import {readFileSync} from 'node:fs';
// Match the root CRM layout import order. Browser fixtures use the same skin as production.
export function readWorkspaceStyles(){return ['apps/web/app/field-office.css','apps/web/app/careers.css','apps/web/app/task-time.css','site/request-button.css','apps/web/app/style.css','apps/web/app/owner-day.css','apps/web/app/customer-records.css','apps/web/app/invoice-closeout.css','apps/web/app/owner-network.css','apps/web/app/field-system.css'].map(p=>readFileSync(p,'utf8')).join('\n');}
