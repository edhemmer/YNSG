import type { Metadata } from "next";
import CustomerRequest from "./request-panel";
export const metadata: Metadata = {
  title: "Your service appointment",
  description: "Review your appointment and respond securely.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Page() {
  return <CustomerRequest />;
}
