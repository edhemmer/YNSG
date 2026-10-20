// Executable regression against the built application and an isolated provider.
// Browser-generated headers are observed; Origin is never supplied by the test.
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
export async function verifyBrowserAuth({origin,providerOrigin,email,faults,password,counts}){
 for(const [name,engine] of Object.entries({chromium,webkit})){
  const browser=await engine.launch({headless:true});
  try{
   for(const javaScriptEnabled of [true,false]){
    const context=await browser.newContext({javaScriptEnabled,ignoreHTTPSErrors:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await context.route('**/*',route=>{const url=new URL(route.request().url());return [origin,providerOrigin].includes(url.origin)?route.continue():route.abort();});
    console.log('Checking '+name+' mobile, JavaScript '+javaScriptEnabled);
    const page=await context.newPage(),origins=[];
    page.on('request',r=>{if(r.method()==='POST'&&r.url()===origin+'/auth/access')origins.push(r.headers().origin??null);});
    const submit=async(label,url)=>{await Promise.all([page.waitForURL(url),page.getByRole('button',{name:label,exact:true}).click()]);};
    // Reproduce the policy defect without credentials or a provider request.
    for(const [policy,expected] of [['no-referrer','null'],['same-origin',providerOrigin]]){
     await page.goto(providerOrigin+'/origin-policy?policy='+policy);await submit('Submit probe','**/origin-result');
     const result=JSON.parse(await page.locator('body').innerText());assert.equal(result.origin,expected,name+' '+policy+' browser Origin');
    }
    await page.goto(origin+'/sign-in');await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill('synthetic-wrong-password');
    await Promise.all([page.waitForResponse(r=>r.url()===origin+'/auth/access').then(r=>assert.equal(r.status(),303,'Native password submit must not be rejected by document policy')),submit('Sign in','**/sign-in?error=invalid')]);
    assert.ok(await page.locator('p[role="alert"]').isVisible());
    await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password());
    await submit('Sign in','**/owner');
    assert.equal((await context.request.get(origin+'/api/session')).status(),200);
    const saved=counts().signIns;await page.goto(origin+'/sign-in');await page.waitForURL('**/owner');assert.equal(counts().signIns,saved,'Saved session must not repeat password authentication');
    const cookie= (await context.cookies()).find(c=>c.name==='ynsg-refresh');assert.ok(cookie?.httpOnly&&cookie.secure&&cookie.sameSite==='Strict');
    await context.clearCookies({name:'ynsg-access'});const before=counts().refreshes;
    if(javaScriptEnabled){await page.goto(origin+'/owner');await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();assert.ok(counts().refreshes>before,'Workspace renews expired access');}
    else{await page.goto(origin+'/auth/password');await submit('Continue saved sign-in','**/auth/password');assert.ok(counts().refreshes>before,'Native renewal works without JavaScript');}
    await context.clearCookies();await page.goto(origin+'/sign-in?mode=reset');await page.getByLabel('Email address',{exact:true}).fill(email);
    const sent=counts().recoveries;await submit('Send password reset','**/sign-in?mode=sent');assert.equal(counts().recoveries,sent+1);
    const verifier=(await context.cookies()).find(c=>c.name==='ynsg-email-pkce');assert.ok(verifier?.httpOnly);
    faults.recovery=true;await page.goto(origin+'/sign-in?mode=reset');await page.getByLabel('Email address',{exact:true}).fill(email);await submit('Send password reset','**/sign-in?mode=reset&error=limited');faults.recovery=false;
    assert.equal((await context.cookies()).find(c=>c.name==='ynsg-email-pkce')?.value,verifier.value,'Failed recovery preserves previous verifier');
    faults.callback=true;await page.goto(origin+'/auth/confirm?code=synthetic-code');await page.waitForURL('**/sign-in?mode=reset&error=limited');faults.callback=false;
    assert.equal((await context.cookies()).find(c=>c.name==='ynsg-email-pkce')?.value,verifier.value,'Temporary callback failure preserves verifier');
    await page.goto(providerOrigin+'/email-link?target='+encodeURIComponent(origin+'/auth/confirm?code=synthetic-code'));await page.getByRole('link',{name:'Open reset email',exact:true}).click();if(!javaScriptEnabled){await page.waitForURL(url=>url.pathname==='/auth/continue');await page.getByRole('link',{name:'Continue',exact:true}).click();}await page.waitForURL(url=>url.pathname==='/auth/password');
    const nextPassword='synthetic-'+name+'-'+javaScriptEnabled+'-password';await page.getByLabel('New password',{exact:true}).fill(nextPassword);await page.getByLabel('Confirm new password',{exact:true}).fill(nextPassword);
    const changed=counts().updates;await submit('Save password','**/auth/password?status=saved');assert.equal(counts().updates,changed+1);assert.ok(await page.getByRole('heading',{name:'Password saved',exact:true}).isVisible());
    await page.reload();assert.equal(counts().updates,changed+1,'GET/reload must not replay a password mutation');
    await context.clearCookies();await page.goto(origin+'/auth/confirm?code=synthetic-code');await page.waitForURL('**/sign-in?error=expired');
    await page.goto(origin+'/sign-in');await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password());await submit('Sign in','**/owner');
    faults.revoked=true;const membership=await(await context.request.get(origin+'/api/session')).json();assert.deepEqual(membership.memberships,[],'Revocation is reflected in live permissions');faults.revoked=false;
    assert.ok(origins.length>=6&&origins.every(o=>o===origin),name+' application forms must generate their own exact Origin');
    await context.close();console.log('PASS: '+name+' mobile viewport, JavaScript '+javaScriptEnabled+': browser Origin, credentials, recovery/rate-limit, callback, password save, renewal, revocation and fresh sign-in.');
   }
  }finally{faults.recovery=false;faults.callback=false;faults.revoked=false;await browser.close();}
 }
}
