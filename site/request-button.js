/** One public appointment entry point, including formerly text-only CTAs. */
export function requestServiceButton(extraClass = '') {
  return `<a class="service-request-button${extraClass ? ' '+extraClass : ''}" href="/request/"><span>Request service appointment</span><span aria-hidden="true">↗</span></a>`;
}
export function standardizeRequestButtons(html) {
  return html.replace(/<a\b([^>]*\bhref="\/request\/?"[^>]*)>([\s\S]*?)<\/a>/g, (anchor, attributes, label) => {
    const classes = /\bclass="([^"]*)"/.exec(attributes)?.[1] || '';
    if (!/\b(button|text-link|nav-request)\b/.test(classes) && !/Request service appointment/.test(label)) return anchor;
    return requestServiceButton(/\bnav-request\b/.test(classes) ? 'nav-request' : '');
  });
}
