// Marketing playbook for a one-owner neighborhood service business. Everything here is free to do.
// Wording rules: say "weed pulling", "small home jobs"; never promise "no trip charges", offer light hanging or insurance work, or pay for referrals.
export type PostIdea={id:string;title:string;text:string;photo:string};
export type MonthPlan={month:number;name:string;focus:string;services:string[];emails:string[];posts:PostIdea[];gbp:string};
export const weeklyRoutine=[
 {when:'Monday, 10 min',what:'Post one real photo or tip on Facebook and Instagram (use a caption below).'},
 {when:'Wednesday, 10 min',what:'Add one update or photo to your Google Business Profile and answer any new review.'},
 {when:'Friday, 10 min',what:'Send this week\'s review requests and one "Stay in touch" email to a past customer.'},
 {when:'Weekly, 5 min',what:'Check Nextdoor and local Facebook groups. Answer questions helpfully. Mention the business only when it is asked for.'}
];
const p=(id:string,title:string,text:string,photo:string):PostIdea=>({id,title,text,photo});
export const monthPlans:MonthPlan[]=[
 {month:1,name:'January',focus:'New-year project lists and indoor jobs',services:['Small home jobs','Furniture assembly','Cleanout'],emails:['new-year','winter-wishes','home-jobs','cleanout'],gbp:'Post: "Start the year with a shorter to-do list." Add a cleanout or assembly photo.',posts:[
  p('jan-1','New year, shorter list','Happy New Year, neighbors! If a shelf, a doorknob or a pile of boxes has been on your list for months, send it all in one request. We handle everyday jobs in a single two-hour visit.','A finished shelf or assembled furniture'),
  p('jan-2','Cold-day indoor help','Too cold to be outside? Good time to knock out indoor jobs: furniture still in the box, a loose handrail, a closet that needs reorganizing. Tell us what is on your list.','Indoor job photo')]},
 {month:2,name:'February',focus:'Snow follow-up and indoor jobs, plan spring',services:['Snow clearing','Small home jobs','Accessibility help'],emails:['snow','home-jobs','return'],gbp:'Post a snow-day photo with a thank-you to neighbors.',posts:[
  p('feb-1','Snow-day thank you','Thank you to every neighbor who trusted us with their walks and driveways this winter. Hand shovels or a walk-behind blower, no salt or deicer. Stay warm out there.','Cleared walkway'),
  p('feb-2','Safer at home','Grab bars, lever handles and lower closet shelves can make home safer and easier. Seniors 70+, veterans, single parents and neighbors with disabilities can ask about our $45 per hour Community Rate.','Real accessibility job, no faces')]},
 {month:3,name:'March',focus:'Spring planning and early bookings',services:['Garden-bed cleanup','Weed pulling','Mulch planning'],emails:['spring','garden','mulch','lawn'],gbp:'Post: "Spring list season." Offer to start the list early.',posts:[
  p('mar-1','Spring list season','Spring is almost here. Garden beds, weed pulling, small planting jobs and mulch can all go on one list. Send yours early and we will plan timing together.','Garden bed before and after'),
  p('mar-2','Mulch the smart way','Planning mulch? Share the areas and rough amount first. For an arranged pickup you pay the supplier directly, and we handle loading, delivery and spreading.','Mulch spread in a bed')]},
 {month:4,name:'April',focus:'Spring cleanup, mowing starts, Easter',services:['Garden-bed cleanup','Lawn mowing','Weed pulling'],emails:['easter','spring','lawn','garden'],gbp:'Post a spring cleanup photo and mowing availability.',posts:[
  p('apr-1','Wishing you a joyful spring','Wishing everyone a joyful Easter and a bright start to spring. Thank you for making this a neighborhood we love to serve.','Warm neighborhood or yard photo'),
  p('apr-2','Mowing season','Standard lawns up to one-third acre start at $50. Tell us about your lawn and we will review a one-time visit or regular mowing.','Fresh-cut lawn')]},
 {month:5,name:'May',focus:'Mother\'s Day, Memorial Day, mulch and planting',services:['Mulch','Planting','Lawn mowing','Weed pulling'],emails:['mothers-day','memorial-day','mulch','summer'],gbp:'Post a Memorial Day tribute, no sales pitch.',posts:[
  p('may-1','Mother\'s Day','Happy Mother\'s Day to all the moms in our neighborhood and the people who feel like family. Thank you for letting us be part of your home.','Simple warm image'),
  p('may-2','Memorial Day','Today we honor those who gave everything for our country. With gratitude to them and the families who carry their memory.','Respectful flag image, no sales text')]},
 {month:6,name:'June',focus:'Summer project lists, Father\'s Day, concrete washing',services:['Concrete washing','Small home jobs','Lawn mowing'],emails:['fathers-day','summer','concrete','lawn'],gbp:'Post a concrete washing before and after.',posts:[
  p('jun-1','Father\'s Day','Happy Father\'s Day to the dads and father figures in our neighborhood. If a few home or yard jobs are on the list, we are glad to take one off your plate.','Dad-friendly project photo'),
  p('jun-2','Concrete refresh','Patios, walkways and driveways get dingy. Send a photo and we will review the surface and access before agreeing to ground-level concrete washing. Accessible outdoor water needed.','Before and after concrete')]},
 {month:7,name:'July',focus:'Independence Day, summer help, outdoor projects',services:['Lawn mowing','Weed pulling','Concrete washing'],emails:['independence','summer','garden'],gbp:'Post a happy Fourth message and one summer job photo.',posts:[
  p('jul-1','Happy Fourth','Wishing you a safe and joyful Independence Day with family, friends and a good cookout. Thank you for being our neighbors.','Neighborhood photo'),
  p('jul-2','Summer to-do list','Furniture assembly, garden-bed care, small repairs: put the everyday jobs on one list and we will review scope, price and timing with you.','Mix of finished jobs')]},
 {month:8,name:'August',focus:'Back to school, fall planning, stay in touch',services:['Small home jobs','Garden-bed cleanup','Cleanout'],emails:['return','home-jobs','bundle','cleanout'],gbp:'Post a garage cleanout or shelving photo.',posts:[
  p('aug-1','Get the house ready','Kids heading back to school? A little time now sets up the fall: shelves for backpacks, a cleared garage corner, a loose door fixed.','Organized garage corner'),
  p('aug-2','Reconnect','To everyone we helped this year: thank you. If something new has come up, send a short list and we will see how we can help.','Friendly photo of Ed with truck or tools')]},
 {month:9,name:'September',focus:'Labor Day, fall cleanup starts',services:['Garden-bed cleanup','Leaf management','Mulch'],emails:['labor-day','fall','leaves'],gbp:'Post a fall cleanup availability note.',posts:[
  p('sep-1','Labor Day','Happy Labor Day to everyone who works hard to keep our community running. Enjoy a well-earned break.','Simple thank-you image'),
  p('sep-2','Fall cleanup','Fall is a good time to tidy beds and get the yard ready for winter. Send your list and we will plan it together.','Tidy bed photo')]},
 {month:10,name:'October',focus:'Leaf season, Halloween, winter prep',services:['Leaf management','Garden-bed cleanup','Cleanout'],emails:['leaves','halloween','fall','snow'],gbp:'Post a leaf cleanup before and after.',posts:[
  p('oct-1','Leaf season','Same driveway, same afternoon. Walks, drives and beds cleared. You approve the estimate and a not-to-exceed cap before we start.','Leaf before and after'),
  p('oct-2','Halloween','Happy Halloween, neighbors! A clear walkway makes a friendly welcome for trick-or-treaters. Have a fun, safe night.','Cleared porch or walkway')]},
 {month:11,name:'November',focus:'Veterans Day, Thanksgiving, snow planning, holiday-ready visits',services:['Leaf management','Snow planning','Small home jobs'],emails:['veterans-day','thanksgiving','snow','home-jobs'],gbp:'Post a Veterans Day thank-you, no sales pitch.',posts:[
  p('nov-1','Thank you, veterans','To every veteran in our neighborhood: thank you for your service. It is an honor to serve our community alongside you. Veterans can ask about our $45 per hour Community Rate.','Respectful image; no sales text on Veterans Day itself'),
  p('nov-2','Holiday-ready','Guests coming? One two-hour visit can cover shelves, curtain rods, furniture and small fixes. Send your list while there is still time.','Finished small home jobs')]},
 {month:12,name:'December',focus:'Christmas greetings, snow, year-end thanks',services:['Snow clearing','Small home jobs'],emails:['christmas','holiday','winter-wishes','snow'],gbp:'Post a thank-you to customers and holiday hours.',posts:[
  p('dec-1','Merry Christmas','Merry Christmas from our family to yours. Thank you for welcoming us into your neighborhood and your home this year.','Warm seasonal image'),
  p('dec-2','Year-end thanks','Thank you for a great year. We will be here for snow and small jobs all winter. Stay warm.','Winter job photo')]}
];
export const evergreenPosts:PostIdea[]=[
 p('ev-1','Meet your neighbor','Hi, I am Ed. I started Your Neighborhood Service Guy to help neighbors with everyday home and yard jobs, done right and priced fairly. Rates are published and you approve an estimate and a not-to-exceed cap before any work starts.','Friendly photo of Ed'),
 p('ev-2','Two-hour visit','Our most popular way to book: one two-hour visit for a list of small jobs. Assemble a dresser, hang a few pictures, swap a doorknob. One request, one trip. $140, or $90 at the Community Rate.','Mix of small jobs'),
 p('ev-3','Community Rate','Seniors 70+, veterans, single parents and neighbors with disabilities can ask about our $45 per hour Community Rate. We serve everyone. This is one way we can especially help.','Respectful community photo'),
 p('ev-4','How pricing works','No surprise bills: we estimate the time, agree on a not-to-exceed cap, and you pay for the time worked. If a job will run past the cap, we stop and ask first.','Pricing page screenshot'),
 p('ev-5','Photo tip','Tip: a quick photo helps us estimate better. Snap the wall where a TV goes, the door that sticks, or the garden bed. Send it with your request.','Example photo'),
 p('ev-6','Customer thank-you','Thank you to our neighbor on [street name] for trusting us today. Reviews from neighbors mean the world to a small business.','Finished job (with permission, no faces or house numbers)'),
 p('ev-7','Before and after','Before and after. Real job, real neighborhood.','Before and after pair'),
 p('ev-8','Safer at home','Practical help so you or someone you love can stay safe at home: grab bars, lever handles, lower closet shelves, wheelchair and walker tune-ups.','Accessibility job, no faces'),
 p('ev-9','Ask a neighbor','What is one small job on your list that never gets done? Tell us in the comments.','Fun relatable image'),
 p('ev-10','Weed pulling','Weed pulling for garden beds and borders, with no chemicals. Tell us which areas need attention and which plants should stay.','Clean garden bed'),
 p('ev-11','Seasonal reminder','Seasons change. Tell us what is on your list and we will help you plan the right time.','Seasonal yard photo'),
 p('ev-12','Local and proud','Locally owned and serving DeKalb to St. Charles. Call or text 815-680-1775 or send a request at yourneighborhoodserviceguy.com.','Truck or logo')
];
export const channels=[
 {name:'Google Business Profile',cadence:'Weekly post, answer reviews within 24 hours',do:['Keep hours, services and service area exact','Add real job photos monthly','Use the same name everywhere','Reply to every review'],avoid:['Keywords in the business name','Fake reviews or review gating']},
 {name:'Facebook page and local groups',cadence:'2 posts a week, answer comments same day',do:['Post real photos with plain captions','Join DeKalb and St. Charles neighborhood groups and be helpful first','Pin the two-hour visit post'],avoid:['Spamming group posts','Posting private customer details']},
 {name:'Instagram',cadence:'2 posts a week, stories for before and after',do:['Before and after reels or carousels','Same caption as Facebook with fewer words','Use local hashtags like #DeKalbIL #StCharlesIL'],avoid:['Stock photos pretending to be your work']},
 {name:'Nextdoor',cadence:'Reply when recommended, one post a month',do:['Thank neighbors who recommend you','Use your real name and photo','Offer seasonal help'],avoid:['Posting the same ad repeatedly']},
 {name:'Yelp, Bing and Apple Business Connect',cadence:'Set up once, review quarterly',do:['Claim and match name, phone and website exactly','Add photos and hours','Finish Bing and Apple verification'],avoid:['Different phone numbers or names across listings']},
 {name:'Email to past customers',cadence:'One short email a month, plus holidays',do:['Use the library: Stay in touch, Seasonal, Holidays','Add a clear single button','Reply personally to every response'],avoid:['Long newsletters','Hard selling on remembrance days']}
];
export const reviewScripts=[
 {when:'In person, end of the job',text:'I am glad it turned out well. If you have a minute, an honest review on Google helps a small local business more than anything. I will text you the link.'},
 {when:'Text, same day',text:'Thanks again for having me today. If you are happy with the work, would you share an honest review? [Google review link] Thank you!'},
 {when:'Email, next day',text:'Use the "Request an honest review" template in Email templates. Follow up once a week later with the Gentle review reminder.'},
 {when:'Reply to a 5-star review',text:'Thank you, [first name]! It was a pleasure helping with [job]. Reach out any time.'},
 {when:'Reply to a critical review',text:'Thank you for telling us, [first name]. I am sorry we missed the mark. Please call me at 815-680-1775 so I can make it right.'}
];
export const measures=[
 {what:'New requests per month',how:'Reports and Requests',goal:'Up each month; lead source shows where they came from'},
 {what:'Google profile calls and website clicks',how:'Google Business Profile Performance',goal:'Rising after each weekly post'},
 {what:'Reviews',how:'Google Business Profile',goal:'1 to 2 new reviews per week; keep rating honest'},
 {what:'Repeat customers',how:'Customers and Reports',goal:'Over a third of jobs from repeat customers'},
 {what:'Search impressions and clicks',how:'Google Search Console',goal:'Pages indexed and growing impressions'},
 {what:'Time to reply to a request',how:'Requests',goal:'Under 4 business hours'}
];
export const marketingRules=[
 'Use only real photos of real work, with permission. No faces or house numbers.',
 'Never promise a quote, a booking or a price the system has not confirmed.',
 'Never offer money or discounts for reviews or referrals.',
 'Do not post sales pitches on remembrance days like Memorial Day or Veterans Day.',
 'Say "weed pulling" and "small home jobs". Do not offer light hanging or insurance work.',
 'Everything here is free. Ask before spending money on ads.'
];
export function monthPlanFor(date:Date,timeZone='America/Chicago'){const m=Number(new Intl.DateTimeFormat('en-US',{timeZone,month:'numeric'}).format(date));return monthPlans.find(x=>x.month===m)||monthPlans[0]!;}
