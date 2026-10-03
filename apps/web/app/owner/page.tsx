import type { Metadata } from "next";
import { ownerGoogleEnabled } from "../../lib/owner-google-auth";
import Workspace from "../workspace";
import { configured } from "../../lib/session";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner sign-in",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
// Dedicated YNSG entry point. Prefill never grants membership or changes authorization.
export default async function OwnerPage() {
  const enabled = await ownerGoogleEnabled(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
  );
  return (
    <Workspace
      configured={configured()}
      initialEmail="edhemmer@gmail.com"
      ownerGoogle={{ enabled }}
    />
  );
}
