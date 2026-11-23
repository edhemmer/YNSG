const form=document.getElementById('partner-form');
if(form){
 const status=document.getElementById('partner-status'),button=document.getElementById('partner-submit'),fallback=document.getElementById('partner-fallback'),emailLink=document.getElementById('partner-email-fallback');
 let requestKey=globalThis.crypto?.randomUUID?.()||'';
 form.addEventListener('submit',async event=>{
  event.preventDefault();fallback.hidden=true;
  if(!form.reportValidity())return;
  if(!requestKey){status.textContent='Please call or email us instead.';fallback.hidden=false;return;}
  const data=Object.fromEntries(new FormData(form).entries());
  emailLink.href='mailto:info@yourneighborhoodserviceguy.com?subject='+encodeURIComponent('YNSG business inquiry — '+data.company)+'&body='+encodeURIComponent(['Organization: '+data.company,'Type: '+data.type,'Name: '+data.name,'Phone: '+data.phone,'Email: '+data.email,'Area: '+(data.location||'Not specified'),'','Message:',data.message].join('\n'));
  button.disabled=true;status.textContent='Sending your inquiry…';
  try{
   const response=await fetch('/api/partner-inquiry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,requestKey})});
   const result=await response.json();
   if(!response.ok||result.ok!==true)throw Error('Unavailable');
   status.textContent='Thank you — your inquiry was sent. We reply within one business day, and a confirmation is on its way to your email.';form.reset();requestKey=globalThis.crypto?.randomUUID?.()||'';
  }catch{status.textContent='We could not confirm your inquiry was delivered.';fallback.hidden=false;}
  finally{button.disabled=false;}
 });
}