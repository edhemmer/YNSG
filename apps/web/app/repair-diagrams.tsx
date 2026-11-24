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
  'dryer-vent': {title: 'Short, straight, metal — to the outside', body: <>
    <rect x={20} y={120} width={90} height={110} rx={6} fill="#e6e8f2" stroke={INK}/><circle cx={65} cy={170} r={28} fill="#fff" stroke={INK}/><T x={34} y={112} size={10}>Dryer</T>
    <path d="M110 150 H200 V70 H262" fill="none" stroke={METAL} strokeWidth={16}/><path d="M110 150 H200 V70 H262" fill="none" stroke={INK} strokeWidth={1} strokeDasharray="4 4"/>
    <rect x={262} y={20} width={22} height={210} fill="#d8c4ae" stroke={WOOD_DARK}/><path d="M284 58 h24 v26 h-24" fill="#d9dee2" stroke={INK}/><T x={186} y={14} size={10} color={MUTED}>Wall + flap hood →</T>
    <T x={116} y={176} size={10} color={GOOD}>4" rigid/semi-rigid metal</T><T x={116} y={190} size={10} color={GOOD}>foil tape joints, no screws</T>
    <T x={20} y={250} size={10} color={BAD}>No plastic, no foil accordion, no screen on the hood</T>
  </>},
  'dryer-cord': {title: 'Match the strap to the cord', body: <>
    <rect x={20} y={40} width={130} height={150} rx={8} fill="#f4f5f9" stroke={INK}/><T x={30} y={32}>4-prong (14-30)</T>
    {[45, 80, 115].map(x => <circle key={x} cx={x + 6} cy={90} r={9} fill={METAL} stroke={INK}/>)}
    <T x={36} y={120} size={9}>Hot</T><T x={74} y={120} size={9}>N</T><T x={108} y={120} size={9}>Hot</T>
    <circle cx={85} cy={160} r={7} fill={GOOD}/><T x={30} y={182} size={10} color={GOOD}>Green → frame screw</T>
    <T x={30} y={206} size={10} color={BAD} weight={700}>Remove N-to-frame strap</T>
    <rect x={170} y={40} width={130} height={150} rx={8} fill="#f4f5f9" stroke={INK}/><T x={180} y={32}>3-prong (10-30)</T>
    {[195, 230, 265].map(x => <circle key={x} cx={x + 6} cy={90} r={9} fill={METAL} stroke={INK}/>)}
    <path d="M236 99 V160" stroke={GOOD} strokeWidth={5}/><circle cx={236} cy={160} r={6} fill={INK}/>
    <T x={180} y={206} size={10} color={GOOD} weight={700}>Strap stays in</T>
    <T x={20} y={236} size={10} color={MUTED}>Always follow the diagram on the dryer's back panel.</T>
  </>},
  'washer-hookup': {title: 'Valves, hoses, drain, level', body: <>
    <rect x={30} y={20} width={260} height={60} rx={6} fill="#f2f2ee" stroke={INK}/><circle cx={80} cy={50} r={10} fill="#d24b4b"/><circle cx={120} cy={50} r={10} fill="#2f6fa3"/><T x={70} y={34} size={9}>Hot</T><T x={108} y={34} size={9}>Cold</T>
    <rect x={220} y={26} width={18} height={70} fill="#d9dee2" stroke={INK}/><T x={236} y={110} size={10}>Standpipe</T><T x={236} y={123} size={9} color={MUTED}>e.g. ≥39" tall</T>
    <rect x={60} y={130} width={120} height={110} rx={8} fill="#e6e8f2" stroke={INK}/><circle cx={120} cy={185} r={30} fill="#fff" stroke={INK}/>
    <path d="M80 60 C80 100 90 120 100 130" fill="none" stroke="#d24b4b" strokeWidth={3}/><path d="M120 60 C120 100 125 120 130 130" fill="none" stroke="#2f6fa3" strokeWidth={3}/>
    <path d="M170 135 C200 120 220 90 229 40" fill="none" stroke={INK} strokeWidth={3}/><T x={248} y={60} size={9} color={GOOD}>Hook in, strap it,</T><T x={248} y={72} size={9} color={GOOD}>not airtight</T>
    <T x={190} y={176} size={10} color={BAD}>Shipping bolts out</T><T x={190} y={232} size={10} color={GOOD}>Level + lock legs</T>
  </>},
  'mow-height': {title: 'Mow tall: never cut more than a third', body: <>
    <line x1={20} y1={220} x2={300} y2={220} stroke={WOOD_DARK} strokeWidth={6}/>
    {Array.from({length: 13}, (_, i) => <path key={i} d={`M${40 + i * 14} 220 q -4 -60 2 -130`} stroke="#3f7d2a" strokeWidth={3} fill="none"/>)}
    <line x1={20} y1={135} x2={300} y2={135} stroke={BAD} strokeDasharray="5 4" strokeWidth={2}/><T x={22} y={78} size={10} color={BAD}>Cut line: remove ≤ 1/3 of the blade</T>
    <Arrow x1={300} y1={218} x2={300} y2={140} color={GOOD}/><T x={232} y={180} size={11} color={GOOD}>2½–3"</T><T x={226} y={194} size={9} color={MUTED}>taller: fescue</T>
    <T x={22} y={244} size={10} color={MUTED}>Sharp blades · leave clippings · alternate direction</T>
  </>},
  'mulch-ring': {title: 'A donut, not a volcano', body: <>
    <line x1={10} y1={200} x2={150} y2={200} stroke={WOOD_DARK} strokeWidth={4}/><rect x={70} y={60} width={20} height={140} fill={WOOD_DARK}/>
    <path d="M30 200 Q80 120 130 200 Z" fill="#8a5a2b" opacity={0.75}/><T x={20} y={50} color={BAD}>✗ Volcano</T><T x={14} y={226} size={9} color={BAD}>piled on trunk = rot</T>
    <line x1={170} y1={200} x2={310} y2={200} stroke={WOOD_DARK} strokeWidth={4}/><rect x={230} y={60} width={20} height={140} fill={WOOD_DARK}/>
    <path d="M180 200 Q182 182 200 182 H222 V200 Z M258 200 V182 H282 Q300 182 302 200 Z" fill="#8a5a2b" opacity={0.75}/><T x={184} y={50} color={GOOD}>✓ Donut</T>
    <T x={176} y={226} size={9} color={GOOD}>2–3" deep, trunk flare clear</T>
  </>},
  'tv-mount': {title: 'Mount into two studs', body: <>
    {[90, 230].map(x => <rect key={x} x={x} y={10} width={14} height={230} fill={WOOD} opacity={0.6}/>)}<T x={108} y={250} size={9} color={MUTED}>Studs (verify, don't guess)</T>
    <rect x={70} y={90} width={180} height={50} rx={4} fill={METAL} stroke={INK}/>
    {[97, 237].flatMap(x => [104, 126].map(y => <circle key={x + '-' + y} cx={x} cy={y} r={5} fill={GOOD}/>))}
    <T x={74} y={84} size={10} color={GOOD}>Lag bolts into stud centers</T>
    <rect x={40} y={60} width={240} height={140} rx={6} fill="none" stroke={INK} strokeDasharray="6 4"/><T x={108} y={214} size={10} color={MUTED}>TV: VESA + weight-rated mount</T>
    <T x={108} y={228} size={10} color={BAD}>Never drywall anchors alone</T>
  </>},
  'anchor-chart': {title: 'Pick the fastener by load and wall', body: <>
    {[['Light', 'Picture hook / small anchor', 30, GOOD], ['Medium', 'Stud, or rated metal anchor', 82, '#9a6b12'], ['Heavy / pulled on', 'Into studs (or rated toggle)', 134, BAD], ['Grab bars', 'Studs or grab-bar anchors only', 186, '#9b3b4a']].map(([a, b, y, c]) =>
      <g key={a as string}><rect x={20} y={y as number} width={280} height={44} rx={8} fill="#fff" stroke={c as string} strokeWidth={2}/><T x={32} y={(y as number) + 19} color={c as string} size={12} weight={700}>{a as string}</T><T x={32} y={(y as number) + 35} size={10} color={MUTED}>{b as string}</T></g>)}
    <T x={20} y={248} size={10} color={MUTED}>Use the package rating — and stay well under it.</T>
  </>},
  'gate-brace': {title: 'Brace pushes up, cable pulls up', body: <>
    <rect x={20} y={20} width={14} height={196} fill={WOOD_DARK}/><T x={4} y={14} size={9} color={MUTED}>Hinge post</T>
    <rect x={40} y={40} width={120} height={170} fill={WOOD} opacity={0.5} stroke={WOOD_DARK}/>
    <line x1={42} y1={206} x2={158} y2={44} stroke={GOOD} strokeWidth={8}/><T x={20} y={232} size={10} color={GOOD}>Left: wood brace, low hinge → high latch</T>
    <rect x={180} y={40} width={120} height={170} fill={WOOD} opacity={0.5} stroke={WOOD_DARK}/><rect x={166} y={20} width={14} height={196} fill={WOOD_DARK}/>
    <line x1={182} y1={44} x2={298} y2={206} stroke={INK} strokeWidth={2.5}/><rect x={232} y={116} width={16} height={10} fill={METAL} stroke={INK}/><T x={20} y={248} size={10}>Right: cable, high hinge → low latch</T>
  </>},

  'drywall-patch': {title: 'Pick the patch by hole size', body: <>
    {[[20, 'Nail hole', 'Spackle, 2 skims', 6], [120, 'Up to ~6"', 'Mesh patch + mud', 22], [220, 'Bigger', 'Backer + drywall', 34]].map(([x, a, b, r]) =>
      <g key={a as string}><rect x={x as number} y={30} width={84} height={110} rx={6} fill="#f7f5f1" stroke={INK}/>
        {(r as number) < 30 ? <circle cx={(x as number) + 42} cy={85} r={r as number} fill="#cfc8bd" stroke={MUTED}/> : <><rect x={(x as number) + 12} y={52} width={60} height={66} fill={WOOD} opacity={0.35} stroke={WOOD_DARK} strokeDasharray="4 3"/><rect x={(x as number) + 22} y={62} width={40} height={46} fill="#fff" stroke={INK}/></>}
        {(r as number) === 22 && <rect x={(x as number) + 12} y={55} width={60} height={60} fill="none" stroke={GOOD} strokeWidth={2} strokeDasharray="3 3"/>}
        <T x={(x as number) + 42} y={160} anchor="middle" size={11}>{a as string}</T><T x={(x as number) + 42} y={176} anchor="middle" size={9} color={MUTED}>{b as string}</T></g>)}
    <rect x={30} y={196} width={260} height={22} rx={11} fill="none" stroke={GOOD}/><rect x={110} y={200} width={100} height={14} rx={7} fill={GOOD} opacity={0.35}/>
    <T x={160} y={236} anchor="middle" size={10} color={GOOD}>3 thin coats, each wider · final ~12" square</T>
    <T x={160} y={251} anchor="middle" size={10} color={MUTED}>Sand · prime the patch · paint</T>
  </>},
  'picture-hang': {title: 'Measure the hook point, hang on two', body: <>
    <rect x={40} y={40} width={150} height={110} fill="#f4efe6" stroke={WOOD_DARK} strokeWidth={6}/>
    <path d="M60 70 L115 52 L170 70" fill="none" stroke={INK} strokeWidth={1.5}/><circle cx={115} cy={52} r={3} fill={BAD}/>
    <line x1={200} y1={37} x2={200} y2={52} stroke={BAD} strokeWidth={2}/><T x={206} y={48} size={10} color={BAD}>wire peak to top</T>
    <line x1={20} y1={190} x2={300} y2={190} stroke={INK} strokeDasharray="4 4"/><T x={210} y={184} size={10} color={MUTED}>level line</T>
    {[88, 142].map(x => <g key={x}><circle cx={x} cy={190} r={5} fill={GOOD}/></g>)}<T x={70} y={210} size={10} color={GOOD}>Two hooks, ~⅓ in from each side</T>
    <Arrow x1={20} y1={250} x2={20} y2={100} color={MUTED}/><T x={28} y={240} size={10} color={MUTED}>Center ≈ 57–60" from floor</T>
  </>},
  'plunger': {title: 'Use the right plunger', body: <>
    <rect x={50} y={20} width={8} height={110} fill={WOOD}/><path d="M24 130 Q54 96 84 130 Z" fill="#d24b4b" stroke={INK}/><T x={20} y={160} size={11}>Cup plunger</T><T x={20} y={176} size={10} color={MUTED}>sinks · tubs</T><T x={20} y={192} size={10} color={MUTED}>block the overflow</T>
    <rect x={212} y={20} width={8} height={100} fill={WOOD}/><path d="M186 120 Q216 86 246 120 Z" fill="#2b2b2b" stroke={INK}/><rect x={206} y={120} width={20} height={16} rx={4} fill="#2b2b2b"/><T x={176} y={160} size={11}>Flange plunger</T><T x={176} y={176} size={10} color={MUTED}>toilets: flange seals</T><T x={176} y={192} size={10} color={MUTED}>the bowl opening</T>
    <T x={20} y={226} size={10} color={GOOD}>Gentle first push · keep the seal · 10–15 strokes</T>
    <T x={20} y={244} size={10} color={BAD}>No chemical cleaners in toilets</T>
  </>},
  'thread-tape': {title: 'Wrap tape the way it tightens', body: <>
    <rect x={20} y={100} width={180} height={34} fill={METAL} stroke={INK}/><T x={24} y={92} size={10} color={MUTED}>Shower arm (stays in the wall)</T>
    {Array.from({length: 7}, (_, i) => <line key={i} x1={150 + i * 7} y1={100} x2={146 + i * 7} y2={134} stroke={INK}/>)}
    <rect x={150} y={102} width={50} height={30} fill="#fff" opacity={0.55}/>
    <path d="M176 82 A26 26 0 1 1 150 150" fill="none" stroke={GOOD} strokeWidth={2.5}/><Arrow x1={152} y1={150} x2={146} y2={146} color={GOOD}/>
    <T x={212} y={110} size={11} color={GOOD}>Clockwise,</T><T x={212} y={125} size={11} color={GOOD}>2–3 wraps</T><T x={212} y={140} size={9} color={MUTED}>(looking at the end)</T>
    <T x={20} y={186} size={10}>Hold the arm with one hand while turning</T><T x={20} y={202} size={10}>Hand-tight + ¼ turn with a rag-wrapped wrench</T>
    <T x={20} y={230} size={10} color={MUTED}>WaterSense heads: ≤ 2.0 gpm (federal max 2.5)</T>
  </>},
  'caulk-bead': {title: 'Backer rod for deep gaps, one smooth bead', body: <>
    <rect x={20} y={40} width={120} height={150} fill={WOOD} stroke={WOOD_DARK}/><rect x={160} y={40} width={140} height={150} fill="#e9e4dc" stroke={INK}/><T x={30} y={30} size={10} color={MUTED}>Trim</T><T x={170} y={30} size={10} color={MUTED}>Siding / wall</T>
    <rect x={140} y={40} width={20} height={150} fill="#fff" stroke={MUTED} strokeDasharray="3 3"/>
    <circle cx={150} cy={130} r={9} fill="#9cc2e6" stroke={INK}/><path d="M140 112 Q150 96 160 112 L160 120 L140 120 Z" fill="#f2f2f2" stroke={INK}/>
    <T x={40} y={214} size={10} color={GOOD}>Backer rod first when deeper than ~¼"</T>
    <T x={40} y={230} size={10} color={GOOD}>Clean + dry · continuous bead · tool it</T>
    <T x={40} y={248} size={10} color={BAD}>Never caulk window weep holes</T>
    <T x={170} y={110} size={9}>← caulk bead</T><T x={170} y={134} size={9}>← backer rod</T>
  </>},
  'pruning-cut': {title: 'Cut just outside the branch collar', body: <>
    <rect x={20} y={10} width={40} height={236} fill={WOOD_DARK}/>
    <path d="M60 110 Q70 100 80 104 L290 74 L292 98 L80 128 Q70 132 60 128 Z" fill={WOOD} stroke={WOOD_DARK}/>
    <path d="M60 104 Q74 100 82 104 L82 128 Q74 132 60 128" fill="none" stroke={GOOD} strokeWidth={3}/><T x={68} y={150} size={10} color={GOOD}>Branch collar: keep it</T>
    <line x1={86} y1={92} x2={88} y2={138} stroke={GOOD} strokeWidth={2.5}/><T x={92} y={168} size={11} color={GOOD}>✓ Final cut here</T>
    <line x1={60} y1={96} x2={60} y2={138} stroke={BAD} strokeWidth={2.5} strokeDasharray="4 3"/><T x={66} y={88} size={10} color={BAD}>✗ Flush cut (into collar)</T>
    <line x1={170} y1={80} x2={170} y2={118} stroke={MUTED} strokeWidth={2}/><line x1={200} y1={84} x2={200} y2={96} stroke={MUTED} strokeWidth={2}/><line x1={230} y1={78} x2={230} y2={110} stroke={MUTED} strokeWidth={2}/>
    <T x={78} y={196} size={10} color={MUTED}>Heavy limb: undercut ①, top cut ②,</T><T x={78} y={210} size={10} color={MUTED}>then final cut ③ at the collar</T>
    <T x={78} y={238} size={10} color={MUTED}>No stubs · no wound paint</T>
  </>},
  'deck-screws': {title: 'Two screws per joist, ends on joist centers', body: <>
    {[60, 160, 260].map(x => <rect key={x} x={x - 8} y={20} width={16} height={160} fill={WOOD_DARK} opacity={0.35}/>)}<T x={300} y={14} anchor="end" size={9} color={MUTED}>Joists (check for soft spots)</T>
    {[40, 84, 128].map(y => <rect key={y} x={20} y={y} width={280} height={38} fill={WOOD} stroke={WOOD_DARK}/>)}
    {[40, 84, 128].flatMap(y => [60, 160, 260].flatMap(x => [y + 9, y + 29].map(yy => <circle key={x + '-' + yy} cx={x} cy={yy} r={3} fill={INK}/>)))}
    <line x1={160} y1={84} x2={160} y2={122} stroke={BAD} strokeWidth={2}/><T x={20} y={202} size={10} color={GOOD}>Screws ~¾" from edges · pre-drill near ends</T>
    <T x={20} y={218} size={10} color={GOOD}>Board ends meet on joist center (red line)</T>
    <T x={20} y={246} size={10} color={MUTED}>Keep the same gap as neighbors so water drains</T>
  </>},
  'paver-base': {title: 'Fix the base, not just the paver', body: <>
    {[60, 120, 180, 240].map(x => <rect key={x} x={x - 26} y={46} width={52} height={28} fill="#b9a596" stroke={INK}/>)}
    <rect x={20} y={74} width={280} height={18} fill="#e8d9a8"/><rect x={20} y={92} width={280} height={60} fill="#a8a8a0"/>
    {Array.from({length: 24}, (_, i) => <circle key={i} cx={30 + (i % 12) * 23} cy={106 + Math.floor(i / 12) * 26} r={3} fill="#7d7d76"/>)}
    <rect x={20} y={152} width={280} height={56} fill="#9b7c5c"/>
    <T x={24} y={40} size={10}>Pavers · sand-filled joints</T><T x={196} y={87} size={10}>Bedding sand ~1"</T>
    <T x={160} y={128} anchor="middle" size={10} color="#fff">Compacted base ≥ 4" (walks, patios)</T><T x={160} y={186} anchor="middle" size={10} color="#fff">Compacted soil</T>
    <T x={20} y={232} size={10} color={MUTED}>ICPI: sand bed doesn't fill dips — rebuild and tamp the base</T>
    <T x={20} y={248} size={10} color={GOOD}>Edge restraint keeps it all from creeping</T>
  </>},
  'dishwasher-drain': {title: 'Follow the drain: filter → hose → air gap or high loop → disposal', body: <>
    <rect x={10} y={60} width={300} height={10} fill={WOOD_DARK}/><T x={14} y={54} size={10} color={MUTED}>Countertop</T>
    <rect x={14} y={78} width={92} height={150} fill="#e9edf0" stroke={INK}/><T x={60} y={98} anchor="middle" size={10}>Dishwasher</T>
    <rect x={30} y={196} width={60} height={14} rx={3} fill={METAL} stroke={INK}/><T x={60} y={224} anchor="middle" size={9} color={GOOD}>① Clean filter</T>
    <rect x={150} y={44} width={12} height={18} rx={3} fill={METAL} stroke={INK}/><T x={168} y={40} size={10}>② Air gap cap</T>
    <path d="M90 206 C130 206 120 84 150 84 C170 84 160 130 214 160" fill="none" stroke={WATER} strokeWidth={5}/>
    <T x={118} y={120} size={9} color={MUTED}>③ No kinks · loop</T><T x={118} y={131} size={9} color={MUTED}>up under counter</T>
    <rect x={214} y={140} width={56} height={62} rx={10} fill="#cfd6db" stroke={INK}/><T x={242} y={176} anchor="middle" size={10}>Disposal</T>
    <circle cx={214} cy={160} r={7} fill="none" stroke={BAD} strokeWidth={2.5}/><T x={200} y={222} size={9} color={BAD}>④ New disposal? Knockout</T><T x={200} y={234} size={9} color={BAD}>plug inside this inlet</T>
    <T x={10} y={250} size={9} color={GOOD}>Pencil goes in ~3" = plug is out · power off first</T>
  </>},
  'thermostat-wires': {title: 'Go by the letter, not the wire color', body: <>
    <rect x={20} y={24} width={130} height={170} rx={10} fill="#f4f6f7" stroke={INK}/><T x={85} y={44} anchor="middle" size={10} color={MUTED}>Wall plate</T>
    {([['R', '#b5481d', '24 V power'], ['C', '#24323c', 'Common (powers screen)'], ['W', '#9aa7b0', 'Heat'], ['Y', '#c28a00', 'Cooling'], ['G', '#2f7a4f', 'Fan']] as const).map(([l, c, m], i) => <g key={l}>
      <rect x={40} y={58 + i * 26} width={22} height={18} rx={3} fill="#fff" stroke={INK}/><T x={51} y={71 + i * 26} anchor="middle" size={11}>{l}</T>
      <line x1={62} y1={67 + i * 26} x2={130} y2={67 + i * 26} stroke={c} strokeWidth={4}/>
      <T x={160} y={71 + i * 26} size={10}>{m}</T></g>)}
    <T x={20} y={214} size={10} color={GOOD}>Power off at furnace · photo before unhooking</T>
    <T x={20} y={230} size={10} color={BAD}>Thick wires or wire nuts = line voltage: refer</T>
    <T x={20} y={246} size={9} color={MUTED}>Colors shown are common, not guaranteed</T>
  </>},
};

export default function RepairDiagram({id, color}: {id: DiagramId; color: string}) {
  const d = drawings[id];
  return <figure className="repair-diagram" style={{borderColor: color}}>
    <svg viewBox="0 0 320 256" role="img" aria-label={d.title}>{d.body}</svg>
    <figcaption style={{color}}>{d.title}</figcaption>
  </figure>;
}
