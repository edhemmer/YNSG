import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
const recovery=z.object({status:z.enum(['requested','canceled','processing','completed']),user:z.uuid().optional(),identityDeleted:z.boolean().optional(),busy:z.boolean().optional()}).strict();
export async function processDeletion(admin:SupabaseClient,input:{request:string;secret:string},lease:string|null){
 const args={p_id:input.request,p_secret:input.secret,p_lease:lease};
 const initial=await admin.rpc('deletion_recovery',{...args,p_finish:false});
 if(initial.error)throw Error(initial.error.code==='42501'?'FORBIDDEN':'RECOVERY_UNAVAILABLE');
 let state=recovery.parse(initial.data);
 if(lease&&state.status==='processing'&&!state.busy){
  if(!state.user||typeof state.identityDeleted!=='boolean')throw Error('PROCESSING_UNCERTAIN');
  if(!state.identityDeleted){const deleted=await admin.auth.admin.deleteUser(state.user,true);if(deleted.error)throw Error('PROCESSING_UNCERTAIN');}
  const finished=await admin.rpc('deletion_recovery',{...args,p_finish:true});
  if(finished.error)throw Error('PROCESSING_UNCERTAIN');state=recovery.parse(finished.data);
  if(state.status!=='completed')throw Error('PROCESSING_UNCERTAIN');
 }
 // The target identity is never returned outside this server-side processor.
 return {status:state.status,busy:Boolean(state.busy)};
}
