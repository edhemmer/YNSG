import {createHash} from 'node:crypto';
import {serviceSaturday} from '../site/data/service-saturday.js';
import {businessIdentity} from './business-identity.js';
import {emailLayout, emailParagraph, emailButton, emailCallout, emailEscape, YNSG_EMAIL_IDENTITY} from './email-layout.js';

export const HELP_OPTIONS = [
  'Leaf and yard cleanup',
  'Weed pulling and garden beds',
  'Furniture assembly',
  'Hanging shelves, pictures or curtain rods',
  'Garage or basement tidy-up',
  'Accessibility help',
  'Something else',
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function checkConfig(config = serviceSaturday) {
  if (typeof config.open !== 'boolean') throw Error('Service Saturday: open must be true or false');
  if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(config.campaign || '')) throw Error('Service Saturday: campaign must be lowercase letters, numbers and dashes');
  for (const key of ['startDate', 'entryDeadline', 'drawingDate', 'serviceDate']) if (!DATE.test(config[key] || '')) throw Error(`Service Saturday: ${key} must be YYYY-MM-DD`);
  if (!(config.startDate <= config.entryDeadline && config.entryDeadline < config.drawingDate && config.drawingDate < config.serviceDate)) throw Error('Service Saturday: dates must run start, deadline, then drawing, then service day');
  if (new Date(config.serviceDate + 'T12:00:00Z').getUTCDay() !== 6) throw Error('Service Saturday: serviceDate must be a Saturday');
  if (!Number.isInteger(config.hours) || config.hours < 1 || config.hours > 8) throw Error('Service Saturday: hours must be 1 to 8');
  if (!Number.isInteger(config.approximateValue) || config.approximateValue < 1 || config.approximateValue >= 600) throw Error('Service Saturday: approximateValue must be under 600');
  return config;
}

/** Today's date in Central time as YYYY-MM-DD. */
export const centralToday = (now = new Date()) => now.toLocaleDateString('en-CA', {timeZone: 'America/Chicago'});

/** True while entries are accepted: switched on and not past the deadline (Central time). */
export const acceptingEntries = (config = serviceSaturday, now = new Date()) => config.open === true && centralToday(now) >= config.startDate && centralToday(now) <= config.entryDeadline;

