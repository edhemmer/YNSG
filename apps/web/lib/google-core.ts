import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
export const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.owned",
  "https://www.googleapis.com/auth/calendar.freebusy",
] as const;
export const CALLBACK_PATH = "/api/google/callback";
export function callbackUri(origin: string) {
  const u = new URL(origin);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.pathname !== "/" ||
    u.search ||
    u.hash
  )
    throw new Error("INVALID_APP_ORIGIN");
  return u.origin + CALLBACK_PATH;
}
export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function seal(value: unknown, key: string, context: string) {
  const bytes = Buffer.from(key, "base64");
  if (bytes.length !== 32) throw new Error("INVALID_ENCRYPTION_KEY");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", bytes, iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function unseal<T>(value: string, key: string, context: string): T {
  const [version, iv, tag, data] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data)
    throw new Error("INVALID_CIPHERTEXT");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "base64"),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8"),
  ) as T;
}
export class GoogleFailure extends Error {
  constructor(
    public code: string,
    public status = 0,
  ) {
    super(code);
  }
}
export async function googleRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {},
  transport: typeof fetch = fetch,
): Promise<T> {
  if (!path.startsWith("/calendar/v3/") && !path.startsWith("/gmail/v1/"))
    throw new GoogleFailure("INVALID_GOOGLE_PATH");
  let response: Response;
  try {
    response = await transport("https://www.googleapis.com" + path, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    throw new GoogleFailure("PROVIDER_UNREACHABLE");
  }
  if (!response.ok)
    throw new GoogleFailure(
      response.status === 401
        ? "RECONNECT_REQUIRED"
        : response.status === 403
          ? "PERMISSION_OR_API_REQUIRED"
          : response.status === 429
            ? "RATE_LIMITED"
            : "GOOGLE_REQUEST_FAILED",
      response.status,
    );
  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new GoogleFailure("INVALID_PROVIDER_RESPONSE");
  }
}
export type Calendar = {
  id: string;
  summary: string;
  accessRole: string;
  timeZone?: string;
  primary?: boolean;
  deleted?: boolean;
};
export async function ownedCalendars(
  token: string,
  transport: typeof fetch = fetch,
) {
  const calendars: Calendar[] = [];
  let page: string | undefined;
  do {
    const q = new URLSearchParams({
      minAccessRole: "owner",
      maxResults: "250",
    });
    if (page) q.set("pageToken", page);
    const result = await googleRequest<{
      items?: Calendar[];
      nextPageToken?: string;
    }>(token, "/calendar/v3/users/me/calendarList?" + q, {}, transport);
    calendars.push(
      ...(result.items || []).filter(
        (c) => c.accessRole === "owner" && !c.deleted,
      ),
    );
    page = result.nextPageToken;
    if (calendars.length > 2500) throw new GoogleFailure("TOO_MANY_CALENDARS");
  } while (page);
  return calendars;
}
export async function busyTimes(
  token: string,
  calendarId: string,
  start: string,
  end: string,
  transport: typeof fetch = fetch,
) {
  if (
    !Number.isFinite(Date.parse(start)) ||
    !Number.isFinite(Date.parse(end)) ||
    Date.parse(end) <= Date.parse(start)
  )
    throw new GoogleFailure("INVALID_WINDOW");
  const result = await googleRequest<{
    calendars?: Record<
      string,
      { errors?: unknown[]; busy?: { start: string; end: string }[] }
    >;
  }>(
    token,
    "/calendar/v3/freeBusy",
    {
      method: "POST",
      body: JSON.stringify({
        timeMin: start,
        timeMax: end,
        items: [{ id: calendarId }],
      }),
    },
    transport,
  );
  const data = result.calendars?.[calendarId];
  if (!data || data.errors?.length || !Array.isArray(data.busy))
    throw new GoogleFailure("BUSY_DATA_UNAVAILABLE");
  if (
    data.busy.some(
      (x) =>
        !Number.isFinite(Date.parse(x.start)) ||
        !Number.isFinite(Date.parse(x.end)) ||
        Date.parse(x.end) <= Date.parse(x.start),
    )
  )
    throw new GoogleFailure("INVALID_BUSY_DATA");
  return { calendarId, busy: data.busy, checkedAt: new Date().toISOString() };
}
export function emailRaw(
  from: string,
  to: string,
  subject: string,
  body: string,
  messageId: string,
) {
  for (const address of [from, to])
    if (!/^[^\s<>@\r\n]+@[^\s<>@\r\n]+\.[^\s<>@\r\n]+$/.test(address))
      throw new GoogleFailure("INVALID_EMAIL");
  if (/[\r\n]/.test(subject) || !/^[a-z0-9-]+$/.test(messageId))
    throw new GoogleFailure("INVALID_HEADER");
  const encoded =
    Buffer.from(body, "utf8")
      .toString("base64")
      .match(/.{1,76}/g)
      ?.join("\r\n") || "";
  return Buffer.from(
    `From: ${from}\r\nTo: ${to}\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=\r\nMessage-ID: <${messageId}@ynsg.invalid>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${encoded}`,
  ).toString("base64url");
}
export async function sendEmail(
  token: string,
  raw: string,
  transport: typeof fetch = fetch,
) {
  // Never automatically retry this POST: a timeout may follow successful acceptance.
  const result = await googleRequest<{ id?: string }>(
    token,
    "/gmail/v1/users/me/messages/send",
    { method: "POST", body: JSON.stringify({ raw }) },
    transport,
  );
  if (!result.id) throw new GoogleFailure("DELIVERY_UNKNOWN");
  return result.id;
}
