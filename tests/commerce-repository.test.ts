import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {addCartItem,removeCartItem,createShopOrder} from '../src/server/repositories/commerce';

function fake(responses:unknown[][]){const calls:Array<{sql:string;values?:unknown[]}>=[];const client={query:async(sql:string,values?:unknown[])=>{calls.push({sql,values});const rows=responses.shift()??[];return {rows,rowCount:rows.length};}} as unknown as PoolClient;return {client,calls};}

test('cart add only inserts active products with sufficient stock',async()=>{
 const {client,calls}=fake([[],[{product_id:'p1'}],[]]);
 assert.equal(await addCartItem(client,{userId:'u1',productId:'p1',quantity:2}),true);
 assert.match(calls[1].sql,/p\.is_active AND p\.stock_quantity >= \$3/);
 assert.match(calls[1].sql,/quantity\+EXCLUDED\.quantity <= 1000/);
});
test('cart add returns false for unavailable product',async()=>{
 const {client,calls}=fake([[],[]]);
 assert.equal(await addCartItem(client,{userId:'u1',productId:'p1',quantity:1}),false);
 assert.equal(calls.length,2);
});
test('cart remove is scoped to the authenticated owner',async()=>{
 const {client,calls}=fake([[{product_id:'p1'}],[]]);
 assert.equal(await removeCartItem(client,{userId:'u1',productId:'p1'}),true);
 assert.match(calls[0].sql,/WHERE user_id=\$1 AND product_id=\$2/);
});
test('order creation computes totals from locked database prices and snapshots lines',async()=>{
 const {client,calls}=fake([
  [{id:'p1',name:'Item',currency:'INR',unit_amount_minor:'1250',stock_quantity:'8',image_url:null}],
  [{id:'p1'}],[],[],[],[{event_id:'evt'}]
 ]);
 const order=await createShopOrder(client,{id:'o1',userId:'u1',items:[{productId:'p1',quantity:2}],shippingMinor:100,
  shippingAddress:{fullName:'A User',address:'Street 1',city:'Vadodara',postalCode:'390001',country:'India'}});
 assert.deepEqual(order,{id:'o1',currency:'INR',subtotalMinor:2500,shippingMinor:100,totalMinor:2600,itemCount:1});
 assert.match(calls[0].sql,/ORDER BY id FOR UPDATE/);
 assert.match(calls[1].sql,/stock_quantity=stock_quantity-\$2/);
 assert.match(calls[2].sql,/INSERT INTO shop_orders/);
 assert.match(calls[3].sql,/INSERT INTO shop_order_items/);
 assert.match(calls[5].sql,/event_outbox/);
});
test('order rejects unavailable products before writes',async()=>{
 const {client,calls}=fake([[]]);
 await assert.rejects(()=>createShopOrder(client,{id:'o1',userId:'u1',items:[{productId:'p1',quantity:1}],
  shippingAddress:{fullName:'A',address:'B',city:'C',postalCode:'D',country:'E'}}));
 assert.equal(calls.length,1);
});
test('order rejects mixed currencies and insufficient inventory',async()=>{
 const a=fake([[{id:'p1',name:'A',currency:'INR',unit_amount_minor:'10',stock_quantity:'5',image_url:null},
 {id:'p2',name:'B',currency:'USD',unit_amount_minor:'10',stock_quantity:'5',image_url:null}]]);
 await assert.rejects(()=>createShopOrder(a.client,{id:'o1',userId:'u1',items:[{productId:'p1',quantity:1},{productId:'p2',quantity:1}],
 shippingAddress:{fullName:'A',address:'B',city:'C',postalCode:'D',country:'E'}}),/same currency/);
 assert.equal(a.calls.length,1);
 const b=fake([[{id:'p1',name:'A',currency:'INR',unit_amount_minor:'10',stock_quantity:'0',image_url:null}]]);
 await assert.rejects(()=>createShopOrder(b.client,{id:'o1',userId:'u1',items:[{productId:'p1',quantity:1}],
 shippingAddress:{fullName:'A',address:'B',city:'C',postalCode:'D',country:'E'}}),/Insufficient stock/);
 assert.equal(b.calls.length,1);
});
test('invalid addresses and duplicate quantities are rejected before DB access',async()=>{
 const a=fake([]);
 await assert.rejects(()=>createShopOrder(a.client,{id:'o1',userId:'u1',items:[{productId:'p1',quantity:1000},{productId:'p1',quantity:1}],
 shippingAddress:{fullName:'A',address:'B',city:'C',postalCode:'D',country:'E'}}));
 const b=fake([]);
 await assert.rejects(()=>createShopOrder(b.client,{id:'o1',userId:'u1',items:[{productId:'p1',quantity:1}],
 shippingAddress:{fullName:'A'}}));
 assert.equal(a.calls.length+b.calls.length,0);
});
