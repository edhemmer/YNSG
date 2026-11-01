// Local editorial seasons, not a weather forecast or a promise of availability.
const orders={
 winter:['snow','home','cleanout','mulch','yard','lawn','concrete','farm','leaf'],
 spring:['mulch','yard','lawn','farm','concrete','home','cleanout','leaf','snow'],
 summer:['lawn','yard','concrete','mulch','home','cleanout','farm','leaf','snow'],
 autumn:['leaf','snow','home','cleanout','yard','mulch','farm','lawn','concrete'],
 november:['leaf','snow','home','cleanout','mulch','yard','lawn','concrete','farm']
};
export function seasonalServices(date=new Date()){
 const month=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'numeric'}).format(date));
 const phase=month===11?'november':month===12||month<=2?'winter':month<=6?'spring':month<=8?'summer':'autumn';
 return {order:orders[phase],label:phase==='november'?'Leaf season now. Winter help next.':phase==='winter'?'Winter help now. Spring projects next.':phase==='spring'?'Spring and summer projects, closer to home.':phase==='summer'?'Summer upkeep, with fall projects ahead.':'Fall projects now. Winter planning next.'};
}
export function seasonalRank(key,date){const index=seasonalServices(date).order.indexOf(key);return index<0?99:index;}
export function seasonalCategoryRank(service,date){return seasonalRank({'Lawn care':seasonalServices(date).order[0]==='leaf'?'leaf':'lawn','Yard & garden':'mulch','Help around the home':'home','Snow clearing':'snow','Concrete pressure washing':'concrete','Cleanout & removal':'cleanout','Farm hand services':'farm'}[service],date);}
export function sortServiceArticles(html,date=new Date()){
 const pattern=/<article\b[^>]*data-season-service="([^"]+)"[^>]*>[\s\S]*?<\/article>/g;
 const articles=[...html.matchAll(pattern)].map(m=>({html:m[0],key:m[1]})).sort((a,b)=>seasonalRank(a.key,date)-seasonalRank(b.key,date));let index=0;
 return html.replace(pattern,()=>articles[index++].html);
}
export function orderSeasonalServices(doc,date=new Date()){
 for(const container of doc.querySelectorAll('[data-seasonal-services]')){
  const items=[...container.children].filter(item=>item.dataset.seasonService);items.sort((a,b)=>seasonalRank(a.dataset.seasonService,date)-seasonalRank(b.dataset.seasonService,date));for(const item of items)container.append(item);
 }
 for(const note of doc.querySelectorAll('[data-seasonal-note]'))note.textContent=seasonalServices(date).label+' Browse every service below; we review timing with you.';
}
if(typeof document!=='undefined')orderSeasonalServices(document);
