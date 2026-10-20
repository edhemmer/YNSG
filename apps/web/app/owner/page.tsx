import type { Metadata } from "next";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {ownerRequestContext} from "../../lib/email-links";
import Workspace from "../workspace";
import { configured } from "../../lib/session";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Business workspace",
  robots: { index: false, follow: false },
  referrer: "strict-origin-when-cross-origin",
};
// Dedicated YNSG entry point. Prefill never grants membership or changes authorization.
export default async function OwnerPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}) {
  const jar=await cookies();
  if(configured()&&!jar.get('ynsg-access')?.value&&!jar.get('ynsg-refresh')?.value){
    const context=ownerRequestContext(searchParams?await searchParams:{});
    redirect('/sign-in'+(context?'?'+new URLSearchParams(context):''));
  }
  return <Workspace configured={configured()} initialEmail="edhemmer@gmail.com"/>;
}
