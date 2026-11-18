import type {ReactNode} from 'react';
import type {DiagramId} from '../lib/home-repair-guides';

// Simple labeled drawings for the field guide. Plain SVG, no images to download, readable on a phone.
const INK = '#24323c', MUTED = '#6b7b86', WOOD = '#c9a27a', WOOD_DARK = '#8a5a2b', METAL = '#9aa7b0', WATER = '#7fb8d9', GOOD = '#2f7a4f', BAD = '#b5481d';
const T = ({x, y, children, anchor = 'start', color = INK, size = 11, weight = 600}: {x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; color?: string; size?: number; weight?: number}) =>
  <text x={x} y={y} textAnchor={anchor} fill={color} fontSize={size} fontWeight={weight} fontFamily="inherit">{children}</text>;
const Arrow = ({x1, y1, x2, y2, color = INK}: {x1: number; y1: number; x2: number; y2: number; color?: string}) => {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 6;
  return <g stroke={color} strokeWidth={1.5} fill="none"><line x1={x1} y1={y1} x2={x2} y2={y2}/><path d={`M${x2 - h * Math.cos(a - 0.5)} ${y2 - h * Math.sin(a - 0.5)}L${x2} ${y2}L${x2 - h * Math.cos(a + 0.5)} ${y2 - h * Math.sin(a + 0.5)}`}/></g>;
};

