# Your Neighborhood Service Guy website

The public site is a small HTML, CSS and JavaScript project. `site/pages/*.html` contains the page bodies; `scripts/build.mjs` combines them with shared navigation and metadata into `dist/`. `site/main.css` and `site/main.js` provide the interaction. The Vercel function `api/requests.js` emails requests to the owner through authenticated Gmail SMTP. There is no customer account, appointment booking, payment collection or CRM in this release.

## Local build

```sh
npm ci
npm run check
npm run build
```

Serve `dist/` with any static server to review pages. Vercel uses the build command in `vercel.json` and publishes `dist/`; `/api/requests` is a Node.js function. The request email is sent to and from `edhemmer@gmail.com` over authenticated Gmail SMTP. Set `GMAIL_APP_PASSWORD` as a Production secret in Vercel, using an app password generated in that Google Account with 2-Step Verification enabled. Do not use the normal Google password. Redeploy after adding the secret. Never put secrets in the repository or browser code.

## Content and interaction

The governing business and technology plans live outside this public repository. This release follows their published pricing and core service boundaries. At the owner’s September 29 direction, it also lists narrow ground-level residential concrete pressure washing as a review-first service; customer-supplied water and runoff review are stated on the site. The governing business plan should be updated to reflect that new service. The expandable service menu passes a category and job into the single request form. JavaScript enhances the home page to keep visitors there; ordinary links to `/request/` remain as the fallback. The form does not imply a booking or quote. Calls use `tel:+17706302094`.

The site uses the approved logo and CSS/SVG decoration, no customer photography. Motion is limited to decorative elements and turns off with `prefers-reduced-motion`. Any future CRM should accept the same validated request model and add durable spam controls, idempotency, access rules and retention before storing customer records.
