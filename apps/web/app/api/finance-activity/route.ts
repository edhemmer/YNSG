import {NextResponse} from 'next/server';
import {financeQuery,financeResult} from '../../../lib/expense-contract';
import {authenticated} from '../../../lib/session';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,parsed=financeQuery.safeParse({organization:q.get('organization'),from:q.get('from'),to:q.get('to'),page:q.get('page')||0});
 if(!parsed.success)return NextResponse.json({error:'Choose a valid date range and report page.'},{status:400,headers});
 try{const {organization:org,from,to,page}=parsed.data,{db}=await authenticated();
  const report=await db.rpc('finance_activity',{p_org:org,p_from:from,p_to:to});if(report.error)throw Error(report.error.code==='42501'?'FORBIDDEN':report.error.message);
  const expenses=await db.from('business_expenses').select('id,expense_date,vendor,category,description,amount_cents,payment_method,reference,business_expense_reversals(reason,reversed_at)',{count:'exact'}).eq('organization_id',org).gte('expense_date',from).lte('expense_date',to).order('expense_date',{ascending:false}).order('id',{ascending:false}).range(page*50,page*50+49);
  if(expenses.error)throw Error(expenses.error.code==='42501'?'FORBIDDEN':expenses.error.message);
  return NextResponse.json(financeResult.parse({report:report.data,expenses:expenses.data,expenseRows:expenses.count||0,page,hasMore:(page+1)*50<(expenses.count||0)}),{headers});
 }catch(error){const code=error instanceof Error?error.message:'';return NextResponse.json({error:code==='UNAUTHORIZED'?'Sign in to continue.':code==='FORBIDDEN'?'Your account cannot open this financial report.':'The report could not be verified. Try refreshing it.'},{status:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:503,headers});}
}
