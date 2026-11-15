import type { PoolClient } from 'pg';
import { insertOutboxEvent } from '../outbox';

const ID=/^[A-Za-z0-9_-]{1,128}$/;
function id(value:string,label:string){if(typeof value!=='string'||!ID.test(value))throw new Error('Invalid '+label+'.');}
function qty(value:number){if(!Number.isInteger(value)||value<1||value>1000)throw new Error('Invalid item quantity.');}
function address(value:Record<string,unknown>){
  if(!value||typeof value!=='object'||Array.isArray(value)||Buffer.byteLength(JSON.stringify(value),'utf8')>8192)throw new Error('Invalid shipping address.');
  const keys=['fullName','address','city','postalCode','country'];
  for(const key of keys){const v=value[key];if(typeof v!=='string'||!v.trim()||v.length>(key==='address'?500:120))throw new Error('Invalid shipping address.');}
  return Object.fromEntries(keys.map(k=>[k,(value[k] as string).trim()]));
}
export async function addCartItem(client:PoolClient,input:{userId:string;productId:string;quantity:number}):Promise<boolean>{
  id(input.userId,'user ID');id(input.productId,'product ID');qty(input.quantity);
  const result=await client.query(`INSERT INTO shop_carts(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[input.userId]);
  void result;
  const item=await client.query(`INSERT INTO shop_cart_items(user_id,product_id,quantity)
    SELECT $1,p.id,$3 FROM shop_products p WHERE p.id=$2 AND p.is_active AND p.stock_quantity >= $3
    ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=shop_cart_items.quantity+EXCLUDED.quantity, added_at=now()
    WHERE shop_cart_items.quantity+EXCLUDED.quantity <= 1000
      AND shop_cart_items.quantity+EXCLUDED.quantity <= (SELECT stock_quantity FROM shop_products WHERE id=EXCLUDED.product_id)
    RETURNING product_id`,[input.userId,input.productId,input.quantity]);
  if(!item.rows[0])return false;
  await client.query(`UPDATE shop_carts SET updated_at=now() WHERE user_id=$1`,[input.userId]);
  return true;
}
export async function removeCartItem(client:PoolClient,input:{userId:string;productId:string}):Promise<boolean>{
  id(input.userId,'user ID');id(input.productId,'product ID');
  const result=await client.query(`DELETE FROM shop_cart_items WHERE user_id=$1 AND product_id=$2 RETURNING product_id`,[input.userId,input.productId]);
  if(result.rows[0])await client.query(`UPDATE shop_carts SET updated_at=now() WHERE user_id=$1`,[input.userId]);
  return Boolean(result.rows[0]);
}
export type CreatedOrder={id:string;currency:string;subtotalMinor:number;shippingMinor:number;totalMinor:number;itemCount:number};
/** Caller must wrap this function in a transaction and complete request idempotency in that same transaction. */
export async function createShopOrder(client:PoolClient,input:{
  id:string;userId:string;items:Array<{productId:string;quantity:number}>;shippingMinor?:number;
  shippingAddress:Record<string,unknown>;
}):Promise<CreatedOrder>{
  id(input.id,'order ID');id(input.userId,'user ID');
  if(!Array.isArray(input.items)||input.items.length<1||input.items.length>100)throw new Error('Invalid order items.');
  const merged=new Map<string,number>();
  for(const item of input.items){id(item.productId,'product ID');qty(item.quantity);merged.set(item.productId,(merged.get(item.productId)??0)+item.quantity);}
  for(const quantity of merged.values())qty(quantity);
  const shipping=input.shippingMinor??0;
  if(!Number.isSafeInteger(shipping)||shipping<0||shipping>100000000)throw new Error('Invalid shipping amount.');
  const shipTo=address(input.shippingAddress);
  const productIds=[...merged.keys()].sort();
  const locked=await client.query<{id:string;name:string;currency:string;unit_amount_minor:string|number;stock_quantity:string|number;image_url:string|null}>(
    `SELECT id,name,currency,unit_amount_minor,stock_quantity,image_url FROM shop_products
     WHERE id=ANY($1::text[]) AND is_active ORDER BY id FOR UPDATE`,[productIds]);
  if(locked.rows.length!==productIds.length)throw new Error('One or more products are unavailable.');
  const currencies=new Set(locked.rows.map(p=>p.currency));
  if(currencies.size!==1)throw new Error('All order items must use the same currency.');
  let subtotal=0;
  const snapshots=locked.rows.map(p=>{
    const quantity=merged.get(p.id)!;
    const unit=Number(p.unit_amount_minor),stock=Number(p.stock_quantity);
    if(!Number.isSafeInteger(unit)||unit<0||!Number.isSafeInteger(stock)||stock<quantity)throw new Error('Insufficient stock or invalid product price.');
    const line=unit*quantity;
    if(!Number.isSafeInteger(line)||!Number.isSafeInteger(subtotal+line))throw new Error('Order amount exceeds supported range.');
    subtotal+=line;
    return {productId:p.id,name:p.name,quantity,unit,imageUrl:p.image_url};
  });
  const total=subtotal+shipping;
  if(!Number.isSafeInteger(total))throw new Error('Order amount exceeds supported range.');
  for(const p of snapshots){
    const updated=await client.query(`UPDATE shop_products SET stock_quantity=stock_quantity-$2,updated_at=now()
      WHERE id=$1 AND is_active AND stock_quantity >= $2 RETURNING id`,[p.productId,p.quantity]);
    if(!updated.rows[0])throw new Error('Inventory changed while creating order; retry transaction.');
  }
  const currency=locked.rows[0].currency;
  await client.query(`INSERT INTO shop_orders(id,user_id,currency,subtotal_minor,shipping_minor,total_minor,shipping_address)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[input.id,input.userId,currency,subtotal,shipping,total,JSON.stringify(shipTo)]);
  for(let i=0;i<snapshots.length;i++){
    const p=snapshots[i];
    await client.query(`INSERT INTO shop_order_items(id,order_id,product_id,product_name,quantity,unit_amount_minor,image_url)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[`${input.id}_item_${i+1}`,input.id,p.productId,p.name,p.quantity,p.unit,p.imageUrl]);
  }
  await client.query(`DELETE FROM shop_cart_items WHERE user_id=$1 AND product_id=ANY($2::text[])`,[input.userId,productIds]);
  await insertOutboxEvent(client,{aggregateType:'shop_order',aggregateId:input.id,eventType:'created',partitionKey:input.userId,
    payload:{orderId:input.id,userId:input.userId,itemCount:snapshots.length,totalMinor:total,currency}});
  return {id:input.id,currency,subtotalMinor:subtotal,shippingMinor:shipping,totalMinor:total,itemCount:snapshots.length};
}
