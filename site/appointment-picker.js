import {localDay,addDays,appointmentSelection} from './appointment-window.js';
import {appointmentHold,selectionKey} from './appointment-hold.js';
const form=document.querySelector('#request-form'),picker=document.querySelector('#appointment-picker');
if(form&&picker){
 const disclosure=document.querySelector('#appointment-disclosure'),disclosureNote=document.querySelector('#appointment-disclosure-note');
 let opened=false;
 const today=localDay(),limit=addDays(today,30),firstMonth=today.slice(0,7),lastMonth=limit.slice(0,7),clientKey=selectionKey();
 let month=firstMonth,times=[],selectedDate='',selectedStart='',held=null,expiryTimer=null,holding=false,validUntil=0,availabilityKnown=false,generation=0,controller=null;
 form.dataset.appointmentClientKey=clientKey;
 const grid=picker.querySelector('#appointment-days'),status=picker.querySelector('#calendar-status'),choices=picker.querySelector('#appointment-times'),summary=picker.querySelector('#appointment-selection');
 const dateLabel=day=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(day+'T12:00:00Z'));
 const timeLabel=start=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'}).format(new Date(start));
 const quickDates=picker.querySelector('#appointment-quick-dates'),timesHeading=picker.querySelector('#appointment-times-heading');
 const shortDate=day=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}).format(new Date(day+'T12:00:00Z'));
 const mode=()=>picker.querySelector('input[name=visitMode]:checked').value;
 const locked=()=>holding||form.getAttribute('aria-busy')==='true'||form.dataset.deliveryUnknown==='true';
 function updateSelection(){
  let current;
  try{current=appointmentSelection({mode:mode(),start:selectedStart||null});}
  catch{held=null;selectedStart='';current=appointmentSelection({mode:mode(),start:null});}
  form.dataset.appointmentStart=selectedStart;form.dataset.appointmentHoldToken=held?.token||'';
  form.querySelector('#preferredTime').value=current.preferredTime;
  if(disclosureNote)disclosureNote.textContent=selectedStart?`${dateLabel(current.firstDate)} · ${timeLabel(selectedStart)} · awaiting confirmation`:'Optional · or we can arrange a time with you';
  summary.textContent=selectedStart?`Selected: ${dateLabel(current.firstDate)} at ${timeLabel(selectedStart)}. ${held&&Date.parse(held.expiresAt)>Date.now()?`Held until ${shortDate(localDay(Date.parse(held.expiresAt)))} at ${timeLabel(held.expiresAt)} Central Time while you finish the form.`:'The time hold has ended.'} ${mode()==='weekly'?'Only the first visit is held; we’ll review the weekly schedule with you. ':''}We’ll call to confirm the details and appointment.`:'We’ll arrange a time with you after you send your request.';
 }
 async function release(key,token=null){
  if(!key)return;
  try{await appointmentHold({action:'release',key,clientKey,token,start:null,website:form.querySelector('#website').value});}catch{/* Abandoned selections also expire in the database. */}
 }
 function expire(){
  expiryTimer=null;
  if(!held||form.hidden)return;
  if(form.dataset.deliveryUnknown==='true'){updateSelection();return;}
  held=null;selectedStart='';updateSelection();showTimes();status.textContent='That time hold ended. Press or click a time again, or send your request and we’ll arrange a time with you.';
 }
 async function clearSelection(){
  clearTimeout(expiryTimer);expiryTimer=null;const previous=held;held=null;selectedStart='';updateSelection();showTimes();status.textContent='No time selected. We’ll arrange a time with you after you send your request.';
  if(previous)await release(previous.key,previous.token);
 }
 async function selectTime(slot){
  if(locked())return;
  if(Date.now()>=validUntil){
   await load(selectedDate);
   if(!availabilityKnown)return;
   const fresh=times.find(t=>Date.parse(t.start)===Date.parse(slot.start));
   if(!fresh){status.textContent='That time is no longer available. Choose another time for this date.';return;}
   slot=fresh;
  }
  holding=true;form.dataset.appointmentHolding='true';picker.setAttribute('aria-busy','true');
  const key=selectionKey(),controls=[...picker.querySelectorAll('button,input[type=radio]')].map(element=>({element,disabled:element.disabled}));
  for(const {element} of controls)element.disabled=true;
  status.textContent='Holding this time while you finish the form…';
  try{
   const result=await appointmentHold({action:'select',key,clientKey,start:slot.start,token:null,website:form.querySelector('#website').value});
   clearTimeout(expiryTimer);held={...result,key};selectedStart=result.start;
   expiryTimer=setTimeout(expire,Math.max(0,Date.parse(result.expiresAt)-Date.now()));
   status.textContent='Time selected. Finish the form below and press “Send service request.”';updateSelection();
  }catch(error){
   // Cancel by selection key even if the response was lost. A late server
   // selection cannot recreate a hold after its cancellation is recorded.
   await release(key);
   const previous=held;clearTimeout(expiryTimer);held=null;selectedStart='';updateSelection();
   if(previous)await release(previous.key,previous.token);
   status.textContent=error.status===409?'That time is no longer available. Press “Check open times again,” or send your request without a time.':error.status===429?'Please wait a moment before checking another time, or call 770-630-2094.':'We couldn’t hold that time. Press “Check open times again,” or send your request without a time.';
  }finally{
   for(const {element,disabled} of controls)element.disabled=disabled;
   holding=false;form.dataset.appointmentHolding='false';picker.setAttribute('aria-busy','false');showTimes();
  }
 }
 function showTimes(){
  choices.replaceChildren();
  if(timesHeading)timesHeading.textContent=selectedDate?'Open times for '+shortDate(selectedDate):'Choose a date to see times';
  for(const slot of times.filter(t=>localDay(Date.parse(t.start))===selectedDate)){
   const button=document.createElement('button');button.type='button';button.className='appointment-time';button.textContent=timeLabel(slot.start);button.disabled=holding;button.setAttribute('aria-pressed',String(!!selectedStart&&Date.parse(slot.start)===Date.parse(selectedStart)));
   button.addEventListener('click',()=>void selectTime(slot));choices.append(button);
  }
 }
 function draw(){
  grid.replaceChildren();
  const first=month+'-01',date=new Date(first+'T12:00:00Z'),count=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  picker.querySelector('#calendar-month').textContent=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'long',year:'numeric'}).format(date);
  picker.querySelector('#calendar-previous').disabled=month<=firstMonth;picker.querySelector('#calendar-next').disabled=month>=lastMonth;
  for(let i=0;i<date.getUTCDay();i++){const empty=document.createElement('span');empty.setAttribute('aria-hidden','true');grid.append(empty);}
  for(let day=1;day<=count;day++){
   const key=month+'-'+String(day).padStart(2,'0'),open=key>=today&&key<=limit&&times.some(t=>localDay(Date.parse(t.start))===key);
   const button=document.createElement('button');button.type='button';button.className='appointment-day';button.textContent=String(day);button.disabled=!open;button.setAttribute('aria-label',`${dateLabel(key)}${open?', open times':availabilityKnown?', unavailable':', open times not checked'}`);button.setAttribute('aria-pressed',String(selectedDate===key));
   button.addEventListener('click',()=>void chooseDate(key));grid.append(button);
  }
 }
 async function chooseDate(key){
  if(locked())return;
  if(Date.now()>=validUntil){await load(key);if(!availabilityKnown)return;}
  if(!times.some(t=>localDay(Date.parse(t.start))===key)){status.textContent=`No open times remain for ${dateLabel(key)}. Please choose another date.`;return;}
  const previous=held;clearTimeout(expiryTimer);held=null;selectedStart='';selectedDate=key;month=key.slice(0,7);
  draw();drawQuickDates();showTimes();updateSelection();status.textContent=`Choose a time for ${dateLabel(key)}.`;choices.querySelector('button')?.focus();
  if(previous)void release(previous.key,previous.token);
 }
 function drawQuickDates(){
  if(!quickDates)return;
  quickDates.replaceChildren();
  const days=[...new Set(times.map(t=>localDay(Date.parse(t.start))))].sort().slice(0,5);
  for(const day of days){
   const button=document.createElement('button');button.type='button';button.className='appointment-quick-date';button.textContent=shortDate(day);button.disabled=holding;
   button.setAttribute('aria-label',dateLabel(day)+', '+times.filter(t=>localDay(Date.parse(t.start))===day).length+' open times');button.setAttribute('aria-pressed',String(day===selectedDate));
   button.addEventListener('click',()=>void chooseDate(day));quickDates.append(button);
  }
 }
 async function load(preserveDate=''){
  if(locked())return;
  controller?.abort();controller=new AbortController();const current=++generation;
  picker.setAttribute('aria-busy','true');
  picker.querySelectorAll('.calendar-toolbar,.appointment-weekdays,#appointment-days').forEach(el=>el.hidden=false);
  const previous=held;clearTimeout(expiryTimer);held=null;
  times=[];availabilityKnown=false;selectedStart='';selectedDate=preserveDate;validUntil=0;draw();drawQuickDates();showTimes();updateSelection();status.dataset.state='loading';status.textContent='Checking open times…';
  const refresh=picker.querySelector('#calendar-refresh');refresh.disabled=true;
  const requestController=controller,timeout=setTimeout(()=>requestController.abort(),15000);
  try{
   if(previous)await release(previous.key,previous.token);
   const response=await fetch('/api/availability',{cache:'no-store',signal:requestController.signal});const data=await response.json();
   if(current!==generation)return;
   if(!response.ok||data.reserved!==false||data.timezone!=='America/Chicago'||!Array.isArray(data.times)||!Number.isFinite(Date.parse(data.validUntil))||Date.parse(data.validUntil)<=Date.now())throw Error('UNAVAILABLE');
   times=data.times.filter(t=>{try{return !!appointmentSelection({mode:'once',start:t.start}).start;}catch{return false;}});validUntil=Date.parse(data.validUntil);availabilityKnown=true;status.dataset.state='ready';
   const days=[...new Set(times.map(t=>localDay(Date.parse(t.start))))].sort();
   selectedDate=days.includes(preserveDate)?preserveDate:(days[0]||'');if(selectedDate)month=selectedDate.slice(0,7);
   drawQuickDates();showTimes();updateSelection();
   status.textContent=times.length?`Next available dates are shown above. Choose a time for ${dateLabel(selectedDate)}, or press another open date. Gray dates are unavailable.`:'No open times are showing in the next 30 days. Send your request without a time, or call 770-630-2094.';draw();
  }catch{if(current===generation){status.dataset.state='error';status.textContent='Appointment times couldn’t load. Dates cannot be selected right now. Press “Check open times again,” or send your service request without a time and we’ll arrange it with you. You can also call 770-630-2094.';}}
  finally{clearTimeout(timeout);if(current===generation){refresh.disabled=false;picker.setAttribute('aria-busy','false');}}
 }
 picker.querySelector('#calendar-refresh').addEventListener('click',()=>void load());
 picker.querySelector('#calendar-clear').addEventListener('click',()=>{if(locked())return;void clearSelection();selectedDate='';draw();drawQuickDates();showTimes();});
 for(const [id,offset] of [['calendar-previous',-1],['calendar-next',1]])picker.querySelector('#'+id).addEventListener('click',()=>{if(locked())return;const date=new Date(month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+offset);month=date.toISOString().slice(0,7);draw();});
 picker.querySelectorAll('input[name=visitMode]').forEach(radio=>radio.addEventListener('change',()=>{if(locked())return;picker.querySelector('#recurrence-note').hidden=mode()!=='weekly';updateSelection();}));
 form.addEventListener('appointment-conflict',()=>{void load();});
 window.addEventListener('pagehide',()=>{if(held&&form.dataset.deliveryUnknown!=='true'&&!form.hidden)void clearSelection();});
 // Mobile browsers can suspend timers while backgrounded or restore this page
 // from their navigation cache. Recheck the clock instead of trusting a timer.
 function resume(){if(held&&Date.parse(held.expiresAt)<=Date.now())expire();}
 window.addEventListener('pageshow',resume);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resume();});
 updateSelection();
 if(disclosure){disclosure.addEventListener('toggle',()=>{if(disclosure.open&&!opened&&!locked()){opened=true;void load();}});}else void load();
}
