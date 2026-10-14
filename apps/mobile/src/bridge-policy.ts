import {crmOrigin} from './navigation-policy.ts';
export type NativeRequest={type:'ynsg.push.register';nonce:string;environment:'sandbox'|'production';scope:string}|{type:'ynsg.theme.changed';theme:'light'|'dark'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseNativeRequest(raw:string,url:string):NativeRequest|null{
 try{const source=new URL(url);if(source.username||source.password||source.origin!==crmOrigin||source.pathname!=='/owner'||raw.length>1024)return null;
 const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))return null;
 if(value.type==='ynsg.theme.changed'&&['light','dark'].includes(value.theme)&&Object.keys(value).length===2)return value;
 if(value.type==='ynsg.push.register'&&typeof value.nonce==='string'&&uuid.test(value.nonce)&&['sandbox','production'].includes(value.environment)&&typeof value.scope==='string'&&value.scope.split('.').length===2&&value.scope.split('.').every((id:string)=>uuid.test(id))&&Object.keys(value).length===4)return value;
 }catch{}return null;
}
export function notificationDestination(value:unknown):string|null{
 if(!value||typeof value!=='object')return null;const v=value as Record<string,unknown>;
 if(Object.keys(v).length!==4||v.version!==1||typeof v.organization!=='string'||!uuid.test(v.organization)||typeof v.object!=='string'||!uuid.test(v.object)||!['new_request','appointment'].includes(String(v.kind)))return null;
 const params=new URLSearchParams({organization:v.organization,section:v.kind==='new_request'?'Work':'Calendar'});if(v.kind==='new_request')params.set('request',v.object);
 return crmOrigin+'/owner?'+params;
}
export function appearanceScript(mode:'system'|'light'|'dark',dark:boolean){
 const chosen=dark?'dark':'light';return `(function(){if(location.origin!==${JSON.stringify(crmOrigin)})return;document.documentElement.dataset.theme=${JSON.stringify(chosen)};try{${mode==='system'?"localStorage.removeItem('ynsg.workspace.theme.v1');":`localStorage.setItem('ynsg.workspace.theme.v1',${JSON.stringify(chosen)});`}}catch{}window.dispatchEvent(new Event('ynsg-theme-sync'));})();true;`;
}
