/** Advisory straight-line distance from DeKalb's approximate center. No intake decisions. */
export const RADIUS_CENTER={latitude:41.92944,longitude:-88.75833,label:'DeKalb city center (provisional)'};
export const PREFERRED_RADIUS_MILES=15;
export function radiusAssessment(latitude:number,longitude:number){
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return {status:'needs_review' as const,miles:null};
 const rad=(n:number)=>n*Math.PI/180,latDiff=rad(latitude-RADIUS_CENTER.latitude),lonDiff=rad(longitude-RADIUS_CENTER.longitude);
 const a=Math.sin(latDiff/2)**2+Math.cos(rad(RADIUS_CENTER.latitude))*Math.cos(rad(latitude))*Math.sin(lonDiff/2)**2;
 const miles=3958.7613*2*Math.asin(Math.min(1,Math.sqrt(a)));
 return {status:miles<=PREFERRED_RADIUS_MILES?'nearby' as const:'outside_preferred' as const,miles:Math.round(miles*10)/10};
}
