function requestErrorMessage(error){
  const approved=new Set([
    'Please check the form and try again.',
    'Please refresh the page before sending your request.',
    'Please choose at least one job.',
    'Please check the required fields and try again.',
    'Please check your selected services and required fields.',
    'Please wait before sending another request, or call or text 770-630-2094.',
    'This request changed while it was sending. Refresh the page before sending the updated details.',
    'We could not verify that your request was saved. Try again with the same details, or call or text 770-630-2094.',
    'The form is temporarily unavailable. Please call or text 770-630-2094.'
  ]);
  const message=typeof error==='string'?error:error?.message;
  return approved.has(message)?message:'We could not confirm that your request was sent. Try again with the same details, or call or text 770-630-2094.';
}
// End public error helper.
const tasks = {
  'Help around the home':['Furniture assembly','Shelving and organizing','Household product setup','Lightweight hanging','Small drywall patch','Moving manageable items','Several small jobs'],
  'Lawn care':['Mowing','Trimming and edging','Mow, trim and blow-off','Leaf management','Recurring lawn care'],
  'Yard & garden':['Pulling weeds by hand','Bulk or bagged mulch pickup, delivery & spreading','Spreading mulch','Planting small bushes','Planting flowers','Small bush trimming','Garden-bed cleanup','Moving yard materials'],
  'Snow clearing':['Residential driveway','Sidewalks and walkways','Accessible entry','Driveway and walks'],
  'Concrete pressure washing':['Concrete driveway','Concrete walks','Concrete patio'],
  'Something else':['Describe below']
};
// getRandomValues supports older iPhone browsers that do not yet expose randomUUID.
function newRequestKey(){
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const value=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;
}
const form = document.querySelector('#request-form');
if(form){
  const groups = form.querySelector('#service-groups');
  const categoryGroups = new Map();
  const checkboxes = new Map();
  const list = form.querySelector('#selected-service-list');
  const summary = form.querySelector('#selected-services');
  const description = form.querySelector('#description');
  const message = form.querySelector('#form-message');
  const selected = new Map();
  const key = (service, task) => `${service}::${task}`;
  const refresh = () => {
    list.replaceChildren();
    for(const {service,task} of selected.values()){
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = service === 'Something else' ? 'Something else' : `${service}: ${task}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-service';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label',`Remove ${label.textContent}`);
      remove.addEventListener('click',()=>{selected.delete(key(service,task));refresh();form.querySelector('#service-count').focus();});
      item.append(label,remove);
      list.append(item);
    }
    summary.hidden = selected.size === 0;
    for(const [id,checkbox] of checkboxes) checkbox.checked=selected.has(id);
    for(const [service,group] of categoryGroups){
      const count=[...selected.values()].filter(item=>item.service===service).length;
      group.querySelector('.category-count').textContent=count ? `${count} selected` : '';
    }
    form.querySelector('#service-count').textContent=selected.size ? `${selected.size} ${selected.size===1?'job':'jobs'} selected. You can add jobs from any section.` : 'No jobs selected yet.';
    description.required = [...selected.values()].some(x=>x.service === 'Something else');
    description.minLength = description.required ? 10 : 0;
    description.placeholder = description.required ? 'Tell us what you need done.' : 'A short note is fine.';
    form.querySelector('#water-note').hidden = ![...selected.values()].some(x=>x.service === 'Concrete pressure washing');
  };
  const names={'Help around the home':'Home jobs','Lawn care':'Lawn care','Yard & garden':'Yard & garden','Snow clearing':'Snow clearing','Concrete pressure washing':'Concrete pressure washing','Something else':'Something else'};
  for(const [service,jobs] of Object.entries(tasks)){
    const group=document.createElement('details');
    group.className='request-category';
    const heading=document.createElement('summary');
    const title=document.createElement('strong');title.textContent=names[service];
    const count=document.createElement('span');count.className='category-count';count.textContent='';
    const action=document.createElement('span');action.className='category-action';action.textContent='Press or click to see jobs';
    heading.append(title,count,action);
    group.addEventListener('toggle',()=>{action.textContent=group.open?'Press or click to close':'Press or click to see jobs';});
    const choices=document.createElement('div');choices.className='request-category-jobs';
    for(const task of jobs){
      const label=document.createElement('label');label.className='service-option';
      const checkbox=document.createElement('input');checkbox.type='checkbox';
      checkboxes.set(key(service,task),checkbox);
      checkbox.addEventListener('change',()=>{
        if(checkbox.checked){
          if(selected.size>=15){checkbox.checked=false;message.textContent='Please choose up to 15 jobs. You can add more in the note below.';message.focus();return;}
          selected.set(key(service,task),{service,task});
        }else selected.delete(key(service,task));
        message.textContent='';refresh();
      });
      label.append(checkbox,document.createTextNode(service==='Something else'?'Describe another job below':task));choices.append(label);
    }
    group.append(heading,choices);groups.append(group);categoryGroups.set(service,group);
  }
  form.querySelector('#service-count').tabIndex=-1;
  const choose=(service,task='')=>{
    if(!Object.hasOwn(tasks,service))return;
    categoryGroups.get(service).open=true;
    const chosen=task && tasks[service].includes(task) ? task : (service==='Something else'?'Describe below':'');
    if(chosen && selected.size<15)selected.set(key(service,chosen),{service,task:chosen});
    refresh();
  };
  refresh();
  const params=new URLSearchParams(location.search);
  choose(params.get('service') || '',params.get('task') || '');
  document.querySelectorAll('[data-service]').forEach(link=>link.addEventListener('click',event=>{
    const section=document.querySelector('#request');
    if(!section) return;
    event.preventDefault();
    choose(link.dataset.service,link.dataset.task || '');
    section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    setTimeout(()=>categoryGroups.get(link.dataset.service)?.querySelector('summary').focus({preventScroll:true}),350);
  }));
  let requestKey='', requestFingerprint='';
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!selected.size){message.textContent='Please choose at least one job, or choose Something else and tell us about it.';groups.querySelector('summary').focus();return;}
    if(!form.reportValidity()) return;
    const button=form.querySelector('button[type=submit]');
    const data=Object.fromEntries(new FormData(form));
    data.services=[...selected.values()];
    const fingerprint=JSON.stringify(data);
    if(fingerprint!==requestFingerprint){requestKey=newRequestKey();requestFingerprint=fingerprint;}
    data.requestKey=requestKey;
    button.disabled=true;
    button.firstChild.textContent='Sending… ';
    message.textContent='';
    form.querySelector('#email-fallback').hidden=true;
    try{
      const response=await fetch('/api/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error || 'We could not send your request. Please call or text 770-630-2094.');
      form.hidden=true;
      const success=document.querySelector('#form-success');
      success.hidden=false;
      success.querySelector('h3').setAttribute('tabindex','-1');
      success.querySelector('h3').focus();
    }catch(error){
      message.textContent=requestErrorMessage(error);
      const fallback=form.querySelector('#email-fallback');
      const subject='Your Neighborhood Service Guy New Request';
      const jobs=data.services.map(x=>`${x.service}: ${x.task}`).join('\n');
      const body=[`Jobs requested:\n${jobs}`,`Details: ${data.description || 'Not specified'}`,`Name: ${data.name}`,`Phone: ${data.phone}`,`Email: ${data.email}`,`Address: ${data.street}, ${data.city}, IL`,`Preferred time: ${data.preferredTime || 'Not specified'}`,`Community Rate inquiry: ${data.communityRate}`].join('\n\n');
      fallback.querySelector('a').href=`mailto:edhemmer@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0,2500))}`;
      fallback.hidden=false;
      message.focus();
    }finally{button.disabled=false;button.firstChild.textContent='Send service request ';}
  });
}
const motion=matchMedia('(prefers-reduced-motion: reduce)');
if(!motion.matches && document.querySelector('.hero')){
  let queued=false;
  const update=()=>{
    const y=Math.min(window.scrollY,700);
    document.documentElement.style.setProperty('--scroll-shift',`${y*.15}px`);
    document.documentElement.style.setProperty('--art-shift',`${y*.065}px`);
    queued=false;
  };
  window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update)}},{passive:true});
  motion.addEventListener('change',()=>{if(motion.matches){document.documentElement.style.removeProperty('--scroll-shift');document.documentElement.style.removeProperty('--art-shift');}});
}

document.querySelectorAll(".service-category").forEach(category=>{const action=category.querySelector(".home-category-action");if(!action)return;const update=()=>{action.textContent=category.open?"Press or click to close":"Press or click to see jobs";};category.addEventListener("toggle",update);update();});
