// A timeout means delivery is unknown. Callers must retain the same request key
// and details when retrying so the server can return the original receipt.
export async function deliverRequest(data,transport=fetch,timeoutMs=20000){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await transport('/api/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:controller.signal});
  const result=await response.json();
  if(!response.ok)throw new Error(typeof result?.error==='string'?result.error:'DELIVERY_UNKNOWN');
  if(result?.ok!==true||result.saved!==true||typeof result.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(result.id))throw new Error('DELIVERY_UNKNOWN');
  return result;
 }finally{clearTimeout(timeout);}
}
