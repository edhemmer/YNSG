# Cost and dependency register — checked September 30, 2026

| Dependency | Observed / constraint | Activation gate |
|---|---|---|
| Supabase | InLight AI organization Free; YNSG jvigtwjlkmeyavzbxjzl empty. Free published 500MB DB/1GB files/50k MAU, two active projects, inactivity pause, no automatic backups | no purchases; isolated tests and verified encrypted DB+files recovery |
| Vercel | existing YNSG public project; account plan still to verify. Hobby permits noncommercial personal use | commercial eligibility unresolved; no upgrade authorized |
| Gmail | confirmed personal sender, prior Apps Script setup is not CRM OAuth | actual send authorization, encrypted token and independent delivery test |
| Auth email | separate from business-message sender | configured SMTP/hook and verification/reset tests |
| Calendar/Maps | required Calendar and configured travel | least privilege OAuth, private calendar selection, quotas and provider tests |
| AI | no configured provider/budget established | explicit provider budget; deterministic Today remains available |
| iOS | Windows cannot certify native device build | Apple enrollment/signing/TestFlight/device testing; no purchase authorized |
| Accounting | CSV now, QBO sandbox proof required | sandbox credentials; no paid live connector requirement |

Sources: https://supabase.com/pricing ; https://vercel.com/docs/plans/hobby ; https://supabase.com/docs/guides/auth/auth-smtp . Recheck at activation. No artificial keep-alive traffic. Warn at 70/85/95% measured usage; owner decides capacity action.

Changelog reviewed: https://supabase.com/changelog (September 25 PostgreSQL 17.11 changes). Empty YNSG schema has no legacy ltree, float btree_gist indexes, legacy pgcrypto cipher or custom operator to migrate. Use UUID/range capacity indexes, not floating-point ranges.
