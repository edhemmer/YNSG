# Owner settings correction flow — October 4, 2026

Latest owner instruction: if publishing is blocked by an incomplete field, take the owner to that field. The owner has confirmed the new Gmail test looks good.

- Retain explicit preview/publication and all existing backend revision, authorization, idempotency and configuration checks.
- Both top and bottom preview actions use the same validation flow, including browser-required fields, configuration cross-field checks and catalog validation.
- Missing or invalid fields are named in plain language, highlighted, scrolled into view and focused. Focus and correction must work without animation or a mouse.
- Error text stays visible in the settings toolbar; a Go to this field action repeats navigation. Correcting the field clears its warning.
- Canonical paths map to actual controls, including nested rates, hours, logo/review links, cities and each catalog item.
- No auto-publication, fabricated business/tax/service review, provider activation or new public pricing policy.
- Preserve the official logo, Edward signature and owner-configurable identity. No public metadata or internal setup exposure changes.
- Tests cover business name, catalog item addressing, wrapped command paths, scheduling relationships and color correction; run TypeScript and production build, then verify deployed commit.
- Live setup remains blocked by zero published configuration and zero email approvals. Google is connected with a selected calendar and an accepted Gmail test. Vercel denied environment creation with 403; automatic delivery and public availability were not activated.
