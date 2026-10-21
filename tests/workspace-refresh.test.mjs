import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const text=readFileSync(new URL('../apps/web/app/workspace.tsx',import.meta.url),'utf8');
const body=text.slice(text.indexOf('  async function refresh(selected = org)'),text.indexOf('\n  useEffect(() => {\n    setData(null);',text.indexOf('  async function refresh(selected = org)'))).replace('selected = org','selected = org');
class SessionApiError extends Error{constructor(status){super('synthetic');this.status=status;}}
test('transient workspace refresh keeps the mounted data and drafts, while access rejection clears protected data',async()=>{
 for(const status of [503,401,403]){let data={synthetic:true},error='';const context={org:'synthetic',page:0,workRequest:null,currentWorkspace:{current:{org:'synthetic'}},reloadSequence:{current:0},api:async()=>{throw new SessionApiError(status);},SessionApiError,setData:v=>data=v,setError:v=>error=v,publicError:()=> 'Synthetic failure',window:{location:{search:''}},URLSearchParams};runInNewContext(body+'\nthis.refresh=refresh;',context);await context.refresh();assert.equal(data===null,[401,403].includes(status));assert.match(error,/could not be refreshed/);}
});
