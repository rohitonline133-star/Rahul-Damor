import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { addCartItem, createShopOrder } from '../src/server/repositories/commerce';

const enabled=Boolean(process.env.DATABASE_URL);
const pool=enabled?new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:true}}):null;
after(async()=>{if(pool)await pool.end();});
async function account(client:PoolClient,id:string){
 const username='shop_'+id.replaceAll('-','').slice(0,20);
 await client.query(`INSERT INTO accounts(id,username,username_normalized,password_hash,password_salt) VALUES($1,$2,$2,'test-hash','test-salt')`,[id,username]);
}
async function product(client:PoolClient,id:string,sellerId:string,stock:number,price:number){
 await client.query(`INSERT INTO shop_products(id,seller_id,name,currency,unit_amount_minor,stock_quantity) VALUES($1,$2,'Integration item','INR',$3,$4)`,[id,sellerId,price,stock]);
}
const address={fullName:'Integration Buyer',address:'Test Street 1',city:'Vadodara',postalCode:'390001',country:'India'};

test('PostgreSQL commerce integration: cart and order atomically reserve stock and publish outbox event',{skip:!enabled},async()=>{
 const client=await pool!.connect();const seller=randomUUID(),buyer=randomUUID(),pid=randomUUID(),orderId=randomUUID();
 try{
  await client.query('BEGIN');await account(client,seller);await account(client,buyer);await product(client,pid,seller,7,1250);
  assert.equal(await addCartItem(client,{userId:buyer,productId:pid,quantity:2}),true);
  const cart=await client.query('SELECT quantity FROM shop_cart_items WHERE user_id=$1 AND product_id=$2',[buyer,pid]);
  assert.equal(cart.rows[0].quantity,2);
  const order=await createShopOrder(client,{id:orderId,userId:buyer,items:[{productId:pid,quantity:2}],shippingMinor:100,shippingAddress:address});
  assert.deepEqual(order,{id:orderId,currency:'INR',subtotalMinor:2500,shippingMinor:100,totalMinor:2600,itemCount:1});
  const stock=await client.query('SELECT stock_quantity FROM shop_products WHERE id=$1',[pid]);
  const line=await client.query('SELECT product_name,quantity,unit_amount_minor FROM shop_order_items WHERE order_id=$1',[orderId]);
  const outbox=await client.query("SELECT payload FROM event_outbox WHERE aggregate_type='shop_order' AND aggregate_id=$1",[orderId]);
  const remaining=await client.query('SELECT 1 FROM shop_cart_items WHERE user_id=$1 AND product_id=$2',[buyer,pid]);
  assert.equal(Number(stock.rows[0].stock_quantity),5);
  assert.deepEqual(line.rows[0],{product_name:'Integration item',quantity:2,unit_amount_minor:'1250'});
  assert.equal(outbox.rowCount,1);assert.equal(outbox.rows[0].payload.totalMinor,2600);
  assert.equal(remaining.rowCount,0);
  await client.query('ROLLBACK');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

test('PostgreSQL commerce integration: failed order leaves inventory unchanged after rollback',{skip:!enabled},async()=>{
 const client=await pool!.connect();const seller=randomUUID(),buyer=randomUUID(),pid=randomUUID(),orderId=randomUUID();
 try{
  await client.query('BEGIN');await account(client,seller);await account(client,buyer);await product(client,pid,seller,1,500);
  await assert.rejects(()=>createShopOrder(client,{id:orderId,userId:buyer,items:[{productId:pid,quantity:2}],shippingAddress:address}),/Insufficient stock/);
  const stock=await client.query('SELECT stock_quantity FROM shop_products WHERE id=$1',[pid]);
  const orders=await client.query('SELECT 1 FROM shop_orders WHERE id=$1',[orderId]);
  assert.equal(Number(stock.rows[0].stock_quantity),1);assert.equal(orders.rowCount,0);
  await client.query('ROLLBACK');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

test('PostgreSQL commerce integration: payment attempts and transactions cannot cross order ownership',{skip:!enabled},async()=>{
 const client=await pool!.connect();const seller=randomUUID(),buyer=randomUUID(),other=randomUUID(),pid=randomUUID(),orderId=randomUUID();
 try{
  await client.query('BEGIN');
  await account(client,seller);await account(client,buyer);await account(client,other);
  await product(client,pid,seller,3,1500);
  await createShopOrder(client,{id:orderId,userId:buyer,items:[{productId:pid,quantity:1}],shippingAddress:address});
  await client.query('SAVEPOINT reject_wrong_payment_attempt');
  await assert.rejects(()=>client.query(`INSERT INTO shop_payment_attempts
   (id,order_id,user_id,provider,provider_order_id,amount_minor,currency)
   VALUES($1,$2,$3,'razorpay',$4,1500,'INR')`,[randomUUID(),orderId,other,'order_'+randomUUID().replaceAll('-','')]),/foreign key/i);
  await client.query('ROLLBACK TO SAVEPOINT reject_wrong_payment_attempt');
  await client.query('RELEASE SAVEPOINT reject_wrong_payment_attempt');
  await client.query('SAVEPOINT reject_wrong_payment_transaction');
  await assert.rejects(()=>client.query(`INSERT INTO payment_transactions
   (id,user_id,order_id,provider,transaction_type,amount_minor,currency,status)
   VALUES($1,$2,$3,'razorpay','shop_purchase',1500,'INR','pending')`,[randomUUID(),other,orderId]),/foreign key/i);
  await client.query('ROLLBACK TO SAVEPOINT reject_wrong_payment_transaction');
  await client.query('RELEASE SAVEPOINT reject_wrong_payment_transaction');
  const valid=await client.query(`INSERT INTO shop_payment_attempts
   (id,order_id,user_id,provider,provider_order_id,amount_minor,currency)
   VALUES($1,$2,$3,'razorpay',$4,1500,'INR') RETURNING id`,
   [randomUUID(),orderId,buyer,'order_'+randomUUID().replaceAll('-','')]);
  assert.equal(valid.rowCount,1);
  await client.query('ROLLBACK');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});
