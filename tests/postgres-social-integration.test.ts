import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createStatus, requestFollow, reviewFollowRequest, blockUser } from '../src/server/repositories/social-graph';

const enabled = Boolean(process.env.DATABASE_URL);
const pool = enabled ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: true } }) : null;
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
test('PostgreSQL integration pool closes cleanly',{skip:!enabled},async()=>{await pool!.query('SELECT 1');});
