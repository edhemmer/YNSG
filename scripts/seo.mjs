import {businessIdentity} from '../lib/business-identity.js';
import {priorityServiceCities} from '../packages/domain/service-geography.mjs';
export const WEBSITE_ORIGIN='https://www.yourneighborhoodserviceguy.com';
export const brand='Your Neighborhood Service Guy';
export const legalBusinessName=businessIdentity.legalName;
export const serviceCities=priorityServiceCities;
export const canonicalUrl=slug=>WEBSITE_ORIGIN+(slug?'/'+slug:'/');
const titles={
 '':'Lawn & Home Services | DeKalb to St. Charles, IL',
 services:'Lawn, Yard & Home Services | Fox Valley IL',
 pricing:'Home & Yard Rates in DeKalb, IL',
 'careers/small-home-jobs':'Handyman & Small Home Job Opportunities in DeKalb, IL',
 'careers/yard-work':'Yard Work Opportunities in DeKalb, IL',
 careers:'Home & Yard Careers in DeKalb, IL',
 about:'About Our DeKalb Area Home & Yard Service',
 request:'Request Home & Yard Service in DeKalb, IL',
 'service-area':'Service Area | St. Charles, Campton Hills & DeKalb',
 'farm-hand-dekalb-il':'Farm Hand Services for Planting & Harvest | DeKalb IL',
 'cleanout-dekalb-il':'Home Cleanouts | DeKalb to St. Charles',
 'handyman-dekalb-il':'Small Handyman Jobs | DeKalb to St. Charles',
 'lawn-mowing-dekalb-il':'Lawn Mowing in DeKalb, IL',
 'leaf-cleanup-dekalb-il':'Leaf Management in DeKalb, IL',
 'snow-removal-dekalb-il':'Residential Snow Removal in DeKalb, IL',
 'mulch-delivery-spreading-dekalb-il':'Mulch Pickup, Delivery & Spreading in DeKalb, IL',
 'mulch-yard-cleanup-dekalb-il':'Mulch & Yard Cleanup in DeKalb, IL',
 'concrete-pressure-washing-dekalb-il':'Concrete Pressure Washing in DeKalb, IL',
};
// Page-specific service entities describe the visible offer, never a separate location.
export const localServicePages={
 'farm-hand-dekalb-il':{name:'Seasonal farm hand services',description:'Seasonal farm hand labor for spring planting preparation, fall harvest support, farm cleanup and other agreed ground-level farm tasks from DeKalb toward St. Charles and surrounding Illinois communities; work is subject to safety review and availability.'},
 'cleanout-dekalb-il':{name:'Household cleanout and removal',description:'Manageable garage, basement and storage-area cleanouts. Scope and access are reviewed before confirming. Disposal fees may apply.'},
 'handyman-dekalb-il':{name:'Small handyman jobs',description:'Furniture assembly, household setup and small home jobs within our published safety limits.'},
 'lawn-mowing-dekalb-il':{name:'Residential lawn mowing',description:'One-time or recurring residential mowing, trimming, edging and blowing clippings off finished surfaces.'},
 'leaf-cleanup-dekalb-il':{name:'Leaf management',description:'Seasonal leaf management for residential yards and outdoor areas. The approach, timing and cost are reviewed with the customer.'},
 'snow-removal-dekalb-il':{name:'Residential snow removal',description:'Driveway, sidewalk and entry snow clearing with hand shovels or a walk-behind snow blower. No salt, deicer or commercial plowing.'},
 'mulch-delivery-spreading-dekalb-il':{name:'Mulch pickup, delivery and spreading',description:'Arranged bulk or bagged mulch pickup, delivery and spreading, or spreading material already at home. Customers prepay the supplier for arranged pickup.'},
 'mulch-yard-cleanup-dekalb-il':{name:'Mulch spreading and garden-bed cleanup',description:'Mulch spreading, hand weeding and small garden-bed jobs. Customers prepay the supplier for arranged mulch pickup.'},
 'concrete-pressure-washing-dekalb-il':{name:'Concrete pressure washing',description:'Ground-level residential concrete driveway, walkway and patio washing with customer-supplied accessible outdoor water.'},
};
export function seo(slug,title,description,media=null){
 const url=canonicalUrl(slug),origin=WEBSITE_ORIGIN+'/';
 const areaServed=serviceCities.map(name=>({'@type':'City',name:name+', Illinois',containedInPlace:{'@type':'State',name:'Illinois'}}));
 const organization={'@type':['LocalBusiness','HomeAndConstructionBusiness'],'@id':origin+'#business',name:legalBusinessName,alternateName:brand,legalName:businessIdentity.legalName,url:origin,logo:origin+'assets/logo.jpg',telephone:'+1-'+businessIdentity.phoneDisplay,contactPoint:{'@type':'ContactPoint',telephone:'+1-'+businessIdentity.phoneDisplay,contactType:'customer service',availableLanguage:'en'},description:'Owner-operated home and yard services based near DeKalb, Illinois, serving communities toward St. Charles and surrounding areas.',slogan:'We’re Here to Help.',areaServed};
 const pageId=url+'#page',breadcrumbId=url+'#breadcrumb';
 const graph=[organization,{'@type':'WebSite','@id':origin+'#website',url:origin,name:brand,publisher:{'@id':organization['@id']},inLanguage:'en-US'},{'@type':slug==='careers'?'CollectionPage':'WebPage','@id':pageId,url,name:titles[slug]||title,description,isPartOf:{'@id':origin+'#website'},about:{'@id':organization['@id']},inLanguage:'en-US',...(slug?{breadcrumb:{'@id':breadcrumbId}}:{})}];
 if(media){const imageId=url+'#service-image';graph.push({'@type':'ImageObject','@id':imageId,url:WEBSITE_ORIGIN+media.src,contentUrl:WEBSITE_ORIGIN+media.src,width:media.width,height:media.height,caption:media.alt});graph.find(node=>node['@id']===pageId).primaryImageOfPage={'@id':imageId};}
 const service=localServicePages[slug];
 if(service){
  const serviceId=url+'#service';
  graph.find(node=>node['@id']===pageId).mainEntity={'@id':serviceId};
  graph.push({'@type':'Service','@id':serviceId,url,name:service.name,description:service.description,serviceType:service.name,...(media?{image:{'@id':url+'#service-image'}}:{}),provider:{'@id':organization['@id']},areaServed,mainEntityOfPage:{'@id':pageId}});
 }
 if(slug==='careers'){const listId=url+'#opportunities';graph.find(node=>node['@id']===pageId).mainEntity={'@id':listId};graph.push({'@type':'ItemList','@id':listId,name:'Home and yard field-support opportunities',itemListElement:[['careers/small-home-jobs','Small home jobs · field support'],['careers/yard-work','Home & yard · field support']].map(([path,name],index)=>({'@type':'ListItem',position:index+1,name,url:canonicalUrl(path)}))});}
 if(slug)graph.push({'@type':'BreadcrumbList','@id':breadcrumbId,itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:origin},...(slug.startsWith('careers/')?[{'@type':'ListItem',position:2,name:'Careers',item:canonicalUrl('careers')},{'@type':'ListItem',position:3,name:title,item:url}]:[{'@type':'ListItem',position:2,name:title,item:url}])]});
 if(!slug||slug==='services'||slug==='service-area'){
  const services=[['help-around-the-home','Small home jobs','Furniture assembly, household setup, organizing and minor home jobs within our published limits.'],['lawn-care','Lawn care','Residential mowing, trimming, edging and blowing clippings off finished surfaces.'],['leaf-management','Leaf management','Seasonal leaf management for residential lawns and outdoor areas; approach and timing agreed together.'],['mulch-material','Mulch pickup, delivery and spreading','Arranged bulk or bagged mulch pickup, delivery and spreading, or spreading mulch already at home. Supplier-prepaid materials; no material resale.'],['junk-cleanout','Household cleanout and removal','Manageable garage, basement and storage cleanouts; disposal fees may apply.'],['yard-and-garden','Yard and garden help','Hand weeding, small bush and flower planting, small bush trimming and arranged mulch pickup, delivery and application. No herbicides.'],['snow-clearing','Residential snow clearing','Residential driveways, sidewalks and entries. No salt, deicer or commercial plowing.'],['farm-hand','Farm hand services','One farm hand for spring planting preparation, fall harvest support, seasonal cleanup and other agreed farm tasks in DeKalb, St. Charles and nearby communities.'],['concrete-washing','Concrete pressure washing','Ground-level residential concrete driveways, walks and patios. The customer supplies accessible outdoor water.']];
  for(const [key,name,summary] of services)graph.push({'@type':'Service','@id':origin+'services#'+key,name,description:summary,provider:{'@id':organization['@id']},areaServed,serviceType:name,url:canonicalUrl('services')+'#'+key});
 }
 return {title:(titles[slug]||title)+' | '+brand,url,schema:JSON.stringify({'@context':'https://schema.org','@graph':graph}).replaceAll('<','\\u003c')};
}
