import type {PoolClient} from 'pg';
import {insertOutboxEvent} from '../outbox';
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const RO=/^order_[A-Za-z0-9]+$/;
const RP=/^pay_[A-Za-z0-9]+$/;
const EV=/^[A-Za-z0-9_.:-]{1,255}$/;
function money(amount:number,currency:string){if(!Number.isSafeInteger(amount)||amount<100||!/^[A-Z]{3}$/.test(currency))throw new Error('Invalid payment amount or currency.');}
export type NewRazorpayAttempt={id:string;orderId:string;userId:string;providerOrderId:string;amountMinor:number;currency:string};
export async function createRazorpayPaymentAttempt(client:PoolClient,input:NewRazorpayAttempt){
 if(!ID.test(input.id)||!ID.test(input.orderId)||!ID.test(input.userId)||!RO.test(input.providerOrderId))throw new Error('Invalid payment attempt identifiers.');
 money(input.amountMinor,input.currency);
 const order=await client.query('SELECT id,user_id,total_minor,currency,payment_status,order_status FROM shop_orders WHERE id=$1 AND user_id=$2 FOR UPDATE',[input.orderId,input.userId]);
 const row=order.rows[0];
 if(!row||row.payment_status!=='pending'||row.order_status==='cancelled')throw new Error('Order is unavailable for payment.');
 if(String(row.total_minor)!==String(input.amountMinor)||row.currency!==input.currency)throw new Error('Payment amount does not match the order.');
 const result=await client.query(`INSERT INTO shop_payment_attempts(id,order_id,user_id,provider,provider_order_id,amount_minor,currency)
 VALUES($1,$2,$3,'razorpay',$4,$5,$6)
 RETURNING id,order_id,user_id,provider_order_id,amount_minor,currency,status,created_at`,
 [input.id,input.orderId,input.userId,input.providerOrderId,input.amountMinor,input.currency]);
 if(!result.rows[0])throw new Error('Payment attempt was not stored.');
 return result.rows[0];
}
export type RazorpayWebhookPayment={eventId:string;eventType:'payment.captured'|'payment.failed';providerOrderId:string;providerPaymentId:string;amountMinor:number;currency:string};
/** Must run in one transaction, after HMAC verification against the exact raw webhook body. */
export async function applyRazorpayPaymentWebhook(client:PoolClient,input:RazorpayWebhookPayment):Promise<'processed'|'duplicate'>{
 if(!EV.test(input.eventId)||!RO.test(input.providerOrderId)||!RP.test(input.providerPaymentId))throw new Error('Invalid Razorpay webhook identifiers.');
 money(input.amountMinor,input.currency);
 if(!['payment.captured','payment.failed'].includes(input.eventType))throw new Error('Unsupported Razorpay event.');
 const receipt=await client.query(`INSERT INTO commerce_webhook_receipts(provider,provider_event_id)
 VALUES('razorpay',$1) ON CONFLICT(provider,provider_event_id) DO NOTHING RETURNING provider_event_id`,[input.eventId]);
 if(!receipt.rows[0])return 'duplicate';
 const found=await client.query(`SELECT id,order_id,user_id,provider_payment_id,amount_minor,currency,status
 FROM shop_payment_attempts WHERE provider='razorpay' AND provider_order_id=$1 FOR UPDATE`,[input.providerOrderId]);
 const attempt=found.rows[0];
 if(!attempt)throw new Error('Unknown Razorpay order reference.');
 if(String(attempt.amount_minor)!==String(input.amountMinor)||attempt.currency!==input.currency)throw new Error('Webhook amount does not match payment attempt.');
 if(attempt.provider_payment_id&&attempt.provider_payment_id!==input.providerPaymentId)throw new Error('Payment attempt is already linked to another payment.');
 const foundOrder=await client.query(`SELECT id,user_id,payment_status,order_status,total_minor,currency FROM shop_orders
 WHERE id=$1 AND user_id=$2 FOR UPDATE`,[attempt.order_id,attempt.user_id]);
 const order=foundOrder.rows[0];
 if(!order||String(order.total_minor)!==String(input.amountMinor)||order.currency!==input.currency)throw new Error('Payment order no longer matches its payment attempt.');
 if(input.eventType==='payment.captured'){
  if(attempt.status==='failed'||attempt.status==='refunded')throw new Error('Payment attempt is not eligible for capture.');
  await client.query(`UPDATE shop_payment_attempts SET provider_payment_id=$2,status='captured',captured_at=COALESCE(captured_at,now()),updated_at=now() WHERE id=$1`,[attempt.id,input.providerPaymentId]);
  await client.query(`UPDATE shop_orders SET payment_status='paid',order_status=CASE WHEN order_status='pending' THEN 'confirmed' ELSE order_status END,updated_at=now() WHERE id=$1 AND payment_status IN ('pending','paid')`,[order.id]);
  await client.query(`INSERT INTO payment_transactions(id,user_id,order_id,provider,provider_transaction_id,transaction_type,amount_minor,currency,status,description)
  VALUES($1,$2,$3,'razorpay',$4,'shop_purchase',$5,$6,'completed','Shop order payment')
  ON CONFLICT(provider,provider_transaction_id) DO NOTHING`,['paytx_'+input.providerPaymentId,attempt.user_id,attempt.order_id,input.providerPaymentId,input.amountMinor,input.currency]);
  await insertOutboxEvent(client,{aggregateType:'shop_order',aggregateId:order.id,eventType:'payment_captured',partitionKey:attempt.user_id,payload:{orderId:order.id,userId:attempt.user_id,paymentId:input.providerPaymentId,amountMinor:input.amountMinor,currency:input.currency}});
 }else{
  if(attempt.status==='captured')throw new Error('A captured payment cannot be marked failed.');
  await client.query(`UPDATE shop_payment_attempts SET status='failed',provider_payment_id=COALESCE(provider_payment_id,$2),updated_at=now() WHERE id=$1`,[attempt.id,input.providerPaymentId]);
  await client.query(`UPDATE shop_orders SET payment_status='failed',updated_at=now() WHERE id=$1 AND payment_status='pending'`,[order.id]);
  await client.query(`INSERT INTO payment_transactions(id,user_id,order_id,provider,provider_transaction_id,transaction_type,amount_minor,currency,status,description)
  VALUES($1,$2,$3,'razorpay',$4,'shop_purchase',$5,$6,'failed','Shop order payment failed')
  ON CONFLICT(provider,provider_transaction_id) DO NOTHING`,['paytx_'+input.providerPaymentId,attempt.user_id,attempt.order_id,input.providerPaymentId,input.amountMinor,input.currency]);
  await insertOutboxEvent(client,{aggregateType:'shop_order',aggregateId:order.id,eventType:'payment_failed',partitionKey:attempt.user_id,payload:{orderId:order.id,userId:attempt.user_id,paymentId:input.providerPaymentId}});
 }
 await client.query(`UPDATE commerce_webhook_receipts SET processed_at=now(),outcome='processed' WHERE provider='razorpay' AND provider_event_id=$1`,[input.eventId]);
 return 'processed';
}
