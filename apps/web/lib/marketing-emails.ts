import {businessIdentity} from '../../../lib/business-identity.js';
import {emailLayout,emailButton,emailEscape,YNSG_EMAIL_IDENTITY} from '../../../lib/email-layout.js';

// Automated marketing emails. Two series: customers (people we have worked for) and prospects
// (website leads, giveaway entrants, partner inquiries and requests that didn't go ahead). Each month
// has its own seasonal content for the DeKalb to St. Charles area. Copy is written in Ed's voice:
// short, local, specific, and never a promise of price, availability or anything we don't offer.
export const JOURNEYS=['welcome','quote_followup','customer_checkin','customer_anniversary','winback','monthly'] as const;
export type Journey=typeof JOURNEYS[number];
export type Audience='customer'|'prospect';
export const JOURNEY_LABELS:Record<Journey,{title:string;detail:string}>={
 welcome:{title:'Welcome',detail:'The day after someone signs up (for example, a Service Saturday entry).'},
 quote_followup:{title:'Estimate follow-up',detail:'3 days after an estimate is sent, if it hasn’t been accepted yet.'},
 customer_checkin:{title:'Customer check-in',detail:'About 3 weeks after a customer’s invoice.'},
 customer_anniversary:{title:'One-year thank-you',detail:'A year after a customer’s first job.'},
 winback:{title:'Second chance',detail:'60–120 days after a request or estimate that didn’t go ahead.'},
 monthly:{title:'Monthly email',detail:'One per month: customer, prospect and business versions, sent Tue–Thu mornings.'}
};

