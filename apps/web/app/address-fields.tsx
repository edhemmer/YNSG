'use client';
import {useState} from 'react';
import {postalCodesForCity,serviceCities} from '../../../site/city-postal-codes.js';
import {usStates} from '../lib/customer-record-contract';
export default function AddressFields({values,onChange}:{values:Record<string,string>;onChange:(key:string,value:string)=>void}){
 const [other,setOther]=useState(false);
 const city=values.city||'',state=values.state||'',postal=values.postalCode||'',cityChoice=serviceCities.find(c=>c.toLowerCase()===city.toLowerCase()),known=state==='IL'&&Boolean(cityChoice),manual=other||Boolean(city&&!known);
 const codes=postalCodesForCity(city,state),saved=postal&&!codes.includes(postal);
 const changeCity=(value:string)=>{onChange('city',value);onChange('postalCode','');};
 return <div className="customer-field-row"><label>City<select required autoComplete="address-level2" value={manual?'__other':cityChoice||city} onChange={e=>{const value=e.target.value;setOther(value==='__other');changeCity(value==='__other'?'':value);}}><option value="">Choose city</option>{state==='IL'&&serviceCities.map(c=><option key={c}>{c}</option>)}<option value="__other">Other city</option></select></label>{manual&&<label>City name<input required minLength={2} maxLength={80} value={city} onChange={e=>changeCity(e.target.value)}/></label>}<label>State<select required autoComplete="address-level1" value={state} onChange={e=>{onChange('state',e.target.value);onChange('postalCode','');}}><option value="">Choose state</option>{usStates.map(s=><option key={s}>{s}</option>)}</select></label><label>ZIP code{codes.length?<select required autoComplete="postal-code" value={postal} onChange={e=>onChange('postalCode',e.target.value)}><option value="">Choose ZIP code</option>{codes.map(code=><option key={code}>{code}</option>)}{saved&&<option value={postal}>{postal} · saved ZIP, verify</option>}</select>:<input required inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}(-[0-9]{4})?" maxLength={10} value={postal} onChange={e=>onChange('postalCode',e.target.value)}/>}</label></div>;
}
