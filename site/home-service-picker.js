import {serviceCatalog} from './service-catalog.js';
/** Progressive enhancement: original links and category form work without this module. */
export function homeServicePicker(doc){
 const panel=doc.querySelector('.service-request-panel'),form=panel?.querySelector('form');if(!form)return;
 const selected=new Map(),checks=new Map(),groups=new Map(),buttons=[];
 const key=(service,task)=>JSON.stringify({service,task});
 const fieldset=form.querySelector('fieldset');fieldset.replaceChildren();
 const legend=doc.createElement('legend');legend.textContent='Choose your jobs';fieldset.append(legend);
 const status=doc.createElement('p');status.setAttribute('role','status');status.className='service-picker-status';
 const review=doc.createElement('ul');review.className='service-picker-selection';review.setAttribute('aria-label','Jobs in your request');
 fieldset.before(status,review);
 const submit=form.querySelector('button[type=submit]');
 function refresh(){
  review.replaceChildren();
  for(const [id,item] of selected){const li=doc.createElement('li'),label=doc.createElement('span'),remove=doc.createElement('button');label.textContent=item.task;remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+item.task);remove.addEventListener('click',()=>{selected.delete(id);refresh();(selected.size?submit:fieldset.querySelector('summary')).focus();});li.append(label,remove);review.append(li);}
  for(const [id,input] of checks)input.checked=selected.has(id);
  for(const {button,id,title} of buttons){if(!id)continue;const added=selected.has(id);button.setAttribute('aria-pressed',String(added));button.textContent=added?'Added · '+title.toLowerCase():'Add '+title.toLowerCase();}
  submit.disabled=selected.size===0;submit.textContent=selected.size?'Continue with '+selected.size+' '+(selected.size===1?'job':'jobs')+' →':'Choose a job to continue';
  status.textContent=selected.size?selected.size+' '+(selected.size===1?'job':'jobs')+' in one request. You can edit your choices next.':'Add jobs from a card or open a service group.';
  panel.dataset.hasJobs=String(selected.size>0);doc.body.classList.toggle('has-service-selection',selected.size>0);
 }
 function toggle(service,task){const id=key(service,task);if(selected.has(id))selected.delete(id);else if(selected.size<15)selected.set(id,{service,task});else{status.textContent='Choose up to 15 jobs. You can describe more on the next screen.';refreshChecks();return;}refresh();}
 function refreshChecks(){for(const [id,input] of checks)input.checked=selected.has(id);}
 for(const [service,tasks] of Object.entries(serviceCatalog)){
  const group=doc.createElement('details'),summary=doc.createElement('summary');summary.textContent=service==='Help around the home'?'Small home jobs':service;group.append(summary);groups.set(service,group);
  for(const task of tasks){const label=doc.createElement('label'),input=doc.createElement('input'),span=doc.createElement('span');input.type='checkbox';input.name='job';input.value=key(service,task);span.textContent=task;checks.set(input.value,input);input.addEventListener('change',()=>toggle(service,task));label.append(input,span);group.append(label);}
  fieldset.append(group);
 }
 for(const link of doc.querySelectorAll('.home-service-book')){
  const params=new URL(link.href).searchParams,service=params.get('service'),task=params.get('task'),title=link.closest('article').querySelector('h3').textContent.trim();if(!Object.hasOwn(serviceCatalog,service))continue;
  const button=doc.createElement('button');button.type='button';button.className=link.className;button.dataset.bookingHref=link.getAttribute('href');const exact=serviceCatalog[service].includes(task);button.textContent=exact?'Add '+title.toLowerCase():'Choose jobs →';if(!exact)button.setAttribute('aria-label','Choose jobs for '+title.toLowerCase());
  button.addEventListener('click',()=>{if(exact)toggle(service,task);else{const group=groups.get(service);group.open=true;group.querySelector('summary').focus();group.scrollIntoView({block:'center',behavior:'instant'});}});
  buttons.push({button,id:exact?key(service,task):null,title});link.replaceWith(button);
 }
 form.addEventListener('submit',event=>{if(!selected.size){event.preventDefault();status.textContent='Choose at least one job to continue.';}});
 panel.querySelector('h3').textContent='Your service request';panel.querySelector('p').textContent='Add the jobs you need. Send them together as one request.';
 const next=submit.nextElementSibling;if(next)next.textContent='Next: review your jobs, choose a time if you like, and add your details.';
 refresh();
}

if(typeof document!=='undefined')homeServicePicker(document);
