import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,failure} from '../../../lib/session';

const date=z.iso.date();
export async function GET(request:Request){
 try{
  const {db}=await authenticated();
  const params=new URL(request.url).searchParams;
  const org=z.uuid().parse(params.get('organization'));
  const from=date.parse(params.get('from')),to=date.parse(params.get('to'));
  const page=z.coerce.number().int().min(0).max(100000).parse(params.get('page')||0);
  if(from>to||Math.round((Date.parse(to)-Date.parse(from))/86400000)>3660)throw Error('VALIDATION');
  const report=await db.rpc('finance_activity',{p_org:org,p_from:from,p_to:to});
  if(report.error)throw Error(report.error.message);
  const expenses=await db.from('business_expenses')
   .select('id,expense_date,vendor,category,description,amount_cents,payment_method,reference,business_expense_reversals(reason,reversed_at)',{count:'exact'})
   .eq('organization_id',org).gte('expense_date',from).lte('expense_date',to)
   .order('expense_date',{ascending:false}).order('id',{ascending:false}).range(page*50,page*50+49);
  if(expenses.error)throw Error('FAILED');
  return NextResponse.json({report:report.data,expenses:expenses.data,expenseRows:expenses.count||0,page,hasMore:(page+1)*50<(expenses.count||0)},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return failure(error)}
}
