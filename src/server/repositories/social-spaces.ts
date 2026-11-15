import type { PoolClient } from 'pg';
import { insertOutboxEvent } from '../outbox';

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const KEY = /^[A-Za-z0-9_.:-]{8,160}$/;
function requireId(value: string, label: string): void {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error(`Invalid ${label}.`);
}
function requireText(value: string, label: string, max: number): void {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > max) {
    throw new Error(`Invalid ${label}.`);
  }
}

export async function createGroup(client: PoolClient, input: {
  id: string; ownerId: string; name: string; description?: string; memberIds?: string[];
}): Promise<{ id: string }> {
  requireId(input.id, 'group ID'); requireId(input.ownerId, 'owner ID');
  requireText(input.name, 'group name', 120);
  const description = input.description ?? '';
  if (description.length > 2000) throw new Error('Invalid group description.');
  const members = [...new Set([input.ownerId, ...(input.memberIds ?? [])])];
  if (members.length > 500) throw new Error('Too many group members.');
  members.forEach(id => requireId(id, 'member ID'));
  await client.query(`INSERT INTO conversations (id, conversation_type, metadata)
    VALUES ($1, 'group', $2::jsonb)`, [input.id, JSON.stringify({ name: input.name })]);
  await client.query(`INSERT INTO groups (id, name, description, created_by)
    VALUES ($1,$2,$3,$4)`, [input.id, input.name.trim(), description, input.ownerId]);
  for (const userId of members) {
    await client.query(`INSERT INTO conversation_members (conversation_id,user_id,role)
      VALUES ($1,$2,$3)`, [input.id, userId, userId === input.ownerId ? 'owner' : 'member']);
    await client.query(`INSERT INTO group_member_settings (conversation_id,user_id)
      VALUES ($1,$2)`, [input.id, userId]);
  }
  await insertOutboxEvent(client, { aggregateType:'group', aggregateId:input.id,
    eventType:'created', partitionKey:input.id,
    payload:{ groupId:input.id, ownerId:input.ownerId, memberCount:members.length } });
  return { id: input.id };
}

export async function addGroupMember(client: PoolClient, input: {
  groupId: string; actorId: string; userId: string;
}): Promise<boolean> {
  requireId(input.groupId,'group ID'); requireId(input.actorId,'actor ID'); requireId(input.userId,'user ID');
  const result = await client.query(`INSERT INTO conversation_members (conversation_id,user_id,role)
    SELECT g.id,$3,'member' FROM groups g
    JOIN conversation_members actor ON actor.conversation_id=g.id AND actor.user_id=$2
      AND actor.role IN ('owner','admin')
    WHERE g.id=$1
      AND (NOT EXISTS (SELECT 1 FROM community_groups linked WHERE linked.group_id=g.id)
        OR EXISTS (SELECT 1 FROM community_groups linked
          JOIN community_members cm ON cm.community_id=linked.community_id AND cm.user_id=$3
          WHERE linked.group_id=g.id))
    ON CONFLICT (conversation_id,user_id) DO NOTHING RETURNING user_id`,
    [input.groupId,input.actorId,input.userId]);
  if (!result.rows[0]) return false;
  await client.query(`INSERT INTO group_member_settings (conversation_id,user_id) VALUES ($1,$2)`,
    [input.groupId,input.userId]);
  await insertOutboxEvent(client,{aggregateType:'group',aggregateId:input.groupId,
    eventType:'member_added',partitionKey:input.groupId,
    payload:{groupId:input.groupId,userId:input.userId,actorId:input.actorId}});
  return true;
}

