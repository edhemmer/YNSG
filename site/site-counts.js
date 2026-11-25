// First-party, anonymous site counts. No cookies and no ids: each event sends only its kind, the page path
// and a broad "where they came from" category. The category is kept in this tab's session storage so later
// pages in the same visit keep their original source.
const SEARCH={google:/(^|\.)google\./,bing:/(^|\.)bing\.com$/,other_search:/(^|\.)(duckduckgo\.com|yahoo\.com|ecosia\.org|search\.brave\.com)$/},SOCIAL={facebook:/(^|\.)(facebook\.com|fb\.com|instagram\.com)$/,nextdoor:/(^|\.)nextdoor\.com$/};
export function sourceOf(referrer,search,host){
 if(/(^|&)utm_medium=email(&|$)/.test(search.replace(/^\?/,'')))return 'email';
 let ref;try{ref=new URL(referrer).hostname;}catch{return 'direct';}
 if(ref===host)return null;
 for(const [name,rule] of Object.entries({...SEARCH,...SOCIAL}))if(rule.test(ref))return name;
 if(/(mail|outlook)\./.test(ref))return 'email';
 return 'other_site';
}
function send(kind){
 try{
  if(navigator.webdriver||document.visibilityState==='prerender')return;
  let source=null;try{source=sessionStorage.getItem('ynsg-source');}catch{}
  source=source||'direct';
  const page=location.pathname.toLowerCase().replace(/\/+$/,'')||'/';
  if(!/^\/[a-z0-9/-]{0,80}$/.test(page))return;
  fetch('/api/site-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,page,source}),keepalive:true,credentials:'omit'}).catch(()=>{});
 }catch{}
}
if(typeof document!=='undefined'&&typeof location!=='undefined'){
 const found=sourceOf(document.referrer,location.search,location.hostname);
 try{if(found||!sessionStorage.getItem('ynsg-source'))sessionStorage.setItem('ynsg-source',found||'direct');}catch{}
 send('view');
 document.addEventListener('click',event=>{const link=event.target.closest?.('a[href^="tel:"]');if(link)send('call_tap');},{capture:true});
 document.addEventListener('ynsg:count',event=>{if(['request_start','request_sent','callback_sent'].includes(event.detail))send(event.detail);});
 const request=document.querySelector('#request-form');
 if(request){
  request.addEventListener('focusin',()=>send('request_start'),{once:true});
  const success=document.querySelector('#form-success');
  if(success)new MutationObserver((_,observer)=>{if(!success.hidden){send('request_sent');observer.disconnect();}}).observe(success,{attributes:true,attributeFilter:['hidden']});
 }
}
