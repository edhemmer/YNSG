import { NextResponse } from "next/server";
import { authenticated, failure } from "../../../lib/session";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const { db, user } = await authenticated();
    const url = new URL(request.url);
    const org = url.searchParams.get("organization");
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .parse(url.searchParams.get("page") || 0);
    const access = await db
      .from("customer_access")
      .select("organization_id,customer_id,can_view_billing,can_approve")
      .eq("user_id", user.id);
    if (access.error) throw access.error;
    const companies = await db
      .from("organizations")
      .select("id,display_name,timezone");
    if (companies.error) throw companies.error;
    if (!org)
      return NextResponse.json(
        { email: user.email, access: access.data, companies: companies.data },
        { headers: { "Cache-Control": "no-store" } },
      );
    z.uuid().parse(org);
    const relationships = access.data.filter((a) => a.organization_id === org);
    if (!relationships.length)
      return NextResponse.json(
        { error: "This account is not connected to that company." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    const ids = relationships.map((a) => a.customer_id);
    const from = page * 20;
    // Select only customer-facing fields; internal submissions/notes and outbox never leave this API.
    const results = await Promise.all([
      db
        .from("customers")
        .select("id,display_name")
        .eq("organization_id", org)
        .in("id", ids),
      db
        .from("properties")
        .select("id,street,city,region,postal_code")
        .eq("organization_id", org)
        .in("customer_id", ids),
      db
        .from("service_requests")
        .select("id,status,created_at")
        .eq("organization_id", org)
        .in("customer_id", ids)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, from + 20),
      db
        .from("jobs")
        .select("id,status")
        .eq("organization_id", org)
        .in("customer_id", ids)
        .order("id")
        .range(from, from + 20),
      db
        .from("invoices")
        .select("id,number,total_cents,issued_at,payments(cents)")
        .eq("organization_id", org)
        .in("customer_id", ids)
        .order("issued_at", { ascending: false })
        .order("id")
        .range(from, from + 20),
    ]);
    if (results.some((r) => r.error)) throw new Error("FAILED");
    const jobs = (results[3].data || []).slice(0, 20).map((j) => j.id);
    const appts = jobs.length
      ? await db
          .from("appointments")
          .select(
            "id,start_at,end_at,arrival_at,status,timezone,customer_response",
          )
          .eq("organization_id", org)
          .in("job_id", jobs)
          .order("start_at", { ascending: false })
      : { data: [], error: null };
    if (appts.error) throw appts.error;
    const hasMore = results.slice(2).some((r) => (r.data?.length || 0) > 20);
    return NextResponse.json(
      {
        company: companies.data.find((c) => c.id === org),
        customers: results[0].data,
        properties: results[1].data,
        requests: results[2].data?.slice(0, 20),
        jobs: results[3].data?.slice(0, 20),
        invoices: results[4].data?.slice(0, 20),
        appointments: appts.data,
        page,
        hasMore,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
