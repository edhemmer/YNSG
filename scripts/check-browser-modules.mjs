import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
export async function verifyBrowserModules(directory){
 const root=resolve(directory),files=[];
 async function visit(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,e.name);if(e.isDirectory())await visit(path);else if(/\.(?:m?js|html)$/.test(e.name))files.push(path);}}
 await visit(root);let count=0;
 for(const file of files){const text=await readFile(file,'utf8'),base=new URL(relative(root,file).split(sep).join('/'),'https://built.example.invalid/');
  const paths=file.endsWith('.html')?[...text.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(m=>m[1]):[...text.matchAll(/(?:\b(?:import|export)\s+(?:[^;"']*?\s+from\s*)?|\bimport\s*\()\s*["']([^"']+)["']/g)].map(m=>m[1]);
  for(const path of paths){if(!path.startsWith('.')&&!path.startsWith('/'))continue;const url=new URL(path,base);if(url.origin!==base.origin)continue;const target=resolve(root,'.'+decodeURIComponent(url.pathname));assert.ok(target.startsWith(root+sep),'Browser import escapes published files');await access(target).catch(()=>assert.fail(relative(root,file)+': missing published browser dependency '+path));count++;}
 }
 console.log('PASS: '+count+' published browser script/import dependencies resolve.');return count;
}
