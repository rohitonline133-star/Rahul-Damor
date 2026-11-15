import type { PoolClient } from 'pg';
import { insertOutboxEvent } from '../outbox';

const ID=/^[A-Za-z0-9_-]{1,128}$/;
function id(value:string,label:string){if(typeof value!=='string'||!ID.test(value))throw new Error(`Invalid ${label}.`);}
export type PrivacySettings={
 lastSeenVisibility:'everyone'|'contacts'|'nobody';
 profilePhotoVisibility:'everyone'|'contacts'|'nobody';
 statusVisibility:'everyone'|'contacts'|'selected';
 readReceiptsEnabled:boolean;
};
const DEFAULTS:PrivacySettings={lastSeenVisibility:'everyone',profilePhotoVisibility:'everyone',statusVisibility:'everyone',readReceiptsEnabled:true};

export async function getPrivacySettings(client:PoolClient,userId:string):Promise<PrivacySettings>{
 id(userId,'user ID');
 const result=await client.query<{last_seen_visibility:PrivacySettings['lastSeenVisibility'];profile_photo_visibility:PrivacySettings['profilePhotoVisibility'];status_visibility:PrivacySettings['statusVisibility'];read_receipts_enabled:boolean}>(
 `SELECT last_seen_visibility,profile_photo_visibility,status_visibility,read_receipts_enabled
 FROM user_privacy_settings WHERE user_id=$1`,[userId]);
 const row=result.rows[0];
 return row?{lastSeenVisibility:row.last_seen_visibility,profilePhotoVisibility:row.profile_photo_visibility,statusVisibility:row.status_visibility,readReceiptsEnabled:row.read_receipts_enabled}:DEFAULTS;
}
export async function updatePrivacySettings(client:PoolClient,input:{userId:string;settings:PrivacySettings}):Promise<PrivacySettings>{
 id(input.userId,'user ID');
 const s=input.settings;
 if(!s||!['everyone','contacts','nobody'].includes(s.lastSeenVisibility)||!['everyone','contacts','nobody'].includes(s.profilePhotoVisibility)||!['everyone','contacts','selected'].includes(s.statusVisibility)||typeof s.readReceiptsEnabled!=='boolean')throw new Error('Invalid privacy settings.');
 const r=await client.query<{last_seen_visibility:PrivacySettings['lastSeenVisibility'];profile_photo_visibility:PrivacySettings['profilePhotoVisibility'];status_visibility:PrivacySettings['statusVisibility'];read_receipts_enabled:boolean}>(
 `INSERT INTO user_privacy_settings(user_id,last_seen_visibility,profile_photo_visibility,status_visibility,read_receipts_enabled,updated_at)
 VALUES($1,$2,$3,$4,$5,now()) ON CONFLICT(user_id) DO UPDATE SET
 last_seen_visibility=EXCLUDED.last_seen_visibility,profile_photo_visibility=EXCLUDED.profile_photo_visibility,
 status_visibility=EXCLUDED.status_visibility,read_receipts_enabled=EXCLUDED.read_receipts_enabled,updated_at=now()
 RETURNING last_seen_visibility,profile_photo_visibility,status_visibility,read_receipts_enabled`,
 [input.userId,s.lastSeenVisibility,s.profilePhotoVisibility,s.statusVisibility,s.readReceiptsEnabled]);
 const row=r.rows[0];
 if(!row)throw new Error('Privacy settings were not saved.');
 await insertOutboxEvent(client,{aggregateType:'privacy_settings',aggregateId:input.userId,eventType:'updated',partitionKey:input.userId,
 payload:{userId:input.userId,updatedFields:['lastSeenVisibility','profilePhotoVisibility','statusVisibility','readReceiptsEnabled']}});
 return {lastSeenVisibility:row.last_seen_visibility,profilePhotoVisibility:row.profile_photo_visibility,statusVisibility:row.status_visibility,readReceiptsEnabled:row.read_receipts_enabled};
}
export async function muteUser(client:PoolClient,input:{muterId:string;mutedId:string}):Promise<boolean>{
 id(input.muterId,'muter ID');id(input.mutedId,'muted ID');
 if(input.muterId===input.mutedId)throw new Error('Cannot mute yourself.');
 const r=await client.query(`INSERT INTO user_mutes(muter_id,muted_id) VALUES($1,$2)
 ON CONFLICT DO NOTHING RETURNING muter_id`,[input.muterId,input.mutedId]);
 if(!r.rows[0])return false;
 await insertOutboxEvent(client,{aggregateType:'user_mute',aggregateId:input.muterId,eventType:'created',partitionKey:input.muterId,
 payload:{muterId:input.muterId,mutedId:input.mutedId}});
 return true;
}
export async function unmuteUser(client:PoolClient,input:{muterId:string;mutedId:string}):Promise<boolean>{
 id(input.muterId,'muter ID');id(input.mutedId,'muted ID');
 const r=await client.query(`DELETE FROM user_mutes WHERE muter_id=$1 AND muted_id=$2 RETURNING muter_id`,[input.muterId,input.mutedId]);
 if(!r.rows[0])return false;
 await insertOutboxEvent(client,{aggregateType:'user_mute',aggregateId:input.muterId,eventType:'removed',partitionKey:input.muterId,
 payload:{muterId:input.muterId,mutedId:input.mutedId}});
 return true;
}
export async function isUserMuted(client:PoolClient,input:{muterId:string;mutedId:string}):Promise<boolean>{
 id(input.muterId,'muter ID');id(input.mutedId,'muted ID');
 const r=await client.query(`SELECT 1 FROM user_mutes WHERE muter_id=$1 AND muted_id=$2`,[input.muterId,input.mutedId]);
 return Boolean(r.rows[0]);
}
export async function listMutedUsers(client:PoolClient,input:{muterId:string;limit?:number;beforeMutedId?:string}):Promise<{items:Array<{userId:string;mutedAt:string}>;nextCursor:string|null}>{
 id(input.muterId,'muter ID');
 const limit=input.limit??30;
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Invalid muted-user page size.');
 if(input.beforeMutedId)id(input.beforeMutedId,'cursor ID');
 const r=await client.query<{muted_id:string;created_at:Date|string}>(`SELECT muted_id,created_at FROM user_mutes
 WHERE muter_id=$1 AND ($2::text IS NULL OR muted_id<$2)
 ORDER BY muted_id DESC LIMIT $3`,[input.muterId,input.beforeMutedId??null,limit+1]);
 const more=r.rows.length>limit;const rows=r.rows.slice(0,limit);
 const items=rows.map(x=>({userId:x.muted_id,mutedAt:x.created_at instanceof Date?x.created_at.toISOString():x.created_at}));
 return {items,nextCursor:more&&items.length?items[items.length-1].userId:null};
}
