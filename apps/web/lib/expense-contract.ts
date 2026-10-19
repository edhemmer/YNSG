import {z} from 'zod';
const text=(min:number,max:number)=>z.string().trim().min(min).max(max).regex(/^[^\u0000]*$/);
const base={organizationId:z.uuid(),key:text(16,128)};
export const recordExpenseCommand=z.object({...base,command:z.literal('RecordBusinessExpense'),date:z.iso.date().regex(/^[2-9]\d{3}-/),vendor:text(2,160),category:z.enum(['tools','fuel','supplies','vehicle','insurance','marketing','software','other']),description:text(3,500),cents:z.number().int().positive().max(999999999),method:z.enum(['cash','zelle','external_card','external_transfer','other']),reference:text(1,160),confirmed:z.literal(true)}).strict();
export const reverseExpenseCommand=z.object({...base,command:z.literal('ReverseBusinessExpense'),id:z.uuid(),reason:text(5,500)}).strict();
export const expenseCommand=z.discriminatedUnion('command',[recordExpenseCommand,reverseExpenseCommand]);
export const expenseRecorded=z.object({id:z.uuid()}).strict();
export const expenseReversed=z.object({id:z.uuid(),reversed:z.literal(true)}).strict();
const integer=z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),nonnegative=integer.min(0);
const reversed=z.object({reason:z.string().min(5).max(500),reversed_at:z.iso.datetime({offset:true})}).strict();
export const financeExpense=z.object({id:z.uuid(),expense_date:z.iso.date(),vendor:z.string().min(2).max(160),category:z.string().min(1).max(80),description:z.string().min(3).max(500),amount_cents:z.number().int().positive().max(999999999),payment_method:z.string().min(1).max(80),reference:z.string().min(1).max(160),business_expense_reversals:z.union([reversed,z.array(reversed).max(1),z.null()])}).strict();
export const financeReport=z.object({from:z.iso.date(),to:z.iso.date(),timezone:z.string().min(1).max(80),cashReceivedCents:integer,cardFeeCents:integer,netRecordedReceiptsCents:integer,expenseCents:integer,cashAfterExpensesCents:integer,issuedInvoicesCents:nonnegative,outstandingAsOfEndCents:integer,expenseCount:nonnegative,paymentCount:nonnegative}).strict();
export const financeResult=z.object({report:financeReport,expenses:z.array(financeExpense).max(50),expenseRows:nonnegative,page:z.number().int().min(0).max(100000),hasMore:z.boolean()}).strict();
export type Expense=z.infer<typeof financeExpense>;
export type FinanceResult=z.infer<typeof financeResult>;
export type ExpenseCommand=z.infer<typeof expenseCommand>;
export function validateExpenseReceipt(command:ExpenseCommand,data:unknown){const result=command.command==='RecordBusinessExpense'?expenseRecorded.parse(data):expenseReversed.parse(data);if(command.command==='ReverseBusinessExpense'&&result.id!==command.id)throw Error('UNVERIFIED');return result;}
export function expenseFailure(error:unknown){const code=error instanceof Error?error.message:'',messages:Record<string,string>={UNAUTHORIZED:'Sign in to continue.',FORBIDDEN:'Your account cannot change business expenses.',VALIDATION:'Check the expense date, amount and required details.',SETUP_REQUIRED:'Finance setup is required for this company.',NOT_FOUND:'This expense is no longer available to your account.',IDEMPOTENCY_CONFLICT:'This retry changed. Keep your entries and review the saved result.',ALREADY_REVERSED:'This expense is already reversed. Refresh the report before continuing.'};return {error:messages[code]||'The saved expense result could not be verified. Check the same saved attempt before making another change.',status:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:messages[code]?409:503};}

export const financeQuery=z.object({organization:z.uuid(),from:z.iso.date().regex(/^(?!0000-)/),to:z.iso.date().regex(/^(?!0000-)/),page:z.coerce.number().int().min(0).max(100000)}).strict().refine(v=>v.from<=v.to&&Math.round((Date.parse(v.to)-Date.parse(v.from))/86400000)<=3660);