export async function createCommunity(client: PoolClient, input: {
  id:string; slug:string; name:string; description?:string; visibility?:'public'|'private'; ownerId:string;
}): Promise<{id:string}> {
  requireId(input.id,'community ID'); requireId(input.ownerId,'owner ID');
  requireText(input.name,'community name',120);
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(input.slug)) throw new Error('Invalid community slug.');
  const description=input.description ?? '';
  if(description.length>4000) throw new Error('Invalid community description.');
  const visibility=input.visibility ?? 'public';
  if(visibility!=='public' && visibility!=='private') throw new Error('Invalid community visibility.');
  await client.query(`INSERT INTO communities (id,slug,name,description,visibility,owner_id)
    VALUES ($1,$2,$3,$4,$5,$6)`,[input.id,input.slug,input.name.trim(),description,visibility,input.ownerId]);
  await client.query(`INSERT INTO community_members (community_id,user_id,role)
    VALUES ($1,$2,'owner')`,[input.id,input.ownerId]);
  await insertOutboxEvent(client,{aggregateType:'community',aggregateId:input.id,
    eventType:'created',partitionKey:input.id,
    payload:{communityId:input.id,ownerId:input.ownerId,visibility}});
  return {id:input.id};
}

export async function joinCommunity(client: PoolClient,input:{
  communityId:string;userId:string;
}):Promise<boolean>{
  requireId(input.communityId,'community ID'); requireId(input.userId,'user ID');
  const result=await client.query(`INSERT INTO community_members (community_id,user_id,role)
    SELECT c.id,$2,'member' FROM communities c
    WHERE c.id=$1 AND (c.visibility='public' OR EXISTS (
      SELECT 1 FROM community_members existing WHERE existing.community_id=c.id AND existing.user_id=$2))
    ON CONFLICT (community_id,user_id) DO NOTHING RETURNING user_id`,
    [input.communityId,input.userId]);
  if(!result.rows[0]) return false;
  await insertOutboxEvent(client,{aggregateType:'community',aggregateId:input.communityId,
    eventType:'member_joined',partitionKey:input.communityId,
    payload:{communityId:input.communityId,userId:input.userId}});
  return true;
}

export async function createNotification(client:PoolClient,input:{
  id:string;userId:string;actorId?:string|null;type:string;idempotencyKey:string;payload?:Record<string,unknown>;
}):Promise<{id:string;duplicate:boolean}>{
  requireId(input.id,'notification ID'); requireId(input.userId,'recipient ID');
  if(input.actorId) requireId(input.actorId,'actor ID');
  if(!/^[a-z][a-z0-9_.-]{1,63}$/.test(input.type)) throw new Error('Invalid notification type.');
  if(typeof input.idempotencyKey!=='string'||!KEY.test(input.idempotencyKey)) throw new Error('Invalid notification idempotency key.');
  const payload=input.payload ?? {};
  if(!payload || typeof payload!=='object'||Array.isArray(payload)||Buffer.byteLength(JSON.stringify(payload),'utf8')>16*1024)
    throw new Error('Invalid notification payload.');
  const inserted=await client.query<{id:string}>(`INSERT INTO user_notifications
    (id,user_id,actor_id,notification_type,payload,idempotency_key)
    VALUES ($1,$2,$3,$4,$5::jsonb,$6)
    ON CONFLICT (user_id,idempotency_key) DO NOTHING RETURNING id`,
    [input.id,input.userId,input.actorId ?? null,input.type,JSON.stringify(payload),input.idempotencyKey]);
  if(!inserted.rows[0]){
    const existing=await client.query<{id:string}>(`SELECT id FROM user_notifications
      WHERE user_id=$1 AND idempotency_key=$2`,[input.userId,input.idempotencyKey]);
    if(existing.rows[0]) return {id:existing.rows[0].id,duplicate:true};
    throw new Error('Notification could not be persisted.');
  }
  await insertOutboxEvent(client,{aggregateType:'notification',aggregateId:input.id,
    eventType:'created',partitionKey:input.userId,
    payload:{notificationId:input.id,userId:input.userId,type:input.type}});
  return {id:input.id,duplicate:false};
}

export async function markNotificationRead(client:PoolClient,input:{
  notificationId:string;userId:string;
}):Promise<boolean>{
  requireId(input.notificationId,'notification ID'); requireId(input.userId,'user ID');
  const result=await client.query(`UPDATE user_notifications SET read_at=COALESCE(read_at,now())
    WHERE id=$1 AND user_id=$2 RETURNING id`,[input.notificationId,input.userId]);
  return Boolean(result.rows[0]);
}

