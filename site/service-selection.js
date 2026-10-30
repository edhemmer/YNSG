import {serviceCatalog} from './service-catalog.js';
const storageKey='ynsg-service-selection-v1',lifetime=24*60*60*1000;
export function validServiceChoices(items){
 if(!Array.isArray(items))return [];
 const chosen=new Map();for(const item of items.slice(0,30)){if(item&&typeof item.service==='string'&&typeof item.task==='string'&&Object.hasOwn(serviceCatalog,item.service)&&serviceCatalog[item.service].includes(item.task)){chosen.set(JSON.stringify([item.service,item.task]),{service:item.service,task:item.task});if(chosen.size===15)break;}}return [...chosen.values()];
}
export function choicesFromUrl(params){const items=[];for(const text of params.getAll('job').slice(0,30)){if(text.length>500)continue;try{items.push(JSON.parse(text));}catch{/* Ignore malformed public job hints. */}}return validServiceChoices(items);}
export function readServiceSelection(storage,now=Date.now()){
 try{const raw=storage?.getItem(storageKey);if(!raw||raw.length>15000)return [];const value=JSON.parse(raw);if(value.version!==1||!Number.isFinite(value.at)||value.at>now||now-value.at>=lifetime){storage?.removeItem(storageKey);return [];}return validServiceChoices(value.jobs);}catch{return [];}
}
export function saveServiceSelection(storage,jobs,now=Date.now()){
 try{if(!storage)return false;const chosen=validServiceChoices(jobs);if(!chosen.length)storage.removeItem(storageKey);else storage.setItem(storageKey,JSON.stringify({version:1,at:now,jobs:chosen}));return true;}catch{return false;}
}
export function clearServiceSelection(storage){try{storage?.removeItem(storageKey);}catch{/* Browsing must work with storage blocked. */}}
