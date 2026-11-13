// Navigation index for the Field guide DIY library: Room or Trade -> Topic -> Job, plus search words people actually say.
import {diyGuides,type DiyCategory,type DiyGuide} from './diy-reference';
export type DiyRoom='Bathroom'|'Kitchen'|'Living & bedrooms'|'Exterior & yard'|'Garage & basement'|'Laundry'|'Whole house';
export const diyRooms:DiyRoom[]=['Bathroom','Kitchen','Living & bedrooms','Exterior & yard','Garage & basement','Laundry','Whole house'];
const R:Record<string,DiyRoom>={B:'Bathroom',K:'Kitchen',L:'Living & bedrooms',E:'Exterior & yard',G:'Garage & basement',U:'Laundry',H:'Whole house'};
export type DiyIndexEntry={topic:string;rooms:DiyRoom[];aka:string[]};
// id, topic, room codes, words people say
const rows:[string,string,string,string][]=[
 ['first-rules','Safety first','H','safety basics rules ppe'],
 ['licensing-map','Rules & licensing','H','license permit illinois legal scope'],
 ['lead-safe','Rules & licensing','H','lead paint rrp epa old house 1978'],
 ['call-before-dig','Safety first','E','811 julie utilities dig post hole'],
 ['ladder-safety','Safety first','EH','ladder fall height climb'],
 ['find-shutoffs','Leaks & shutoffs','BKUGH','shut off water main valve emergency'],
 ['find-leaks','Leaks & shutoffs','BKUGH','water bill meter hidden leak'],
 ['winter-plumbing','Leaks & shutoffs','EGH','frozen pipe freeze hose bib spigot winterize'],
 ['replace-faucet','Faucets','BK','tap sink faucet install swap'],
 ['faucet-cartridge','Faucets','BK','cartridge single handle drip leak stiff handle moen delta'],
 ['faucet-aerator','Faucets','BK','aerator low flow spray splash screen'],
 ['faucet-compression','Faucets','BKU','two handle washer seat drip compression stem'],
 ['toilet-running','Toilets','B','running toilet constant fill leak'],
 ['toilet-flapper','Toilets','B','flapper chain running leak tank'],
 ['toilet-fill-valve','Toilets','B','fill valve ballcock hiss float tank'],
 ['toilet-seat','Toilets','B','seat lid replace loose'],
 ['clear-clog','Drains & traps','BK','clog drain plunger snake slow drain'],
 ['replace-trap','Drains & traps','BK','p trap leak under sink pipe'],
 ['showerhead','Showers & tubs','B','shower head spray low pressure'],
 ['tub-caulk','Showers & tubs','B','caulk reseal tub shower mold'],
 ['water-heater-care','Water heater & pumps','GH','hot water flush sediment tank temperature'],
 ['sump-check','Water heater & pumps','G','sump pump basement flood'],
 ['power-off-test','Safety first','H','breaker electric off test voltage tester'],
 ['breaker-trips','Breakers & testing','H','breaker trip overload panel'],
 ['gfci-test','Breakers & testing','BKGE','gfci outlet reset test tripped'],
 ['replace-outlet','Outlets, switches & lights','H','outlet receptacle switch plug'],
 ['light-fixture','Outlets, switches & lights','H','light ceiling fan fixture chandelier'],
 ['smoke-co-alarms','Alarms','LH','smoke detector carbon monoxide alarm chirp battery'],
 ['thermostat','Heating & cooling controls','LH','thermostat furnace ac programmable'],
 ['furnace-filter','Filters & airflow','H','furnace filter air filter hvac'],
 ['dryer-vent','Filters & airflow','U','dryer vent lint duct fire'],
 ['bath-fan-clean','Filters & airflow','B','exhaust fan vent bath moisture'],
 ['weatherstrip','Drafts & sealing','LEH','draft weatherstrip door sweep caulk energy'],
 ['ac-drain','Cooling','GH','ac condensate drain line clog air conditioner'],
 ['gutters','Gutters & drainage','E','gutter downspout roof water'],
 ['exterior-caulk','Sealing & screens','E','caulk seal gap trim siding'],
 ['screen-repair','Sealing & screens','LE','window screen mesh tear'],
 ['deck-board','Decks & fences','E','deck board rot replace'],
 ['fence-repair','Decks & fences','E','fence panel post gate'],
 ['prep-paint','Painting','L','paint room walls roller prep'],
 ['interior-touchup','Painting','L','touch up scuff paint wall'],
 ['paint-cabinets','Painting','BK','cabinet paint refinish'],
 ['stain-deck','Painting','E','stain seal deck fence clean'],
 ['drywall-nail-pop','Drywall & ceilings','L','drywall nail pop crack patch spackle'],
 ['ceiling-stain','Drywall & ceilings','LBK','ceiling stain water leak'],
 ['door-wont-latch','Doors that will not close or latch','LH','door will not latch strike plate bolt rattle'],
 ['door-wont-close','Doors that will not close or latch','LH','door will not close swollen humid bound'],
 ['door-sticks-top','Doors that will not close or latch','LH','door sticks top latch side rubbing'],
 ['door-rubs-floor','Doors that will not close or latch','LH','door drags floor carpet threshold sweep'],
 ['door-gap-uneven','Doors that will not close or latch','LH','door gap uneven crooked out of square'],
 ['sticking-door','Doors that will not close or latch','LH','door sag sticks hinge tighten'],
 ['door-swings-open','Door movement & noise','LH','door swings open closes by itself drifts'],
 ['door-slams','Door movement & noise','LH','door slams stop closer bumper'],
 ['door-squeak','Door movement & noise','LH','squeak hinge noise lubricate'],
 ['storm-door-closer','Door movement & noise','E','storm door closer screen door pneumatic'],
 ['door-hardware','Knobs, locks & deadbolts','LEH','doorknob lockset deadbolt install replace'],
 ['door-loose-knob','Knobs, locks & deadbolts','LH','loose knob handle wobbly set screw'],
 ['deadbolt-wont-throw','Knobs, locks & deadbolts','EH','deadbolt will not lock unlock jam'],
 ['lock-hard-to-turn','Knobs, locks & deadbolts','EH','key sticks lock hard graphite'],
 ['sliding-door','Sliding, bifold & pocket doors','LE','patio slider track roller lock'],
 ['closet-bifold','Sliding, bifold & pocket doors','L','bifold closet door track pin'],
 ['pocket-door','Sliding, bifold & pocket doors','L','pocket door roller track'],
 ['window-sticks','Windows','LH','window stuck hard to open paint sealed'],
 ['window-wont-stay-up','Windows','LH','window falls balance spring sash'],
 ['window-lock','Windows','LH','window lock latch'],
 ['garage-storage','Garage & wall storage','G','garage shelving rack ceiling rail overhead'],
 ['pegboard-slatwall','Garage & wall storage','G','pegboard slatwall tool wall'],
 ['closet-system','Closets & pantry','L','closet organizer shelf rod'],
 ['pantry-organize','Closets & pantry','K','pantry cabinet organizer pull out'],
 ['mount-tv','Mounting & anchoring','L','tv mount mirror wall stud anchor'],
 ['furniture-anchor','Mounting & anchoring','L','tip over anchor dresser bookcase child safety'],
 ['mudroom-bench','Build & install','LG','bench hooks entry mudroom'],
 ['dishwasher','Kitchen appliances','K','dishwasher install replace'],
 ['range-microwave','Kitchen appliances','K','range stove microwave over the range'],
 ['garbage-disposal','Kitchen appliances','K','disposal garbage jam hum'],
 ['fridge-water-line','Kitchen appliances','K','refrigerator ice maker water line'],
 ['washer-hookup','Laundry appliances','U','washing machine hoses hookup'],
 ['dryer-install','Laundry appliances','U','dryer electric cord install'],
 ['baseboard-trim','Trim & floors','L','baseboard trim molding caulk'],
 ['squeaky-floor','Trim & floors','L','squeak floor creak subfloor'],
 ['vinyl-plank','Trim & floors','LKB','vinyl plank lvp tile floor damaged'],
 ['plant-flowers','Planting','E','flowers perennial annual bed plant'],
 ['plant-shrub','Planting','E','shrub bush tree plant hole'],
 ['mulch-beds','Yard care','E','mulch bed weeds edging'],
 ['prune-bushes','Yard care','E','trim prune hedge shrub'],
 ['patch-lawn','Yard care','E','lawn grass seed bare spot'],
 ['cabinet-hinge','Cabinets & drawers','KB','cabinet door sag hinge adjust'],
 ['drawer-slide','Cabinets & drawers','KBL','drawer slide sticks drops'],
 ['cabinet-pulls','Cabinets & drawers','KB','knob pull handle hardware'],
 ['wobbly-furniture','Furniture & railings','L','wobbly chair table loose joint'],
 ['loose-handrail','Furniture & railings','LH','handrail stair railing loose'],
 ['curtain-rod','Hanging & mounting','L','curtain rod blinds shade window treatment'],
 ['hang-pictures','Hanging & mounting','L','picture mirror shelf hang level'],
 ['towel-bar','Hanging & mounting','B','towel bar hook toilet paper holder'],
 ['basement-damp','Moisture & basements','G','basement damp wet humidity efflorescence'],
];
export const diyIndex:Record<string,DiyIndexEntry>=Object.fromEntries(rows.map(([id,topic,codes,aka])=>[id,{topic,rooms:[...codes].map(c=>R[c]),aka:aka.split(' ')}]));
export const entryFor=(g:DiyGuide)=>diyIndex[g.id];
const words=(s:string)=>s.toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(Boolean);
export type Browse={mode:'room'|'trade'|'az';area:string|null;topic:string|null};
export const areasFor=(mode:'room'|'trade'):string[]=>mode==='room'?diyRooms:[...new Set(diyGuides.map(g=>g.category))];
export function guidesIn(mode:'room'|'trade',area:string,list:DiyGuide[]=diyGuides){return list.filter(g=>mode==='room'?diyIndex[g.id]?.rooms.includes(area as DiyRoom):g.category===(area as DiyCategory));}
export function topicsIn(mode:'room'|'trade',area:string,list:DiyGuide[]=diyGuides){const m=new Map<string,DiyGuide[]>();for(const g of guidesIn(mode,area,list)){const t=diyIndex[g.id]?.topic||'Other';m.set(t,[...(m.get(t)||[]),g]);}return [...m.entries()].map(([topic,guides])=>({topic,guides}));}
// Typeahead: prefix and whole-word matches on title and everyday words, best first.
export function suggestDiy(query:string,limit=50,list:DiyGuide[]=diyGuides){
 const q=words(query);if(!q.length)return [];
 return list.map(g=>{const e=diyIndex[g.id],t=words(g.title),a=e?e.aka:[],topic=words(e?.topic||''),body=words([g.summary,g.tools.join(' '),g.steps.join(' ')].join(' '));let s=0,hit=0;
  for(const w of q){let ws=0;if(t.includes(w))ws=10;else if(t.some(y=>y.startsWith(w)))ws=8;else if(a.includes(w))ws=7;else if(a.some(y=>y.startsWith(w)))ws=6;else if(topic.some(y=>y.startsWith(w)))ws=4;else if(w.length>2&&body.some(y=>y.startsWith(w)))ws=1;if(ws)hit++;s+=ws;}
  if(hit<q.length)return {g,s:0};
  if(words(g.title).join(' ').startsWith(q.join(' ')))s+=6;
  return {g,s};}).filter(r=>r.s>0).sort((a,b)=>b.s-a.s||a.g.title.localeCompare(b.g.title)).slice(0,limit).map(r=>r.g);
}
export const azLetters=(list:DiyGuide[]=diyGuides)=>[...new Set(list.map(g=>g.title.replace(/[^A-Za-z]/g,'').charAt(0).toUpperCase()))].sort();
export const guidesStartingWith=(l:string,list:DiyGuide[]=diyGuides)=>list.filter(g=>g.title.replace(/[^A-Za-z]/g,'').charAt(0).toUpperCase()===l).sort((a,b)=>a.title.localeCompare(b.title));
