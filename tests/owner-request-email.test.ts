import test from 'node:test';import assert from 'node:assert/strict';
import {ownerRequestEmail} from '../lib/owner-request-email.js';
test('owner email groups all services, promotes contacts and escapes customer content',()=>{
 const r=ownerRequestEmail({name:'<script>bad</script>',phone:'5550000000',email:'test@example.invalid',street:'100 Test St',city:'DeKalb',description:'A & B',communityRate:'Yes'},[{service:'Lawn care',task:'Mowing'},{service:'Lawn care',task:'Leaf management'},{service:'Yard',task:'Plant flowers'}],'synthetic-id');
 assert.ok(r.html.indexOf('Call customer')<r.html.indexOf('Work requested'));assert.equal((r.html.match(/<h3[^>]*>Lawn care<\/h3>/g)||[]).length,1);assert.ok(r.html.includes('Leaf management'));assert.ok(!r.html.includes('<script>'));assert.ok(r.html.includes('&lt;script&gt;'));assert.ok(r.text.endsWith('Request ID: synthetic-id'));assert.ok(r.text.includes('No appointment has been confirmed.'));
});
import {emailRaw} from '../apps/web/lib/google-core.ts';
test('Gmail owner notification contains readable HTML and plain text with safe Reply-To',()=>{
 const message=ownerRequestEmail({name:'Test customer',phone:'5550000000',email:'customer@example.invalid',street:'100 Test St',city:'Test City'},[{service:'Yard',task:'Mulch pickup'}],'request-test','Test Company','','https://crm.example.invalid/?request=request-test');
 const raw=Buffer.from(emailRaw('owner@example.invalid','owner@example.invalid','Test Company New Request',message.text,'ynsg-test',{html:message.html,replyTo:'customer@example.invalid'}),'base64url').toString();
 assert.ok(raw.includes('Reply-To: customer@example.invalid\r\n'));assert.ok(raw.includes('multipart/alternative'));assert.ok(raw.endsWith('--ynsg-alt-ynsg-test--\r\n'));
 const parts=[...raw.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)(?=\r\n--)/g)].map(x=>Buffer.from(x[1]!.replace(/\r\n/g,''),'base64').toString());
 assert.deepEqual(parts,[message.text,message.html]);assert.ok(message.html.includes('Open request in CRM'));
 assert.throws(()=>emailRaw('owner@example.invalid','owner@example.invalid','Test',message.text,'ynsg-test',{replyTo:'customer@example.invalid\r\nBcc: victim@example.invalid'}));
 const plain=Buffer.from(emailRaw('owner@example.invalid','customer@example.invalid','Test','Plain fallback','ynsg-plain'),'base64url').toString();assert.ok(plain.includes('Content-Type: text/plain'));assert.ok(!plain.includes('multipart/alternative'));assert.ok(!plain.includes('Reply-To:'));
});
