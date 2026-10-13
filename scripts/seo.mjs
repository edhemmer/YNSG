export const WEBSITE_ORIGIN='https://www.yourneighborhoodserviceguy.com';
export const brand='Your Neighborhood Service Guy';
export const serviceCities=['DeKalb','Sycamore','Cortland'];
export const canonicalUrl=slug=>WEBSITE_ORIGIN+(slug?'/'+slug:'/');
const titles={
 '':'DeKalb & Sycamore Home & Yard Help',
 services:'Home & Yard Services in DeKalb, IL',
 pricing:'Rates & Community Pricing',
 about:'About Our Local Home & Yard Service',
 request:'Request a Home or Yard Service Appointment',
 'service-area':'DeKalb, Sycamore & Cortland Service Area',
};
export function seo(slug,title,description){
 const url=canonicalUrl(slug),origin=WEBSITE_ORIGIN+'/';
 const areaServed=serviceCities.map(name=>({'@type':'City',name:name+', Illinois',containedInPlace:{'@type':'State',name:'Illinois'}}));
 const organization={'@type':'Organization','@id':origin+'#business',name:brand,url:origin,logo:origin+'assets/logo.jpg',telephone:'+1-770-630-2094',description:'Owner-operated home and yard services in DeKalb, Sycamore and Cortland, Illinois.',slogan:'We’re Here to Help.',areaServed};
 const graph=[organization,{'@type':'WebSite','@id':origin+'#website',url:origin,name:brand,publisher:{'@id':organization['@id']},inLanguage:'en-US'},{'@type':'WebPage','@id':url+'#page',url,name:title,description,isPartOf:{'@id':origin+'#website'},about:{'@id':organization['@id']},inLanguage:'en-US'}];
 if(slug)graph.push({'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:origin},{'@type':'ListItem',position:2,name:title,item:url}]});
 if(!slug||slug==='services'||slug==='service-area'){
  const services=[['home','Small home jobs','Furniture assembly, household setup, organizing and minor home jobs within our published limits.'],['lawn','Lawn care and leaf management','Residential mowing, trimming and leaf gathering or bagging.'],['garden','Yard and garden help','Hand weeding, small bush and flower planting, small bush trimming and arranged mulch pickup, delivery and application. No herbicides.'],['snow','Residential snow clearing','Residential driveways, sidewalks and entries. No salt, deicer or commercial plowing.'],['concrete','Concrete pressure washing','Ground-level residential concrete driveways, walks and patios. The customer supplies accessible outdoor water.']];
  for(const [key,name,summary] of services)graph.push({'@type':'Service','@id':origin+'services#'+key,name,description:summary,provider:{'@id':organization['@id']},areaServed,url:canonicalUrl('services')});
 }
 return {title:(titles[slug]||title)+' | '+brand,url,schema:JSON.stringify({'@context':'https://schema.org','@graph':graph}).replaceAll('<','\\u003c')};
}
