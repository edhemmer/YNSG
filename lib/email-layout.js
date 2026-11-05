export const emailEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const emailParagraph = text => `<p style="margin:0 0 18px;white-space:pre-wrap;overflow-wrap:anywhere">${emailEscape(text)}</p>`;
export const YNSG_EMAIL_IDENTITY=Object.freeze({logoUrl:'https://www.yourneighborhoodserviceguy.com/assets/logo.jpg',ownerName:'Ed Hemmer',phone:'815-680-1775',website:'YourNeighborhoodServiceGuy.com'});
export function emailIdentity(settings,organization){
 const {audience,...identity}=emailIdentityRaw(settings,organization);
 return {logoUrl:identity.logoUrl,ownerName:identity.ownerName,...(identity.phone?{phone:identity.phone}:{}),...(identity.website?{website:identity.website}:{})};
}
function emailIdentityRaw(settings,organization){
 const defaults=organization==='a933d657-14d3-46b6-85e6-21d973e4ed97'?YNSG_EMAIL_IDENTITY:{};
 return normalizeIdentity({logoUrl:settings?.brand?.logoUrl===undefined?defaults.logoUrl:settings.brand.logoUrl,ownerName:settings?.brand?.ownerName===undefined?defaults.ownerName:settings.brand.ownerName,phone:settings?.brand?.phone===undefined?defaults.phone:settings.brand.phone,website:settings?.brand?.website===undefined?defaults.website:settings.brand.website});
}
function normalizeIdentity(identity={}){
 let logoUrl=null;
 if(identity.logoUrl){const u=new URL(identity.logoUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error('INVALID_EMAIL_LOGO');logoUrl=u.toString();}
 const ownerName=String(identity.ownerName||'').trim();
 if(ownerName.length>160||/[\r\n]/.test(ownerName))throw Error('INVALID_EMAIL_SIGNATURE');
 const phone=String(identity.phone||'').trim(),website=String(identity.website||'').trim();
 if((phone&&!/^[0-9+().\- ]{7,25}$/.test(phone))||(website&&!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(website)))throw Error('INVALID_EMAIL_CONTACT');
 // Owner notifications are written to the business owner: no customer signature or customer footer.
 return {logoUrl,ownerName:identity.audience==='owner'?'':ownerName,phone,website,audience:identity.audience==='owner'?'owner':'customer'};
}
export function emailSignedText(text,identity){const {ownerName}=normalizeIdentity(identity);return text+(ownerName?'\n\nBest Regards,\n'+ownerName:'');}
export function emailButton(label, url, secondary=false) {
 const u=new URL(url);
 if(u.protocol!=='https:'||u.username||u.password)throw Error('INVALID_EMAIL_ACTION');
 return `<p style="margin:24px 0;text-align:center"><a class="${secondary?'mail-button-secondary':'mail-button'}" href="${emailEscape(u.toString())}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 22px;border:2px solid #416833;border-radius:12px;background:${secondary?'#ffffff':'#416833'};color:${secondary?'#416833':'#ffffff'};font-size:17px;font-weight:bold;line-height:1.4;text-decoration:none;box-shadow:0 3px 8px rgba(4,36,64,.12)">${emailEscape(label)}</a></p>`;
}
// Content is trusted template markup. Escape every dynamic value before composing it.
export function emailLayout(company, title, preview, content, identity) {
 const {logoUrl,ownerName,phone,website,audience}=normalizeIdentity(identity);
 content=content.replace(/<(h[23])([^>]*)>/g,(_,tag,attrs)=>`<${tag}${attrs.includes('style="')?attrs.replace('style="','style="text-align:center;'):attrs+' style="text-align:center"'}>`);
 const logo=logoUrl?`<tr><td style="padding:22px 24px;text-align:center;background:#ffffff"><img src="${emailEscape(logoUrl)}" alt="${emailEscape(company)} logo" width="240" style="display:block;width:240px;max-width:100%;height:auto;margin:auto;border:0"></td></tr>`:'';
 const signature=ownerName?`<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #d5e0d1">Best Regards,<br><strong>${emailEscape(ownerName)}</strong></p>`:'';
 return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><style>@media(max-width:480px){.mail-content{padding:24px 18px!important}.mail-card h1{font-size:26px!important}.mail-button,.mail-button-secondary{display:block!important;text-align:center!important}}.mail-content table th{background:#042440;color:#ffffff;padding:12px 10px}.mail-content table td{vertical-align:top}.mail-detail{background:#f8f6ef;border:1px solid #d5e0d1;border-left:4px solid #d89b3c;border-radius:12px;padding:18px;margin:20px 0}.mail-detail p:last-child{margin-bottom:0}@media(prefers-color-scheme:dark){.mail-body{background:#0f1c29!important}.mail-card,.mail-content{background:#192c3e!important;color:#f5f7f6!important}.mail-content div{background:#213142!important;color:#f5f7f6!important}.mail-content h2,.mail-content h3,.mail-content p{color:#f5f7f6!important}.mail-content a{color:#bce3b0!important}.mail-content .mail-button{color:#ffffff!important}.mail-content .mail-button-secondary{background:#192c3e!important;color:#bce3b0!important;border-color:#bce3b0!important}}</style></head><body class="mail-body" style="margin:0;background:#f8f6ef;color:#042440;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${emailEscape(preview)}</div><table role="presentation" width="100%" style="border-collapse:collapse"><tr><td style="padding:16px 12px"><table class="mail-card" role="presentation" width="100%" style="max-width:640px;margin:auto;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #d5e0d1;border-radius:20px;overflow:hidden">${logo}<tr><td style="padding:32px 28px;text-align:center;background:#042440;color:#ffffff;border-bottom:5px solid #d89b3c"><p style="margin:0;font-size:16px;line-height:1.5;font-weight:bold;color:#ffffff">${emailEscape(company)}</p><h1 style="margin:12px 0 0;font-size:30px;line-height:1.25;letter-spacing:-.5px;color:#ffffff">${emailEscape(title)}</h1></td></tr><tr><td class="mail-content" style="padding:30px 28px;background:#ffffff;color:#042440;font-size:17px;line-height:1.6;overflow-wrap:anywhere">${content}${signature}</td></tr><tr><td style="padding:20px 24px;text-align:center;background:#f8f6ef;color:#526273;font-size:13px;line-height:1.6;border-top:1px solid #d5e0d1">${audience==='owner'?emailEscape(company)+'<br>Owner notification':emailEscape(company)+'<br>'+(phone?'<a href="tel:'+emailEscape(phone.replace(/[^+0-9]/g,''))+'" style="color:#416833;font-weight:700;text-decoration:none">Call '+emailEscape(phone)+'</a>'+(website?' · ':''):'')+(website?'<a href="https://'+emailEscape(website.toLowerCase())+'" style="color:#416833;text-decoration:none">'+emailEscape(website)+'</a>':'')+((phone||website)?'<br>':'')+'Please keep this email for your records.'}</td></tr></table></td></tr></table></body></html>`;
}
