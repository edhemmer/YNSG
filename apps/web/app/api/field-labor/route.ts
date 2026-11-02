import {NextResponse} from 'next/server';
import {authenticated} from '../../../lib/session';
import {laborFailure} from '../../../lib/labor-api-error';
import {invoiceIssuanceReadiness} from '../../../lib/service-workflow';
import {fieldLaborQuery,fieldInvoiceWorkContext} from '../../../lib/labor-access-contract';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const q=fieldLaborQuery.parse(Object.fromEntries(new URL(request.url).searchParams)),{db}=await authenticated(),r=await db.rpc('field_invoice_work_context',{p_org:q.organization,p_job:q.job});if(r.error)throw r.error;const data=fieldInvoiceWorkContext.parse(r.data);if(data.organization!==q.organization||data.job!==q.job)throw Error('UNVERIFIED');const readiness=invoiceIssuanceReadiness(data.configuration,data.tax.required);if(data.tax.required&&!data.tax.valid){readiness.ready=false;readiness.reasons.push('The office must review the applicable tax and customer-approved total before this invoice can be issued.');}return NextResponse.json({organization:data.organization,job:data.job,crew:data.crew,draft:data.draft,canIssue:data.canIssue,tax:{...data.tax,rules:[]},readiness},{headers:{'Cache-Control':'private, no-store'}})}catch(e){return laborFailure(e)}}
