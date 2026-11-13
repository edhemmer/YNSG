import type {DiyDiagram} from '../lib/diy-reference';
const S={fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
const G='#315842',Y='#c6a35b';
const label={fontSize:12,fill:'currentColor',fontFamily:'inherit'} as const;
export const diagramInfo:Record<DiyDiagram,{title:string;caption:string}>={
 'toilet-tank':{title:'Inside a toilet tank',caption:'Check the flapper and chain first. Water should stop about an inch below the top of the overflow tube.'},
 'p-trap':{title:'Sink P-trap',caption:'Two slip nuts hold the trap. The bevel on each washer faces the pipe end. Hand tight plus a quarter turn.'},
 'ladder-angle':{title:'Ladder angle (4 to 1)',caption:'For every four feet of height, set the base one foot out. Extend three feet above the landing.'},
 'stud-mount':{title:'Fasten into studs',caption:'Studs are often 16 inches apart, center to center. Heavy loads go into studs or joists, not drywall alone.'},
 'dryer-vent':{title:'Dryer vent path',caption:'Short, straight, rigid metal duct from the dryer to the outside. No kinks, no crushing behind the dryer.'},
 'shutoff-valve':{title:'Quarter-turn shutoff',caption:'Handle along the pipe is open. Handle across the pipe is closed. Turn slowly and never force a stuck valve.'},
 'door-latch':{title:'Door latch and strike plate',caption:'If the latch bolt does not line up with the hole in the strike plate, the door will not stay shut. Look at the scuff marks, then move the plate or tighten the hinges.'},
 'door-hinge':{title:'Door hinge screws',caption:'Sagging doors usually need the top hinge tightened. If screws spin, use longer 3 inch screws that reach the framing.'}
};
export default function DiyDiagram({kind}:{kind:DiyDiagram}){
 const info=diagramInfo[kind];
 return <figure className="diy-diagram"><svg viewBox="0 0 320 190" role="img" aria-label={info.title} width="100%" height="auto" style={{maxWidth:420,display:'block',color:'inherit'}}>
  {kind==='toilet-tank'&&<g><rect x="40" y="30" width="240" height="120" rx="8" {...S}/><line x1="40" y1="75" x2="280" y2="75" stroke={G} strokeWidth="2" strokeDasharray="5 4"/><text x="46" y="68" {...label}>water level</text>
   <rect x="64" y="50" width="26" height="100" {...S}/><text x="60" y="168" {...label}>fill valve</text><circle cx="110" cy="62" r="10" {...S}/><text x="96" y="46" {...label}>float</text>
   <rect x="200" y="50" width="14" height="100" {...S}/><text x="168" y="46" {...label}>overflow tube</text>
   <path d="M150 140 q25 -20 50 0" stroke={Y} strokeWidth="3" fill="none"/><text x="140" y="168" {...label}>flapper</text><path d="M175 128 C175 100 150 100 150 86" {...S}/><text x="120" y="82" {...label}>chain</text></g>}
  {kind==='p-trap'&&<g><rect x="60" y="20" width="30" height="40" {...S}/><text x="96" y="40" {...label}>sink tailpiece</text>
   <path d="M75 60 V110 q0 30 30 30 q30 0 30 -30 V95 H230" {...S}/><circle cx="75" cy="74" r="6" fill={Y}/><text x="86" y="90" {...label}>slip nut</text><circle cx="135" cy="95" r="6" fill={Y}/><text x="128" y="82" {...label}>slip nut</text><text x="100" y="168" {...label}>trap holds water, blocks sewer gas</text><rect x="230" y="75" width="40" height="40" {...S}/><text x="232" y="132" {...label}>wall pipe</text></g>}
  {kind==='ladder-angle'&&<g><line x1="40" y1="165" x2="260" y2="165" {...S}/><line x1="60" y1="165" x2="170" y2="30" {...S}/><line x1="260" y1="30" x2="260" y2="165" stroke={Y} strokeWidth="3"/><line x1="170" y1="30" x2="170" y2="165" stroke={G} strokeWidth="1" strokeDasharray="4 4"/>
   <text x="268" y="100" {...label}>height 4</text><text x="82" y="182" {...label}>base 1</text><text x="150" y="22" {...label}>3 ft above landing</text><path d="M170 30 H280" {...S}/></g>}
  {kind==='stud-mount'&&<g><rect x="30" y="20" width="260" height="150" {...S}/>{[70,140,210].map(x=><rect key={x} x={x} y="20" width="14" height="150" fill={G} opacity=".25" stroke="currentColor"/>)}<text x="64" y="184" {...label}>studs about 16 in apart</text>
   <rect x="52" y="85" width="100" height="14" rx="3" fill={Y} stroke="currentColor"/><circle cx="77" cy="92" r="3" fill="currentColor"/><circle cx="147" cy="92" r="3" fill="currentColor"/><text x="46" y="78" {...label}>bracket screws land in studs</text></g>}
  {kind==='dryer-vent'&&<g><rect x="20" y="50" width="90" height="100" rx="8" {...S}/><circle cx="65" cy="100" r="28" {...S}/><text x="46" y="166" {...label}>dryer</text>
   <rect x="110" y="95" width="120" height="10" fill={G} opacity=".4" stroke="currentColor"/><text x="120" y="88" {...label}>rigid metal duct</text><rect x="230" y="75" width="14" height="50" {...S}/><path d="M244 80 l22 -10 M244 125 l22 10" {...S}/><text x="226" y="150" {...label}>outside vent</text></g>}
  {kind==='shutoff-valve'&&<g><line x1="20" y1="60" x2="300" y2="60" {...S} strokeWidth="6"/><rect x="40" y="48" width="40" height="24" rx="4" fill={Y} stroke="currentColor"/><line x1="40" y1="30" x2="100" y2="30" {...S}/><text x="30" y="20" {...label}>OPEN: handle along pipe</text>
   <line x1="20" y1="140" x2="300" y2="140" {...S} strokeWidth="6"/><rect x="40" y="128" width="40" height="24" rx="4" fill={Y} stroke="currentColor"/><line x1="60" y1="112" x2="60" y2="168" {...S}/><text x="100" y="120" {...label}>CLOSED: handle across pipe</text></g>}
  {kind==='door-latch'&&<g><rect x="30" y="30" width="110" height="130" {...S}/><text x="40" y="24" {...label}>door edge</text><rect x="110" y="86" width="40" height="14" rx="3" fill={Y} stroke="currentColor"/><text x="60" y="80" {...label}>latch bolt</text>
   <rect x="190" y="30" width="30" height="130" {...S}/><text x="170" y="24" {...label}>door frame</text><rect x="196" y="70" width="18" height="44" rx="3" fill={G} opacity=".3" stroke="currentColor"/><text x="150" y="132" {...label}>strike plate hole</text><path d="M150 93 H196" stroke={Y} strokeWidth="2" strokeDasharray="4 3"/><text x="40" y="180" {...label}>bolt must meet the hole</text></g>}
  {kind==='door-hinge'&&<g><rect x="40" y="20" width="30" height="150" {...S}/><text x="30" y="14" {...label}>door frame</text><rect x="70" y="20" width="200" height="150" {...S}/>
   {[40,140].map(y=><g key={y}><rect x="62" y={y} width="16" height="30" rx="2" fill={Y} stroke="currentColor"/><circle cx="70" cy={y+8} r="2" fill="currentColor"/><circle cx="70" cy={y+22} r="2" fill="currentColor"/></g>)}<text x="92" y="58" {...label}>top hinge: tighten first</text><text x="92" y="158" {...label}>bottom hinge</text></g>}
 </svg><figcaption className="tiny"><strong>{info.title}.</strong> {info.caption}</figcaption></figure>;
}
