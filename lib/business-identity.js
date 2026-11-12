// Owner-approved YNSG identity. Digital contact details and durable print branding
// are intentionally separate; never rewrite issued financial snapshots from here.
export const businessIdentity=Object.freeze({
 brandName:'Your Neighborhood Service Guy',
 legalName:'Your Neighborhood Service Guy, LLC',
 phoneDisplay:'815-680-1775',
 phoneE164:'+18156801775',
 website:'https://www.yourneighborhoodserviceguy.com',
 app:'https://yourneighborhoodserviceguy.app',
 // Official public profiles (Google Business Profile, Facebook, Nextdoor...). Add only URLs the owner confirms;
 // they become schema.org sameAs so search engines connect the website to the profiles.
 profiles:Object.freeze(['https://g.page/r/CWxW2KabD1UWECE']),
 // Owner's Google Business Profile review link (already configured in CRM settings).
 // Search-engine ownership tags: paste only the token string (the content="..." value) that Google Search
 // Console or Bing Webmaster Tools gives for "HTML tag" verification. Leave empty until then.
 searchVerification:Object.freeze({google:'',bing:''}),
 // Owner-stated public hours (Monday to Friday, 8 AM to 5 PM), shown in the footer and in search data.
 hours:Object.freeze({days:['Monday','Tuesday','Wednesday','Thursday','Friday'],opens:'08:00',closes:'17:00',label:'Monday–Friday, 8 AM–5 PM'}),
 // Owner's public social pages. Paste the full https URL once confirmed; blank entries are skipped everywhere
 // (website footer, search data and emails), so nothing broken ever appears.
 social:Object.freeze({facebook:'https://www.facebook.com/YourNeighborhoodServiceGuy',instagram:'https://www.instagram.com/yourneighborhoodserviceguy/'}),
 publicEmail:'info@yourneighborhoodserviceguy.com',
 googleReviewUrl:'https://g.page/r/CWxW2KabD1UWECE/review',
});
export const printIdentity=Object.freeze({
 logo:'/assets/logo.jpg',
 tagline:'We’re Here to Help.',
 websiteLabel:'YourNeighborhoodServiceGuy.com',
 website:businessIdentity.website,
});
