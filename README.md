# Your Neighborhood Service Guy website

The public site is a small HTML, CSS and JavaScript project. `site/pages/*.html` contains the page bodies; `scripts/build.mjs` combines them with shared navigation and metadata into `dist/`. `site/main.css` and `site/main.js` provide the interaction. The Vercel function `api/requests.js` emails requests to the owner through Resend. There is no customer account, appointment booking, payment collection or CRM in this release.

## Local build

```sh
npm ci
npm run check
npm run build
```

Serve `dist/` with any static server to review pages. Vercel uses the build command in `vercel.json` and publishes `dist/`; `/api/requests` is a Node.js function. Set `RESEND_API_KEY` and `REQUEST_FROM_EMAIL` in Vercel for the request endpoint. The sender address must be verified with the email provider. Never put secrets in the repository or browser code.

## Content and interaction

The governing business and technology plans live outside this public repository. This release follows their published service scope and pricing. The expandable service menu passes a category and job into the single request form. JavaScript enhances the home page to keep visitors there; ordinary links to `/request/` remain as the fallback. The form does not imply a booking or quote. Calls use `tel:+17706302094`.

The site uses the approved logo and CSS/SVG decoration, no customer photography. Motion is limited to decorative elements and turns off with `prefers-reduced-motion`. Any future CRM should accept the same validated request model and add durable spam controls, idempotency, access rules and retention before storing customer records.
