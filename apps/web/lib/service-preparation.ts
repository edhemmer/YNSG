/** Preparation within the existing offered scope, never an approval or a quote.
 * External references are general guidance; company limits still control. */
export type ServicePreparation={id:string;title:string;source:string;url:string;checkedOn:string;safety:string;questions:string[];tools:string[];stop:string;steps:string[];customerQuestions:string[]};
const checkedOn='2026-10-31';
export const servicePreparations:ServicePreparation[]=[
 {id:'lawn-preparation',title:'Prepare a lawn mowing visit',source:'OSHA — landscape and horticultural hazards',url:'https://www.osha.gov/landscaping/hazards/',checkedOn,
  safety:'Inspect the work area and equipment, keep people clear, and follow the equipment manual.',
  questions:['What area is included, and how is it accessed?','Are there gates, slopes, hidden obstacles, pets or irrigation features?','Are the ground and weather suitable for the equipment?'],
  tools:['Suitable maintained mowing equipment','Equipment-required protective gear','Site access details'],
  stop:'Stop for unsafe slopes, hidden hazards, bystanders or unsuitable conditions. Tree work, chemicals and other unapproved services are outside this guide.',
  steps:['Walk the agreed area with the customer or their instructions before beginning.','Check for loose objects and features that could be damaged or struck.','Inspect the equipment and use the manufacturer-required guards and protective gear.','Confirm boundaries, access and the requested result; keep other people and pets clear.','Review the finished area and any follow-up needs without adding unapproved work.'],
  customerQuestions:['Which lawn areas would you like included?','Are there gates, slopes, pets or obstacles we should know about?']},
 {id:'leaf-preparation',title:'Plan leaf management',source:'OSHA — landscape and horticultural hazards',url:'https://www.osha.gov/landscaping/hazards/',checkedOn,
  safety:'Inspect the area for hidden objects, choose suitable equipment and protect people from flying debris.',
  questions:['Which areas need attention, and are the leaves wet or mixed with other material?','Are there delicate plants, gravel, fixtures or obstacles?','What material-management arrangements need to be agreed before work?'],
  tools:['Suitable rake or leaf equipment','Equipment-required protective gear','Agreed material-management plan'],
  stop:'Do not assume a disposal method. Roofs, gutters, burning, hazardous material and tree work are outside this guide.',
  steps:['Confirm the areas and desired result.','Check the leaves and surrounding area for hidden objects and delicate features.','Agree on how collected material will be managed before beginning.','Use appropriate equipment and its protective measures, keeping other people clear.','Review the result and the agreed material arrangements with the customer.'],
  customerQuestions:['Which areas need leaf management?','Is there anything delicate or hidden in the area, and what material arrangements should we review?']},
 {id:'garden-preparation',title:'Prepare mulch and garden-bed work',source:'University of Illinois Extension — proper mulching',url:'https://extension.illinois.edu/news-releases/too-much-good-thing-mulch-volcanoes-slowly-kill-trees',checkedOn,
  safety:'Confirm plants and materials; keep mulch away from trunks and follow the agreed planting scope.',
  questions:['Which plants should stay, and which areas need attention?','Are materials already purchased, and is pickup part of the agreed work?','Are irrigation, electrical fixtures or buried features identified before disturbing soil?'],
  tools:['Suitable hand tools','Agreed materials and supplier details','Gloves and task-appropriate protective gear'],
  stop:'No herbicides, tree work or work above the approved five-foot limit. Stop for unknown plants, hidden services or conditions outside the agreed scope.',
  steps:['Identify the exact beds, plants to retain and requested result.','Confirm material type, payment, pickup and access before a materials run.','Check the area for fixtures, irrigation and unknown buried features before disturbing soil.','Use the agreed manual methods; when mulching, keep material clear of trunks and plant crowns.','Review the area with the customer and record any additional work separately.'],
  customerQuestions:['Which beds or plants would you like us to work on?','Are the materials already purchased, and is pickup needed?']},
 {id:'snow-preparation',title:'Prepare residential snow clearing',source:'OSHA — winter weather hazards',url:'https://www.osha.gov/winter-weather/hazards',checkedOn,
  safety:'Review ground conditions, visibility and cold exposure; follow the snow equipment manual.',
  questions:['Which residential ground-level surfaces need clearing?','Are edges, steps, obstacles and the agreed snow-placement area identified?','Are ice, traffic, poor visibility or weather creating unsafe conditions?'],
  tools:['Suitable maintained snow equipment','Weather-appropriate clothing and traction','Clear access and marked obstacles'],
  stop:'No roofs, ladders, commercial snow work, salt or deicer. Stop when ice, weather, traffic or equipment conditions make the agreed work unsafe.',
  steps:['Confirm the residential driveway, walks and accessible entry included in the request.','Identify obstacles, surface edges and where snow may be placed.','Check equipment, clothing, visibility and footing before beginning.','Keep clear of moving parts and follow the manufacturer’s shutdown procedure before addressing a blockage.','Review the result; describe remaining conditions without promising an ice-free surface.'],
  customerQuestions:['Which driveway, walks or entry areas need clearing?','Are there obstacles or a preferred area for snow placement we should review?']},
 {id:'pressure-washing-preparation',title:'Prepare ground-level concrete washing',source:'CDC — pressure washer safety',url:'https://www.cdc.gov/natural-disasters/safety/pressure-washer-safety.html',checkedOn,
  safety:'High-pressure spray, electrical connections and engine exhaust require equipment-specific precautions.',
  questions:['Is the requested surface concrete and suitable for the equipment?','Is customer-supplied outdoor water available?','Are drainage, electrical fixtures, nearby belongings and public access reviewed?'],
  tools:['Suitable inspected pressure washer','Manufacturer-required protective gear','Customer water connection and reviewed drainage plan'],
  stop:'Ground-level approved concrete only. No roofs, ladders or unapproved surfaces. Stop for unsafe runoff, damaged equipment, electrical hazards or people entering the work area.',
  steps:['Confirm the surface and approved work area before setting up.','Review customer-supplied water, drainage and nearby items with the customer.','Inspect the machine and follow its manual, including electrical or exhaust precautions.','Keep people clear and never direct the spray at anyone; review surface suitability before proceeding.','Check the result and surrounding area with the customer.'],
  customerQuestions:['Which concrete areas would you like cleaned?','Is an outdoor water connection available, and are there drainage or access concerns?']},
 {id:'cleanout-preparation',title:'Plan a manageable household cleanout',source:'US EPA — household hazardous waste',url:'https://www.epa.gov/hw/household-hazardous-waste-hhw',checkedOn,
  safety:'Identify excluded or unknown material before handling; hazardous household waste needs separate arrangements.',
  questions:['Which items should go, and which must stay?','Are item size, weight, stairs and access manageable?','Are excluded materials and the removal plan reviewed, including any disposal fees?'],
  tools:['Suitable handling aids and protective gear','Clear access and separated keep-items','Reviewed loading and removal arrangements'],
  stop:'No hazardous materials, large appliances or excessively heavy items. Stop for unknown contents, unsafe access or loads beyond suitable equipment and handling capacity.',
  steps:['Identify the exact items and keep-items before moving anything.','Review access, stairs, item dimensions and handling needs.','Separate unknown or excluded material; do not treat chemicals or other hazardous waste as ordinary clutter.','Confirm the removal arrangements and any applicable disposal fees before proceeding.','Use suitable handling and loading practices and review the cleared area with the customer.'],
  customerQuestions:['Which items should be removed, and what should stay?','Are there stairs, heavy items or materials with unknown contents we should review?']}
];
export function unsupportedPreparationTask(service:string,task:string){return /\b(roof|rooftop|gutter|tree (removal|trimming|planting|pruning)|hardwiring|hardwired|rewiring|electrical|hvac|thermostat|pesticide|herbicide|structural|engine repair)\b/i.test((service+' '+task).replace(/\s+/g,' '));}
export function servicePreparationForWork(service:string,task:string){
 if(unsupportedPreparationTask(service,task))return null;
 const name=(service+' '+task).toLowerCase();
 const id=/leaf|leaves/.test(name)?'leaf-preparation':/cleanout|household item removal/.test(name)?'cleanout-preparation':/pressure wash|concrete wash/.test(name)?'pressure-washing-preparation':/snow clear|snow remov|snow blow/.test(name)?'snow-preparation':/yard & garden|mulch|planting|pulling weeds|garden-bed|small bush trimming|moving yard materials/.test(name)?'garden-preparation':/lawn care|lawn mow|mowing|\bmow\b|trimming and edging/.test(name)?'lawn-preparation':null;
 const preparation=servicePreparations.find(preparation=>preparation.id===id)||null;
 if(preparation?.id!=='garden-preparation')return preparation;
 const customerQuestions=/pickup|moving yard materials|materials run/.test(name)?['What materials or order need to be collected or moved, and from where?','Are the materials already paid for, and what access is available?']:/small bush trimming/.test(name)?['Which bushes need attention, and approximately how tall are they?','Are there plants or fixtures we should protect?']:/planting/.test(name)?['Which plants and locations would you like us to review?','Are the plants already purchased, and are irrigation or other buried features known?']:/pulling weeds|weeding/.test(name)?['Which areas need hand weeding, and which plants should stay?','Are there plants or fixtures we should protect?']:preparation.customerQuestions;
 return {...preparation,customerQuestions};
}
export const servicePreparationTopics=servicePreparations.map(({id,title,source,url,checkedOn,safety})=>({id,title,source,url,checkedOn,safety}));
