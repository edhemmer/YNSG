# Your Neighborhood Service Guy website

The public site is a small HTML, CSS and JavaScript project. `site/pages/*.html` contains the page bodies; `scripts/build.mjs` combines them with shared navigation and metadata into `dist/`. `site/main.css` and `site/main.js` provide the interaction. The Vercel function `api/requests.js` emails requests to the owner through Resend. There is no customer account, appointment booking, payment collection or CRM in this release.

## Local build

```sh
npm ci
npm run check
npm run build
```

Serve `dist/` with any static server to review pages. Vercel uses the build command in `vercel.json` and publishes `dist/`; `/api/requests` is a Node.js function. Set `RESEND_API_KEY` as a Production secret in Vercel. A previously saved `RESEND_API_Key` is accepted as a compatibility fallback. Requests go to `edhemmer@gmail.com` from Resend's `onboarding@resend.dev` testing sender. This sender can reach only the account owner's email and should be replaced with a sender on a verified business domain when the site moves beyond this owner-only notification flow. Never put secrets in the repository or browser code.

## Content and interaction

The governing business and technology plans live outside this public repository. This release follows their published pricing and core service boundaries. At the owner’s September 29 direction, it also lists narrow ground-level residential concrete pressure washing as a review-first service; customer-supplied water and runoff review are stated on the site. The governing business plan should be updated to reflect that new service. The expandable service menu passes a category and job into the single request form. JavaScript enhances the home page to keep visitors there; ordinary links to `/request/` remain as the fallback. The form does not imply a booking or quote. Calls use `tel:+17706302094`.

The site uses the approved logo and CSS/SVG decoration, no customer photography. Motion is limited to decorative elements and turns off with `prefers-reduced-motion`. Any future CRM should accept the same validated request model and add durable spam controls, idempotency, access rules and retention before storing customer records.

## CRM handoff

The public form posts one request to `POST /api/requests`. The server validates service, job details, customer name, phone, email, street, city, preferred time and Community Rate inquiry. Today the delivery step emails the owner and returns a request ID after the provider accepts the message. The form does not book an appointment or create an account.

When the CRM is ready, keep this public form and endpoint contract. Replace the email delivery step with an authorized create-request operation that stores the original submission, returns a durable request ID, and schedules any notifications through the CRM. Add idempotency, spam throttling, tenant ownership, retention and an audit trail before turning on persistence. Update the Privacy Notice at the same time; do not silently start storing submissions or send duplicate owner emails.
