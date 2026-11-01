/** Display saved UTC evidence in an explicitly named business timezone. */
export function businessTimestamp(value:string,timezone='UTC'){
 const instant=new Date(value);if(!Number.isFinite(instant.getTime()))return 'Time unavailable';
 try{return new Intl.DateTimeFormat('en-US',{timeZone:timezone,month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(instant);}catch{return 'Time unavailable';}
}
