import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('owner Taxes is visibly about business income taxes, not customer sales tax',()=>{
 const page=read('apps/web/app/owner/taxes/page.tsx');
 const workspace=read('apps/web/app/workspace.tsx');
 assert.match(page,/<h1>Business income taxes<\/h1>/);
 assert.match(page,/<BusinessIncomeRecords organization=\{org\} year=\{year\}\/>/);
 assert.match(page,/<h2>Income-tax payment calendar<\/h2>/);
 assert.match(page,/<legend>Federal and Illinois income-tax planning worksheet<\/legend>/);
 assert.match(page,/Separate invoice transaction-tax rules \(not income tax\)/);
 assert.doesNotMatch(page,/<h2>Sales tax after credits<\/h2>/);
 assert.match(workspace,/<span>Income taxes<\/span>/);
});
test('income-tax preparation reads only verified business records without inventing deductions',()=>{
 const component=read('apps/web/app/owner/taxes/business-income-records.tsx');
 assert.match(component,/sessionFetch\('\/api\/finance-activity\?/);
 assert.match(component,/sessionFetch\('\/api\/mileage\?/);
 assert.match(component,/financeResult\.parse/);
 assert.match(component,/businessMiles/);
 assert.match(component,/not taxable profit or a tax-due calculation/);
 assert.match(component,/Expense categories are not automatically deductible/);
 assert.match(component,/if\(!financeResponse\.ok\)/);
});
test('invoice transaction tax still has its own explicit review controls',()=>{
 const page=read('apps/web/app/owner/taxes/page.tsx');
 const settings=read('apps/web/app/company-settings.tsx');
 assert.match(page,/Separate transaction-tax rule review \(only when applicable\)/);
 assert.match(settings,/Invoice transaction-tax treatment \(separate from income taxes\)/);
 const invoice=read('apps/web/app/invoice-draft.tsx');
 assert.match(invoice,/Review separate invoice transaction-tax rules/);
 assert.match(invoice,/readiness\?\.ready!==true/);
});

test('income records can load without the separate tax-payment ledger and mileage can fail independently',()=>{
 const page=read('apps/web/app/owner/taxes/page.tsx');
 const dataBlock=page.indexOf('{data&&<>');
 assert.ok(page.indexOf('<BusinessIncomeRecords organization={org} year={year}/>')<dataBlock);
 const component=read('apps/web/app/owner/taxes/business-income-records.tsx');
 assert.match(component,/const mileage=raw&&/);
 assert.match(component,/Mileage could not be verified/);
});
