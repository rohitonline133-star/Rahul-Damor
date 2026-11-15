import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createStatus, requestFollow, reviewFollowRequest, blockUser } from '../src/server/repositories/social-graph';
import { createGroup, createCommunity, linkGroupToCommunity, joinCommunityGroup, addGroupMember } from '../src/server/repositories/social-spaces';
import { updatePrivacySettings, canViewLastSeen, canViewProfilePhoto, shouldSendReadReceipt, muteUser, isUserMuted, unmuteUser } from '../src/server/repositories/privacy';

const enabled = Boolean(process.env.DATABASE_URL);
const pool = enabled ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: true } }) : null;
after(async()=>{ if(pool) await pool.end(); });
async function fixture(client: import('pg').PoolClient, id: string, username: string) {
  await client.query(`INSERT INTO accounts(id,username,username_normalized,password_hash,password_salt)
    VALUES($1,$2,$2,'hash','salt')`,[id,username]);
}
test('PostgreSQL integration: selected status audience and outbox commit atomically',{skip:!enabled},async()=>{
 const client=await pool!.connect(); const a=randomUUID(),b=randomUUID(),s=randomUUID();
 try { await client.query('BEGIN'); await fixture(client,a,'it_'+a.replaceAll('-','').slice(0,20)); await fixture(client,b,'it_'+b.replaceAll('-','').slice(0,20));
  await createStatus(client,{id:s,userId:a,type:'text',content:'integration',audience:'selected',selectedUserIds:[b],expiresAt:new Date(Date.now()+60*60*1000).toISOString()});
  const audience=await client.query('SELECT user_id FROM status_audience_members WHERE status_id=$1',[s]);
  const event=await client.query("SELECT event_id FROM event_outbox WHERE aggregate_type='status' AND aggregate_id=$1",[s]);
  assert.deepEqual(audience.rows.map(x=>x.user_id),[b]); assert.equal(event.rowCount,1);
  await client.query('ROLLBACK');
 } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
});
test('PostgreSQL integration: private follow approval and block cleanup',{skip:!enabled},async()=>{
 const client=await pool!.connect(); const a=randomUUID(),b=randomUUID(),requestId=randomUUID();
 try { await client.query('BEGIN'); await fixture(client,a,'it_'+a.replaceAll('-','').slice(0,20)); await fixture(client,b,'it_'+b.replaceAll('-','').slice(0,20));
  await client.query('INSERT INTO user_profiles(user_id,is_private) VALUES($1,true)',[b]);
  assert.equal(await requestFollow(client,{requestId,requesterId:a,targetUserId:b}),'requested');
  assert.equal(await reviewFollowRequest(client,{requesterId:a,targetUserId:b,decision:'accepted'}),true);
  const edge=await client.query("SELECT status FROM follows WHERE follower_id=$1 AND following_id=$2",[a,b]);
  assert.equal(edge.rows[0]?.status,'accepted');
  assert.equal(await blockUser(client,{blockerId:a,blockedId:b}),true);
  const remaining=await client.query('SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=$2',[a,b]);
  assert.equal(remaining.rowCount,0);
  await client.query('ROLLBACK');
 } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
});

