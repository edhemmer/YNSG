import test from 'node:test';
import assert from 'node:assert/strict';
import {preservesLicensedBrand,FRANCHISE_NAME,FRANCHISE_LOGO} from '../apps/web/lib/franchise-brand';
import type {CompanySettings} from '../packages/contracts';
const cfg={displayName:FRANCHISE_NAME,brand:{navy:'#10283c',forest:'#315842',gold:'#edbd6b',cream:'#f8f6ef',logoUrl:FRANCHISE_LOGO,ownerName:'Ed'}} as CompanySettings;
test('local owner personalization retains the licensed identity',()=>{
 assert.equal(preservesLicensedBrand(cfg,{...cfg,brand:{...cfg.brand,ownerName:'New owner'},cities:['A new city'],notificationRecipient:'local@example.invalid'}),true);
 for(const key of ['navy','forest','gold','cream','logoUrl'] as const)assert.equal(preservesLicensedBrand(cfg,{...cfg,brand:{...cfg.brand,[key]:key==='logoUrl'?'https://example.invalid/logo.png':'#000000'}}),false);
 assert.equal(preservesLicensedBrand(cfg,{...cfg,displayName:'Different brand'}),false);
 assert.equal(preservesLicensedBrand(null,cfg),true);
 assert.equal(preservesLicensedBrand(null,{...cfg,displayName:'Different brand'}),false);
 assert.equal(preservesLicensedBrand(null,{...cfg,brand:{...cfg.brand,logoUrl:null}}),false);
});
