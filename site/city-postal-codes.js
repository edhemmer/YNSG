// Standard service-address ZIP choices for the currently advertised Illinois cities.
// Sources and coverage limits are recorded in docs/production/city-postal-codes.md.
export const serviceCities=['DeKalb','Sycamore','Cortland'];
const codes={dekalb:['60115'],sycamore:['60178'],cortland:['60112']};
export function postalCodesForCity(city,state='IL'){
 return state.toUpperCase()==='IL'?[...(Object.hasOwn(codes,String(city).trim().toLowerCase())?codes[String(city).trim().toLowerCase()]:[])]:[];
}
export function cityPostalPicker(form){
 const city=form.querySelector('[name=city]'),postal=form.querySelector('[name=postalCode]');
 if(!city||!postal)return;
 // Open lead intake accepts addresses beyond advertised towns; never rewrite free-text fields.
 if(city.tagName!=='SELECT'||postal.tagName!=='SELECT')return;
 function sync(keep=false){const previous=keep?postal.value:'';postal.replaceChildren();const empty=form.ownerDocument.createElement('option');empty.value='';empty.textContent=city.value?'Choose ZIP code':'Choose a city first';postal.append(empty);for(const code of postalCodesForCity(city.value)){const option=form.ownerDocument.createElement('option');option.value=code;option.textContent=code;postal.append(option);}postal.value=previous;}
 sync(true);city.addEventListener('change',()=>sync());form.addEventListener('reset',()=>queueMicrotask(()=>sync()));
}
