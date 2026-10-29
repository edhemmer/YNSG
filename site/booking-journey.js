// Keep the existing form and delivery contracts while presenting one stage at a time.
export function bookingJourney({form,services,requestData}){
 const progress=form.querySelector('.booking-progress'),stages=[...form.querySelectorAll('[data-stage]')];
 if(!progress||stages.length!==3)return {refresh(){}};
 let step=1,arrange=false,hadTime=false;
 const locked=()=>form.dataset.deliveryUnknown==='true'||form.getAttribute('aria-busy')==='true'||form.dataset.appointmentHolding==='true';
 const message=form.querySelector('#form-message'),nextTime=form.querySelector('#booking-time-next'),summary=form.querySelector('#booking-summary');
 function refresh(){
  progress.querySelectorAll('[data-booking-step]').forEach(b=>{b.disabled=locked()||Number(b.dataset.bookingStep)>step;});
  const selected=Boolean(form.dataset.appointmentStart&&form.dataset.appointmentHoldToken);
  if(selected)arrange=false;
  nextTime.disabled=locked()||(!selected&&!arrange);
  const data=requestData(),jobs=services();summary.textContent=(jobs.length===1?jobs[0].task||jobs[0].service:jobs.length+' jobs')+' · '+(data.preferredTime||'We’ll arrange a time with you');
  if(hadTime&&!selected&&!arrange&&step===3&&!locked()){show(2);message.textContent='Please choose a time again, or ask us to arrange one.';}
  hadTime=selected;
 }
 function show(value,focus=true){
  step=value;stages.forEach(s=>s.hidden=Number(s.dataset.stage)!==step);
  progress.querySelectorAll('[data-booking-step]').forEach(b=>{b.disabled=locked()||Number(b.dataset.bookingStep)>step;b.setAttribute('aria-current',Number(b.dataset.bookingStep)===step?'step':'false');});
  summary.hidden=step!==3;
  if(focus){const heading=stages[step-1].querySelector('h2');heading.focus({preventScroll:true});heading.scrollIntoView?.({block:'start',behavior:'instant'});}
 }
 function advance(){
  if(locked())return;
  if(step===1){if(!services().length){message.textContent='Choose at least one job to continue.';form.querySelector('#service-count').focus();return;}
   const description=form.querySelector('#description');if(!description.checkValidity()){description.reportValidity();return;}
  }else if(step===2&&!form.dataset.appointmentStart&&!arrange){message.textContent='Choose an open time, or ask us to arrange one.';return;}
  message.textContent='';show(Math.min(3,step+1));refresh();
 }
 progress.hidden=false;form.dataset.guidedBooking='true';form.noValidate=true;form.querySelectorAll('[data-stage-controls]').forEach(s=>s.hidden=false);
 form.querySelector('#booking-services-next').addEventListener('click',advance);
 form.querySelector('#booking-skip-time').addEventListener('click',()=>{
  if(locked())return;
  if(!services().length){message.textContent='Choose at least one job to continue.';form.querySelector('#service-count').focus();return;}
  const description=form.querySelector('#description');if(!description.checkValidity()){description.reportValidity();return;}
  // No slot is reserved; the owner will contact the customer to arrange a visit.
  if(form.dataset.appointmentStart){message.textContent='You already selected a time. Go to the time step to change it.';show(2);return;}
  arrange=true;hadTime=false;message.textContent='';show(3);refresh();
 });
 nextTime.addEventListener('click',advance);
 progress.querySelectorAll('[data-booking-step]').forEach(b=>b.addEventListener('click',()=>{if(!locked()&&Number(b.dataset.bookingStep)<=step){message.textContent='';show(Number(b.dataset.bookingStep));refresh();}}));
 form.querySelectorAll('[data-booking-back]').forEach(b=>b.addEventListener('click',()=>{if(!locked()){message.textContent='';show(Number(b.dataset.bookingBack));refresh();}}));
 form.querySelector('#calendar-clear').addEventListener('click',()=>{if(locked())return;arrange=true;hadTime=false;show(3);});
 form.addEventListener('appointment-selection-changed',refresh);form.addEventListener('input',refresh);form.addEventListener('change',refresh);
 form.addEventListener('submit',event=>{if(step<3&&!locked()){event.preventDefault();event.stopImmediatePropagation();advance();}},true);
 form.addEventListener('invalid',event=>{const stage=event.target.closest('[data-stage]');if(stage&&!locked()){show(Number(stage.dataset.stage),false);event.target.focus({preventScroll:true});event.target.scrollIntoView?.({block:'nearest'});}},true);
 form.addEventListener('appointment-conflict',()=>{arrange=false;if(!locked())show(services().length?2:1);refresh();});
 if(form.dataset.deliveryUnknown==='true')show(3,false);else show(1,false);
 refresh();return {refresh};
}
