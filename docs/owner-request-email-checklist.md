# Owner request email acceptance — October 5, 2026

Current requirements supersede the October 3 request-ID footer requirement.

- Keep the company subject, correct recipient and customer Reply-To.
- Show customer contact actions first and group all selected tasks by category.
- Distinguish a requested time from an approved appointment.
- Hide internal request IDs in HTML and plain text. IDs used in authenticated navigation are not authorization credentials.
- Open the owner request page and preserve the selected request through sign-in. Never link to the Vercel dashboard or include hosting bypass secrets.
- Use readable mobile email layouts, escaped customer content, configurable branding and owner signature.
- Preserve delivery retry keys and current appointment details.
- Verify hosting access independently of the connector’s deployment-protection bypass.

Real owner sign-in and customer action acceptance remain separate live checks.
