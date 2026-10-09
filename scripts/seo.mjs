const origin='https://www.yourneighborhoodserviceguy.com/';
const brand='Your Neighborhood Service Guy';
const titles={'':'Home & Yard Services in DeKalb',services:'Home & Yard Services',pricing:'Pricing & Community Rate',about:'Meet Ed',request:'Request a Service Appointment'};
export function seo(slug,title,description){
 const url=origin+(slug?slug+'/':'');
 const organization={'@type':'Organization','@id':origin+'#business',name:brand,url:origin,logo:origin+'assets/logo.jpg',telephone:'+1-770-630-2094',slogan:'We’re Here to Help.',areaServed:['DeKalb, Illinois','Sycamore, Illinois','Cortland, Illinois']};
 const graph=[organization,{'@type':'WebSite','@id':origin+'#website',url:origin,name:brand,publisher:{'@id':organization['@id']},inLanguage:'en-US'},{'@type':'WebPage','@id':url+'#page',url,name:title,description,isPartOf:{'@id':origin+'#website'},about:{'@id':organization['@id']},inLanguage:'en-US'}];
 if(slug)graph.push({'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:origin},{'@type':'ListItem',position:2,name:title,item:url}]});
 if(!slug||slug==='services')graph.push({'@type':'Service',name:'Home & yard services',serviceType:['Furniture assembly and small home jobs','Lawn care','Yard and garden help','Residential snow clearing','Concrete pressure washing'],provider:{'@id':organization['@id']},areaServed:organization.areaServed,url:origin+'services/'});
 return {title:(titles[slug]||title)+' | '+brand,schema:JSON.stringify({'@context':'https://schema.org','@graph':graph}).replaceAll('<','\\u003c')};
}
