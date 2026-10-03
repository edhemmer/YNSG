export async function ownerGoogleEnabled(
  url: string | undefined,
  key: string | undefined,
  transport: typeof fetch = fetch,
): Promise<boolean> {
  if (!url || !key) return false;
  try {
    const r = await transport(new URL("/auth/v1/settings", url), {
      headers: { apikey: key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return false;
    const d = await r.json();
    return d?.external?.google === true;
  } catch {
    return false;
  }
}
export function ownerAuthorizationUrl(
  value: string,
  supabaseUrl: string,
): string {
  const url = new URL(value),
    base = new URL(supabaseUrl);
  if (
    url.protocol !== "https:" ||
    url.origin !== base.origin ||
    url.pathname !== "/auth/v1/authorize" ||
    url.searchParams.get("provider") !== "google" ||
    url.username ||
    url.password
  )
    throw Error("INVALID_AUTHORIZATION_URL");
  return url.toString();
}
