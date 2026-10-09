export type Point={lat:number;lng:number};
type Position={lat():number;lng():number};
export type BrowserMap={fitBounds(bounds:unknown):void;panTo(position:Position):void;setZoom(zoom:number):void};
type Overlay={setMap(map:BrowserMap|null):void};
export type MapsApi={
 Map:new(el:HTMLElement,options:Record<string,unknown>)=>BrowserMap;
 LatLngBounds:new()=>{extend(point:Position):void};
 Marker:new(options:Record<string,unknown>)=>Overlay&{addListener(event:string,run:()=>void):{remove():void}};
 Polyline:new(options:Record<string,unknown>)=>Overlay;
 TrafficLayer:new()=>Overlay;
 Geocoder:new()=>{geocode(options:{address:string}):Promise<{results:{geometry:{location:Position};partial_match?:boolean}[]}>};
 SymbolPath:{CIRCLE:number};
};
type MapsWindow=Window&{google?:{maps:MapsApi};ynsgMapsReady?:()=>void};
let loading:Promise<MapsApi>|null=null;
export function loadGoogleMap(key:string):Promise<MapsApi>{
 if(!key)return Promise.reject(Error('MAP_KEY_REQUIRED'));
 const win=window as MapsWindow;if(win.google?.maps)return Promise.resolve(win.google.maps);
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script'),timeout=setTimeout(()=>{script.remove();loading=null;reject(Error('MAP_LOAD_FAILED'));},15000);
  win.ynsgMapsReady=()=>{clearTimeout(timeout);if(win.google?.maps)resolve(win.google.maps);else{loading=null;reject(Error('MAP_LOAD_FAILED'));}};
  script.onerror=()=>{clearTimeout(timeout);script.remove();loading=null;reject(Error('MAP_LOAD_FAILED'));};
  script.async=true;script.src='https://maps.googleapis.com/maps/api/js?'+new URLSearchParams({key,loading:'async',callback:'ynsgMapsReady',v:'quarterly'});document.head.append(script);
 });return loading;
}
export function decodePolyline(encoded:string):Point[]{
 const points:Point[]=[];let i=0,lat=0,lng=0;
 const value=()=>{let result=0,shift=0,b=0;do{if(i>=encoded.length||shift>30)throw Error('INVALID_POLYLINE');b=encoded.charCodeAt(i++)-63;if(b<0||b>63)throw Error('INVALID_POLYLINE');result|=(b&31)<<shift;shift+=5;}while(b>=32);return result&1?~(result>>1):result>>1;};
 while(i<encoded.length){lat+=value();lng+=value();const p={lat:lat/1e5,lng:lng/1e5};if(Math.abs(p.lat)>90||Math.abs(p.lng)>180)throw Error('INVALID_POLYLINE');points.push(p);}return points;
}
export const routeColors=['#2563eb','#7c3aed','#0891b2','#be185d','#b45309','#15803d'];