const SITE=businessIdentity.website;
type Service={label:string;path:string};
const S:Record<string,Service>={
 snow:{label:'Snow clearing',path:'/snow-removal-dekalb-il'},
 handyman:{label:'Help around the home',path:'/handyman-dekalb-il'},
 access:{label:'Accessibility help',path:'/accessibility-home-safety-dekalb-il'},
 cleanout:{label:'Cleanouts and hauling',path:'/cleanout-dekalb-il'},
 yard:{label:'Yard cleanup and mulch',path:'/mulch-yard-cleanup-dekalb-il'},
 mulch:{label:'Mulch delivery and spreading',path:'/mulch-delivery-spreading-dekalb-il'},
 lawn:{label:'Lawn mowing',path:'/lawn-mowing-dekalb-il'},
 wash:{label:'Concrete pressure washing',path:'/concrete-pressure-washing-dekalb-il'},
 leaf:{label:'Leaf cleanup',path:'/leaf-cleanup-dekalb-il'},
 farm:{label:'Farm hand help',path:'/farm-hand-dekalb-il'}
};
type Month={subject:string;preview:string;headline:string;intro:string;checklist:[string,string,string];services:[string,string];customer:string;prospect:string};
// Index 0 = January.
export const MONTHS:Month[]=[
 {subject:'January at home: small fixes, big comfort',preview:'Indoor projects, safer steps and snow help when you need it.',headline:'A good month for the inside list',intro:'Cold weeks are when the little things inside the house start to bug you. They’re also when we have time to take care of them.',
  checklist:['Tighten wobbly railings and add a grab bar where someone needs one','Put up the shelves that have been waiting in the garage','Keep a path cleared to the mailbox and the car'],services:['handyman','access'],
  customer:'You already know how we work. Reply with your list and I’ll find a time.',prospect:'Send me your list and I’ll tell you what we can take care of in one visit.'},
 {subject:'Beat the spring rush: get on the list in February',preview:'Book early, finish the winter punch list and plan spring.',headline:'Spring fills up fast around here',intro:'By April, everyone in town wants the same weekend. A few minutes now gets you a spot before the rush.',
  checklist:['Finish indoor repairs before the yard work starts','Pick a date for spring cleanup and mulch','Clear the garage so there’s room for the mower again'],services:['yard','cleanout'],
  customer:'Reply with “spring” and I’ll pencil you in first.',prospect:'Request a spot now. Getting on the list doesn’t lock you into anything.'},
 {subject:'March: clear the clutter, plan the yard',preview:'Spring-cleaning hauls, garage cleanouts and yard prep.',headline:'Out with the winter clutter',intro:'Spring cleaning always turns up a pile of stuff that needs to go. We haul it, and we leave the space ready to use.',
  checklist:['Garage, basement or shed cleanout','Take broken furniture and old appliances to drop-off','Rake out beds once the ground firms up'],services:['cleanout','yard'],
  customer:'Point at the pile and we’ll take it from there. Reply and I’ll set a time.',prospect:'Tell me what needs to go and I’ll send a clear estimate before we start.'},
 {subject:'April: fresh mulch, clean beds, a yard you’ll use',preview:'Spring cleanup and mulch season is here.',headline:'Spring cleanup season',intro:'Fresh mulch and clean edges make the whole house look cared for, and they hold moisture through the summer.',
  checklist:['Clear leaves and winter debris from the beds','Edge the beds and lay fresh mulch','Book the first mow of the season'],services:['mulch','lawn'],
  customer:'Same yard, same care. Reply and I’ll get you on this month’s schedule.',prospect:'Tell me about the yard and I’ll send an estimate you can count on.'},
 {subject:'May: let someone else handle the mowing',preview:'Weekly or every-other-week mowing, plus patio and walk cleanup.',headline:'Get your Saturdays back',intro:'Mowing season is in full swing. A steady schedule keeps the lawn healthy and gives you your weekends back.',
  checklist:['Set a regular mowing schedule before the grass gets ahead','Pressure wash the patio and walk before cookout season','Touch up mulch where the rain thinned it'],services:['lawn','wash'],
  customer:'Want to be on a regular route? Reply and we’ll set it up.',prospect:'Ask about a regular mowing schedule. One request gets it started.'},
 {subject:'June: clean concrete and outdoor fixes',preview:'Pressure washing, outdoor lights and small summer repairs.',headline:'Make the outside look new again',intro:'A clean driveway and walkway change how the whole place feels. While we’re there, we can knock out the small outdoor fixes too.',
  checklist:['Pressure wash the driveway, walks and patio','Fix the outdoor light that stopped working','Tighten loose deck boards and railings'],services:['wash','handyman'],
  customer:'Reply with what’s bugging you outside and I’ll bundle it into one visit.',prospect:'Send a photo or two with your request and I’ll tell you what it takes.'},
 {subject:'July: summer upkeep without the sweat',preview:'Mowing, trimming and the odd jobs that pile up in summer.',headline:'Too hot to do it yourself',intro:'July is for being outside on purpose, not sweating through chores. Hand us the upkeep and enjoy the season.',
  checklist:['Keep mowing on schedule through the heat','Trim back overgrown shrubs from walks and windows','Haul away the summer project leftovers'],services:['lawn','farm'],
  customer:'Going on vacation? Reply and we’ll keep the yard looking lived-in.',prospect:'Request help for while you’re away, or for the job you keep putting off.'},
 {subject:'August: get the house organized before fall',preview:'Shelving, storage, cleanouts and back-to-school setup.',headline:'Reset the house before school starts',intro:'The end of summer is a good time to make some room. Shelving, storage and a cleanout make the next few months easier.',
  checklist:['Add basement or closet shelving','Clear out the room that turned into storage','Pressure wash before fall leaves stain the concrete'],services:['handyman','cleanout'],
  customer:'Reply with what you’d like organized and I’ll plan it out with you.',prospect:'Tell me which room is the problem and I’ll send a plan and estimate.'},
 {subject:'September: get ahead of fall',preview:'Outdoor repairs and yard work before the cold sets in.',headline:'Fix it now, not in the cold',intro:'Outdoor repairs are a lot easier in September than in November. Let’s get the outside ready before the weather turns.',
  checklist:['Repair steps, railings and outdoor lights','Cut back beds and refresh mulch for winter','Reserve your leaf cleanup date'],services:['handyman','yard'],
  customer:'Reply now to hold your usual fall spot.',prospect:'Request a fall visit early. Spots go quickly once the leaves drop.'},
 {subject:'October: reserve leaf cleanup and winter help',preview:'Leaf cleanup dates and snow clearing are filling up.',headline:'Leaves now, snow next',intro:'Leaf season is here and winter is right behind it. One call sets up both.',
  checklist:['Book leaf cleanup, including curb strips','Get on the snow clearing list before the first storm','Put away hoses and patio furniture'],services:['leaf','snow'],
  customer:'Reply with “leaves” or “snow” (or both) and I’ll lock in your spot.',prospect:'Request a leaf cleanup now and ask about snow clearing while you’re at it.'},
 {subject:'November: last call for leaves, ready for snow',preview:'Final leaf pickups, winter prep and snow clearing.',headline:'Wrap up the yard for winter',intro:'Before the snow flies, let’s get the last of the leaves out and the house ready for winter.',
  checklist:['Final leaf cleanup and bed cleanout','Clear walkways and window wells of leaves','Confirm your snow clearing plan'],services:['leaf','snow'],
  customer:'Thanks for a great season. Reply if there’s anything left before winter.',prospect:'There’s still time for a final cleanup. Send a request today.'},
 {subject:'December: snow help and a thank-you',preview:'Snow clearing, holiday help and our thanks for a good year.',headline:'Thank you for a good year',intro:'This was a great year in the neighborhood. We’re ready for snow, and for the holiday jobs that can’t wait.',
  checklist:['Snow clearing for drives, walks and steps','Move furniture or haul boxes before guests arrive','Add a grab bar or railing for visiting family'],services:['snow','access'],
  customer:'Thank you for trusting us with your home this year. Reply anytime. We’re here.',prospect:'If winter brings something you need help with, we’re a short message away.'}
];

