import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, failure } from "../../../lib/session";
import {
  daySearchBounds,
  localDate,
  requestedTasks,
  type DayCall,
} from "../../../lib/day-plan";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const org = z.uuid().parse(params.get("organization"));
    const { db, user } = await authenticated();
    const membership = await db
      .from("memberships")
      .select("role")
      .eq("organization_id", org)
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (membership.error) throw membership.error;
    if (!membership.data)
      return NextResponse.json(
        { error: "Owner access is required for the daily call sheet." },
        { status: 403, headers },
      );
    const company = await db
      .from("organizations")
      .select("display_name,timezone")
      .eq("id", org)
      .single();
    if (company.error) throw company.error;
    const date =
      params.get("date") || localDate(new Date(), company.data.timezone);
    const bounds = daySearchBounds(date);
    // One joined query, independent of the dashboard's 50-row page. Fail visibly if bounded capacity is exceeded.
    const appointments = await db
      .from("appointments")
      .select(
        "id,request_id,arrival_at,end_at,status,customer_response,request:service_requests!appointments_organization_id_request_id_fkey(original_submission)",
        { count: "exact" },
      )
      .eq("organization_id", org)
      .in("status", ["reserved", "needs_review"])
      .gte("arrival_at", bounds.from)
      .lt("arrival_at", bounds.to)
      .order("arrival_at")
      .order("id")
      .range(0, 1000);
    if (appointments.error) throw appointments.error;
    if (appointments.count === null) throw Error("INCOMPLETE_COUNT");
    if ((appointments.count ?? appointments.data.length) > 1000)
      return NextResponse.json(
        {
          error:
            "This call sheet is too large to display completely. Narrow the schedule before printing.",
        },
        { status: 409, headers },
      );
    const calls: DayCall[] = appointments.data
      .filter(
        (a) =>
          localDate(new Date(a.arrival_at), company.data.timezone) === date,
      )
      .map((a) => {
        const linked = Array.isArray(a.request) ? a.request[0] : a.request;
        if (!linked?.original_submission) throw Error("INCOMPLETE_ORDER");
        const r = linked.original_submission;
        return {
          id: a.id,
          requestId: a.request_id,
          arrivalAt: a.arrival_at,
          endAt: a.end_at,
          status: a.status,
          customerResponse: a.customer_response,
          name: r.name || "Customer name needs review",
          phone: r.phone || "",
          email: r.email || "",
          address: [r.street, r.city].filter(Boolean).join(", "),
          tasks: requestedTasks(r),
          description: r.description || "",
        };
      });
    return NextResponse.json(
      {
        date,
        timezone: company.data.timezone,
        company: company.data.display_name,
        generatedAt: new Date().toISOString(),
        calls,
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_DATE")
      return NextResponse.json(
        { error: "Choose a valid calendar date." },
        { status: 400, headers },
      );
    return failure(error);
  }
}
