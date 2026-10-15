import {NextResponse} from 'next/server';
import {ownerAddressCheck} from '../../../lib/customer-record-contract';
import {authenticated,sameOrigin} from '../../../lib/session';
import {addressInput,checkAddress} from '../../../../../lib/address-check.js';
export const dynamic='force-dynamic';
export const maxDuration=30;
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Request not accepted.'},{status:403,headers});
 let value:unknown;try{const text=await request.text();if(Buffer.byteLength(text)>1024)throw Error();value=JSON.parse(text);}catch{return NextResponse.json({error:'Check the address fields.'},{status:400,headers});}
 const parsed=ownerAddressCheck.safeParse(value);if(!parsed.success)return NextResponse.json({error:'Check the address fields.'},{status:400,headers});
 const {organization,...raw}=parsed.data;let input;try{input=addressInput(raw);}catch{return NextResponse.json({error:'Check the street, city, state and ZIP.'},{status:400,headers});}
 try{const {db}=await authenticated();const access=await db.rpc('google_access',{p_org:organization});if(access.error||access.data!==true)return NextResponse.json({error:'Owner access is required.'},{status:403,headers});return NextResponse.json(await checkAddress(input),{headers});}catch{return NextResponse.json({error:'The address check is unavailable. You can keep your entry and continue.'},{status:503,headers});}
}
