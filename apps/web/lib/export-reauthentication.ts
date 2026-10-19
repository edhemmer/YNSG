import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
export const exportAuthorization=z.object({organization:z.uuid(),authorized:z.literal(true)}).strict();
export const exportReauthentication=z.object({organization:z.uuid(),password:z.string().min(1).max(128)}).strict();
export async function authorizeRecordExport(db:SupabaseClient,organization:string){
 const r=await db.rpc('authorize_record_export',{p_org:z.uuid().parse(organization)});
 if(r.error)throw Error(r.error.code==='42501'?'FORBIDDEN':r.error.message==='REAUTHENTICATION_REQUIRED'?'REAUTHENTICATION_REQUIRED':'EXPORT_AUTHORIZATION_UNAVAILABLE');
 const proof=exportAuthorization.parse(r.data);if(proof.organization!==organization)throw Error('EXPORT_AUTHORIZATION_UNAVAILABLE');return proof;
}
