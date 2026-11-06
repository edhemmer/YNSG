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
 profiles:Object.freeze([]),
 // Owner's Google Business Profile review link (already configured in CRM settings).
 googleReviewUrl:'https://g.page/r/CWxW2KabD1UWECE/review',
});
export const printIdentity=Object.freeze({
 logo:'/assets/logo.jpg',
 tagline:'We’re Here to Help.',
 websiteLabel:'YourNeighborhoodServiceGuy.com',
 website:businessIdentity.website,
});
