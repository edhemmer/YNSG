import test from 'node:test';import assert from 'node:assert/strict';
import {stripeSetup,liveStripeKey} from '../apps/web/lib/stripe-setup.ts';
const org='20000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000002';
const env={STRIPE_SECRET_KEY:'rk_live_synthetic',STRIPE_WEBHOOK_SECRET:'whsec_synthetic',STRIPE_MERCHANTS_JSON:JSON.stringify({[org]:'acct_synthetic'}),APP_ORIGIN:'https://workspace.example.invalid',SUPABASE_URL:'https://db.example.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-database-key'};
test('configuration accepts live restricted and legacy keys without claiming provider or payment evidence',()=>{
 assert.equal(liveStripeKey('rk_live_synthetic'),true);assert.equal(liveStripeKey('sk_live_synthetic'),true);for(const key of ['sk_test_synthetic','rk_test_synthetic','pk_live_synthetic','rk_live_synthetic\n','rk_live_'])assert.equal(liveStripeKey(key),false);
 const state=stripeSetup(org,env);assert.equal(state.configured,true);assert.ok(!JSON.stringify(state).includes('synthetic'));assert.ok(!('merchantVerified' in state));
});
test('missing, invalid, and cross-tenant merchant configuration is actionable and secret-free',()=>{
 assert.equal(stripeSetup(org,{}).configured,false);assert.equal(stripeSetup(other,env).checks.merchant,'unassigned');
 assert.equal(stripeSetup(org,{...env,STRIPE_MERCHANTS_JSON:'not JSON'}).checks.merchant,'invalid');
 assert.equal(stripeSetup(org,{...env,STRIPE_MERCHANTS_JSON:JSON.stringify({[org]:'acct_same',[other]:'acct_same'})}).checks.merchant,'invalid');
 assert.equal(stripeSetup(org,{...env,STRIPE_SECRET_KEY:'sk_test_synthetic'}).checks.apiKey,'invalid');
 assert.equal(stripeSetup(org,{...env,APP_ORIGIN:'https://workspace.example.invalid/path'}).checks.workspace,'invalid');
 assert.equal(stripeSetup(org,{...env,STRIPE_WEBHOOK_SECRET:'whsec_synthetic\n'}).checks.webhook,'invalid');
});
