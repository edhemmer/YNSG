export const WEBSITE_ORIGIN='https://www.yourneighborhoodserviceguy.com';
export const brand='Your Neighborhood Service Guy';
export const serviceCities=['DeKalb','Sycamore','Cortland'];
export const canonicalUrl=slug=>WEBSITE_ORIGIN+(slug?'/'+slug:'/');
const titles={
 '':'Home & Yard Help in DeKalb, Sycamore & Cortland',
 services:'Home & Yard Services in DeKalb, Sycamore & Cortland',
 pricing:'Rates & Community Pricing',
 about:'About Our Local Home & Yard Service',
 request:'Request a Home or Yard Service Appointment',
 'service-area':'DeKalb, Sycamore & Cortland Service Area',
 'handyman-dekalb-il':'Small Handyman Jobs in DeKalb, IL',
 'lawn-mowing-dekalb-il':'Lawn Mowing in DeKalb, IL',
 'leaf-cleanup-dekalb-il':'Leaf Cleanup in DeKalb, IL',
 'snow-removal-dekalb-il':'Residential Snow Removal in DeKalb, IL',
 'mulch-yard-cleanup-dekalb-il':'Mulch & Yard Cleanup in DeKalb, IL',
 'concrete-pressure-washing-dekalb-il':'Concrete Pressure Washing in DeKalb, IL',
};
export function seo(slug,title,description){
 const url=canonicalUrl(slug),origin=WEBSITE_ORIGIN+'/';
 const areaServed=serviceCities.map(name=>({'@type':'City',name:name+', Illinois',containedInPlace:{'@type':'State',name:'Illinois'}}));
 const organization={'@type':['LocalBusiness','HomeAndConstructionBusiness'],'@id':origin+'#business',name:brand,url:origin,logo:origin+'assets/logo.jpg',telephone:'+1-770-630-2094',contactPoint:{'@type':'ContactPoint',telephone:'+1-770-630-2094',contactType:'customer service',availableLanguage:'en'},description:'Owner-operated home and yard services in DeKalb, Sycamore and Cortland, Illinois.',slogan:'We’re Here to Help.',areaServed};
 const pageId=url+'#page',breadcrumbId=url+'#breadcrumb';
 const graph=[organization,{'@type':'WebSite','@id':origin+'#website',url:origin,name:brand,publisher:{'@id':organization['@id']},inLanguage:'en-US'},{'@type':'WebPage','@id':pageId,url,name:titles[slug]||title,description,isPartOf:{'@id':origin+'#website'},about:{'@id':organization['@id']},inLanguage:'en-US',...(slug?{breadcrumb:{'@id':breadcrumbId}}:{})}];
 if(slug)graph.push({'@type':'BreadcrumbList','@id':breadcrumbId,itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:origin},{'@type':'ListItem',position:2,name:title,item:url}]});
 if(!slug||slug==='services'||slug==='service-area'){
  const services=[['help-around-the-home','Small home jobs','Furniture assembly, household setup, organizing and minor home jobs within our published limits.'],['lawn-care','Lawn care and leaf management','Residential mowing, trimming and leaf gathering or bagging.'],['yard-and-garden','Yard and garden help','Hand weeding, small bush and flower planting, small bush trimming and arranged mulch pickup, delivery and application. No herbicides.'],['snow-clearing','Residential snow clearing','Residential driveways, sidewalks and entries. No salt, deicer or commercial plowing.'],['concrete-washing','Concrete pressure washing','Ground-level residential concrete driveways, walks and patios. The customer supplies accessible outdoor water.']];
  for(const [key,name,summary] of services)graph.push({'@type':'Service','@id':origin+'services#'+key,name,description:summary,provider:{'@id':organization['@id']},areaServed,serviceType:name,url:canonicalUrl('services')+'#'+key});
 }
 return {title:(titles[slug]||title)+' | '+brand,url,schema:JSON.stringify({'@context':'https://schema.org','@graph':graph}).replaceAll('<','\\u003c')};
}