test('PostgreSQL integration: privacy visibility respects mutual follows and blocks',{skip:!enabled},async()=>{
 const client=await pool!.connect(); const owner=randomUUID(),viewer=randomUUID();
 try {
  await client.query('BEGIN');
  await fixture(client,owner,'it_'+owner.replaceAll('-','').slice(0,20));
  await fixture(client,viewer,'it_'+viewer.replaceAll('-','').slice(0,20));
  await client.query('INSERT INTO user_profiles(user_id) VALUES($1),($2)',[owner,viewer]);
  await updatePrivacySettings(client,{userId:owner,settings:{lastSeenVisibility:'contacts',profilePhotoVisibility:'contacts',statusVisibility:'contacts',readReceiptsEnabled:true}});
  assert.equal(await canViewLastSeen(client,{ownerId:owner,viewerId:viewer}),false);
  await client.query("INSERT INTO follows(follower_id,following_id,status) VALUES($1,$2,'accepted'),($2,$1,'accepted')",[owner,viewer]);
  assert.equal(await canViewLastSeen(client,{ownerId:owner,viewerId:viewer}),true);
  assert.equal(await canViewProfilePhoto(client,{ownerId:owner,viewerId:viewer}),true);
  assert.equal(await shouldSendReadReceipt(client,owner),true);
  await client.query('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)',[owner,viewer]);
  assert.equal(await canViewLastSeen(client,{ownerId:owner,viewerId:viewer}),false);
  await updatePrivacySettings(client,{userId:owner,settings:{lastSeenVisibility:'nobody',profilePhotoVisibility:'nobody',statusVisibility:'selected',readReceiptsEnabled:false}});
  assert.equal(await shouldSendReadReceipt(client,owner),false);
  await client.query('ROLLBACK');
 } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
});
test('PostgreSQL integration: mute state is owner-scoped and reversible',{skip:!enabled},async()=>{
 const client=await pool!.connect(); const muter=randomUUID(),muted=randomUUID();
 try {
  await client.query('BEGIN');
  await fixture(client,muter,'it_'+muter.replaceAll('-','').slice(0,20));
  await fixture(client,muted,'it_'+muted.replaceAll('-','').slice(0,20));
  assert.equal(await muteUser(client,{muterId:muter,mutedId:muted}),true);
  assert.equal(await isUserMuted(client,{muterId:muter,mutedId:muted}),true);
  assert.equal(await isUserMuted(client,{muterId:muted,mutedId:muter}),false);
  assert.equal(await unmuteUser(client,{muterId:muter,mutedId:muted}),true);
  assert.equal(await isUserMuted(client,{muterId:muter,mutedId:muted}),false);
  await client.query('ROLLBACK');
 } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
});

test('PostgreSQL integration: community-linked group enforces community membership',{skip:!enabled},async()=>{
 const client=await pool!.connect();
 const owner=randomUUID(),member=randomUUID(),outsider=randomUUID(),communityId=randomUUID(),otherCommunityId=randomUUID(),groupId=randomUUID();
 try{
  await client.query('BEGIN');
  await fixture(client,owner,'it_'+owner.replaceAll('-','').slice(0,20));
  await fixture(client,member,'it_'+member.replaceAll('-','').slice(0,20));
  await fixture(client,outsider,'it_'+outsider.replaceAll('-','').slice(0,20));
  await createCommunity(client,{id:communityId,slug:'c-'+communityId.replaceAll('-','').slice(0,20),name:'Integration community',ownerId:owner});
  await createCommunity(client,{id:otherCommunityId,slug:'c-'+otherCommunityId.replaceAll('-','').slice(0,20),name:'Second integration community',ownerId:owner});
  await createGroup(client,{id:groupId,ownerId:owner,name:'Integration group'});
  await client.query("INSERT INTO community_members(community_id,user_id,role) VALUES($1,$2,'member')",[communityId,member]);
  assert.equal(await linkGroupToCommunity(client,{communityId,groupId,actorId:owner}),true);
  assert.equal(await linkGroupToCommunity(client,{communityId:otherCommunityId,groupId,actorId:owner}),true);
  assert.equal(await joinCommunityGroup(client,{communityId,groupId,userId:member}),true);
  assert.equal(await joinCommunityGroup(client,{communityId:otherCommunityId,groupId,userId:outsider}),false);
  assert.equal(await joinCommunityGroup(client,{communityId,groupId,userId:outsider}),false);
  assert.equal(await addGroupMember(client,{groupId,actorId:owner,userId:outsider}),false);
  await client.query("INSERT INTO community_members(community_id,user_id,role) VALUES($1,$2,'member')",[communityId,outsider]);
  assert.equal(await addGroupMember(client,{groupId,actorId:owner,userId:outsider}),true);
  const members=await client.query('SELECT user_id FROM conversation_members WHERE conversation_id=$1 ORDER BY user_id',[groupId]);
  assert.deepEqual(members.rows.map(row=>row.user_id).sort(),[owner,member,outsider].sort());
  await client.query('ROLLBACK');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});
