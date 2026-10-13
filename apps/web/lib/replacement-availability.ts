type Reservation={resourceId:string;start:string;end:string};
// Only server-read reservations of the validated original may be ignored in a preview.
// The canonical commit retains and rechecks the original and all competing reservations.
export function replacementAvailability(reservations:Reservation[],original:Reservation[]){
 const keys=new Set(original.map(r=>JSON.stringify([r.resourceId,Date.parse(r.start),Date.parse(r.end)])));
 return reservations.filter(r=>!keys.has(JSON.stringify([r.resourceId,Date.parse(r.start),Date.parse(r.end)])));
}
