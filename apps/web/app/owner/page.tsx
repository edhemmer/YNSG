import type { Metadata } from "next";
import Workspace from "../workspace";
import { configured } from "../../lib/session";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Owner sign-in", robots: { index: false, follow: false }, referrer: "no-referrer" };
// Dedicated YNSG entry point. Prefill never grants membership or changes authorization.
export default function OwnerPage() { return <Workspace configured={configured()} initialEmail="edhemmer@gmail.com" />; }
