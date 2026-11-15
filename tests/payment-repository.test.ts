import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {createRazorpayPaymentAttempt,applyRazorpayPaymentWebhook} from '../src/server/repositories/payments';
function fake(responses:unknown[][]){const calls:Array<{sql:string;values?:unknown[]}>=[];const client={query:async(sql:string,values?:unknown[])=>{calls.push({sql,values});const rows=responses.shift()??[];return {rows,rowCount:rows.length};}} as unknown as PoolClient;return {client,calls};}
test('payment attempt amount and currency must match the authenticated pending order',async()=>{
 const f=fake([[{id:'o1',user_id:'u1',total_minor:'2500',currency:'INR',payment_status:'pending',order_status:'pending'}],[{id:'a1'}]]);
 const row=await createRazorpayPaymentAttempt(f.client,{id:'a1',orderId:'o1',userId:'u1',providerOrderId:'order_123',amountMinor:2500,currency:'INR'});
 assert.equal(row.id,'a1');assert.match(f.calls[0].sql,/FOR UPDATE/);
 const bad=fake([[{id:'o1',user_id:'u1',total_minor:'2500',currency:'INR',payment_status:'pending',order_status:'pending'}]]);
 await assert.rejects(()=>createRazorpayPaymentAttempt(bad.client,{id:'a2',orderId:'o1',userId:'u1',providerOrderId:'order_124',amountMinor:2501,currency:'INR'}),/does not match/);
 assert.equal(bad.calls.length,1);
});
test('captured webhook atomically updates payment, order and outbox',async()=>{
 const f=fake([[{provider_event_id:'evt_1'}],[{id:'a1',order_id:'o1',user_id:'u1',amount_minor:'2500',currency:'INR',status:'pending'}],[{id:'o1',user_id:'u1',total_minor:'2500',currency:'INR',payment_status:'pending',order_status:'pending'}],[],[],[],[],[{event_id:'out1'}],[]]);
 assert.equal(await applyRazorpayPaymentWebhook(f.client,{eventId:'evt_1',eventType:'payment.captured',providerOrderId:'order_123',providerPaymentId:'pay_123',amountMinor:2500,currency:'INR'}),'processed');
 assert.match(f.calls[3].sql,/status='captured'/);assert.match(f.calls[4].sql,/payment_status='paid'/);assert.match(f.calls[6].sql,/event_outbox/);
});
test('duplicate provider webhook event never replays side effects',async()=>{
 const f=fake([[]]);
 assert.equal(await applyRazorpayPaymentWebhook(f.client,{eventId:'evt_1',eventType:'payment.captured',providerOrderId:'order_123',providerPaymentId:'pay_123',amountMinor:2500,currency:'INR'}),'duplicate');
 assert.equal(f.calls.length,1);
});
test('failed event cannot downgrade a captured payment',async()=>{
 const f=fake([[{provider_event_id:'evt_2'}],[{id:'a1',order_id:'o1',user_id:'u1',amount_minor:'2500',currency:'INR',status:'captured',provider_payment_id:'pay_123'}],[{id:'o1',user_id:'u1',total_minor:'2500',currency:'INR',payment_status:'paid',order_status:'confirmed'}]]);
 await assert.rejects(()=>applyRazorpayPaymentWebhook(f.client,{eventId:'evt_2',eventType:'payment.failed',providerOrderId:'order_123',providerPaymentId:'pay_123',amountMinor:2500,currency:'INR'}),/cannot be marked failed/);
});
