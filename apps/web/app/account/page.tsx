import {redirect} from "next/navigation";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
import Account from "./panel";
import {EntrySafety} from "../entry-safety";
export default async function Page({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}) {
  const params=searchParams?await searchParams:{};
  if(Object.hasOwn(params,"password"))redirect("/auth/password");
  return <EntrySafety><Account /></EntrySafety>;
}
