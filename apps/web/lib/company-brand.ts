import {contrast} from '../../../packages/domain/configuration.ts';
type Palette={navy:string;forest:string;gold:string;cream:string};
export function companyBrand(value:unknown):Palette|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 for(const key of ['navy','forest','gold','cream'])if(typeof v[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(v[key] as string))return null;
 const p=v as Palette;
 // Existing cards, buttons and header use white as well as the company background.
 if([[p.navy,p.cream],[p.navy,'#ffffff'],[p.forest,'#ffffff'],[p.forest,p.cream],[p.navy,p.gold],[p.navy,'#e3ede0'],[p.navy,'#fff6e9'],[p.navy,'#e5f0e2'],[p.navy,'#dbe7d8']].some(([a,b])=>contrast(a!,b!)<4.5))return null;
 return {navy:p.navy,forest:p.forest,gold:p.gold,cream:p.cream};
}
export function companyTheme(value:unknown):Record<string,string> {
 const brand=companyBrand(value);
 return brand?{'--ink':brand.navy,'--green':brand.forest,'--gold':brand.gold,'--paper':brand.cream}:{};
}
