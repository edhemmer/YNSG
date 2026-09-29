const tasks = {
  'Help around the home':['Furniture assembly','Shelving and organizing','Household product setup','Lightweight hanging','Small drywall patch','Moving manageable items','Several small jobs'],
  'Lawn care':['Mowing','Trimming and edging','Mow, trim and blow-off','Leaf management','Recurring lawn care'],
  'Yard & garden':['Pulling weeds by hand','Spreading mulch','Planting small bushes','Planting flowers','Small bush trimming','Garden-bed cleanup','Moving yard materials'],
  'Snow clearing':['Residential driveway','Sidewalks and walkways','Accessible entry','Driveway and walks'],
  'Concrete pressure washing':['Concrete driveway','Concrete walks','Concrete patio'],
  'Something else':[]
};
const form = document.querySelector('#request-form');
if(form){
  const service = form.elements.service;
  const task = form.elements.task;
  const description = form.elements.description;
  let suggestedDescription = '';
  const suggest = job => {
    if(description.value.trim() && description.value !== suggestedDescription) return;
    suggestedDescription = job ? `I'd like help with ${job.toLowerCase()}.` : '';
    description.value = suggestedDescription;
  };
  const fillTasks = selected => {
    task.replaceChildren(new Option('Choose a job or describe it below',''));
    for(const name of tasks[selected] || []) task.add(new Option(name,name));
    task.disabled = !selected || selected === 'Something else';
    document.querySelector('#water-note').hidden = selected !== 'Concrete pressure washing';
  };
  service.addEventListener('change',()=>{fillTasks(service.value);suggest('');});
  task.addEventListener('change',()=>suggest(task.value));
  const choose = (selected, job='') => {
    if(!(selected in tasks)) return;
    service.value=selected;
    fillTasks(selected);
    if(job && tasks[selected].includes(job)){task.value=job;suggest(job);}
  };
  const params = new URLSearchParams(location.search);
  choose(params.get('service') || '',params.get('task') || '');
  document.querySelectorAll('[data-service]').forEach(link=>link.addEventListener('click',event=>{
    const section=document.querySelector('#request');
    if(!section) return;
    event.preventDefault();
    choose(link.dataset.service,link.dataset.task || '');
    section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    setTimeout(()=>service.focus({preventScroll:true}),350);
  }));
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!form.reportValidity()) return;
    const button=form.querySelector('button[type=submit]');
    const message=document.querySelector('#form-message');
    const data=Object.fromEntries(new FormData(form));
    button.disabled=true;
    button.firstChild.textContent='Sending… ';
    message.textContent='';
    document.querySelector('#email-fallback').hidden=true;
    try{
      const response=await fetch('/api/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error || 'We could not send your request. Please call or text 770-630-2094.');
      form.hidden=true;
      document.querySelector('#form-success').hidden=false;
      document.querySelector('#form-success h3').setAttribute('tabindex','-1');
      document.querySelector('#form-success h3').focus();
    }catch(error){
      message.textContent=error.message || 'We could not send your request. Please call or text 770-630-2094.';
      const fallback=document.querySelector('#email-fallback');
      const subject='Your Neighborhood Service Guy New Request';
      const body=[`Service: ${data.service}`,`Job: ${data.task || 'Not selected'}`,`Details: ${data.description}`,`Name: ${data.name}`,`Phone: ${data.phone}`,`Email: ${data.email || 'Not provided'}`,`Address: ${data.street}, ${data.city}, IL`,`Preferred time: ${data.preferredTime || 'Not specified'}`,`Community Rate inquiry: ${data.communityRate}`].join('\n\n');
      fallback.querySelector('a').href=`mailto:edhemmer@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0,2500))}`;
      fallback.hidden=false;
      message.focus();
    }
    finally{button.disabled=false;button.firstChild.textContent='Send service request ';}
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
