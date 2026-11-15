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
    SELECT $1,p.id,$3::integer FROM shop_products p WHERE p.id=$2 AND p.is_active AND p.stock_quantity >= $3::bigint
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

export type ProductPage={items:Array<{id:string;sellerId:string;name:string;description:string;currency:string;unitAmountMinor:string;category:string;imageUrl:string|null;stockQuantity:string;createdAt:string}>;nextCursor:string|null};
function decodeCursor(cursor?:string):{createdAt:string;id:string}|null{
 if(!cursor)return null;
 if(cursor.length>512)throw new Error('Invalid pagination cursor.');
 let value:{createdAt?:unknown;id?:unknown};
 try{value=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));}catch{throw new Error('Invalid pagination cursor.');}
 if(typeof value.createdAt!=='string'||Number.isNaN(Date.parse(value.createdAt))||typeof value.id!=='string'||!ID.test(value.id))throw new Error('Invalid pagination cursor.');
 return {createdAt:value.createdAt,id:value.id};
}
export async function listActiveProducts(client:PoolClient,input:{limit?:number;cursor?:string;category?:string;search?:string}={}):Promise<ProductPage>{
 const limit=input.limit??24;if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Invalid page size.');
 if(input.category!==undefined&&(typeof input.category!=='string'||input.category.length>120))throw new Error('Invalid category.');
 if(input.search!==undefined&&(typeof input.search!=='string'||input.search.length>120))throw new Error('Invalid search query.');
 const cursor=decodeCursor(input.cursor);
 const result=await client.query(`SELECT id,seller_id,name,description,currency,unit_amount_minor,category,image_url,stock_quantity,created_at
   FROM shop_products WHERE is_active
   AND ($1::text IS NULL OR category=$1)
   AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR description ILIKE '%' || $2 || '%')
   AND ($3::timestamptz IS NULL OR (created_at,id)<($3,$4))
   ORDER BY created_at DESC,id DESC LIMIT $5`,
 [input.category??null,input.search?.trim()||null,cursor?.createdAt??null,cursor?.id??null,limit+1]);
 const rows=result.rows as Array<{id:string;seller_id:string;name:string;description:string;currency:string;unit_amount_minor:string;category:string;image_url:string|null;stock_quantity:string;created_at:Date|string}>;
 const hasMore=rows.length>limit,selected=rows.slice(0,limit);
 const items=selected.map(p=>({id:p.id,sellerId:p.seller_id,name:p.name,description:p.description,currency:p.currency,unitAmountMinor:String(p.unit_amount_minor),category:p.category,imageUrl:p.image_url,stockQuantity:String(p.stock_quantity),createdAt:new Date(p.created_at).toISOString()}));
 const last=selected[selected.length-1];
 return {items,nextCursor:hasMore&&last?Buffer.from(JSON.stringify({createdAt:new Date(last.created_at).toISOString(),id:last.id})).toString('base64url'):null};
}
export async function getActiveProduct(client:PoolClient,productId:string){
 id(productId,'product ID');
 const result=await client.query(`SELECT id,seller_id,name,description,currency,unit_amount_minor,category,image_url,stock_quantity,created_at
  FROM shop_products WHERE id=$1 AND is_active`,[productId]);
 const p=result.rows[0];if(!p)return null;
 return {id:p.id,sellerId:p.seller_id,name:p.name,description:p.description,currency:p.currency,unitAmountMinor:String(p.unit_amount_minor),category:p.category,imageUrl:p.image_url,stockQuantity:String(p.stock_quantity),createdAt:new Date(p.created_at).toISOString()};
}
export async function listUserCart(client:PoolClient,userId:string){
 id(userId,'user ID');
 const result=await client.query(`SELECT p.id AS product_id,p.seller_id,p.name,p.currency,p.unit_amount_minor,p.image_url,p.stock_quantity,i.quantity,i.added_at
  FROM shop_cart_items i JOIN shop_products p ON p.id=i.product_id
  WHERE i.user_id=$1 AND p.is_active ORDER BY i.added_at DESC,p.id`,[userId]);
 return result.rows.map(p=>({productId:p.product_id,sellerId:p.seller_id,name:p.name,currency:p.currency,unitAmountMinor:String(p.unit_amount_minor),imageUrl:p.image_url,stockQuantity:String(p.stock_quantity),quantity:p.quantity,addedAt:new Date(p.added_at).toISOString()}));
}
export async function listUserOrders(client:PoolClient,input:{userId:string;limit?:number;before?:string}){
 id(input.userId,'user ID');const limit=input.limit??20;if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Invalid page size.');
 const before=input.before??null;if(before!==null&&(typeof before!=='string'||Number.isNaN(Date.parse(before))))throw new Error('Invalid order cursor.');
 const result=await client.query(`SELECT id,currency,subtotal_minor,shipping_minor,total_minor,order_status,payment_status,created_at
  FROM shop_orders WHERE user_id=$1 AND ($2::timestamptz IS NULL OR created_at<$2)
  ORDER BY created_at DESC,id DESC LIMIT $3`,[input.userId,before,limit+1]);
 const hasMore=result.rows.length>limit,rows=result.rows.slice(0,limit);
 return {items:rows.map(o=>({id:o.id,currency:o.currency,subtotalMinor:String(o.subtotal_minor),shippingMinor:String(o.shipping_minor),totalMinor:String(o.total_minor),orderStatus:o.order_status,paymentStatus:o.payment_status,createdAt:new Date(o.created_at).toISOString()})),nextCursor:hasMore&&rows.length?new Date(rows[rows.length-1].created_at).toISOString():null};
}
export async function getUserOrder(client:PoolClient,input:{userId:string;orderId:string}){
 id(input.userId,'user ID');id(input.orderId,'order ID');
 const result=await client.query(`SELECT o.id,o.currency,o.subtotal_minor,o.shipping_minor,o.total_minor,o.order_status,o.payment_status,o.created_at,
  i.id AS item_id,i.product_id,i.product_name,i.quantity,i.unit_amount_minor,i.image_url
  FROM shop_orders o LEFT JOIN shop_order_items i ON i.order_id=o.id
  WHERE o.id=$1 AND o.user_id=$2 ORDER BY i.id`,[input.orderId,input.userId]);
 if(!result.rows.length)return null;const first=result.rows[0];
 return {id:first.id,currency:first.currency,subtotalMinor:String(first.subtotal_minor),shippingMinor:String(first.shipping_minor),totalMinor:String(first.total_minor),orderStatus:first.order_status,paymentStatus:first.payment_status,createdAt:new Date(first.created_at).toISOString(),
  items:result.rows.filter(r=>r.item_id).map(r=>({id:r.item_id,productId:r.product_id,productName:r.product_name,quantity:r.quantity,unitAmountMinor:String(r.unit_amount_minor),imageUrl:r.image_url}))};
}
