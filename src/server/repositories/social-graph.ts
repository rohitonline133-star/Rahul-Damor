import type { PoolClient } from 'pg';
import { insertOutboxEvent } from '../outbox';

const ID=/^[A-Za-z0-9_-]{1,128}$/;
function validId(value:string,label:string){if(typeof value!=='string'||!ID.test(value))throw new Error(`Invalid ${label}.`);}
export async function blockUser(client:PoolClient,input:{blockerId:string;blockedId:string}):Promise<boolean>{
 validId(input.blockerId,'blocker ID');validId(input.blockedId,'blocked ID');
 if(input.blockerId===input.blockedId)throw new Error('Cannot block yourself.');
 const r=await client.query(`INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)
 ON CONFLICT DO NOTHING RETURNING blocker_id`,[input.blockerId,input.blockedId]);
 if(!r.rows[0])return false;
 await client.query(`DELETE FROM follows WHERE (follower_id=$1 AND following_id=$2) OR (follower_id=$2 AND following_id=$1)`,[input.blockerId,input.blockedId]);
 await client.query(`DELETE FROM follow_requests WHERE (requester_id=$1 AND target_user_id=$2) OR (requester_id=$2 AND target_user_id=$1)`,[input.blockerId,input.blockedId]);
 await insertOutboxEvent(client,{aggregateType:'user_block',aggregateId:input.blockerId,eventType:'created',partitionKey:input.blockerId,payload:{blockerId:input.blockerId,blockedId:input.blockedId}});
 return true;
}
export async function unblockUser(client:PoolClient,input:{blockerId:string;blockedId:string}):Promise<boolean>{
 validId(input.blockerId,'blocker ID');validId(input.blockedId,'blocked ID');
 const r=await client.query(`DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2 RETURNING blocker_id`,[input.blockerId,input.blockedId]);
 if(!r.rows[0])return false;
 await insertOutboxEvent(client,{aggregateType:'user_block',aggregateId:input.blockerId,eventType:'removed',partitionKey:input.blockerId,payload:{blockerId:input.blockerId,blockedId:input.blockedId}});
 return true;
}
export async function createStatus(client:PoolClient,input:{
 id:string;userId:string;type:'text'|'image'|'video';content:string;caption?:string;mediaRef?:string;
 audience?:'everyone'|'contacts'|'selected';selectedUserIds?:string[];expiresAt:string;
}):Promise<{id:string}>{
 validId(input.id,'status ID');validId(input.userId,'user ID');
 if(!['text','image','video'].includes(input.type)||typeof input.content!=='string'||input.content.length>10000)throw new Error('Invalid status content.');
 const audience=input.audience??'everyone';
 if(!['everyone','contacts','selected'].includes(audience))throw new Error('Invalid status audience.');
 const selected=[...new Set(input.selectedUserIds??[])];
 if(audience==='selected'&&(selected.length===0||selected.length>500))throw new Error('Selected audience must contain 1 to 500 users.');
 selected.forEach(id=>validId(id,'audience user ID'));
 if(selected.includes(input.userId))throw new Error('Status audience must not include its owner.');
 if(audience!=='selected'&&selected.length)throw new Error('Selected users require selected audience.');
 const expiry=Date.parse(input.expiresAt);
 if(!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+24*60*60*1000)throw new Error('Status expiry must be within 24 hours.');
 await client.query(`INSERT INTO user_statuses(id,user_id,status_type,content,caption,media_ref,audience,expires_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[input.id,input.userId,input.type,input.content,input.caption??'',input.mediaRef??null,audience,input.expiresAt]);
 for(const userId of selected)await client.query(`INSERT INTO status_audience_members(status_id,user_id) VALUES($1,$2)`,[input.id,userId]);
 await insertOutboxEvent(client,{aggregateType:'status',aggregateId:input.id,eventType:'created',partitionKey:input.userId,payload:{statusId:input.id,userId:input.userId,audience}});
 return {id:input.id};
}
export async function recordStatusView(client:PoolClient,input:{statusId:string;viewerId:string}):Promise<boolean>{
 validId(input.statusId,'status ID');validId(input.viewerId,'viewer ID');
 const r=await client.query(`INSERT INTO status_views(status_id,viewer_id)
 SELECT s.id,$2 FROM user_statuses s
 WHERE s.id=$1 AND s.deleted_at IS NULL AND s.expires_at>now()
 AND (s.user_id=$2 OR (
   NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=s.user_id AND b.blocked_id=$2) OR (b.blocker_id=$2 AND b.blocked_id=s.user_id))
   AND (
     COALESCE((SELECT ps.status_visibility FROM user_privacy_settings ps WHERE ps.user_id=s.user_id),'everyone')='everyone'
     OR (COALESCE((SELECT ps.status_visibility FROM user_privacy_settings ps WHERE ps.user_id=s.user_id),'everyone')='contacts'
       AND EXISTS(SELECT 1 FROM follows f1 JOIN follows f2 ON f1.follower_id=f2.following_id AND f1.following_id=f2.follower_id WHERE f1.follower_id=$2 AND f1.following_id=s.user_id AND f1.status='accepted' AND f2.status='accepted'))
     OR (COALESCE((SELECT ps.status_visibility FROM user_privacy_settings ps WHERE ps.user_id=s.user_id),'everyone')='selected'
       AND s.audience='selected' AND EXISTS(SELECT 1 FROM status_audience_members a WHERE a.status_id=s.id AND a.user_id=$2))
   )
   AND (s.audience='everyone'
     OR (s.audience='contacts' AND EXISTS(SELECT 1 FROM follows f1 JOIN follows f2 ON f1.follower_id=f2.following_id AND f1.following_id=f2.following_id WHERE f1.follower_id=$2 AND f1.following_id=s.user_id AND f1.status='accepted' AND f2.status='accepted'))
     OR (s.audience='selected' AND EXISTS(SELECT 1 FROM status_audience_members a WHERE a.status_id=s.id AND a.user_id=$2))
   )
 ))
 ON CONFLICT(status_id,viewer_id) DO NOTHING RETURNING status_id`,[input.statusId,input.viewerId]);
 return Boolean(r.rows[0]);
}
export async function submitModerationReport(client:PoolClient,input:{
 id:string;reporterId:string;targetType:'user'|'message'|'group'|'status'|'media'|'post'|'community';
 targetId:string;category:'spam'|'harassment'|'impersonation'|'copyright'|'illegal'|'other';description?:string;
}):Promise<{id:string}>{
 validId(input.id,'report ID');validId(input.reporterId,'reporter ID');validId(input.targetId,'target ID');
 if(!['user','message','group','status','media','post','community'].includes(input.targetType))throw new Error('Invalid report target.');
 if(!['spam','harassment','impersonation','copyright','illegal','other'].includes(input.category))throw new Error('Invalid report category.');
 const description=input.description??'';
 if(description.length>4000)throw new Error('Report description is too long.');
 await client.query(`INSERT INTO moderation_reports(id,reporter_id,target_type,target_id,category,description)
 VALUES($1,$2,$3,$4,$5,$6)`,[input.id,input.reporterId,input.targetType,input.targetId,input.category,description]);
 await insertOutboxEvent(client,{aggregateType:'moderation_report',aggregateId:input.id,eventType:'submitted',partitionKey:'moderation-queue',payload:{reportId:input.id,targetType:input.targetType,category:input.category}});
 return {id:input.id};
}
export async function requestFollow(client:PoolClient,input:{requestId:string;requesterId:string;targetUserId:string}):Promise<'followed'|'requested'|'already_following'>{
 validId(input.requestId,'follow request ID');validId(input.requesterId,'requester ID');validId(input.targetUserId,'target user ID');
 if(input.requesterId===input.targetUserId)throw new Error('Cannot follow yourself.');
 const target=await client.query<{is_private:boolean;exists:boolean}>(`SELECT COALESCE(p.is_private,false) AS is_private,true AS exists
 FROM accounts a LEFT JOIN user_profiles p ON p.user_id=a.id
 WHERE a.id=$2 AND a.account_status='active'
 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=$2) OR (b.blocker_id=$2 AND b.blocked_id=$1))`,
 [input.requesterId,input.targetUserId]);
 if(!target.rows[0])throw new Error('Target account unavailable.');
 const status=target.rows[0].is_private?'pending':'accepted';
 const inserted=await client.query(`INSERT INTO follows(follower_id,following_id,status)
 VALUES($1,$2,$3) ON CONFLICT(follower_id,following_id) DO UPDATE
 SET status=EXCLUDED.status WHERE follows.status='rejected'
 RETURNING status`,[input.requesterId,input.targetUserId,status]);
 if(!inserted.rows[0]){
  const existing=await client.query<{status:string}>(`SELECT status FROM follows WHERE follower_id=$1 AND following_id=$2`,[input.requesterId,input.targetUserId]);
  if(existing.rows[0]?.status==='accepted')return 'already_following';
  if(existing.rows[0]?.status==='pending')return 'requested';
  throw new Error('Follow request could not be created.');
 }
 if(status==='pending')await client.query(`INSERT INTO follow_requests(id,requester_id,target_user_id,status)
 VALUES($1,$2,$3,'pending') ON CONFLICT(requester_id,target_user_id) DO UPDATE
 SET status='pending',created_at=now(),reviewed_at=NULL`,[input.requestId,input.requesterId,input.targetUserId]);
 await insertOutboxEvent(client,{aggregateType:'follow',aggregateId:input.requesterId,eventType:status==='accepted'?'created':'requested',partitionKey:input.targetUserId,payload:{requesterId:input.requesterId,targetUserId:input.targetUserId,status}});
 return status==='accepted'?'followed':'requested';
}
export async function reviewFollowRequest(client:PoolClient,input:{
 requesterId:string;targetUserId:string;decision:'accepted'|'rejected';
}):Promise<boolean>{
 validId(input.requesterId,'requester ID');validId(input.targetUserId,'target user ID');
 if(input.decision!=='accepted'&&input.decision!=='rejected')throw new Error('Invalid follow decision.');
 const result=await client.query(`UPDATE follow_requests r SET status=$3,reviewed_at=now()
 WHERE r.requester_id=$1 AND r.target_user_id=$2 AND r.status='pending'
 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=$2) OR (b.blocker_id=$2 AND b.blocked_id=$1))
 RETURNING r.requester_id`,[input.requesterId,input.targetUserId,input.decision]);
 if(!result.rows[0])return false;
 if(input.decision==='accepted')await client.query(`INSERT INTO follows(follower_id,following_id,status) VALUES($1,$2,'accepted')
 ON CONFLICT(follower_id,following_id) DO UPDATE SET status='accepted'`,[input.requesterId,input.targetUserId]);
 else await client.query(`UPDATE follows SET status='rejected' WHERE follower_id=$1 AND following_id=$2`,[input.requesterId,input.targetUserId]);
 await insertOutboxEvent(client,{aggregateType:'follow',aggregateId:input.requesterId,eventType:input.decision,partitionKey:input.requesterId,payload:{requesterId:input.requesterId,targetUserId:input.targetUserId,decision:input.decision}});
 return true;
}
