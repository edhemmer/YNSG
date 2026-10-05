import {localDay,addDays,appointmentSelection} from './appointment-window.js';
const form=document.querySelector('#request-form'),picker=document.querySelector('#appointment-picker');
if(form&&picker){
 const today=localDay(),limit=addDays(today,30),firstMonth=today.slice(0,7),lastMonth=limit.slice(0,7);
 let month=firstMonth,times=[],selectedDate='',selectedStart='',validUntil=0,availabilityKnown=false,generation=0,controller=null;
 const grid=picker.querySelector('#appointment-days'),status=picker.querySelector('#calendar-status'),choices=picker.querySelector('#appointment-times'),summary=picker.querySelector('#appointment-selection');
 const dateLabel=day=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(day+'T12:00:00Z'));
 const timeLabel=start=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'}).format(new Date(start));
 const mode=()=>picker.querySelector('input[name=visitMode]:checked').value;
 function updateSelection(){
  const current=appointmentSelection({mode:mode(),start:selectedStart||null});
  form.dataset.appointmentStart=selectedStart;
  form.querySelector('#preferredTime').value=current.preferredTime;
  summary.textContent=selectedStart?`${mode()==='weekly'?'Weekly visits starting':'Requested visit:'} ${dateLabel(current.firstDate)} at ${timeLabel(selectedStart)}${mode()==='weekly'?' — same weekday and time for 12 months.':''} We’ll confirm after reviewing your request.`:'We’ll arrange a time with you after you send your request.';
 }
 function showTimes(){
  choices.replaceChildren();
  for(const slot of times.filter(t=>localDay(Date.parse(t.start))===selectedDate)){
   const button=document.createElement('button');button.type='button';button.className='appointment-time';button.textContent=timeLabel(slot.start);button.setAttribute('aria-pressed',String(slot.start===selectedStart));
   button.addEventListener('click',()=>{if(Date.now()>=validUntil){load();return;}selectedStart=slot.start;showTimes();updateSelection();});choices.append(button);
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
   button.addEventListener('click',()=>{if(Date.now()>=validUntil){load();return;}selectedDate=key;selectedStart='';draw();showTimes();updateSelection();status.textContent=`Choose a time for ${dateLabel(key)}.`;choices.querySelector('button')?.focus();});grid.append(button);
  }
 }
 async function load(){
  controller?.abort();controller=new AbortController();const current=++generation;
  picker.setAttribute('aria-busy','true');
  picker.querySelectorAll('.calendar-toolbar,.appointment-weekdays,#appointment-days').forEach(el=>el.hidden=false);
  times=[];availabilityKnown=false;selectedStart='';selectedDate='';validUntil=0;draw();showTimes();updateSelection();status.textContent='Checking open times…';
  const refresh=picker.querySelector('#calendar-refresh');refresh.disabled=true;
  const requestController=controller,timeout=setTimeout(()=>requestController.abort(),15000);
  try{
   const response=await fetch('/api/availability',{cache:'no-store',signal:controller.signal});const data=await response.json();
   if(current!==generation)return;
   if(!response.ok||data.reserved!==false||data.timezone!=='America/Chicago'||!Array.isArray(data.times)||!Number.isFinite(Date.parse(data.validUntil))||Date.parse(data.validUntil)<=Date.now())throw Error('UNAVAILABLE');
   times=data.times.filter(t=>{try{return !!appointmentSelection({mode:'once',start:t.start}).start;}catch{return false;}});validUntil=Date.parse(data.validUntil);availabilityKnown=true;
   picker.querySelectorAll('.calendar-toolbar,.appointment-weekdays,#appointment-days').forEach(el=>el.hidden=false);
   status.textContent=times.length?'Press or click an open date to see the times. Dates shown in gray are unavailable.':'No open times are showing in the next 30 days. Send your request without a time, or call 770-630-2094.';draw();
  }catch{if(current===generation)status.textContent='Open times couldn’t load. The gray dates haven’t been checked. Press “Check open times again” to retry, or send your request and we’ll arrange a time with you.';}
  finally{clearTimeout(timeout);if(current===generation){refresh.disabled=false;picker.setAttribute('aria-busy','false');}}
 }
 picker.querySelector('#calendar-refresh').addEventListener('click',load);
 picker.querySelector('#calendar-clear').addEventListener('click',()=>{selectedStart='';selectedDate='';draw();showTimes();updateSelection();});
 for(const [id,offset] of [['calendar-previous',-1],['calendar-next',1]])picker.querySelector('#'+id).addEventListener('click',()=>{const date=new Date(month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+offset);month=date.toISOString().slice(0,7);draw();});
 picker.querySelectorAll('input[name=visitMode]').forEach(radio=>radio.addEventListener('change',()=>{picker.querySelector('#recurrence-note').hidden=mode()!=='weekly';updateSelection();}));
 load();
}
