// Release builds may inherit production mode; React interaction tests need its test helpers.
// This preload changes only the test subprocess, never the application build or deployed runtime.
process.env.NODE_ENV = "test";

// Tests establish their own synthetic integration settings. Do not inherit hosted secrets.
for (const key of Object.keys(process.env)) {
  if (/^(SUPABASE_|CRM_|GOOGLE_|RESEND_|STRIPE_|TRANSACTIONAL_EMAIL_|REQUEST_FROM_EMAIL$|VERCEL_AUTOMATION_BYPASS_SECRET$)/.test(key)) delete process.env[key];
}
