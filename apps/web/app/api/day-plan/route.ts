import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildPackingPlan,
  workKey,
  type PackingRule,
} from "../../../lib/packing-plan";
import { authenticated, failure } from "../../../lib/session";
import {
  daySearchBounds,
  localDate,
  requestedTasks,
  type DayCall,
} from "../../../lib/day-plan";
import {buildRoutePlan} from "../../../lib/route-plan";
import {googleRouteProvider} from "../../../lib/google-routes";
export const maxDuration=60;
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
        "id,revision,request_id,start_at,arrival_at,end_at,status,customer_response,request:service_requests!appointments_organization_id_request_id_fkey(original_submission)",
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
    if (
      appointments.count > 1000 ||
      appointments.count !== appointments.data.length
    )
      return NextResponse.json(
        {
          error:
            "This call sheet is too large to display completely. Narrow the schedule before printing.",
        },
        { status: 409, headers },
      );
    const operatorResult=await db.from('resources').select('id,name').eq('organization_id',org).eq('kind','operator').order('name').limit(100);
    if(operatorResult.error)throw operatorResult.error;
    const operators=operatorResult.data;
    const selectedOperator=params.get('operator')||operators[0]?.id||null;
    if(selectedOperator&&!operators.some(o=>o.id===selectedOperator))return NextResponse.json({error:'Choose an operator in this workspace.'},{status:400,headers});
    const assignments=selectedOperator?await db.from('resource_reservations').select('appointment_id',{count:'exact'}).eq('organization_id',org).eq('resource_id',selectedOperator).eq('active',true).in('appointment_id',appointments.data.length?appointments.data.map(a=>a.id):['00000000-0000-4000-8000-000000000000']).range(0,1000):null;
    if(assignments?.error||assignments&&assignments.count!==assignments.data?.length)throw Error('INCOMPLETE_ROUTE_ASSIGNMENTS');
    const assigned=new Set(assignments?.data?.map(a=>a.appointment_id)||[]);
    const calls: DayCall[] = appointments.data
      .filter(
        (a) =>
          (!selectedOperator||assigned.has(a.id))&&
          localDate(new Date(a.arrival_at), company.data.timezone) === date,
      )
      .map((a) => {
        const linked = Array.isArray(a.request) ? a.request[0] : a.request;
        if (!linked?.original_submission) throw Error("INCOMPLETE_ORDER");
        const r = linked.original_submission;
        return {
          id: a.id,
          requestId: a.request_id,
          revision: a.revision,
          startAt: a.start_at,
          arrivalAt: a.arrival_at,
          endAt: a.end_at,
          status: a.status,
          customerResponse: a.customer_response,
          name: r.name || "Customer name needs review",
          phone: r.phone || "",
          email: r.email || "",
          address: [r.street, r.city].filter(Boolean).join(", "),
          tasks: requestedTasks(r),
          workItems: r.services?.length
            ? r.services.map((item: { service: string; task?: string }) => ({
                service: item.service,
                task: item.task || "",
              }))
            : r.service
              ? [{ service: r.service, task: r.task || "" }]
              : [],
          description: r.description || "",
        };
      });
    const selectedWork = [
      ...new Map(
        calls
          .flatMap((call) => call.workItems)
          .map((work) => [workKey(work), work]),
      ).values(),
    ];
    const rules = await db.rpc("read_packing_rules", {
      p_org: org,
      p_work: selectedWork,
    });
    const packingRulesAvailable =
      !rules.error &&
      rules.data?.complete === true &&
      Array.isArray(rules.data.rules);
    const packingRules = packingRulesAvailable
      ? (rules.data.rules as PackingRule[])
      : [];
    return NextResponse.json(
      {
        operators,selectedOperator,
        packing: packingRulesAvailable
          ? buildPackingPlan(calls, packingRules)
          : {
              items: [],
              unmapped: [],
              warnings: [
                "Equipment rules could not be loaded. Refresh before using the packing list.",
              ],
              complete: false,
            },
        packingRules,
        packingRulesAvailable,
        date,
        timezone: company.data.timezone,
        company: company.data.display_name,
        generatedAt: new Date().toISOString(),
        calls,
        route: await buildRoutePlan(calls,googleRouteProvider()),
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
