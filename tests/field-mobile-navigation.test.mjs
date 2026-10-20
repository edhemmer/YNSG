import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('apps/web/app/workspace.tsx','utf8');
test('mobile dock uses primary task shortcuts plus accessible More drawer',()=>{
 const dock=source.slice(source.indexOf('<nav className="crm-mobile-dock"'),source.indexOf('</nav>}',source.indexOf('<nav className="crm-mobile-dock"')));
 assert.match(dock,/\['Dashboard','Requests','Calendar'\]/);
 assert.match(dock,/More workspace tools/);
 assert.match(dock,/aria-expanded=\{mobileNav\}/);
 assert.match(dock,/setMobileNav\(v=>!v\)/);
 assert.doesNotMatch(dock,/primarySections\.filter\(canSeeSection\)/);
});
test('full menu retains every existing owner module and navigation closes drawer',()=>{
 for(const key of ['Work','Money','Today','Customers','Snapshot','Learning','Activity','Settings'])assert.match(source,new RegExp("key:'"+key+"'"));
 assert.match(source,/secondarySections\.filter\(canSeeSection\)/);
 assert.match(source,/setMobileNav\(false\)/);
 assert.match(source,/Finish the current action before changing screens/);
});
