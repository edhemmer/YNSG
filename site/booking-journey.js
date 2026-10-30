// Keep the existing form and delivery contracts while presenting one stage at a time.
export function bookingJourney({form,services,requestData,resumeSelected=false}){
 const progress=form.querySelector('.booking-progress'),stages=[...form.querySelectorAll('[data-stage]')];
 if(!progress||stages.length!==3)return {refresh(){}};
 let step=1,arrange=false,hadTime=false,lastReview='';
 const description=form.querySelector('#description'),workNote=description.closest('.form-field'),noteHome=form.ownerDocument.createComment('work-note'),detailsNote=form.querySelector('#booking-details-note');
 workNote.before(noteHome);
 let noteOnly=resumeSelected&&services().length>0&&description.required&&!description.validity.valid;
 const servicePicker=form.querySelector('#service-picker'),serviceHeading=form.querySelector('#service-heading'),serviceIntro=serviceHeading.nextElementSibling,originalHeading=serviceHeading.textContent,originalIntro=serviceIntro.textContent;
 const noteEdit=form.ownerDocument.createElement('button');noteEdit.type='button';noteEdit.className='booking-text-button';noteEdit.textContent='Edit jobs';noteEdit.hidden=true;noteHome.before(noteEdit);
 noteEdit.addEventListener('click',()=>{if(!locked()){noteOnly=false;show(1);refresh();}});
 function serviceView(){if(!services().length)noteOnly=false;servicePicker.hidden=Boolean(noteOnly);noteEdit.hidden=!noteOnly;noteEdit.disabled=locked();serviceHeading.textContent=noteOnly?'A note about your other job':originalHeading;serviceIntro.textContent=noteOnly?'Your jobs are selected. Tell us a little about the other work before choosing a time.':originalIntro;}
 function placeNote(){if(!detailsNote)return;if(step===1&&description.required)noteHome.after(workNote);else detailsNote.append(workNote);}
 const locked=()=>form.dataset.deliveryUnknown==='true'||form.getAttribute('aria-busy')==='true'||form.dataset.appointmentHolding==='true';
 const message=form.querySelector('#form-message'),nextTime=form.querySelector('#booking-time-next'),summary=form.querySelector('#booking-summary');
 function refresh(){
  progress.querySelectorAll('[data-booking-step]').forEach(b=>{b.disabled=locked()||Number(b.dataset.bookingStep)>step;});
  const selected=Boolean(form.dataset.appointmentStart&&form.dataset.appointmentHoldToken);
  if(selected)arrange=false;
  nextTime.disabled=locked()||(!selected&&!arrange);
  serviceView();placeNote();
  const data=requestData(),jobs=services(),doc=form.ownerDocument;
  const fingerprint=JSON.stringify([step,jobs,data.preferredTime||'',selected,arrange,locked()]);
  if(fingerprint!==lastReview){lastReview=fingerprint;
  const heading=doc.createElement('strong');heading.textContent=(step===2?'Your selected jobs · ':'Your request · ')+jobs.length+' '+(jobs.length===1?'job':'jobs');
  const list=doc.createElement('ul');for(const job of jobs){const item=doc.createElement('li');item.textContent=job.service+': '+(job.task||'Details to review');list.append(item);}
  const time=doc.createElement('p');time.textContent=step===2&&!selected&&!arrange?'Choose a preferred time below, or let us arrange one.':data.preferredTime?'Requested time: '+data.preferredTime:'We’ll arrange a time with you';
  const note=doc.createElement('p');note.className='tiny';note.textContent=step===2?'Nothing is sent until you press Send appointment request.':'One combined request. We’ll confirm the work, price and appointment with you.';
  const edit=doc.createElement('button');edit.type='button';edit.className='booking-text-button booking-edit-jobs';edit.textContent='Edit jobs';edit.disabled=locked();edit.addEventListener('click',()=>{if(!locked()){noteOnly=false;show(1);refresh();}});
  summary.replaceChildren(heading,list,edit,time,note);}
  if(hadTime&&!selected&&!arrange&&step===3&&!locked()){show(2);message.textContent='Please choose a time again, or ask us to arrange one.';}
  hadTime=selected;
 }
 function show(value,focus=true){
  step=value;serviceView();placeNote();stages.forEach(s=>s.hidden=Number(s.dataset.stage)!==step);
  progress.querySelectorAll('[data-booking-step]').forEach(b=>{b.disabled=locked()||Number(b.dataset.bookingStep)>step;b.setAttribute('aria-current',Number(b.dataset.bookingStep)===step?'step':'false');});
  summary.hidden=step===1;
  if(step>1)stages[step-1].querySelector('h2').after(summary);
  progress.querySelectorAll('[data-booking-step]').forEach(b=>{const completed=Number(b.dataset.bookingStep)<step;b.classList.toggle('booking-step-complete',completed);b.querySelector('span').textContent=completed?'✓':b.dataset.bookingStep;});
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
 progress.querySelectorAll('[data-booking-step]').forEach(b=>b.addEventListener('click',()=>{if(!locked()&&Number(b.dataset.bookingStep)<=step){message.textContent='';if(Number(b.dataset.bookingStep)===1)noteOnly=false;show(Number(b.dataset.bookingStep));refresh();}}));
 form.querySelectorAll('[data-booking-back]').forEach(b=>b.addEventListener('click',()=>{if(!locked()){message.textContent='';if(Number(b.dataset.bookingBack)===1)noteOnly=false;show(Number(b.dataset.bookingBack));refresh();}}));
 form.querySelector('#calendar-clear').addEventListener('click',()=>{if(locked())return;arrange=true;hadTime=false;show(3);});
 form.addEventListener('request-services-changed',refresh);
 form.addEventListener('appointment-selection-changed',refresh);form.addEventListener('input',refresh);form.addEventListener('change',refresh);
 form.addEventListener('submit',event=>{if(step<3&&!locked()){event.preventDefault();event.stopImmediatePropagation();advance();}},true);
 form.addEventListener('invalid',event=>{const stage=event.target.closest('[data-stage]');if(stage&&!locked()){show(Number(stage.dataset.stage),false);event.target.focus({preventScroll:true});event.target.scrollIntoView?.({block:'nearest'});}},true);
 form.addEventListener('appointment-conflict',()=>{arrange=false;if(!locked())show(services().length?2:1);refresh();});
 if(form.dataset.deliveryUnknown==='true')show(3,false);else show(resumeSelected&&services().length&&description.validity.valid?2:1,false);
 refresh();return {refresh,currentStep:()=>step};
}
