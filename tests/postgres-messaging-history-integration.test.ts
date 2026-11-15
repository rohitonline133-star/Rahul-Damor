import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createConversation,sendMessage,listConversationMessages} from '../src/server/repositories/conversations';
const enabled=Boolean(process.env.DATABASE_URL);
const pool=enabled?new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:true}}):null;
after(async()=>{if(pool)await pool.end();});

test('PostgreSQL: message history requires membership and compound cursor has no gaps',{skip:!enabled},async()=>{
 const client=await pool!.connect();const owner=randomUUID(),member=randomUUID(),outsider=randomUUID(),conversationId=randomUUID();
 try{
  await client.query('BEGIN');
  for(const id of [owner,member,outsider]){const username='it_'+id.replaceAll('-','').slice(0,20);await client.query('INSERT INTO accounts(id,username,username_normalized,password_hash,password_salt) VALUES($1,$2,$2,\'hash\',\'salt\')',[id,username]);}
  await createConversation(client,{id:conversationId,ownerId:owner,type:'direct'});
  await client.query("INSERT INTO conversation_members(conversation_id,user_id,role) VALUES($1,$2,'member')",[conversationId,member]);
  for(let i=0;i<3;i++)await sendMessage(client,{id:randomUUID(),conversationId,senderId:i===1?member:owner,clientMessageId:'client_'+randomUUID().replaceAll('-',''),body:{text:'message '+i}});
  const first=await listConversationMessages(client,{conversationId,viewerId:member,limit:2});assert.equal(first.items.length,2);assert.ok(first.nextCursor);
  const second=await listConversationMessages(client,{conversationId,viewerId:member,limit:2,before:first.nextCursor!});assert.equal(second.items.length,1);
  assert.equal(new Set([...first.items,...second.items].map(x=>x.id)).size,3);
  const hidden=await listConversationMessages(client,{conversationId,viewerId:outsider});assert.equal(hidden.items.length,0);
  await client.query('ROLLBACK');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});
