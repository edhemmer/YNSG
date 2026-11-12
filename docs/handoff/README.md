# Developer handoff: start here

Last updated: November 12, 2026. Owner: Ed Hemmer, Your Neighborhood Service Guy, LLC (YNSG).

This folder is the plain-language orientation for a developer who is new to the project. The older files in `docs/` are dated evidence and acceptance records; they are accurate for their date but are not a map. Read these files in order:

| # | File | Read it to learn |
| --- | --- | --- |
| 1 | [01-business-and-goals.md](01-business-and-goals.md) | What the business does, who it serves, and what we are building toward |
| 2 | [02-build-scope.md](02-build-scope.md) | What is built, what is partly built, what is not built (the scope ledger) |
| 3 | [03-architecture.md](03-architecture.md) | How the pieces fit: site, owner app, database, payments, email |
| 4 | [04-operations.md](04-operations.md) | Accounts, deploys, environment, scheduled jobs, how to ship safely |
| 5 | [05-design-brand-and-copy.md](05-design-brand-and-copy.md) | Brand palette, tone, wording rules, things we must never say |
| 6 | [06-email-and-invoices.md](06-email-and-invoices.md) | The email layout, 48-template library, transactional messages, deliverability, invoice rendering |
| 7 | [07-seo-and-growth.md](07-seo-and-growth.md) | Local SEO, listings, Search Console, review strategy |
| 8 | [08-open-decisions-and-roadmap.md](08-open-decisions-and-roadmap.md) | Pending owner decisions, next work, known gaps |

Authoritative engineering rules still live in [`AGENTS.md`](../../AGENTS.md), [`docs/governance.md`](../governance.md), [`docs/engineering-spec.md`](../engineering-spec.md) and [`docs/production/README.md`](../production/README.md). Where this folder and those disagree, those win, and the owner's latest instruction wins over everything.

## Ten-minute orientation

1. Two Vercel projects deploy from one repository. `ynsg` serves the public marketing website (static HTML built from `site/`). `ynsg-repo` serves the owner and customer app (Next.js in `apps/web`).
2. Production branch is `codex/crm-workflow`, not `main`. `main` is an old website-only snapshot.
3. The database is Supabase Postgres with row-level security. Approvals, bookings, invoices and payments are owned by database commands, not by ad hoc table edits.
4. Prices, tax, scheduling and invoice math are deterministic code and database rules. AI never sets money values.
5. Everything must stay on free tiers unless the owner approves a cost first. See the cost register in [04-operations.md](04-operations.md).
6. The owner merges pull requests himself. Bundle related changes into one PR.
