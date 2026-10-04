import {websiteAvailability,CALENDAR_UNAVAILABLE} from '../lib/website-availability.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'});}
 try{return res.status(200).json(await websiteAvailability());}
 catch{return res.status(503).json({error:CALENDAR_UNAVAILABLE});}
}
