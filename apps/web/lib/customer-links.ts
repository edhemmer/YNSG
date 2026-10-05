import {applicationOrigin} from './email-links.ts';
import { createHmac, hkdfSync } from "node:crypto";
// Separate cryptographic purpose: this key never encrypts tokens or Google credentials.
export function customerLinkToken(
  organization: string,
  outbox: string,
  revision: number,
  encryptionKey: string,
) {
  const master = Buffer.from(encryptionKey, "base64");
  if (master.length !== 32) throw Error("LINK_KEY_REQUIRED");
  const key = Buffer.from(
    hkdfSync(
      "sha256",
      master,
      Buffer.alloc(0),
      "ynsg/customer-request-link/v1",
      32,
    ),
  );
  return createHmac("sha256", key)
    .update(JSON.stringify([organization, outbox, revision]))
    .digest("base64url");
}
export function customerLinkUrl(
  origin: string,
  token: string,
  action: "confirm" | "reschedule" | "manage" = "manage",
) {
  const url = new URL(applicationOrigin(origin));
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  )
    throw Error("LINK_ORIGIN_REQUIRED");
  // The fragment is never sent to the host, analytics, access logs or referrer.
  return (
    url.origin + "/request/manage#" + new URLSearchParams({ token, action })
  );
}
