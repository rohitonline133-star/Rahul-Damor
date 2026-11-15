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
