import test from 'node:test';import assert from 'node:assert/strict';
// @ts-expect-error Shared server JavaScript formatter.
import {ownerRequestEmail} from '../lib/owner-request-email.js';
test('owner email groups all services, promotes contacts and escapes customer content',()=>{
 const r=ownerRequestEmail({name:'<script>bad</script>',phone:'5550000000',email:'test@example.invalid',street:'100 Test St',city:'DeKalb',description:'A & B',communityRate:'Yes'},[{service:'Lawn care',task:'Mowing'},{service:'Lawn care',task:'Leaf management'},{service:'Yard',task:'Plant flowers'}],'synthetic-id');
 assert.ok(r.html.indexOf('Call customer')<r.html.indexOf('Work requested'));assert.equal((r.html.match(/<h3[^>]*>Lawn care<\/h3>/g)||[]).length,1);assert.ok(r.html.includes('Leaf management'));assert.ok(!r.html.includes('<script>'));assert.ok(r.html.includes('&lt;script&gt;'));assert.ok(r.text.endsWith('Request ID: synthetic-id'));assert.ok(r.text.includes('No appointment has been confirmed.'));
});
