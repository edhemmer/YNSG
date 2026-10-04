import { createClient } from "@supabase/supabase-js";
import { OAuth2Client, CodeChallengeMethod, type Credentials } from "google-auth-library";
import { randomBytes } from "node:crypto";
import { authenticated, authClient } from "./session";
import {
  callbackUri,
  GOOGLE_SCOPES,
  hash,
  seal,
  unseal,
  GoogleFailure,
  googleRefreshFailure,
  CALENDAR_CREATION_SCOPE,
} from "./google-core";
export type Account = {
  organization_id: string;
  revision: number;
  encrypted_tokens: string | null;
  email: string | null;
  subject: string | null;
  scopes: string[];
  calendar_id: string | null;
  health: string;
  checked_at: string | null;
  gmail_test: string;
  test_key: string | null;
  test_started_at: string | null;
  replay?: boolean;
};
export function missingGoogleConfiguration() {
  return [
    "APP_ORIGIN",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_TOKEN_ENCRYPTION_KEY",
  ].filter((k) => !process.env[k]);
}
function encryptionKey() {
  const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!key || Buffer.from(key, "base64").length !== 32)
    throw new GoogleFailure("ENCRYPTION_KEY_REQUIRED");
  return key;
}
export function oauth() {
  if (missingGoogleConfiguration().length)
    throw new GoogleFailure("GOOGLE_SETUP_REQUIRED");
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: callbackUri(process.env.APP_ORIGIN!),
  });
}
export async function authorizeGoogle(org: string) {
  const session = await authenticated();
  const { data, error } = await session.db.rpc("google_access", { p_org: org });
  if (error || data !== true) throw new GoogleFailure("OWNER_ACCESS_REQUIRED");
  return session;
}
export function serverDatabase(){
  if(!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.SUPABASE_URL)throw new GoogleFailure('GOOGLE_SETUP_REQUIRED');
  return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function store<T = Account>(
  org: string | null,
  action: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_URL)
    throw new GoogleFailure("GOOGLE_SETUP_REQUIRED");
  const db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error, status } = await db.rpc("google_store", {
    p_org: org,
    p_action: action,
    p_input: input,
  });
  if (error) {
    // Log only an allowlisted category/status, never credentials or provider payloads.
    const category = status === 401 ? "SERVER_DATABASE_AUTH_REQUIRED"
      : status === 403 ? "SERVER_DATABASE_PERMISSION_REQUIRED" : "CONNECTION_STORAGE_FAILED";
    console.error("google_store_failed", { category, status });
    if (status === 401 || status === 403) throw new GoogleFailure(category);
    throw new GoogleFailure(
      [
        "STALE_CONNECTION",
        "DELIVERY_REVIEW_REQUIRED",
        "TRY_LATER",
        "CALENDAR_MIGRATION_REQUIRED",
      ].find((x) => error.message.includes(x)) || "CONNECTION_STORAGE_FAILED",
    );
  }
  return data as T;
}
export function publicAccount(a: Account) {
  return {
    revision: a.revision,
    email: a.email,
    connected: Boolean(a.encrypted_tokens),
    calendarId: a.calendar_id,
    health: a.health,
    checkedAt: a.checked_at,
    gmailTest:
      a.gmail_test === "sending" &&
      a.test_started_at &&
      Date.parse(a.test_started_at) < Date.now() - 120000
        ? "unknown"
        : a.gmail_test,
    legacyEmailUnchanged: true,
    canCreateCalendar: a.scopes.includes(CALENDAR_CREATION_SCOPE),
  };
}
type OAuthState = {
  org: string;
  user: string;
  access: string;
  verifier: string;
  nonce: string;
  revision: number;
  expires: number;
};
export async function startGoogle(org: string) {
  const session = await authorizeGoogle(org),
    client = oauth(),
    a = await store(org, "read");
  if (a.encrypted_tokens)
    throw new GoogleFailure("DISCONNECT_BEFORE_RECONNECT");
  const state = randomBytes(32).toString("base64url"),
    nonce = randomBytes(32).toString("base64url");
  const { codeVerifier, codeChallenge } =
    await client.generateCodeVerifierAsync();
  const value: OAuthState = {
    org,
    user: session.user.id,
    access: session.access,
    verifier: codeVerifier,
    nonce,
    revision: a.revision,
    expires: Date.now() + 600000,
  };
  await store(org, "state_put", {
    hash: hash(state),
    ciphertext: seal(value, encryptionKey(), "oauth:" + hash(state)),
  });
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GOOGLE_SCOPES],
    state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
  });
  return { url, state, nonce };
}
export async function finishGoogle(state: string, nonce: string, code: string) {
  const saved = await store<{
    ciphertext: string;
    organization_id: string;
  } | null>(null, "state_take", { hash: hash(state) });
  if (!saved) throw new GoogleFailure("OAUTH_EXPIRED");
  const s = unseal<OAuthState>(
    saved.ciphertext,
    encryptionKey(),
    "oauth:" + hash(state),
  );
  if (
    s.expires < Date.now() ||
    s.nonce !== nonce ||
    s.org !== saved.organization_id
  )
    throw new GoogleFailure("OAUTH_EXPIRED");
  // The ordinary CRM cookie is SameSite=Strict. Revalidate the initiating live session explicitly.
  const db = authClient(s.access),
    identity = await db.auth.getUser(s.access),
    access = await db.rpc("google_access", { p_org: s.org });
  if (
    identity.error ||
    identity.data.user?.id !== s.user ||
    access.error ||
    access.data !== true
  )
    throw new GoogleFailure("OWNER_ACCESS_REQUIRED");
  const client = oauth();
  const { tokens } = await client.getToken({
    code,
    codeVerifier: s.verifier,
    redirect_uri: callbackUri(process.env.APP_ORIGIN!),
  });
  if (!tokens.id_token || !tokens.refresh_token)
    throw new GoogleFailure("OFFLINE_CONSENT_REQUIRED");
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID!,
  });
  const claims = ticket.getPayload();
  if (!claims?.sub || !claims.email || !claims.email_verified)
    throw new GoogleFailure("VERIFIED_GOOGLE_EMAIL_REQUIRED");
  const scopes = (tokens.scope || "").split(" ");
  if (GOOGLE_SCOPES.some((scope) => !scopes.includes(scope)))
    throw new GoogleFailure("MISSING_GOOGLE_SCOPES");
  await store(s.org, "connect", {
    revision: s.revision,
    ciphertext: seal(tokens, encryptionKey(), "tokens:" + s.org),
    email: claims.email,
    subject: claims.sub,
    scopes,
    actor: s.user,
  });
  return s.org;
}
export async function accessToken(org: string) {
  let account = await store(org, "read");
  if (!account.encrypted_tokens) throw new GoogleFailure("GOOGLE_DISCONNECTED");
  let tokens = unseal<Credentials>(
    account.encrypted_tokens,
    encryptionKey(),
    "tokens:" + org,
  );
  if (
    !tokens.access_token ||
    !tokens.expiry_date ||
    tokens.expiry_date < Date.now() + 60000
  ) {
    const client = oauth();
    client.setCredentials({ refresh_token: tokens.refresh_token });
    try {
      const refreshed = await client.refreshAccessToken();
      tokens = {
        ...tokens,
        ...refreshed.credentials,
        refresh_token:
          refreshed.credentials.refresh_token || tokens.refresh_token,
      };
    } catch (error) {
      const code = googleRefreshFailure(error);
      await store(org, "health", {
        revision: account.revision,
        health: code.toLowerCase(),
      });
      throw new GoogleFailure(code);
    }
    account = await store(org, "tokens", {
      revision: account.revision,
      ciphertext: seal(tokens, encryptionKey(), "tokens:" + org),
    });
  }
  if (!tokens.access_token) throw new GoogleFailure("RECONNECT_REQUIRED");
  return { token: tokens.access_token, account };
}
export async function disconnectGoogle(org: string, user: string) {
  const account = await store(org, "read");
  const tokens = account.encrypted_tokens
    ? unseal<Credentials>(
        account.encrypted_tokens,
        encryptionKey(),
        "tokens:" + org,
      )
    : null;
  await store(org, "disconnect", { revision: account.revision, actor: user });
  if (!tokens) return { revoked: true };
  try {
    const client = oauth();
    await client.revokeToken(tokens.refresh_token || tokens.access_token!);
    return { revoked: true };
  } catch {
    return {
      revoked: false,
      message:
        "Local access removed. Google revocation could not be confirmed; remove access in your Google Account security settings.",
    };
  }
}

export type CalendarCreation = { status: "sending" | "created" | "unknown" | "failed"; calendarId: string | null; summary: string; create?: boolean; operationId?: string; subject?: string; timeZone?: string };
export async function calendarCreation(org: string, action: string, input: Record<string, unknown> = {}): Promise<CalendarCreation | null> {
  const {data, error, status} = await serverDatabase().rpc("google_calendar_creation", {p_org: org, p_action: action, p_input: input});
  if (error) {
    const code = status === 401 ? "SERVER_DATABASE_AUTH_REQUIRED" : status === 403 ? "SERVER_DATABASE_PERMISSION_REQUIRED"
      : ["STALE_CONNECTION", "BUSINESS_CALENDAR_ALREADY_SELECTED", "CALENDAR_CREATION_PERMISSION_REQUIRED", "GOOGLE_DISCONNECTED"].find(c => error.message.includes(c)) || "CONNECTION_STORAGE_FAILED";
    console.error("google_calendar_creation_failed", {category: code, status});
    throw new GoogleFailure(code);
  }
  return data;
}
