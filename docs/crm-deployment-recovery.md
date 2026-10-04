# CRM deployment recovery — October 4, 2026

Internal operations reference; do not expose this document in public navigation.

## Verified source and project mapping

| Application | Vercel project | Git branch | Root directory |
|---|---|---|---|
| Business owner and customer app | ynsg-repo | codex/crm-workflow | apps/web |
| Public service website | ynsg | main | Repository root |

The CRM source at 241f4e65c6899889448ff660f3c43478716eeef4 includes the settings field navigation and publishing improvements. The owner's subsequent redeployment selected main and failed before compilation because apps/web does not exist on that branch. Keep the CRM root directory unchanged; deploy its CRM branch. Do not merge CRM source into the public website as a recovery shortcut.

## Email activation verification

The owner reported adding GOOGLE_GMAIL_DELIVERY_ENABLED=true and redeploying. Environment-variable API access is still restricted, so the value is not independently verified. The failed main deployment cannot establish that the CRM runtime received it.

Use Preview scope for codex/crm-workflow. A new successful CRM deployment is required after changing environment variables. Never commit OAuth credentials, worker bearer secrets, tokens, or private environment files.

After the correct deployment is READY, sign in and check Settings: published business configuration, Google identity and selected business calendar, receipt of the Gmail test, and owner approval of the current sender/configuration. The global sending flag alone does not authorize a company's notifications.

A recurring worker trigger must also be configured and verified before claiming automated reminders or queue delivery. No real customer test email should be sent merely to check deployment. Authenticated readiness verification and full customer workflow acceptance remain required.
