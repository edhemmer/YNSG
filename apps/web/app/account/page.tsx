import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
import Account from "./panel";
import {EntrySafety} from "../entry-safety";
export default function Page() {
  return <EntrySafety><Account /></EntrySafety>;
}
