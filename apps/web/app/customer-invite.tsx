"use client";
import { publicError } from "../lib/public-errors";
import { useState } from "react";
import { sessionFetch } from "../lib/session-fetch";
export default function CustomerInvite({
  organization,
  customer,
}: {
  organization: string;
  customer: string;
}) {
  const [email, setEmail] = useState(""),
    [url, setUrl] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setMessage("");
        setUrl("");
        try {
          const r = await sessionFetch("/api/account-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "invite",
              organization,
              customer,
              email,
            }),
          });
          const d = await r.json();
          if (!r.ok)
            throw Error(
              "Use the email recorded for this customer and verify your owner access.",
            );
          setUrl(d.url);
          setMessage(
            "Invitation expires in 24 hours. Share it only with this customer. They must verify the same email before their records connect.",
          );
        } catch (e) {
          setMessage(publicError(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Customer account email
        <input
          type="email"
          required
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <button disabled={busy}>Create account invitation</button>
      {message && <p role="status">{message}</p>}
      {url && (
        <label>
          Private invitation link
          <input readOnly value={url} onFocus={(e) => e.target.select()} />
        </label>
      )}
    </form>
  );
}
