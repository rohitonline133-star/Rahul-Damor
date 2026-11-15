import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { listConversationMessages } from '../src/server/repositories/conversations';

function fake(rows: unknown[][]) {
 const calls:Array<{sql:string;values?:unknown[]}> = [];
 const client={query:async(sql:string,values?:unknown[])=>{calls.push({sql,values});return {rows:rows.shift()??[],rowCount:0};}} as unknown as PoolClient;
 return {client,calls};
}

test('message history is member-scoped and paginates on timestamp plus ID',async()=>{
 const {client,calls}=fake([[
  {id:'m3',conversation_id:'c1',sender_id:'u1',body:{text:'3'},created_at:'2026-11-15T10:00:00.000Z',edited_at:null},
  {id:'m2',conversation_id:'c1',sender_id:'u2',body:{text:'2'},created_at:'2026-11-15T10:00:00.000Z',edited_at:null},
  {id:'m1',conversation_id:'c1',sender_id:'u1',body:{text:'1'},created_at:'2026-11-15T09:59:00.000Z',edited_at:null}
 ]]);
 const page=await listConversationMessages(client,{conversationId:'c1',viewerId:'u1',limit:2});
 assert.deepEqual(page.items.map(x=>x.id),['m3','m2']);
 assert.deepEqual(page.nextCursor,{createdAt:'2026-11-15T10:00:00.000Z',id:'m2'});
 assert.match(calls[0].sql,/JOIN conversation_members/);
 assert.match(calls[0].sql,/m.deleted_at IS NULL/);
 assert.deepEqual(calls[0].values,['c1','u1',null,null,3]);
});

test('message history rejects invalid cursor and page bounds before SQL',async()=>{
 const {client,calls}=fake([]);
 await assert.rejects(()=>listConversationMessages(client,{conversationId:'c1',viewerId:'u1',limit:101}));
 await assert.rejects(()=>listConversationMessages(client,{conversationId:'c1',viewerId:'u1',before:{createdAt:'invalid',id:'m1'}}));
 assert.equal(calls.length,0);
});
