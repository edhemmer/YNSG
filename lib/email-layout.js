export const emailEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const emailParagraph = text => `<p style="margin:0 0 18px;white-space:pre-wrap;overflow-wrap:anywhere">${emailEscape(text)}</p>`;
export const YNSG_EMAIL_IDENTITY=Object.freeze({logoUrl:'https://www.yourneighborhoodserviceguy.com/assets/logo.jpg',ownerName:'Ed Hemmer'});
export function emailIdentity(settings,organization){
 const defaults=organization==='a933d657-14d3-46b6-85e6-21d973e4ed97'?YNSG_EMAIL_IDENTITY:{};
 return normalizeIdentity({logoUrl:settings?.brand?.logoUrl===undefined?defaults.logoUrl:settings.brand.logoUrl,ownerName:settings?.brand?.ownerName===undefined?defaults.ownerName:settings.brand.ownerName});
}
function normalizeIdentity(identity={}){
 let logoUrl=null;
 if(identity.logoUrl){const u=new URL(identity.logoUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error('INVALID_EMAIL_LOGO');logoUrl=u.toString();}
 const ownerName=String(identity.ownerName||'').trim();
 if(ownerName.length>160||/[\r\n]/.test(ownerName))throw Error('INVALID_EMAIL_SIGNATURE');
 return {logoUrl,ownerName};
}
export function emailSignedText(text,identity){const {ownerName}=normalizeIdentity(identity);return text+(ownerName?'\n\nBest Regards,\n'+ownerName:'');}
export function emailButton(label, url, secondary=false) {
 const u=new URL(url);
 if(u.protocol!=='https:'||u.username||u.password)throw Error('INVALID_EMAIL_ACTION');
 return `<p style="margin:24px 0;text-align:center"><a class="${secondary?'mail-button-secondary':'mail-button'}" href="${emailEscape(u.toString())}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 22px;border:2px solid #315842;border-radius:12px;background:${secondary?'#ffffff':'#315842'};color:${secondary?'#315842':'#ffffff'};font-size:17px;font-weight:bold;line-height:1.4;text-decoration:none;box-shadow:0 3px 8px rgba(16,40,60,.12)">${emailEscape(label)}</a></p>`;
}
// Content is trusted template markup. Escape every dynamic value before composing it.
export function emailLayout(company, title, preview, content, identity) {
 const {logoUrl,ownerName}=normalizeIdentity(identity);
 content=content.replace(/<(h[23])([^>]*)>/g,(_,tag,attrs)=>`<${tag}${attrs.includes('style="')?attrs.replace('style="','style="text-align:center;'):attrs+' style="text-align:center"'}>`);
 const logo=logoUrl?`<tr><td style="padding:22px 24px;text-align:center;background:#ffffff"><img src="${emailEscape(logoUrl)}" alt="${emailEscape(company)} logo" width="240" style="display:block;width:240px;max-width:100%;height:auto;margin:auto;border:0"></td></tr>`:'';
 const signature=ownerName?`<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #d6dfd7">Best Regards,<br><strong>${emailEscape(ownerName)}</strong></p>`:'';
 return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><style>@media(max-width:480px){.mail-content{padding:24px 18px!important}.mail-card h1{font-size:26px!important}.mail-button,.mail-button-secondary{display:block!important;text-align:center!important}}.mail-content table th{background:#10283c;color:#ffffff;padding:12px 10px}.mail-content table td{vertical-align:top}.mail-detail{background:#f8f6ef;border:1px solid #d6dfd7;border-left:4px solid #c6a35b;border-radius:12px;padding:18px;margin:20px 0}.mail-detail p:last-child{margin-bottom:0}@media(prefers-color-scheme:dark){.mail-body{background:#121c25!important}.mail-card,.mail-content{background:#1c2c38!important;color:#f5f7f6!important}.mail-content div{background:#22323c!important;color:#f5f7f6!important}.mail-content h2,.mail-content h3,.mail-content p{color:#f5f7f6!important}.mail-content a{color:#b9e1cc!important}.mail-content .mail-button{color:#ffffff!important}.mail-content .mail-button-secondary{background:#1c2c38!important;color:#b9e1cc!important;border-color:#b9e1cc!important}}</style></head><body class="mail-body" style="margin:0;background:#f8f6ef;color:#10283c;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${emailEscape(preview)}</div><table role="presentation" width="100%" style="border-collapse:collapse"><tr><td style="padding:16px 12px"><table class="mail-card" role="presentation" width="100%" style="max-width:640px;margin:auto;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #d6dfd7;border-radius:20px;overflow:hidden">${logo}<tr><td style="padding:32px 28px;text-align:center;background:#10283c;color:#ffffff;border-bottom:5px solid #c6a35b"><p style="margin:0;font-size:16px;line-height:1.5;font-weight:bold;color:#ffffff">${emailEscape(company)}</p><h1 style="margin:12px 0 0;font-size:30px;line-height:1.25;letter-spacing:-.5px;color:#ffffff">${emailEscape(title)}</h1></td></tr><tr><td class="mail-content" style="padding:30px 28px;background:#ffffff;color:#10283c;font-size:17px;line-height:1.6;overflow-wrap:anywhere">${content}${signature}</td></tr><tr><td style="padding:20px 24px;text-align:center;background:#f8f6ef;color:#52636c;font-size:13px;line-height:1.6;border-top:1px solid #d6dfd7">${emailEscape(company)}<br>Please keep this email for your records.</td></tr></table></td></tr></table></body></html>`;
}
