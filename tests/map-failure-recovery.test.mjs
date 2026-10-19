import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {loadGoogleMap,onMapAuthorizationFailure,boundedMapRequest} from '../apps/web/lib/google-map-browser.ts';
test('map requests settle on timeout, success and provider rejection',async()=>{
 assert.equal(await boundedMapRequest(Promise.resolve(42),20),42);
 await assert.rejects(boundedMapRequest(Promise.reject(Error('provider')),20),/provider/);
 await assert.rejects(boundedMapRequest(new Promise(()=>{}),5),/MAP_REQUEST_TIMEOUT/);
});
test('late Google authorization failure notifies the mounted map after script load and prevents false ready reuse',async()=>{
 const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>');
 const previousWindow=globalThis.window,previousDocument=globalThis.document;
 Object.assign(globalThis,{window:dom.window,document:dom.window.document});
 try{
  let notified=0;const stop=onMapAuthorizationFailure(()=>notified++);
  const promise=loadGoogleMap('synthetic');
  const win=window;win.google={maps:{Map:class{}}};win.ynsgMapsReady();
  assert.equal(await promise,win.google.maps);
  win.gm_authFailure();assert.equal(notified,1);
  await assert.rejects(loadGoogleMap('synthetic'),/MAP_AUTH_FAILED/);
  stop();win.gm_authFailure();assert.equal(notified,1);
 }finally{Object.assign(globalThis,{window:previousWindow,document:previousDocument});dom.window.close();}
});