export type Segment='home'|'business';
export type MarketingInput={journey:Journey;audience:Audience;month:number;name?:string|null;sendId:string;token:string;stage?:string;segment?:Segment};
// Business series: landlords, property managers, offices, churches and other organizations. Two months
// share each entry (index 0 = January–February). Same rules: no price, availability or credentials promised.
type BusinessMonth={subject:string;preview:string;headline:string;intro:string;checklist:[string,string,string]};
export const BUSINESS_MONTHS:BusinessMonth[]=[
 {subject:'A winter punch list for your building',preview:'Slow weeks are the best time to clear the small repairs.',headline:'Clear the building’s small-repair list',intro:'Winter is when the little things in a building get noticed: doors that don’t latch, loose hardware, worn caulk. It’s also when we have room on the schedule to take care of them.',
  checklist:['Doors, closers, locks and hardware that need adjusting','Wall patches and touch-ups in hallways and common rooms','Shelving, storage and furniture assembly']},
 {subject:'Spring grounds and turnover prep',preview:'Get the grounds cleaned up and turnovers lined up before May.',headline:'Get ahead of spring and move-out season',intro:'Spring cleanup and May move-outs arrive at the same time. A little planning now keeps both from landing on the same week.',
  checklist:['Clear winter debris from beds and common grounds','Refresh mulch at entrances and walkways','Hold turnover dates before the May move-outs']},
 {subject:'Turnovers without the scramble',preview:'Cleanouts, patching and a yard reset between tenants.',headline:'Get units ready to show, on schedule',intro:'Between tenants, every day a unit sits costs rent. We take care of the small jobs that hold up a turnover so it’s ready to show.',
  checklist:['Cleanouts of items left behind','Patching, touch-ups and hardware between tenants','A yard reset so the property shows well']},
 {subject:'August move-outs are coming',preview:'Book turnover help early and finish exterior touch-ups.',headline:'August fills up fast around NIU',intro:'Late summer brings the second wave of move-outs. Getting dates on the calendar now beats searching for help the week keys come back.',
  checklist:['Book August turnover dates now','Exterior touch-ups while the weather holds','Storage rooms and shelving before fall']},
 {subject:'Get the building ready before the cold',preview:'Weatherstripping, leaves and outdoor fixes before it freezes.',headline:'Fix it now, not in the cold',intro:'Outdoor items and drafty doors are a lot easier to deal with in the fall. Let’s get the building ready before the weather turns.',
  checklist:['Weatherstripping and door sweeps','Leaf cleanup on common grounds','Ground-level outdoor repairs before the freeze']},
 {subject:'Ready for holiday guests and services',preview:'A punch list before the busiest weeks of the year.',headline:'Get the building ready for the holidays',intro:'Holiday events, services and visitors put every building on display. A short punch list now means fewer surprises when people arrive.',
  checklist:['A punch list before holiday events and services','Grab bars and accessibility help for visitors','Clear storage rooms and haul away clutter']}
];
const firstName=(name?:string|null)=>{const f=(name||'').trim().split(/\s+/)[0]||'';return /^[\p{L}'’-]{2,30}$/u.test(f)?f:'';};
export const trackedLink=(sendId:string,path:string)=>{
 if(!/^[0-9a-f-]{36}$/i.test(sendId)||!/^\/[a-z0-9-/]*$/.test(path))throw Error('INVALID_LINK');
 return SITE+'/api/email-click?s='+sendId+'&to='+encodeURIComponent(path);
};
export const unsubscribeLink=(token:string)=>{if(!/^[a-f0-9]{64}$/.test(token))throw Error('INVALID_TOKEN');return SITE+'/unsubscribe?t='+token;};

type Body={subject:string;preview:string;headline:string;paragraphs:string[];callout?:{title:string;items:string[]};extra?:{title:string;items:string[];tone:'green'|'navy'};cta:{label:string;path:string};secondary?:{label:string;path:string}};
function compose(input:MarketingInput):Body{
 const hi=firstName(input.name),greet=hi?`Hi ${hi},`:'Hi neighbor,';
 const m=MONTHS[(input.month-1+12)%12]!;
 const customer=input.audience==='customer';
 if(input.segment==='business'){
  const b=BUSINESS_MONTHS[Math.floor(((input.month-1+12)%12)/2)]!;
  const how={tone:'navy' as const,title:'How we work with businesses',items:['A free walkthrough and a written, itemized scope','A fixed price for that scope, or a not-to-exceed cap when we can’t see it all','Before-and-after photos with every invoice']};
  if(input.journey==='welcome')return {subject:'Thanks for reaching out about your property',preview:'Who we are and how we work with businesses.',headline:'Glad to be on your list',
   paragraphs:[greet,'Thanks for getting in touch. I’m Ed, and Your Neighborhood Service Guy helps landlords, property managers, offices and churches from DeKalb to St. Charles with the small repairs and grounds work that pile up.','About once a month I’ll send a short note with what’s worth doing that season. You can unsubscribe in one click.'],
   extra:how,cta:{label:'Request a free walkthrough',path:'/business-community-partners'},secondary:{label:'See all services',path:'/services'}};
  if(input.journey==='winback')return {subject:'Still have a list for your property?',preview:'If the timing wasn’t right before, it might be now.',headline:'Still have something on the list?',
   paragraphs:[greet,'A while back you asked about help with a property. The timing or scope might not have lined up then.','If that list is still waiting, or a new one has come up, send it over and I’ll take a fresh look.'],
   callout:{title:'What we’re doing this season',items:b.checklist},cta:{label:'Request a free walkthrough',path:'/business-community-partners'}};
  if(input.journey==='monthly')return {subject:b.subject,preview:b.preview,headline:b.headline,
   paragraphs:[greet,b.intro,customer?'You already know how we work. Reply with the list and I’ll set a date.':'Send me the list, or ask for a free walkthrough, and I’ll put it all in writing.'],
   callout:{title:'This season’s checklist',items:b.checklist},extra:how,
   cta:customer?{label:'Book the next visit',path:'/request'}:{label:'Request a free walkthrough',path:'/business-community-partners'},secondary:{label:'See all services',path:'/services'}};
 }
 switch(input.journey){
  case 'welcome':return {subject:'Welcome to the neighborhood list',preview:'Who we are, what we do, and how to reach me.',headline:'Glad you’re here',
   paragraphs:[greet,'Thanks for signing up. I’m Ed, and Your Neighborhood Service Guy is how I help folks from DeKalb to St. Charles with the jobs that pile up: yard work, snow, hauling, small repairs and making homes safer to get around.','About once a month I’ll send a short note with what’s worth doing that season, and the occasional giveaway like Service Saturday. No spam, and you can unsubscribe in one click.'],
   callout:{title:'Most-asked-for help',items:[S.yard!.label,S.handyman!.label,S.snow!.label]},cta:{label:'See all services',path:'/services'},secondary:{label:'Request service',path:'/request'}};
  case 'quote_followup':return {subject:'Any questions about your estimate?',preview:'Happy to adjust the scope or find a date that works.',headline:'Your estimate is ready when you are',
   paragraphs:[greet,'I wanted to make sure your estimate came through and that it covers what you had in mind.','If something should be added, dropped or done differently, just reply. I can adjust the scope. And if the timing isn’t right, tell me when works better.'],
   cta:{label:'Contact us',path:'/request'}};
  case 'customer_checkin':return {subject:'How is everything holding up?',preview:'A quick check-in after our visit.',headline:'Checking in',
   paragraphs:[greet,'It’s been a few weeks since we were out. I hope everything is holding up the way it should.','If anything isn’t right, reply and I’ll take care of it. And if you were happy with the work, a quick Google review helps your neighbors find us.'],
   callout:{title:'Coming up this season',items:m.checklist},cta:{label:'Leave a Google review',path:'/review'},secondary:{label:'Book the next job',path:'/request'}};
  case 'customer_anniversary':return {subject:'One year together: thank you',preview:'A thank-you from Ed, a year after our first job together.',headline:'Thank you for a year of trust',
   paragraphs:[greet,'It’s been a year since our first job together. A small local business runs on people like you who call back and tell a neighbor, and I don’t take that for granted.','Whenever something comes up, reply to this email. You never need to fill out a form.'],
   callout:{title:'Good to do this time of year',items:m.checklist},cta:{label:'Book your next visit',path:'/request'}};
  case 'winback':return {subject:'New season, new openings',preview:'If the timing wasn’t right before, it might be now.',headline:'Still have something on the list?',
   paragraphs:[greet,'A while back you reached out about some help around your place. Timing, scope or the season might not have lined up then.','Things change, and we keep adding services and areas. If that job is still waiting, or a new one has come up, send it over and I’ll take a fresh look.'],
   callout:{title:'What we’re doing this month',items:m.checklist},cta:{label:'Send a new request',path:'/request'},secondary:{label:'See all services',path:'/services'}};
  default:{
   const svc=m.services.map(k=>S[k]!);
   return {subject:m.subject,preview:m.preview,headline:m.headline,
    paragraphs:[greet,m.intro,customer?m.customer:m.prospect],
    callout:{title:'This month’s checklist',items:m.checklist},
    extra:customer?{tone:'green',title:'For our customers',items:['Skip the form: reply to this email with your list','I already have your address and notes on file','Bundle a few small jobs into one visit']}
     :{tone:'navy',title:'Why neighbors call us',items:['Local and owner-operated: you talk to Ed','A clear written estimate before any work starts','One visit can cover several small jobs']},
    cta:customer?{label:'Book your next visit',path:'/request'}:{label:'Request service',path:'/request'},
    secondary:{label:svc[0]!.label,path:svc[0]!.path}};
  }
 }
}

export function marketingEmail(input:MarketingInput){
 const b=compose(input),unsubscribe=unsubscribeLink(input.token);
 const link=(path:string)=>path==='/review'?(businessIdentity.profiles[0]+'/review'):trackedLink(input.sendId,path);
 const items=b.callout?b.callout.items:[];
 const why=input.audience==='customer'?'You’re receiving this because you’re a customer of '+businessIdentity.brandName+'.':'You’re receiving this because you contacted or signed up with '+businessIdentity.brandName+'.';
 const callout=b.callout?`<div class="mail-detail" style="margin:22px 0;padding:16px 18px;background:#fbf7ec;border:1px solid #d6dfd7;border-left:5px solid #c6a35b;border-radius:12px"><p style="margin:0 0 8px;font-size:13px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#8a6d2f">${emailEscape(b.callout.title)}</p><ul style="margin:0;padding-left:20px">${items.map(i=>`<li style="margin:0 0 6px">${emailEscape(i)}</li>`).join('')}</ul></div>`:'';
 const tones={green:['#315842','#eef5f0','#315842'],navy:['#10283c','#eef2f6','#10283c']};
 const extra=b.extra?`<div class="mail-detail" style="margin:22px 0;padding:16px 18px;background:${tones[b.extra.tone][1]};border:1px solid #d6dfd7;border-left:5px solid ${tones[b.extra.tone][0]};border-radius:12px"><p style="margin:0 0 8px;font-size:13px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:${tones[b.extra.tone][2]}">${emailEscape(b.extra.title)}</p><ul style="margin:0;padding-left:20px">${b.extra.items.map(i=>`<li style="margin:0 0 6px">${emailEscape(i)}</li>`).join('')}</ul></div>`:'';
 const footer=`<p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#52636c">${emailEscape(why)} <a href="${emailEscape(unsubscribe)}" style="color:#21503a;font-weight:bold">Unsubscribe</a> in one click.<br>${emailEscape(businessIdentity.legalName)} · ${emailEscape(businessIdentity.mailingAddress)}</p>`;
 const html=emailLayout(businessIdentity.brandName,b.headline,b.preview,
  b.paragraphs.map(p=>`<p style="margin:0 0 16px">${emailEscape(p)}</p>`).join('')+(b.extra?.tone==='green'?extra+callout:callout+extra)+emailButton(b.cta.label,link(b.cta.path))+(b.secondary?emailButton(b.secondary.label,link(b.secondary.path),true):'')+footer,
  YNSG_EMAIL_IDENTITY);
 const text=[...b.paragraphs,...(b.callout?['',b.callout.title+':',...items.map(i=>'- '+i)]:[]),...(b.extra?['',b.extra.title+':',...b.extra.items.map(i=>'- '+i)]:[]),'',b.cta.label+': '+link(b.cta.path),...(b.secondary?[b.secondary.label+': '+link(b.secondary.path)]:[]),'','Best Regards,','Ed Hemmer · '+businessIdentity.phoneDisplay,'',why,'Unsubscribe: '+unsubscribe,businessIdentity.legalName+' · '+businessIdentity.mailingAddress].join('\n');
 return {subject:b.subject,preview:b.preview,html,body:text,
  headers:{'List-Unsubscribe':`<${SITE}/api/unsubscribe?t=${input.token}>, <mailto:${businessIdentity.email}?subject=unsubscribe>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}};
}
