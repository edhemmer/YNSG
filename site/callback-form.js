// Short "call me back" form: name, phone and what they need. Sends to /api/callback-request.
for(const form of document.querySelectorAll('form[data-callback-form]')){
 const status=form.querySelector('[data-callback-status]'),button=form.querySelector('button[type=submit]');
 let requestKey=globalThis.crypto?.randomUUID?.()||'',fingerprint='',sent=false;
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!form.reportValidity())return;
  if(!requestKey){status.textContent='Please call or text 815-680-1775 instead.';return;}
  const data=Object.fromEntries(new FormData(form).entries());
  const next=JSON.stringify(data);if(fingerprint&&next!==fingerprint)requestKey=globalThis.crypto.randomUUID();fingerprint=next;
  button.disabled=true;status.textContent='Sending…';
  try{
   const response=await fetch('/api/callback-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,requestKey})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok||result.ok!==true){status.textContent=result.error||'We could not confirm your request was received. Please call or text 815-680-1775.';return;}
   sent=true;form.querySelectorAll('input,textarea,button').forEach(el=>{el.disabled=true;});
   status.textContent='Thanks, '+data.name.split(' ')[0]+'. We got it and will call you back at '+data.phone+'.';
   document.dispatchEvent(new CustomEvent('ynsg:count',{detail:'callback_sent'}));
  }catch{status.textContent='We could not confirm your request was received. Please call or text 815-680-1775.';}
  finally{if(!sent)button.disabled=false;}
 });
}