export type NotificationPage = {
  items: Array<{id:string;actorId:string|null;type:string;payload:Record<string,unknown>;createdAt:string;readAt:string|null}>;
  nextCursor: string|null;
};
export async function listNotifications(client:PoolClient,input:{
  userId:string;limit?:number;before?:{createdAt:string;id:string};
}):Promise<NotificationPage>{
  requireId(input.userId,'user ID');
  const limit=input.limit ?? 30;
  if(!Number.isInteger(limit)||limit<1||limit>100) throw new Error('Invalid notification page size.');
  if(input.before){
    requireId(input.before.id,'notification cursor ID');
    if(Number.isNaN(Date.parse(input.before.createdAt))) throw new Error('Invalid notification cursor timestamp.');
  }
  const result=await client.query<{
    id:string;actor_id:string|null;notification_type:string;payload:Record<string,unknown>;
    created_at:Date|string;read_at:Date|string|null;
  }>(`SELECT id,actor_id,notification_type,payload,created_at,read_at
    FROM user_notifications
    WHERE user_id=$1 AND ($2::timestamptz IS NULL OR (created_at,id)<($2::timestamptz,$3::text))
    ORDER BY created_at DESC,id DESC LIMIT $4`,
    [input.userId,input.before?.createdAt ?? null,input.before?.id ?? null,limit+1]);
  const hasMore=result.rows.length>limit;
  const rows=result.rows.slice(0,limit);
  const items=rows.map(row=>({
    id:row.id,actorId:row.actor_id,type:row.notification_type,payload:row.payload,
    createdAt:row.created_at instanceof Date?row.created_at.toISOString():row.created_at,
    readAt:row.read_at instanceof Date?row.read_at.toISOString():row.read_at
  }));
  const last=items[items.length-1];
  return {items,nextCursor:hasMore&&last?JSON.stringify({createdAt:last.createdAt,id:last.id}):null};
}
export async function markAllNotificationsRead(client:PoolClient,input:{userId:string}):Promise<number>{
  requireId(input.userId,'user ID');
  const result=await client.query(`UPDATE user_notifications SET read_at=now()
    WHERE user_id=$1 AND read_at IS NULL RETURNING id`,[input.userId]);
  return result.rowCount ?? result.rows.length;
}

export async function requestCommunityJoin(client:PoolClient,input:{
  communityId:string;userId:string;
}):Promise<'joined'|'requested'|'already_member'>{
  requireId(input.communityId,'community ID'); requireId(input.userId,'user ID');
  const result=await client.query<{visibility:string;member_id:string|null}>(`SELECT c.visibility,
    (SELECT cm.user_id FROM community_members cm WHERE cm.community_id=c.id AND cm.user_id=$2) AS member_id
    FROM communities c WHERE c.id=$1 FOR SHARE`,[input.communityId,input.userId]);
  const community=result.rows[0];
  if(!community) throw new Error('Community not found.');
  if(community.member_id) return 'already_member';
  if(community.visibility==='public'){
    const joined=await joinCommunity(client,input);
    return joined?'joined':'already_member';
  }
  const pending=await client.query(`INSERT INTO community_join_requests(community_id,user_id,status)
    VALUES($1,$2,'pending') ON CONFLICT(community_id,user_id) DO UPDATE
    SET status='pending',requested_at=now(),reviewed_at=NULL,reviewed_by=NULL
    WHERE community_join_requests.status IN ('rejected','cancelled')
    RETURNING user_id`,[input.communityId,input.userId]);
  if(pending.rows[0]){
    await insertOutboxEvent(client,{aggregateType:'community',aggregateId:input.communityId,
      eventType:'join_requested',partitionKey:input.communityId,
      payload:{communityId:input.communityId,userId:input.userId}});
  }
  return 'requested';
}
export async function reviewCommunityJoinRequest(client:PoolClient,input:{
  communityId:string;actorId:string;userId:string;decision:'approved'|'rejected';
}):Promise<boolean>{
  requireId(input.communityId,'community ID'); requireId(input.actorId,'moderator ID'); requireId(input.userId,'user ID');
  if(input.decision!=='approved'&&input.decision!=='rejected') throw new Error('Invalid community join decision.');
  const reviewed=await client.query<{user_id:string}>(`UPDATE community_join_requests r
    SET status=$4,reviewed_at=now(),reviewed_by=$2
    WHERE r.community_id=$1 AND r.user_id=$3 AND r.status='pending'
      AND EXISTS(SELECT 1 FROM community_members moderator
        WHERE moderator.community_id=r.community_id AND moderator.user_id=$2
          AND moderator.role IN ('owner','moderator'))
    RETURNING r.user_id`,[input.communityId,input.actorId,input.userId,input.decision]);
  if(!reviewed.rows[0]) return false;
  if(input.decision==='approved'){
    await client.query(`INSERT INTO community_members(community_id,user_id,role)
      VALUES($1,$2,'member') ON CONFLICT(community_id,user_id) DO NOTHING`,
      [input.communityId,input.userId]);
  }
  await insertOutboxEvent(client,{aggregateType:'community',aggregateId:input.communityId,
    eventType:input.decision==='approved'?'member_joined':'join_rejected',
    partitionKey:input.communityId,payload:{communityId:input.communityId,userId:input.userId,actorId:input.actorId}});
  return true;
}


