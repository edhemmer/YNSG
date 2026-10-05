import {websiteGuard} from '../lib/website-guard.js';
import {websiteAvailability,CALENDAR_UNAVAILABLE} from '../lib/website-availability.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'});}
 try{await websiteGuard(req,'availability');return res.status(200).json(await websiteAvailability());}
 catch(error){const status=error.status===429?429:503;if(status===429)res.setHeader('Retry-After','60');return res.status(status).json({error:CALENDAR_UNAVAILABLE});}
}
