import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';

// Every environment variable the code reads must be listed in the inventory, so
// operators always have one current list of what a deployment needs. The scan and
// the directories match how docs/production/environment.md was generated.
const root=new URL('..',import.meta.url).pathname;
const dirs=['apps/web','apps/mobile','api','lib','site','scripts','packages'];
const skip=new Set(['node_modules','.next','dist','.expo','ios','android']);

function names(){
 const found=new Set();
 const walk=directory=>{
  for(const entry of readdirSync(directory)){
   if(skip.has(entry))continue;
   const path=join(directory,entry);
   if(statSync(path).isDirectory())walk(path);
   else if(/\.(m?js|tsx?|cjs)$/.test(entry)){
    const source=readFileSync(path,'utf8');
    for(const match of source.matchAll(/(?:process\.env|\benv)\.([A-Z][A-Z0-9_]{2,})/g))found.add(match[1]);
    for(const match of source.matchAll(/process\.env\[\s*['"]([A-Z][A-Z0-9_]{2,})['"]\s*\]/g))found.add(match[1]);
   }
  }
 };
 for(const directory of dirs){try{walk(join(root,directory));}catch{/* optional directory */}}
 return [...found].sort();
}

test('every environment variable read by the code is listed in the inventory',()=>{
 const inventory=readFileSync(join(root,'docs/production/environment.md'),'utf8');
 const missing=names().filter(name=>!inventory.includes('`'+name+'`'));
 assert.deepEqual(missing,[],'Add these variables to docs/production/environment.md (names only, never values): '+missing.join(', '));
});

test('the inventory never contains a value-like assignment',()=>{
 const inventory=readFileSync(join(root,'docs/production/environment.md'),'utf8');
 assert.doesNotMatch(inventory,/[A-Z][A-Z0-9_]{3,}\s*=\s*\S/,'Inventory must list names only');
 assert.doesNotMatch(inventory,/sk_(live|test)_|eyJ[A-Za-z0-9_-]{20,}|-----BEGIN/,'Inventory must not contain credentials');
});