/** Link an existing group to a community. The actor must administer both spaces. */
export async function linkGroupToCommunity(client:PoolClient,input:{
  communityId:string;groupId:string;actorId:string;
}):Promise<boolean>{
  requireId(input.communityId,'community ID');requireId(input.groupId,'group ID');requireId(input.actorId,'actor ID');
  const result=await client.query(`INSERT INTO community_groups(community_id,group_id,created_by)
    SELECT c.id::text,g.id::text,$3::text FROM communities c
    JOIN groups g ON g.id=$2::text
    JOIN community_members cm ON cm.community_id=c.id AND cm.user_id=$3::text AND cm.role IN ('owner','moderator')
    JOIN conversation_members gm ON gm.conversation_id=g.id AND gm.user_id=$3::text AND gm.role IN ('owner','admin')
    WHERE c.id=$1::text
    ON CONFLICT(community_id,group_id) DO NOTHING RETURNING group_id`,
    [input.communityId,input.groupId,input.actorId]);
  if(!result.rows[0])return false;
  await insertOutboxEvent(client,{aggregateType:'community',aggregateId:input.communityId,
    eventType:'group_linked',partitionKey:input.communityId,
    payload:{communityId:input.communityId,groupId:input.groupId,actorId:input.actorId}});
  return true;
}

/** Community members can join only groups explicitly linked to that community. */
export async function joinCommunityGroup(client:PoolClient,input:{
  communityId:string;groupId:string;userId:string;
}):Promise<boolean>{
  requireId(input.communityId,'community ID');requireId(input.groupId,'group ID');requireId(input.userId,'user ID');
  const result=await client.query(`INSERT INTO conversation_members(conversation_id,user_id,role)
    SELECT cg.group_id,$3,'member' FROM community_groups cg
    JOIN community_members cm ON cm.community_id=cg.community_id AND cm.user_id=$3
    WHERE cg.community_id=$1 AND cg.group_id=$2
    ON CONFLICT(conversation_id,user_id) DO NOTHING RETURNING user_id`,
    [input.communityId,input.groupId,input.userId]);
  if(!result.rows[0])return false;
  await client.query('INSERT INTO group_member_settings(conversation_id,user_id) VALUES($1,$2)',
    [input.groupId,input.userId]);
  await insertOutboxEvent(client,{aggregateType:'group',aggregateId:input.groupId,
    eventType:'member_joined',partitionKey:input.groupId,
    payload:{groupId:input.groupId,userId:input.userId,communityId:input.communityId}});
  return true;
}
