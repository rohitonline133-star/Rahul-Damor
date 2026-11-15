import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {listActiveProducts,getActiveProduct,listUserCart,listUserOrders,getUserOrder} from '../src/server/repositories/commerce';
function fake(rows:unknown[]){const calls:Array<{sql:string;values?:unknown[]}>=[];const client={query:async(sql:string,values?:unknown[])=>{calls.push({sql,values});return {rows,rowCount:rows.length};}} as unknown as PoolClient;return {client,calls};}
test('product listing is active-only, filtered and keyset paginated',async()=>{
 const {client,calls}=fake([{id:'p1',seller_id:'u1',name:'Item',description:'desc',currency:'INR',unit_amount_minor:'100',category:'books',image_url:null,stock_quantity:'4',created_at:'2026-01-01T00:00:00Z'}]);
 const result=await listActiveProducts(client,{limit:1,category:'books',search:'Item'});
 assert.equal(result.items[0].id,'p1');assert.equal(result.nextCursor,null);
 assert.match(calls[0].sql,/WHERE is_active/);assert.match(calls[0].sql,/created_at,id/);
});
test('product detail and cart reads are parameterized',async()=>{
 const product=fake([{id:'p1',seller_id:'u1',name:'Item',description:'',currency:'INR',unit_amount_minor:'1',category:'',image_url:null,stock_quantity:'3',created_at:'2026-01-01T00:00:00Z'}]);
 assert.equal((await getActiveProduct(product.client,'p1'))?.sellerId,'u1');
 assert.deepEqual(product.calls[0].values,['p1']);
 const cart=fake([{product_id:'p1',seller_id:'u1',name:'Item',currency:'INR',unit_amount_minor:'1',image_url:null,stock_quantity:'3',quantity:2,added_at:'2026-01-01T00:00:00Z'}]);
 assert.equal((await listUserCart(cart.client,'u1'))[0].quantity,2);
 assert.deepEqual(cart.calls[0].values,['u1']);
});
test('order list and detail enforce user ownership in SQL',async()=>{
 const list=fake([{id:'o1',currency:'INR',subtotal_minor:'100',shipping_minor:'0',total_minor:'100',order_status:'pending',payment_status:'pending',created_at:'2026-01-01T00:00:00Z'}]);
 assert.equal((await listUserOrders(list.client,{userId:'u1'})).items[0].id,'o1');
 assert.match(list.calls[0].sql,/WHERE user_id=\$1/);
 const detail=fake([{id:'o1',currency:'INR',subtotal_minor:'100',shipping_minor:'0',total_minor:'100',order_status:'pending',payment_status:'pending',created_at:'2026-01-01T00:00:00Z',item_id:'i1',product_id:'p1',product_name:'Item',quantity:1,unit_amount_minor:'100',image_url:null}]);
 assert.equal((await getUserOrder(detail.client,{userId:'u1',orderId:'o1'}))?.items.length,1);
 assert.deepEqual(detail.calls[0].values,['o1','u1']);
});
test('pagination bounds and cursor validation reject malformed input',async()=>{
 const f=fake([]);
 await assert.rejects(()=>listActiveProducts(f.client,{limit:1000}));
 await assert.rejects(()=>listActiveProducts(f.client,{cursor:'not-base64-json'}));
 await assert.rejects(()=>listUserOrders(f.client,{userId:'u1',limit:0}));
 assert.equal(f.calls.length,0);
});
