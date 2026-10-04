# Email branding and settings actions — October 4, 2026

- Save/publish actions must be visible near the beginning of Company settings and after the form. Retain explicit preview, owner approval, revision checks and validation; do not auto-publish or fabricate reviewed settings.
- Explain exactly why email activation is disabled, including missing published configuration and a sender mismatch. Preserve receipt confirmation and independent automatic-dispatch activation.
- Use the existing official logo unchanged, through an HTTPS image URL, with company-name fallback when images are blocked.
- YNSG outgoing request notices, Google tests, appointment messages, invoices, payment thank-you and declines use the same email layout and signature. Plain text carries the same signature.
- Signature is “Best Regards,” followed by “Edward Hemmer” for YNSG. Future businesses configure their own owner name and logo; never inherit YNSG identity by matching a display name.
- Public bio remains Edward without last name. No public pricing policy changes, promises, personal details or error codes are introduced.
- Escape all dynamic identity/content, reject unsafe image URLs, preserve recipients, amounts, appointment state and action URLs.
- Review all affected templates, settings UI, dispatch paths and test-email copy; test identity isolation, unsafe input, text/HTML agreement and settings compatibility. Build both apps and verify deployments.
- Real Gmail/iPhone image rendering and authenticated owner publishing remain live verification requirements; code and deployment checks do not substitute for them.

## Implementation review

Company settings has a visible, sticky preview/publish control at the top and the existing controls at the bottom. The activation panel explains missing publication, sender mismatch, missing test or receipt confirmation and offers a keyboard-focusable jump to Company settings. Native required-field validation, explicit preview, backend configuration revision/idempotency and mail activation gates are preserved.

Email logo URL and owner signature are optional brand fields persisted inside existing versioned company configuration. Existing settings remain compatible. Only the known YNSG organization receives the YNSG identity fallback; other businesses use their own settings or omit those elements. All application service email paths, including the public website request formatter, use the shared layout. Supabase-managed authentication templates are separate and are not changed in this update.

Plain text and HTML receive matching signatures. The Gmail test uses the business display name and a clear subject. Image URLs must use HTTPS without embedded credentials; dynamic names, text and image attributes are escaped. No real customers were emailed during development and no owner settings or delivery approval were auto-published.
