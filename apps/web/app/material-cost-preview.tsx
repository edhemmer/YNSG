'use client';
import {useState,type ChangeEvent} from 'react';
import {previewMaterialUse,shouldSuppressTinyConsumable} from '../lib/material-lot-accounting';

const dollars=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
function parseCents(v:string){if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(v))throw Error('Enter a valid amount in dollars and cents.');const [d,f='']=v.split('.');return Number(d)*100+Number(f.padEnd(2,'0'));}
const id='20000000-0000-4000-8000-000000000001',lot='30000000-0000-4000-8000-000000000001',job='40000000-0000-4000-8000-000000000001';
export default function MaterialCostPreview(){
 const [barcode,setBarcode]=useState(''),[name,setName]=useState(''),[pretax,setPretax]=useState(''),[tax,setTax]=useState('0'),[units,setUnits]=useState('100'),[used,setUsed]=useState('50'),[treatment,setTreatment]=useState<'included-in-labor'|'at-cost'|'customer-supplied'>('at-cost'),[receipt,setReceipt]=useState(''),[message,setMessage]=useState(''),[imageStatus,setImageStatus]=useState('');
 function preview(){try{
  const total=Number(units),consumed=Number(used);
  const p=previewMaterialUse({id:lot,organizationId:id,productBarcode:barcode||undefined,description:name,purchasedUnits:total,unitName:'parts',pretaxCents:parseCents(pretax),taxPaidCents:parseCents(tax),receiptId:null,quantityRemaining:total,returnStatus:'none'},{organizationId:id,lotId:lot,jobId:job,unitsUsed:consumed,treatment});
  setMessage('Allocated purchase cost: '+dollars(p.recordedCostCents)+'. Proposed customer materials line: '+dollars(p.billableCents)+(shouldSuppressTinyConsumable(p.billableCents,100)?' (consider including this minor supply in overhead).':'')+' Remaining units: '+p.quantityRemainingAfter+'. This is a preview only; no records or invoices changed.');
 }catch{setMessage('Check product, barcode if used, purchase price, tax, quantity and amount used. No invoice was changed.');}}
 async function detectBarcode(event:ChangeEvent<HTMLInputElement>){
  const image=event.target.files?.[0];if(!image)return;
  if(!image.type.startsWith('image/')||image.size>8*1024*1024){setImageStatus('Choose a barcode photo under 8 MB.');return;}
  const Detector=(window as typeof window & {BarcodeDetector?:new (options:{formats:string[]})=>{detect:(file:Blob)=>Promise<{rawValue:string}[]>}}).BarcodeDetector;
  if(!Detector){setImageStatus('This browser cannot read a barcode photo automatically. Type the barcode printed under it instead.');return;}
  try{const d=new Detector({formats:['upc_a','ean_13','ean_8']});const matches=await d.detect(image);if(matches.length===1&&/^\d{8,14}$/.test(matches[0]!.rawValue)){setBarcode(matches[0]!.rawValue);setImageStatus('Barcode identified; verify it matches the product.');}else setImageStatus('No single verified product barcode found. Enter the printed code manually.');}
  catch{setImageStatus('Photo detection was unavailable. Enter the printed code manually.');}
 }
 return <details className="card" aria-label="Materials cost calculator"><summary>Quick materials cost calculator · no invoice changes</summary>
 <p>Use the receipt's actual product price and tax. Scan a barcode or type its printed digits; barcode alone cannot find your purchase price. Nothing here is saved or added to a customer invoice.</p>
 <div className="form-row"><label>Product description<input value={name} onChange={e=>setName(e.target.value)} placeholder="Paintable caulk" maxLength={200}/></label><label>Barcode (optional)<input inputMode="numeric" pattern="[0-9]{8,14}" value={barcode} onChange={e=>setBarcode(e.target.value)} placeholder="Enter UPC/EAN digits"/></label></div>
 <label>Read a barcode photo (supported browsers only)<input type="file" accept="image/*" capture="environment" onChange={e=>void detectBarcode(e)}/></label>{imageStatus&&<p role="status">{imageStatus}</p>}
 <div className="form-row"><label>Product subtotal ($)<input inputMode="decimal" value={pretax} onChange={e=>setPretax(e.target.value)} placeholder="7.40"/></label><label>Tax actually paid ($)<input inputMode="decimal" value={tax} onChange={e=>setTax(e.target.value)}/></label></div>
 <div className="form-row"><label>Purchased quantity or portions<input type="number" min="1" max="100000" step="1" value={units} onChange={e=>setUnits(e.target.value)}/></label><label>Quantity or portions used<input type="number" min="1" max="100000" step="1" value={used} onChange={e=>setUsed(e.target.value)}/></label></div>
 <p className="tiny">For half a tube, enter 100 purchased portions and 50 used. Use realistic measurements, not false precision.</p>
 <label>Material treatment<select value={treatment} onChange={e=>setTreatment(e.target.value as typeof treatment)}><option value="at-cost">Separately bill actual allocated cost</option><option value="included-in-labor">Include in labor/overhead</option><option value="customer-supplied">Customer supplied — no material charge</option></select></label>
 <label>Receipt photo for your reference (not uploaded)<input type="file" accept="image/*,application/pdf" onChange={e=>setReceipt(e.target.files?.[0]?.name||'')}/></label>{receipt&&<p>Selected on this device only: {receipt}. Secure receipt storage is not connected.</p>}
 <button type="button" onClick={preview}>Calculate allocation</button>{message&&<p role="status">{message}</p>}
 </details>;
}
