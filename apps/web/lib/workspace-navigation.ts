export type WorkspaceMembership = { organization_id: string; role: string };
export type WorkspaceRoute = { organization: string; section: string; request: string | null; customer: string | null };
const sections = ['Dashboard', 'Requests', 'Calendar', 'Today', 'Customers', 'Work', 'Money', 'Snapshot', 'Marketing', 'Learning', 'Network', 'Activity', 'Settings'];
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
export function workspaceHome(role?: string) {
  return role === 'technician' ? 'Today' : role === 'bookkeeper' ? 'Money' : role === 'dispatcher' ? 'Requests' : 'Dashboard';
}
export function workspaceSectionAllowed(section: string, role?: string) {
  if (!sections.includes(section)) return false;
  if (role === 'owner' || role === 'admin') return true;
  if (role === 'dispatcher') return ['Requests', 'Customers', 'Work', 'Today'].includes(section);
  if (role === 'bookkeeper') return ['Customers', 'Money'].includes(section);
  return role === 'technician' && ['Today', 'Work'].includes(section);
}
// URL values identify a destination, never confer company or record authority.
export function readWorkspaceRoute(url: URL, memberships: WorkspaceMembership[], fallback = ''): WorkspaceRoute {
  const requested = url.searchParams.get('organization') || url.searchParams.get('googleOrganization');
  const member = memberships.find(m => m.organization_id === requested)
    || memberships.find(m => m.organization_id === fallback) || memberships[0];
  const desired = url.searchParams.get('section') || (url.searchParams.has('request') ? 'Requests' : workspaceHome(member?.role));
  const allowed = workspaceSectionAllowed(desired, member?.role);
  const section = allowed ? desired : workspaceHome(member?.role);
  const request = url.searchParams.get('request'), customer = url.searchParams.get('customer');
  return { organization: member?.organization_id || '', section,
    request: allowed && ['Work', 'Requests'].includes(section) && request && uuid.test(request) ? request : null,
    customer: allowed && section === 'Customers' && customer && uuid.test(customer) ? customer : null };
}
export function workspaceRouteUrl(current: URL, route: WorkspaceRoute) {
  const url = new URL(current);
  for (const key of ['section', 'organization', 'request', 'customer', 'googleOrganization', 'google', 'setup']) url.searchParams.delete(key);
  url.searchParams.set('section', route.section);
  if (route.organization) url.searchParams.set('organization', route.organization);
  if (route.request) url.searchParams.set('request', route.request);
  if (route.customer) url.searchParams.set('customer', route.customer);
  return url;
}

type Position = { index: number; group: string };
const position = (state: unknown): Position | null => {
  const p = (state as { ynsgWorkspace?: Position } | null)?.ynsgWorkspace;
  return p && Number.isSafeInteger(p.index) && typeof p.group === 'string' ? p : null;
};
// Restore the history cursor on a rejected Back/Forward. Replacing the popped
// entry would destroy a previous screen and leave Forward with the wrong URL.
export function createWorkspaceHistory(browser: Window, accept: (url: URL) => boolean) {
  let cursor = position(browser.history.state) || { index: 0, group: browser.crypto.randomUUID() };
  let current = browser.location.href;
  let restoring = false;
  const state = () => ({ ...browser.history.state, ynsgWorkspace: cursor });
  browser.history.replaceState(state(), '', current);
  const pop = (event: PopStateEvent) => {
    if (restoring) { restoring = false; return; }
    const target = position(event.state);
    const destination = new URL(browser.location.href);
    if (!accept(destination)) {
      if (target?.group === cursor.group && target.index !== cursor.index) {
        restoring = true;
        browser.history.go(cursor.index - target.index);
      } else browser.history.replaceState(state(), '', current);
      return;
    }
    cursor = target?.group === cursor.group ? target : { index: 0, group: browser.crypto.randomUUID() };
    current = destination.href;
    browser.history.replaceState(state(), '', current);
  };
  browser.addEventListener('popstate', pop);
  return {
    push(url: URL) {
      if (restoring || url.href === current) return;
      cursor = { ...cursor, index: cursor.index + 1 };
      current = url.href;
      browser.history.pushState(state(), '', current);
    },
    replace(url: URL) { current = url.href; browser.history.replaceState(state(), '', current); },
    dispose() { browser.removeEventListener('popstate', pop); },
  };
}
