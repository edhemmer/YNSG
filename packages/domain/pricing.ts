import { DomainError, type CompanySettings } from '../contracts/index.ts';
function integer(value:number,name:string){if(!Number.isSafeInteger(value)||value<0)throw new DomainError('VALIDATION',`${name} must be a nonnegative integer`);}
export function laborPrice(minutes:number,program:'standard'|'community',approved:boolean,rules:CompanySettings['hourly']):number {
  integer(minutes,'Minutes');
  if(program==='community'&&!approved)throw new DomainError('SETUP_REQUIRED','Community Rate needs explicit eligibility review');
  const rate=program==='community'?rules.communityCents:rules.standardCents;
  integer(rate,'Rate');
  let billed=Math.max(minutes,rules.minimumMinutes);
  if(billed%rules.incrementMinutes!==0){
    if(rules.partialExtension===null)throw new DomainError('SETUP_REQUIRED','Partial-extension policy has not been approved');
    if(rules.partialExtension==='ceil')billed=Math.ceil(billed/rules.incrementMinutes)*rules.incrementMinutes;
  }
  const numerator=BigInt(billed)*BigInt(rate);
  // Half-up to cents for explicitly configured exact-minute billing.
  const cents=(numerator+30n)/60n;
  if(cents>999_999_999n)throw new DomainError('VALIDATION','Labor amount exceeds supported limit');
  return Number(cents);
}
export type Cost={payer:'supplier_prepaid'|'business';authorized:boolean;actualCents:number;reimbursementCents:number};
export function reimbursableCost(cost:Cost):number {
  integer(cost.actualCents,'Cost');integer(cost.reimbursementCents,'Reimbursement');
  if(cost.payer==='supplier_prepaid'){
    if(cost.reimbursementCents!==0)throw new DomainError('VALIDATION','Supplier-prepaid materials cannot be invoiced');
    return 0;
  }
  if(!cost.authorized)throw new DomainError('SETUP_REQUIRED','Purchase authorization required');
  if(cost.reimbursementCents!==cost.actualCents)throw new DomainError('VALIDATION','Reimbursement must equal documented actual cost');
  return cost.actualCents;
}
export function invoiceBalance(total:number,allocations:readonly number[],credits:readonly number[]):number {
  integer(total,'Total');let balance=BigInt(total);
  for(const cents of [...allocations,...credits]){integer(cents,'Allocation');balance-=BigInt(cents);}
  if(balance<0n)throw new DomainError('VALIDATION','Allocations exceed invoice balance; retain excess as unapplied funds');
  return Number(balance);
}
export function balancedJournal(lines:readonly {debit:number;credit:number}[]):boolean {
  if(lines.length<2)return false;
  let difference=0n;
  for(const l of lines){integer(l.debit,'Debit');integer(l.credit,'Credit');if((l.debit===0)===(l.credit===0))return false;difference+=BigInt(l.debit)-BigInt(l.credit);}
  return difference===0n;
}
