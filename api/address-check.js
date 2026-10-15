import {websiteGuard} from '../lib/website-guard.js';
import {addressInput,checkAddress,AddressInputFailure} from '../lib/address-check.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Request not accepted.'});}
 try{
  if(req.headers['sec-fetch-site']==='cross-site'||!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'Request not accepted.'});
  if(!req.body||Buffer.byteLength(JSON.stringify(req.body))>1024)throw new AddressInputFailure();
  const input=addressInput(req.body);
  if(input.state!=='IL'||!['dekalb','sycamore','cortland'].includes(input.city.toLowerCase()))throw new AddressInputFailure();
  // Reuse the durable public-read quota; no address is sent to its guard or logged.
  await websiteGuard(req,'availability');
  return res.status(200).json(await checkAddress(input));
 }catch(error){const status=error instanceof AddressInputFailure?400:error.status===429?429:503;if(status===429)res.setHeader('Retry-After','60');return res.status(status).json({error:status===400?error.message:'The address check is unavailable. You can keep your entry and continue.'});}
}
