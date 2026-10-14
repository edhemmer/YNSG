# YNSG Owner iPhone/iPad foundation

Expo SDK 57, generated with the official blank TypeScript template. This is an initial native shell for the existing guided CRM, not an App Store release. The CRM remains the session, company-permission, booking and financial authority. Cookie credentials stay in the native WebView; no script bridge exposes tokens and no customer records are stored in app preferences. Exact HTTPS CRM origin is embedded; foreign pages require a deliberate top-level tap and open through system applications, not inside the authenticated WebView. Offline changes are blocked, and the app switcher hides the workspace while inactive.

## Local preparation

From repository root: `pnpm --dir apps/mobile install --frozen-lockfile`; then `pnpm --dir apps/mobile typecheck` and `pnpm --dir apps/mobile bundle:ios`. `pnpm --dir apps/mobile prebuild:ios` generates the iOS project without installing CocoaPods. On a configured Mac, `pnpm --dir apps/mobile ios` runs a development build. Build commands do not enroll an Apple account or deploy the app. `eas.json` only lays out later build profiles; no EAS project, paid build or submission was created.

The native dependency graph has its own workspace and lockfile; Expo/Metro never become website deployment dependencies. `npm run verify:mobile` includes the native audit, independently of browser release checks. Native release remains blocked by upstream unpatched `node-forge` GHSA-86w9-cpqp-85rv and `braces` GHSA-vfj7-8cjw-p6xm toolchain advisories discovered October 14, 2026. No advisory is suppressed. Resolve these before distributing native builds.

## Required before device/TestFlight release

- Confirm the proposed bundle identifier, Apple team/enrollment, signing and profiles. Add production native app icon/splash assets derived from the approved brand; generic template icons are not a release asset.
- Use a development client compatible with the locked SDK; verify iPhone/iPad, landscape, large text, VoiceOver, hardware keyboard, web authentication/session expiry, app interruption and unreliable connectivity. A JavaScript iOS bundle is not a native signed build or device pass.
- Implement and test ASWebAuthenticationSession/AuthSession plus a server-backed session handoff for Google connections and email callback links; never copy tokens through injected JavaScript. Until then, connection management and callback recovery use the browser workspace. Custom scheme registration does not prove verified universal links.
- Implement authenticated native PDF download/share, clear-cache/sign-out behavior and app-switcher privacy timing on real devices. Existing browser PDF is available; the native foundation deliberately does not export cookie values to a downloader.
- APNs, universal links/AASA and push permissions are not enabled. Define devices, retention, quiet hours and user consent first. No native payment or offline financial mutation queue is implemented.
- Confirm App Store privacy disclosures, encryption answers and review requirements; a web-backed foundation alone does not establish App Store eligibility. The present `ITSAppUsesNonExemptEncryption:false` declaration describes platform HTTPS only and must be re-reviewed if custom cryptography is introduced.

Official references: https://docs.expo.dev/more/create-expo/ ; https://docs.expo.dev/versions/v57.0.0/sdk/webview/ ; https://docs.expo.dev/versions/latest/sdk/webbrowser/ ; https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession .
