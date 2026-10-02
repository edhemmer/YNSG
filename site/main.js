const tasks = {
  'Help around the home':['Furniture assembly','Shelving and organizing','Household product setup','Lightweight hanging','Small drywall patch','Moving manageable items','Several small jobs'],
  'Lawn care':['Mowing','Trimming and edging','Mow, trim and blow-off','Leaf management','Recurring lawn care'],
  'Yard & garden':['Pulling weeds by hand','Bulk or bagged mulch pickup, delivery & spreading','Spreading mulch','Planting small bushes','Planting flowers','Small bush trimming','Garden-bed cleanup','Moving yard materials'],
  'Snow clearing':['Residential driveway','Sidewalks and walkways','Accessible entry','Driveway and walks'],
  'Concrete pressure washing':['Concrete driveway','Concrete walks','Concrete patio'],
  'Something else':['Describe below']
};
const form = document.querySelector('#request-form');
if(form){
  const category = form.querySelector('#service');
  const choices = form.querySelector('#task-choices');
  const fieldset = form.querySelector('#service-choices');
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
      remove.addEventListener('click',()=>{selected.delete(key(service,task));render();});
      item.append(label,remove);
      list.append(item);
    }
    summary.hidden = selected.size === 0;
    description.required = [...selected.values()].some(x=>x.service === 'Something else');
    description.minLength = description.required ? 10 : 0;
    description.placeholder = description.required ? 'Tell us what you need done.' : 'A short note is fine.';
    form.querySelector('#water-note').hidden = ![...selected.values()].some(x=>x.service === 'Concrete pressure washing');
  };
  const render = () => {
    choices.replaceChildren();
    const service = category.value;
    fieldset.hidden = !service;
    for(const task of tasks[service] || []){
      const label = document.createElement('label');
      label.className = 'service-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selected.has(key(service,task));
      checkbox.addEventListener('change',()=>{
        if(checkbox.checked){
          if(selected.size >= 15){checkbox.checked=false;message.textContent='Please choose up to 15 jobs. You can add more in the note below.';message.focus();return;}
          selected.set(key(service,task),{service,task});
        }else selected.delete(key(service,task));
        message.textContent='';
        refresh();
      });
      label.append(checkbox,document.createTextNode(service === 'Something else' ? 'Something else (describe below)' : task));
      choices.append(label);
    }
    refresh();
  };
  const choose = (service, task='') => {
    if(!Object.hasOwn(tasks,service)) return;
    category.value=service;
    const chosen=task && tasks[service].includes(task) ? task : (!task ? (service === 'Something else' ? 'Describe below' : 'Not sure yet') : '');
    if(chosen && selected.size < 15) selected.set(key(service,chosen),{service,task:chosen});
    render();
  };
  category.addEventListener('change',render);
  const params=new URLSearchParams(location.search);
  choose(params.get('service') || '',params.get('task') || '');
  document.querySelectorAll('[data-service]').forEach(link=>link.addEventListener('click',event=>{
    const section=document.querySelector('#request');
    if(!section) return;
    event.preventDefault();
    choose(link.dataset.service,link.dataset.task || '');
    section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    setTimeout(()=>category.focus({preventScroll:true}),350);
  }));
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!selected.size){message.textContent='Please choose at least one job, or choose Something else and tell us about it.';category.focus();return;}
    if(!form.reportValidity()) return;
    const button=form.querySelector('button[type=submit]');
    const data=Object.fromEntries(new FormData(form));
    data.services=[...selected.values()];
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
      message.textContent=error.message || 'We could not send your request. Please call or text 770-630-2094.';
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
