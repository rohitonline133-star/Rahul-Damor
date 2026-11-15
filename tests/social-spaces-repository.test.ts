import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { createGroup, addGroupMember, createCommunity, joinCommunity, createNotification, markNotificationRead } from '../src/server/repositories/social-spaces';

function fake(responses: unknown[][]) {
  const calls:Array<{sql:string;values?:unknown[]}>=[];
  const client={query:async(sql:string,values?:unknown[])=>{calls.push({sql,values});const rows=responses.shift()??[];return {rows,rowCount:rows.length};}} as unknown as PoolClient;
  return {client,calls};
}
test('group creation persists conversation, owner/member roles, settings and outbox',async()=>{
  const {client,calls}=fake([[],[],[],[],[],[],[{event_id:'e'}]]);
  const result=await createGroup(client,{id:'g1',ownerId:'u1',name:'Team',memberIds:['u2']});
  assert.deepEqual(result,{id:'g1'}); assert.equal(calls.length,7);
  assert.match(calls[0].sql,/conversation_type/); assert.match(calls[1].sql,/INSERT INTO groups/);
  assert.match(calls[6].sql,/event_outbox/);
});
test('group membership is authorized by owner/admin in SQL',async()=>{
  const {client,calls}=fake([[{user_id:'u2'}],[],[{event_id:'e'}]]);
  assert.equal(await addGroupMember(client,{groupId:'g1',actorId:'u1',userId:'u2'}),true);
  assert.match(calls[0].sql,/actor\.role IN \('owner','admin'\)/); assert.match(calls[2].sql,/event_outbox/);
});
test('community creation persists owner membership and event',async()=>{
  const {client,calls}=fake([[],[],[{event_id:'e'}]]);
  assert.deepEqual(await createCommunity(client,{id:'c1',slug:'community-one',name:'Community',ownerId:'u1'}),{id:'c1'});
  assert.match(calls[1].sql,/community_members/); assert.match(calls[2].sql,/event_outbox/);
});
test('public community join emits event only for new membership',async()=>{
  const {client,calls}=fake([[{user_id:'u2'}],[{event_id:'e'}]]);
  assert.equal(await joinCommunity(client,{communityId:'c1',userId:'u2'}),true);
  assert.match(calls[0].sql,/visibility='public'/); assert.equal(calls.length,2);
});
test('notification idempotency prevents duplicate delivery events',async()=>{
  const {client,calls}=fake([[{id:'n1'}],[{event_id:'e'}]]);
  assert.deepEqual(await createNotification(client,{id:'n1',userId:'u1',type:'message.new',idempotencyKey:'message:12345678'}),{id:'n1',duplicate:false});
  assert.match(calls[1].sql,/event_outbox/);
  const dup=fake([[],[{id:'n1'}]]);
  assert.deepEqual(await createNotification(dup.client,{id:'n2',userId:'u1',type:'message.new',idempotencyKey:'message:12345678'}),{id:'n1',duplicate:true});
  assert.equal(dup.calls.length,2);
});
test('notification read update is recipient scoped',async()=>{
  const {client,calls}=fake([[{id:'n1'}]]);
  assert.equal(await markNotificationRead(client,{notificationId:'n1',userId:'u1'}),true);
  assert.match(calls[0].sql,/WHERE id=\$1 AND user_id=\$2/);
});
test('input validation rejects oversized groups and malformed slugs before SQL',async()=>{
  const a=fake([]); await assert.rejects(()=>createGroup(a.client,{id:'g1',ownerId:'u1',name:'Team',memberIds:Array.from({length:501},(_,i)=>'u'+i)}));
  const b=fake([]); await assert.rejects(()=>createCommunity(b.client,{id:'c1',slug:'INVALID SLUG',name:'X',ownerId:'u1'}));
  assert.equal(a.calls.length+b.calls.length,0);
});