const drawings: Record<DiagramId, {title: string; body: ReactNode}> = {
  'door-reveal': {title: 'Read the gap (reveal) to find the cause', body: <>
    <rect x={40} y={14} width={150} height={226} fill="none" stroke={WOOD_DARK} strokeWidth={8}/>
    <path d="M48 22 L182 30 L182 232 L48 232 Z" fill={WOOD} stroke={WOOD_DARK} strokeWidth={1.5}/>
    {[40, 125, 205].map(y => <rect key={y} x={42} y={y} width={10} height={22} fill={METAL}/>)}
    <circle cx={170} cy={130} r={5} fill={METAL}/>
    <circle cx={180} cy={24} r={12} fill="none" stroke={BAD} strokeWidth={2.5}/>
    <T x={200} y={22} color={BAD}>Rubs here</T><T x={200} y={36} size={10} color={MUTED} weight={500}>top latch corner</T>
    <Arrow x1={198} y1={66} x2={54} y2={52} color={GOOD}/><T x={200} y={64} size={10} color={GOOD}>3" screw in top hinge</T><T x={200} y={77} size={10} color={GOOD}>pulls the door back up</T>
    <T x={200} y={120}>Even gap ≈ 1/8"</T><T x={200} y={134} size={10} color={MUTED} weight={500}>(a nickel thick)</T>
    <T x={200} y={176} size={10} color={MUTED} weight={500}>Tighten hinges first.</T><T x={200} y={190} size={10} color={MUTED} weight={500}>Plane only if still tight.</T>
  </>},
  'strike-plate': {title: 'Mark the latch, then move the strike to it', body: <>
    <rect x={40} y={20} width={60} height={210} fill={WOOD} stroke={WOOD_DARK}/>
    <rect x={52} y={92} width={36} height={70} rx={3} fill={METAL} stroke={INK}/>
    <rect x={62} y={112} width={16} height={26} fill="#fff" stroke={INK}/>
    <rect x={62} y={128} width={16} height={12} fill={BAD} opacity={0.7}/>
    <T x={112} y={118}>Strike opening</T><T x={112} y={142} color={BAD}>Latch mark hits low →</T>
    <T x={112} y={158} size={10} color={MUTED} weight={500}>door sagged: tighten hinges,</T><T x={112} y={171} size={10} color={MUTED} weight={500}>then file or move strike down</T>
    <T x={112} y={60} size={10} color={MUTED} weight={500}>Tip: lipstick or dry-erase</T><T x={112} y={73} size={10} color={MUTED} weight={500}>marker on the latch shows</T><T x={112} y={86} size={10} color={MUTED} weight={500}>exactly where it hits</T>
  </>},
  'hinge-pin': {title: 'One hinge at a time, door closed', body: <>
    <rect x={70} y={30} width={18} height={190} fill={WOOD} stroke={WOOD_DARK}/>
    {[0, 1, 2].map(i => <rect key={i} x={86} y={60 + i * 44} width={20} height={40} rx={4} fill={METAL} stroke={INK}/>)}
    <rect x={93} y={20} width={6} height={175} fill="#d9dee2" stroke={INK}/>
    <Arrow x1={96} y1={235} x2={96} y2={200} color={GOOD}/><T x={112} y={232}>Tap pin up from below</T>
    <T x={112} y={30}>Coat pin with petroleum</T><T x={112} y={44}>jelly, tap back down</T>
  </>},
  'euro-hinge': {title: 'Concealed cabinet hinge: three adjustments', body: <>
    <rect x={20} y={70} width={70} height={110} fill={WOOD} stroke={WOOD_DARK}/><T x={55} y={196} anchor="middle" size={10} color={MUTED}>Door</T>
    <circle cx={60} cy={125} r={22} fill={METAL} stroke={INK}/>
    <rect x={78} y={112} width={150} height={26} rx={6} fill={METAL} stroke={INK}/>
    <rect x={190} y={96} width={60} height={58} rx={4} fill="#d9dee2" stroke={INK}/><T x={220} y={170} anchor="middle" size={10} color={MUTED}>Plate</T>
    <circle cx={120} cy={125} r={7} fill="#fff" stroke="#2f6b5b" strokeWidth={2.5}/><circle cx={168} cy={125} r={7} fill="#fff" stroke="#6b4fa0" strokeWidth={2.5}/>
    <circle cx={205} cy={108} r={5} fill="#fff" stroke="#9a6b12" strokeWidth={2.5}/><circle cx={235} cy={142} r={5} fill="#fff" stroke="#9a6b12" strokeWidth={2.5}/>
    <T x={100} y={40} color="#2f6b5b">① Front screw: left ↔ right</T><Arrow x1={118} y1={46} x2={120} y2={114} color="#2f6b5b"/>
    <T x={100} y={226} color="#6b4fa0">② Back screw: in ↔ out</T><Arrow x1={160} y1={214} x2={168} y2={136} color="#6b4fa0"/>
    <T x={258} y={92} color="#9a6b12">③ Plate</T><T x={258} y={106} color="#9a6b12">screws:</T><T x={258} y={120} color="#9a6b12">up ↕ down</T>
  </>},
  'drawer-slide': {title: 'Side-mount ball-bearing slide', body: <>
    <rect x={20} y={30} width={280} height={170} fill="none" stroke={WOOD_DARK} strokeWidth={6}/><T x={30} y={22} size={10} color={MUTED}>Cabinet side</T>
    <rect x={40} y={100} width={250} height={14} fill={METAL} stroke={INK}/><T x={44} y={95} size={10}>Cabinet member (level, same height both sides)</T>
    <rect x={60} y={116} width={210} height={10} fill="#d9dee2" stroke={INK}/><T x={64} y={142} size={10}>Drawer member</T>
    <rect x={230} y={114} width={14} height={14} fill={INK}/><T x={198} y={160} size={10} color={BAD}>Release lever</T><Arrow x1={232} y1={150} x2={236} y2={130} color={BAD}/>
    <T x={40} y={184} size={11} color={GOOD}>About 1/2" clearance each side</T>
  </>},
  'toilet-tank': {title: 'Inside the tank', body: <>
    <path d="M40 30 H260 V220 H40 Z" fill="#f4f8fb" stroke={INK} strokeWidth={2}/>
    <rect x={42} y={92} width={216} height={126} fill={WATER} opacity={0.35}/>
    <rect x={70} y={60} width={16} height={158} fill="#e6eef3" stroke={INK}/><rect x={62} y={84} width={32} height={28} rx={4} fill="#fff" stroke={INK}/>
    <T x={60} y={50} size={10}>Fill valve + float</T>
    <rect x={180} y={70} width={14} height={140} fill="#e6eef3" stroke={INK}/><T x={198} y={76} size={10}>Overflow</T>
    <line x1={170} y1={70} x2={204} y2={70} stroke={GOOD} strokeDasharray="3 3" strokeWidth={2}/>
    <line x1={150} y1={92} x2={258} y2={92} stroke={GOOD} strokeWidth={2}/><T x={92} y={128} size={10} color={GOOD}>Water ≈ 1/2"</T><T x={92} y={141} size={10} color={GOOD}>under top</T>
    <ellipse cx={150} cy={212} rx={26} ry={7} fill={BAD} opacity={0.8}/><T x={110} y={238} size={10} color={BAD}>Flapper (most common leak)</T>
    <path d="M152 206 C158 170 160 110 162 36" fill="none" stroke={INK} strokeDasharray="2 3"/><T x={140} y={24} size={10}>Chain: ~1/2" slack</T>
  </>},
  'faucet-cartridge': {title: 'Single-handle cartridge faucet', body: <>
    {[['Handle + cap', 28, 34, '#d9dee2'], ['Set screw (Allen)', 72, 18, METAL], ['Retaining clip / nut', 100, 18, '#9aa7b0'], ['Cartridge (brand-specific)', 128, 52, '#e8eef2'], ['O-rings (silicone grease)', 190, 12, '#2f7a4f']].map(([label, y, h, fill]) =>
      <g key={label as string}><rect x={70} y={y as number} width={70} height={h as number} rx={4} fill={fill as string} stroke={INK}/><T x={156} y={(y as number) + (h as number) / 2 + 4}>{label as string}</T></g>)}
    <rect x={60} y={214} width={90} height={22} rx={4} fill={METAL} stroke={INK}/><T x={156} y={229} size={10} color={MUTED}>Faucet body (stays put)</T>
    <T x={10} y={252} size={10} color={BAD}>Water off at both shut-offs first. Photo each step.</T>
  </>},
  'hose-bib': {title: 'Outdoor spigot: what leaks where', body: <>
    <rect x={150} y={20} width={30} height={200} fill="#d8c4ae" stroke={WOOD_DARK}/><T x={186} y={30} size={10} color={MUTED}>House wall</T>
    <rect x={40} y={102} width={120} height={20} fill={METAL} stroke={INK}/><rect x={180} y={106} width={110} height={12} fill={METAL} stroke={INK}/>
    <T x={196} y={140} size={10}>Frost-free: valve</T><T x={196} y={153} size={10}>sits inside the</T><T x={196} y={166} size={10}>warm house</T>
    <rect x={50} y={70} width={14} height={34} fill={INK}/><circle cx={57} cy={62} r={14} fill="none" stroke={INK} strokeWidth={4}/>
    <rect x={46} y={94} width={22} height={12} fill={BAD}/><T x={6} y={30} size={10} color={BAD}>Leak at handle =</T><T x={6} y={43} size={10} color={BAD}>packing nut (1/8 turn)</T>
    <path d="M40 122 v26" stroke={WATER} strokeWidth={4}/><T x={6} y={172} size={10}>Drip from spout =</T><T x={6} y={185} size={10}>washer / seat</T>
    <T x={6} y={230} size={10} color={BAD}>Water inside the wall = freeze split → refer</T>
  </>},
  'grout-caulk': {title: 'Grout between tiles, caulk where things move', body: <>
    {[0, 1, 2].map(i => <rect key={i} x={30 + i * 70} y={40} width={64} height={64} fill="#e9edf0" stroke={INK}/>)}
    {[1, 2].map(i => <rect key={i} x={24 + i * 70} y={40} width={6} height={64} fill="#9aa7b0"/>)}
    <T x={30} y={30} size={10}>Grout joints: tile to tile, same plane</T>
    <rect x={30} y={140} width={150} height={46} fill="#e9edf0" stroke={INK}/><rect x={186} y={146} width={100} height={40} fill={WOOD} stroke={WOOD_DARK}/>
    <rect x={180} y={140} width={6} height={46} fill={GOOD}/>
    <T x={30} y={204} size={10} color={GOOD}>Flexible caulk: tile to wood, tub, wall,</T><T x={30} y={217} size={10} color={GOOD}>cabinet, corners (changes of material/plane)</T>
    <T x={30} y={236} size={10} color={BAD}>Grout here cracks every season.</T>
  </>},
  'transition': {title: 'Pick the profile by floor height', body: <>
    <rect x={20} y={70} width={110} height={18} fill="#e9edf0" stroke={INK}/><rect x={140} y={70} width={110} height={18} fill={WOOD} stroke={WOOD_DARK}/>
    <path d="M118 66 h34 v4 h-12 v18 h-10 v-18 h-12 z" fill={WOOD_DARK}/><T x={20} y={56}>T-molding: same height both sides</T>
    <rect x={20} y={176} width={110} height={12} fill="#e9edf0" stroke={INK}/><rect x={140} y={164} width={110} height={24} fill={WOOD} stroke={WOOD_DARK}/>
    <path d="M110 188 L138 162 h10 v26 z" fill={WOOD_DARK}/><T x={20} y={150}>Reducer: ramps from higher floor down</T>
    <T x={20} y={214} size={10} color={MUTED} weight={500}>Floating floor? Fasten the strip to the subfloor/track,</T><T x={20} y={227} size={10} color={MUTED} weight={500}>never through the floating planks.</T>
  </>},
  'nail-pop': {title: 'Re-secure, then patch', body: <>
    <rect x={120} y={20} width={40} height={210} fill={WOOD} stroke={WOOD_DARK}/>
    <rect x={40} y={20} width={200} height={210} fill="#f2f2ee" opacity={0.6} stroke={INK}/><T x={126} y={38} size={10} color={WOOD_DARK}>Stud</T>
    <circle cx={140} cy={125} r={8} fill={BAD}/><T x={166} y={129} color={BAD}>Popped nail</T>
    {[95, 155].map(y => <g key={y}><circle cx={140} cy={y} r={5} fill={GOOD}/></g>)}
    <T x={166} y={94} color={GOOD}>Screw ~1–1½" above</T><T x={166} y={160} color={GOOD}>Screw ~1–1½" below</T>
    <T x={44} y={248} size={10} color={MUTED}>Dimple just below the paper — don't tear it.</T>
  </>},
  'grab-bar': {title: 'Grab bar: height and framing', body: <>
    <line x1={20} y1={230} x2={300} y2={230} stroke={INK} strokeWidth={2}/>
    {[80, 196].map(x => <rect key={x} x={x} y={30} width={12} height={200} fill={WOOD} opacity={0.6}/>)}
    <T x={100} y={24} size={10} color={MUTED}>Studs (16" on center typical)</T>
    <rect x={72} y={100} width={136} height={10} rx={5} fill={METAL} stroke={INK}/>
    {[86, 202].map(x => <circle key={x} cx={x} cy={105} r={9} fill="none" stroke={GOOD} strokeWidth={2.5}/>)}
    <Arrow x1={250} y1={226} x2={250} y2={104}/><Arrow x1={250} y1={104} x2={250} y2={226}/><T x={258} y={160}>33–36"</T><T x={258} y={174} size={10} color={MUTED}>to top of bar</T>
    <T x={20} y={250} size={10} color={GOOD}>Flanges into studs or rated anchors. Pull-test hard.</T>
  </>},
  'screen-spline': {title: 'Roll the spline: sides, then ends', body: <>
    <rect x={40} y={30} width={220} height={170} fill="none" stroke={INK} strokeWidth={8}/>
    <rect x={48} y={38} width={204} height={154} fill="url(#mesh)"/>
    <defs><pattern id="mesh" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0h6M0 0v6" stroke="#9aa7b0" strokeWidth={0.6}/></pattern></defs>
    <T x={150} y={22} anchor="middle" color={GOOD}>① long side</T><T x={150} y={220} anchor="middle" color={GOOD}>② opposite side</T>
    <T x={6} y={118} color={GOOD}>③</T><T x={270} y={118} color={GOOD}>④</T>
    <T x={40} y={244} size={10} color={MUTED}>Hold it square; don't over-stretch.</T>
  </>},
  'stripped-hole': {title: 'Rebuild the wood, then re-drive', body: <>
    <rect x={40} y={40} width={90} height={170} fill={WOOD} stroke={WOOD_DARK}/>
    <rect x={76} y={60} width={18} height={120} fill="#fff" stroke={INK}/><T x={40} y={30}>Worn-out hole</T>
    <rect x={180} y={40} width={90} height={170} fill={WOOD} stroke={WOOD_DARK}/>
    {[0, 1, 2, 3].map(i => <rect key={i} x={214 + i * 4} y={60} width={3} height={120} fill={WOOD_DARK}/>)}
    <T x={180} y={30}>Glued toothpicks or dowel</T><T x={180} y={230} size={10} color={GOOD}>Dry, trim flush, pilot, screw</T>
    <T x={40} y={230} size={10} color={MUTED}>Or: 3" screw into the stud</T>
  </>},
  'shoe-molding': {title: 'Shoe molding: nail to the baseboard', body: <>
    <rect x={30} y={30} width={40} height={180} fill="#f2f2ee" stroke={INK}/><rect x={70} y={60} width={26} height={150} fill={WOOD} stroke={WOOD_DARK}/>
    <path d="M96 210 V188 Q96 210 118 210 Z" fill={WOOD_DARK}/>
    <line x1={20} y1={212} x2={300} y2={212} stroke={INK} strokeWidth={3}/><T x={130} y={232} size={10} color={MUTED}>Floor (free to move)</T>
    <Arrow x1={150} y1={180} x2={102} y2={198} color={GOOD}/><T x={156} y={176} color={GOOD}>Brad into baseboard,</T><T x={156} y={190} color={GOOD}>not into the floor</T>
    <T x={106} y={80}>Baseboard</T>
  </>},
  'bifold': {title: 'Bifold: pivots and guide', body: <>
    <line x1={30} y1={30} x2={290} y2={30} stroke={INK} strokeWidth={6}/><T x={30} y={22} size={10} color={MUTED}>Top track (keep clean)</T>
    <rect x={40} y={36} width={60} height={190} fill={WOOD} stroke={WOOD_DARK}/><rect x={102} y={36} width={60} height={190} fill={WOOD} stroke={WOOD_DARK}/>
    <circle cx={50} cy={34} r={6} fill={GOOD}/><circle cx={50} cy={228} r={6} fill={GOOD}/><circle cx={152} cy={34} r={6} fill="#466a8c"/>
    <T x={176} y={70} color={GOOD}>Top pivot: slide bracket</T><T x={176} y={84} color={GOOD}>to square the door</T>
    <T x={176} y={214} color={GOOD}>Bottom pivot: height</T><T x={176} y={126} color="#466a8c">Guide wheel rides</T><T x={176} y={140} color="#466a8c">in the track</T>
  </>},
};

export default function RepairDiagram({id, color}: {id: DiagramId; color: string}) {
  const d = drawings[id];
  return <figure className="repair-diagram" style={{borderColor: color}}>
    <svg viewBox="0 0 320 256" role="img" aria-label={d.title}>{d.body}</svg>
    <figcaption style={{color}}>{d.title}</figcaption>
  </figure>;
}