/** "Saturday, December 12, 2026" */
export function longDate(value) {
  const [y, m, d] = value.split('-').map(Number), day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[day]}, ${MONTHS[m - 1]} ${d}, ${y}`;
}
/** "December 12" */
export const shortDate = value => { const [, m, d] = value.split('-').map(Number); return `${MONTHS[m - 1]} ${d}`; };

const text = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max ? value.trim() : null;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const ZIP = /^[0-9]{5}$/;

/** Validates a public entry. Returns {ok:true,data} or {ok:false}. Never echoes input back. */
export function validateEntry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {ok: false};
  const entryType = raw.entryType === 'nominate' ? 'nominate' : raw.entryType === 'self' ? 'self' : null;
  const data = {
    entryType,
    entrantName: text(raw.entrantName, 2, 120),
    entrantEmail: text(raw.entrantEmail, 5, 254),
    entrantPhone: typeof raw.entrantPhone === 'string' ? raw.entrantPhone.trim() : '',
    entrantStreet: text(raw.entrantStreet, 3, 200),
    entrantCity: text(raw.entrantCity, 2, 80),
    entrantPostalCode: text(raw.entrantPostalCode, 5, 5),
    helpWith: HELP_OPTIONS.includes(raw.helpWith) ? raw.helpWith : null,
    story: text(raw.story, 10, 1500),
    rulesAccepted: raw.rulesAccepted === true,
    marketingConsent: raw.marketingConsent === true,
  };
  if (data.entrantPhone && (data.entrantPhone.length < 7 || data.entrantPhone.length > 35)) return {ok: false};
  if (entryType === 'nominate') {
    Object.assign(data, {
      nomineeName: text(raw.nomineeName, 2, 120),
      nomineeRelationship: typeof raw.nomineeRelationship === 'string' ? raw.nomineeRelationship.trim().slice(0, 80) : '',
      workStreet: text(raw.workStreet, 3, 200),
      workCity: text(raw.workCity, 2, 80),
      workPostalCode: text(raw.workPostalCode, 5, 5),
    });
    if (!data.nomineeName) return {ok: false};
  } else {
    Object.assign(data, {workStreet: data.entrantStreet, workCity: data.entrantCity, workPostalCode: data.entrantPostalCode});
  }
  const required = ['entryType', 'entrantName', 'entrantEmail', 'entrantStreet', 'entrantCity', 'entrantPostalCode', 'helpWith', 'story', 'workStreet', 'workCity', 'workPostalCode'];
  if (required.some(key => !data[key])) return {ok: false};
  if (!EMAIL.test(data.entrantEmail) || /[\r\n]/.test(data.entrantEmail)) return {ok: false};
  if (!ZIP.test(data.entrantPostalCode) || !ZIP.test(data.workPostalCode)) return {ok: false};
  if (!data.rulesAccepted || !data.marketingConsent) return {ok: false};
  data.entrantEmail = data.entrantEmail.toLowerCase();
  return {ok: true, data};
}

/** Plain-text summary emailed to the owner for each entry. */
export function entrySummary(data, campaign, key) {
  return [
    'New Service Saturday entry (' + campaign + ')',
    '',
    'Type: ' + (data.entryType === 'nominate' ? 'Nominating a neighbor' : 'Entering for their own home'),
    'Name: ' + data.entrantName,
    'Email: ' + data.entrantEmail,
    'Phone: ' + (data.entrantPhone || 'Not provided'),
    'Address: ' + data.entrantStreet + ', ' + data.entrantCity + ' ' + data.entrantPostalCode,
    ...(data.entryType === 'nominate' ? ['', 'Neighbor: ' + data.nomineeName + (data.nomineeRelationship ? ' (' + data.nomineeRelationship + ')' : ''), 'Work address: ' + data.workStreet + ', ' + data.workCity + ' ' + data.workPostalCode] : []),
    '',
    'Service they want if they win: ' + data.helpWith,
    'Their story:',
    data.story,
    '',
    'Agreed to the Official Rules and to receive YNSG emails (can unsubscribe anytime).',
    'Entry ID: ' + key,
  ].join('\n');
}

/** Stable email id derived from the entry key, so a retried entry never sends a second confirmation. */
export function confirmationId(key) {
  const h = createHash('sha256').update('service-saturday-confirmation:' + key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** "You're entered" email for the entrant, with a one-click opt-out and the business mailing address. */
export function confirmationEmail(data, config = serviceSaturday, token = null) {
  const site = businessIdentity.website, first = data.entrantName.split(/\s+/)[0];
  const unsubscribe = site + '/unsubscribe/' + (token && /^[a-f0-9]{64}$/.test(token) ? '?t=' + token : '');
  const forWhom = data.entryType === 'nominate' ? 'Thanks for nominating ' + data.nomineeName + '. It means a lot when neighbors look out for each other.' : 'Thanks for entering. We hope we get to help around your place.';
  const steps = 'Entries close ' + longDate(config.entryDeadline) + '. We draw one winner at random on ' + longDate(config.drawingDate) + ' and reach out by email or phone. The work happens ' + longDate(config.serviceDate) + '.';
  const footer = '<p style="margin:26px 0 0;font-size:14px;line-height:1.6;color:#52636c">You entered Service Saturday at ' + emailEscape(site.replace(/^https:\/\/(www\.)?/, '')) + ' and agreed to occasional emails from us. <a href="' + emailEscape(unsubscribe) + '" style="color:#21503a;font-weight:bold">Unsubscribe</a> anytime.<br>Prize: one visit, labor only. No cash value; non-transferable.<br>' + emailEscape(businessIdentity.legalName) + ' · ' + emailEscape(businessIdentity.mailingAddress) + '</p>';
  const content = emailParagraph('Hi ' + first + ',') + emailParagraph(forWhom) + emailCallout('What happens next', steps, 'green') + emailParagraph('Good to know: the prize is up to ' + config.hours + ' hours of labor in one visit. Materials and disposal aren\u2019t included, so jobs you already have supplies for work best.') + emailButton('Read the Official Rules', site + '/service-saturday-rules/', true) + footer;
  const html = emailLayout(businessIdentity.brandName, 'You\u2019re entered in Service Saturday!', 'Thanks for entering. Here is what happens next.', content, {...YNSG_EMAIL_IDENTITY, audience: 'customer'});
  const text = ['Hi ' + first + ',', '', forWhom, '', 'What happens next: ' + steps, '', 'The prize is up to ' + config.hours + ' hours of labor in one visit. Materials and disposal aren\u2019t included. No cash value; non-transferable.', 'Official Rules: ' + site + '/service-saturday-rules/', '', 'We\u2019re Here to Help.', 'Ed Hemmer, ' + businessIdentity.brandName + ' · ' + businessIdentity.phoneDisplay, '', 'Unsubscribe: ' + unsubscribe, businessIdentity.legalName + ' · ' + businessIdentity.mailingAddress].join('\n');
  return {subject: 'You\u2019re entered in Service Saturday!', html, text};
}
