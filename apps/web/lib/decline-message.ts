export const declineReasons=[['time','Date or time unavailable'],['service','Service not offered'],['area','Outside service area'],['other','Other / write my own']] as const;
export type DeclineReason=typeof declineReasons[number][0];
export function declineExplanation(reason:DeclineReason){
 return {time:'I’m not available for the date or time you requested. If your schedule is flexible, please reply with a few other options and I’ll see what we can arrange.',service:'This particular project falls outside the services I offer, so I won’t be able to take it on. Please keep me in mind for other projects around your home or yard.',area:'The service address is outside the area I currently cover, so I won’t be able to arrange a visit for this project. Thank you for considering me.',other:''}[reason];
}
export const YNSG_ORGANIZATION='a933d657-14d3-46b6-85e6-21d973e4ed97';
export function futureProjectInvitation(organization?:string){return organization===YNSG_ORGANIZATION?`I’d welcome the chance to help with a future project. My services include:\n• Lawn mowing, trimming and leaf cleanup\n• Hand weeding, mulch spreading, planting and small bush trimming\n• Furniture assembly, organizing and small home jobs\n• Ground-level concrete pressure washing\n• Residential driveway and sidewalk snow clearing\n\nSee services and limits:\nhttps://www.yourneighborhoodserviceguy.com/services\n\nThanks again for thinking of Your Neighborhood Service Guy.\nWe’re Here to Help.\n770-630-2094`:'';}
export function declineSignature(organization?:string){return organization===YNSG_ORGANIZATION?'Best regards,\nEd Hemmer\nYour Neighborhood Service Guy\n770-630-2094\nwww.yourneighborhoodserviceguy.com':'';}
export function serviceNotOfferedDraft(name:string,organization:string){return {subject:'Thank you for thinking of Your Neighborhood Service Guy',body:`Hi ${name.trim().split(/\s+/)[0]||'there'},\n\nThank you for reaching out to Your Neighborhood Service Guy.\n\n${declineExplanation('service')}\n\n${futureProjectInvitation(organization)}\n\n${declineSignature(organization)}`};}
export function emailDraftUrl(email:string,subject:string,body:string){
 if(!/^[^\s@<>?,;:\r\n]+@[^\s@<>?,;:\r\n]+\.[^\s@<>?,;:\r\n]+$/.test(email)||/[\r\n]/.test(subject))return null;
 return 'mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
}
