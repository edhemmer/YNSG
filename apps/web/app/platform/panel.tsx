"use client";
import { useEffect, useState } from "react";
import { sessionFetch } from "../../lib/session-fetch";
type Owner = {
  id: string;
  display_name: string;
  company_status: string;
  subscription_status: string;
  owners: { email: string }[];
};
export default function Platform() {
  const [rows, setRows] = useState<Owner[]>([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setRows([]);
    sessionFetch("/api/platform?page=" + page)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (active) {
          setRows(d.owners);
          setMore(d.hasMore);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [page]);
  return (
    <main id="main" className="account-shell">
      <a href="/">Owner workspace and sign-in</a>
      <h1>Owner accounts</h1>
      <p>
        Company owners and subscription status. Customer records are not
        available in this module.
      </p>
      {error && <p role="alert">{error}</p>}
      {rows.map((r) => (
        <section className="account-card" key={r.id}>
          <h2>{r.display_name}</h2>
          {r.owners.map((o) => (
            <p key={o.email}>{o.email}</p>
          ))}
          <p>
            Company: {r.company_status} · Subscription:{" "}
            {r.subscription_status.replaceAll("_", " ")}
          </p>
        </section>
      ))}
      <div className="actions">
        <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <button disabled={!more} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </main>
  );
}
