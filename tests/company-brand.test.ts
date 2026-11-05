import test from 'node:test';
import assert from 'node:assert/strict';
import {companyBrand,companyTheme} from '../apps/web/lib/company-brand.js';
const palette={navy:'#042440',forest:'#416833',gold:'#f3ac39',cream:'#f8f6ef'};
test('company branding uses approved colors without leaking extra settings',()=>{assert.deepEqual(companyBrand({...palette,sender:'PRIVATE'}),palette);assert.equal(companyTheme(palette)['--green'],palette.forest)});
test('unsafe and missing company colors reset to defaults instead of retaining another company',()=>{assert.deepEqual(companyTheme(null),{});assert.equal(companyBrand({...palette,forest:'#ffffff'}),null);assert.equal(companyBrand({...palette,navy:'red; background:url(x)'}),null);assert.equal(companyBrand({...palette,cream:'#042440'}),null)});

test('brand colors must stay readable on existing secondary surfaces too',()=>{assert.equal(companyBrand({navy:'#757575',forest:'#416833',gold:'#ffffff',cream:'#ffffff'}),null)});
