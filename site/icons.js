export const iconPaths={
 services:'<path d="M7 7V4h10v3"/><rect x="3" y="7" width="18" height="14" rx="3"/><path d="M3 12l9 3 9-3m-9 1v4"/>',
 pricing:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18m-5 6h2"/>',
 about:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 phone:'<path d="m7 3 3 5-3 2c2 4 3 5 7 7l2-3 5 3-1 4C10 23 1 14 3 4z"/>',
 request:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>'
};
export function icon(name){return `<svg class="ui-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||iconPaths.services}</svg>`;}
