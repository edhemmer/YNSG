import {seasonalCategoryRank} from './seasonal-services.js';
import {choicesFromUrl,readServiceSelection,saveServiceSelection} from './service-selection.js';
import {serviceCatalog} from './service-catalog.js';
/** Progressive enhancement: original links and category form work without this module. */
export function homeServicePicker(doc){
 const panel=doc.querySelector('.service-request-panel'),form=panel?.querySelector('form');if(!form)return;
 let storage;try{storage=doc.defaultView?.sessionStorage;}catch{}
 let canPersist=false;
 const selected=new Map(),checks=new Map(),groups=new Map(),buttons=[];
 const params=new URL(doc.URL).searchParams;
 for(const item of params.has('job')?choicesFromUrl(params):readServiceSelection(storage))selected.set(JSON.stringify(item),item);
 const key=(service,task)=>JSON.stringify({service,task});
 const fieldset=form.querySelector('fieldset');fieldset.replaceChildren();
 const legend=doc.createElement('legend');legend.textContent='Choose your jobs';fieldset.append(legend);
 const status=doc.createElement('p');status.setAttribute('role','status');status.className='service-picker-status';
 const review=doc.createElement('ul');review.className='service-picker-selection';review.setAttribute('aria-label','Jobs in your request');
 fieldset.before(status,review);
 const submit=form.querySelector('button[type=submit]');
 function refresh(){
  canPersist=saveServiceSelection(storage,[...selected.values()]);
  review.replaceChildren();
  for(const [id,item] of selected){const li=doc.createElement('li'),label=doc.createElement('span'),remove=doc.createElement('button');label.textContent=item.task;remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+item.task);remove.addEventListener('click',()=>{selected.delete(id);refresh();(selected.size?submit:fieldset.querySelector('summary')).focus();});li.append(label,remove);review.append(li);}
  for(const [id,input] of checks)input.checked=selected.has(id);
  for(const {button,id,title} of buttons){if(!id)continue;const added=selected.has(id);button.setAttribute('aria-pressed',String(added));button.textContent=added?'Added · '+title.toLowerCase():'Add '+title.toLowerCase();}
  submit.disabled=false;submit.textContent=selected.size?'Continue with '+selected.size+' '+(selected.size===1?'job':'jobs')+' →':'Choose your first job →';
  status.hidden=selected.size===0;
  status.textContent=selected.size?selected.size+' '+(selected.size===1?'job':'jobs')+' in one request. You can edit your choices next.':(panel.dataset.preferredService?'Pick one or more jobs.':'Choose a group or add from a card.');
  panel.dataset.hasJobs=String(selected.size>0);doc.body.classList.toggle('has-service-selection',selected.size>0);
 }
 function toggle(service,task){const id=key(service,task);if(selected.has(id))selected.delete(id);else if(selected.size<15)selected.set(id,{service,task});else{status.textContent='Choose up to 15 jobs. You can describe more on the next screen.';refreshChecks();return;}refresh();}
 function refreshChecks(){for(const [id,input] of checks)input.checked=selected.has(id);}
 const otherServices=doc.createElement('details'),otherTitle=doc.createElement('summary');otherServices.className='picker-other-services';otherTitle.textContent='Add other services';otherServices.append(otherTitle);
 const entries=Object.entries(serviceCatalog).sort(([a],[b])=>Number(b===panel.dataset.preferredService)-Number(a===panel.dataset.preferredService)||seasonalCategoryRank(a)-seasonalCategoryRank(b));
 for(const [service,available] of entries){
  const tasks=[...available].sort((a,b)=>Number(b===panel.dataset.preferredTask)-Number(a===panel.dataset.preferredTask));
  const group=doc.createElement('details'),summary=doc.createElement('summary');summary.textContent=service==='Help around the home'?'Small home jobs':service;group.append(summary);groups.set(service,group);group.open=service===panel.dataset.preferredService;
  const visibleCount=panel.dataset.preferredService===service?(panel.dataset.preferredTask?1:3):tasks.length;
  const more=doc.createElement('details'),moreTitle=doc.createElement('summary');more.className='picker-more-jobs';moreTitle.textContent='More '+(service==='Help around the home'?'home':service.toLowerCase())+' jobs ('+Math.max(0,tasks.length-visibleCount)+')';more.append(moreTitle);
  let index=0;
  for(const task of tasks){const label=doc.createElement('label'),input=doc.createElement('input'),span=doc.createElement('span');input.type='checkbox';input.name='job';input.value=key(service,task);span.textContent=task;checks.set(input.value,input);input.addEventListener('change',()=>toggle(service,task));label.append(input,span);if(index++<visibleCount)group.append(label);else{more.append(label);if(selected.has(input.value))more.open=true;}}
  if(tasks.length>visibleCount)group.append(more);
  if(panel.dataset.preferredService&&service!==panel.dataset.preferredService){otherServices.append(group);if([...selected.values()].some(item=>item.service===service))otherServices.open=true;}else fieldset.append(group);
 }
 if(panel.dataset.preferredService)fieldset.append(otherServices);
 for(const link of doc.querySelectorAll('.home-service-book')){
  const params=new URL(link.href).searchParams,service=params.get('service'),task=params.get('task'),title=link.closest('article').querySelector('h3').textContent.trim();if(!Object.hasOwn(serviceCatalog,service))continue;
  const button=doc.createElement('button');button.type='button';button.className=link.className;button.dataset.bookingHref=link.getAttribute('href');const exact=serviceCatalog[service].includes(task);button.textContent=exact?'Add '+title.toLowerCase():'Choose jobs →';if(!exact)button.setAttribute('aria-label','Choose jobs for '+title.toLowerCase());
  button.addEventListener('click',()=>{if(exact)toggle(service,task);else{const group=groups.get(service);group.open=true;group.querySelector('summary').focus();group.scrollIntoView({block:'center',behavior:'instant'});}});
  buttons.push({button,id:exact?key(service,task):null,title});link.replaceWith(button);
 }
 form.addEventListener('submit',event=>{if(!selected.size){event.preventDefault();status.hidden=false;status.textContent='Choose a service group, then add the jobs you need.';const group=groups.get(panel.dataset.preferredService)||groups.values().next().value;group.open=true;group.querySelector('summary').focus();}});
 panel.querySelector('h3').textContent=panel.dataset.requestTitle||'Your service request';panel.querySelector('p').textContent='Choose jobs for one request.';
 const next=submit.nextElementSibling;if(next)next.textContent='Your jobs carry into step 2: optional timing. Add your details in step 3.';
 const help=doc.createElement('details'),helpTitle=doc.createElement('summary');help.className='service-picker-help';helpTitle.textContent='How your request works';help.append(helpTitle);if(next)help.append(next);const assurance=panel.querySelector('.service-picker-assurance');if(assurance)help.append(assurance);form.after(help);const pricing=panel.querySelector(':scope > .text-link');if(pricing)pricing.textContent='Rates & Community Rate →';
 doc.defaultView?.addEventListener('pageshow',event=>{if(!event.persisted||!canPersist)return;selected.clear();for(const item of readServiceSelection(storage))selected.set(key(item.service,item.task),item);refresh();});
 refresh();
}

if(typeof document!=='undefined')homeServicePicker(document);
