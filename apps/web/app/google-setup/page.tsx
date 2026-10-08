import type { Metadata } from "next";
import { redirect as navigate } from "next/navigation";
import { authenticated } from "../../lib/session";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Calendar and email",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function GoogleSetup() {
  // Authenticate and recheck live owner permission before reading any setup details.
  let allowed = false;
  try {
    const { db, user } = await authenticated();
    const { data, error } = await db.from("memberships")
      .select("organization_id,role").eq("user_id", user.id);
    if (!error) {
      for (const membership of data || []) {
        if (!["owner", "admin"].includes(membership.role)) continue;
        const access = await db.rpc("google_access", { p_org: membership.organization_id });
        if (!access.error && access.data === true) { allowed = true; break; }
      }
    }
  } catch {
    // Fail closed for expired sessions, revoked membership or unavailable auth.
  }
  if (!allowed) navigate("/owner");
  // Preserve existing private links without exposing infrastructure instructions.
  navigate("/owner?setup=google");
}
