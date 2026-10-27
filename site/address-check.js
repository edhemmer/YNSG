export function addressCheck(form,transport=fetch){
 const document=form.ownerDocument,Event=document.defaultView.Event;
 const check=form.querySelector('#address-check'),result=form.querySelector('#address-check-result');if(!check||!result)return;
 const street=form.querySelector('#street'),city=form.querySelector('#city'),postal=form.querySelector('[name=postalCode]');
 let generation=0,controller=null;
 const snapshot=()=>JSON.stringify({street:street.value.trim(),city:city.value,state:'IL',...(postal?{postalCode:postal.value}:{})});
 const locked=()=>form.hidden||form.dataset.deliveryUnknown==='true'||form.getAttribute('aria-busy')==='true';
 const changed=()=>{generation++;controller?.abort();controller=null;result.replaceChildren();check.disabled=locked();check.textContent='Check address';};
 street.addEventListener('input',changed);street.addEventListener('change',changed);city.addEventListener('change',changed);postal?.addEventListener('change',changed);form.addEventListener('reset',changed);
 form.addEventListener('request-delivery-state-changed',()=>{check.disabled=locked()||controller!==null;});
 check.addEventListener('click',async()=>{
  if(locked())return;
  if(!street.checkValidity()||street.value.trim().length<5||!city.value||(postal&&!postal.value)){result.textContent='Enter your street address and choose a city and ZIP code first.';street.focus();return;}
  controller?.abort();controller=new AbortController();const own=controller,current=++generation,original=snapshot();
  check.disabled=true;check.textContent='Checking address…';result.textContent='Checking the street details…';
  const timeout=setTimeout(()=>own.abort(),25000);
  try{
   const response=await transport('/api/address-check',{method:'POST',headers:{'Content-Type':'application/json'},body:original,cache:'no-store',signal:own.signal});const data=await response.json();
   if(current!==generation||snapshot()!==original||locked())return;
   result.replaceChildren();
   if(!response.ok||!['match','multiple','no_match','unavailable'].includes(data.status)||!Array.isArray(data.candidates)||data.candidates.length>3)throw Error('UNAVAILABLE');
   if(data.status==='unavailable'){result.textContent='The address check is unavailable. You can keep your entry and continue.';return;}
   if(!data.candidates.length){result.textContent='We couldn’t match this street address. Please review it; you can keep your entry and continue.';return;}
   const message=document.createElement('p');message.textContent=data.status==='multiple'?'More than one street match. Choose the correct address, or keep your entry.':'Street match found. Please review it, including any apartment or unit.';result.append(message);
   for(const candidate of data.candidates){
    if(typeof candidate.street!=='string'||candidate.street.length>200||typeof candidate.city!=='string'||candidate.state!=='IL')continue;
    const supported=city.tagName==='SELECT'?[...city.options].find(o=>o.value.toLowerCase()===candidate.city.toLowerCase()):true;
    const line=document.createElement('p');line.textContent=[candidate.street,candidate.city,candidate.state,candidate.postalCode].filter(Boolean).join(', ');result.append(line);
    if(!supported)continue;
    const use=document.createElement('button');use.type='button';use.className='booking-text-button';use.textContent='Use this street address';
    use.addEventListener('click',()=>{if(locked()||snapshot()!==original)return;street.value=candidate.street;city.value=city.tagName==='SELECT'?supported.value:candidate.city.toLowerCase()===city.value.toLowerCase()?city.value:candidate.city;street.dispatchEvent(new Event('input',{bubbles:true}));city.dispatchEvent(new Event('change',{bubbles:true}));if(postal&&(postal.tagName!=='SELECT'||[...postal.options].some(o=>o.value===candidate.postalCode))){postal.value=candidate.postalCode;postal.dispatchEvent(new Event('change',{bubbles:true}));}result.textContent='Street address updated. Please verify your apartment or unit, if any.';});result.append(use);
   }
  }catch{if(current===generation&&snapshot()===original&&!locked())result.textContent='The address check is unavailable. You can keep your entry and continue.';}
  finally{clearTimeout(timeout);if(current===generation){check.disabled=locked();check.textContent='Check address';controller=null;}}
 });
}
