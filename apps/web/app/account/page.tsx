import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
import Account from "./panel";
export default function Page() {
  return <Account />;
}
