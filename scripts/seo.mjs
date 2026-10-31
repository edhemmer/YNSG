export const WEBSITE_ORIGIN='https://www.yourneighborhoodserviceguy.com';
export const brand='Your Neighborhood Service Guy';
export const serviceCities=['DeKalb','Sycamore','Cortland'];
export const canonicalUrl=slug=>WEBSITE_ORIGIN+(slug?'/'+slug:'/');
const titles={
 '':'Home & Yard Services | Sycamore, DeKalb & Nearby',
 services:'Home & Yard Services in DeKalb, Sycamore & Cortland',
 pricing:'Home & Yard Rates in DeKalb, IL',
 about:'About Our DeKalb Area Home & Yard Service',
 request:'Request Home & Yard Service in DeKalb, IL',
 'service-area':'DeKalb, Sycamore & Cortland Service Area',
 'cleanout-dekalb-il':'Home Cleanouts in DeKalb, Sycamore & Cortland',
 'handyman-dekalb-il':'Handyman Help in DeKalb, Sycamore & Cortland',
 'lawn-mowing-dekalb-il':'Lawn Mowing in DeKalb, IL',
 'leaf-cleanup-dekalb-il':'Leaf Management in DeKalb, IL',
 'snow-removal-dekalb-il':'Residential Snow Removal in DeKalb, IL',
 'mulch-delivery-spreading-dekalb-il':'Mulch Pickup, Delivery & Spreading in DeKalb, IL',
 'mulch-yard-cleanup-dekalb-il':'Mulch & Yard Cleanup in DeKalb, IL',
 'concrete-pressure-washing-dekalb-il':'Concrete Pressure Washing in DeKalb, IL',
};
// Page-specific service entities describe the visible offer, never a separate location.
export const localServicePages={
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
 const organization={'@type':['LocalBusiness','HomeAndConstructionBusiness'],'@id':origin+'#business',name:brand,url:origin,logo:origin+'assets/logo.jpg',telephone:'+1-770-630-2094',contactPoint:{'@type':'ContactPoint',telephone:'+1-770-630-2094',contactType:'customer service',availableLanguage:'en'},description:'Owner-operated home and yard services in DeKalb, Sycamore and Cortland, Illinois.',slogan:'We’re Here to Help.',areaServed};
 const pageId=url+'#page',breadcrumbId=url+'#breadcrumb';
 const graph=[organization,{'@type':'WebSite','@id':origin+'#website',url:origin,name:brand,publisher:{'@id':organization['@id']},inLanguage:'en-US'},{'@type':'WebPage','@id':pageId,url,name:titles[slug]||title,description,isPartOf:{'@id':origin+'#website'},about:{'@id':organization['@id']},inLanguage:'en-US',...(slug?{breadcrumb:{'@id':breadcrumbId}}:{})}];
 if(media){const imageId=url+'#service-image';graph.push({'@type':'ImageObject','@id':imageId,url:WEBSITE_ORIGIN+media.src,contentUrl:WEBSITE_ORIGIN+media.src,width:media.width,height:media.height,caption:media.alt});graph.find(node=>node['@id']===pageId).primaryImageOfPage={'@id':imageId};}
 const service=localServicePages[slug];
 if(service){
  const serviceId=url+'#service';
  graph.find(node=>node['@id']===pageId).mainEntity={'@id':serviceId};
  graph.push({'@type':'Service','@id':serviceId,url,name:service.name,description:service.description,serviceType:service.name,...(media?{image:{'@id':url+'#service-image'}}:{}),provider:{'@id':organization['@id']},areaServed,mainEntityOfPage:{'@id':pageId}});
 }
 if(slug)graph.push({'@type':'BreadcrumbList','@id':breadcrumbId,itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:origin},{'@type':'ListItem',position:2,name:title,item:url}]});
 if(!slug||slug==='services'||slug==='service-area'){
  const services=[['help-around-the-home','Small home jobs','Furniture assembly, household setup, organizing and minor home jobs within our published limits.'],['lawn-care','Lawn care and leaf management','Residential mowing, trimming and seasonal leaf management.'],['yard-and-garden','Yard and garden help','Hand weeding, small bush and flower planting, small bush trimming and arranged mulch pickup, delivery and application. No herbicides.'],['snow-clearing','Residential snow clearing','Residential driveways, sidewalks and entries. No salt, deicer or commercial plowing.'],['concrete-washing','Concrete pressure washing','Ground-level residential concrete driveways, walks and patios. The customer supplies accessible outdoor water.']];
  for(const [key,name,summary] of services)graph.push({'@type':'Service','@id':origin+'services#'+key,name,description:summary,provider:{'@id':organization['@id']},areaServed,serviceType:name,url:canonicalUrl('services')+'#'+key});
 }
 return {title:(titles[slug]||title)+' | '+brand,url,schema:JSON.stringify({'@context':'https://schema.org','@graph':graph}).replaceAll('<','\\u003c')};
}
