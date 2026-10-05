import { NextResponse } from "next/server";
import { z } from "zod";
import {companyBrand} from "../../../lib/company-brand";
import { authenticated, failure } from "../../../lib/session";
export async function GET(request: Request) {
  try {
    const { db } = await authenticated();
    const org = z
      .uuid()
      .parse(new URL(request.url).searchParams.get("organization"));
    const page=z.coerce.number().int().min(0).max(100000).parse(new URL(request.url).searchParams.get('page')||0);
    const from=page*50,to=from+50;
    const appointmentFrom=new Date(Date.now()-24*60*60*1000).toISOString();
    const selectedRequest=new URL(request.url).searchParams.get('request');
    if(selectedRequest)z.uuid().parse(selectedRequest);
    const requestQuery=db.from('service_requests').select('id,status,revision,created_at,original_submission').eq('organization_id',org);
    const appointmentQuery=db.from('appointments').select('id,request_id,status,revision,start_at,end_at,arrival_at,expires_at,replaces_id,customer_response').eq('organization_id',org).not('request_id','is',null);
    const results = await Promise.all([
      db
        .from("organizations")
        .select("id,display_name,timezone,status")
        .eq("id", org)
        .maybeSingle(),
      selectedRequest?requestQuery.eq('id',selectedRequest):requestQuery.order('created_at',{ascending:false}).order('id').range(from,to),
      db
        .from("customers")
        .select("id,display_name")
        .eq("organization_id", org)
        .order("display_name").order("id")
        .range(from,to),
      db
        .from("quotes")
        .select(
          "id,customer_id,current_version,revision,status,quote_versions(version,scope,labor_cents,duration_minutes)",
        )
        .eq("organization_id", org)
        .order("id")
        .range(from,to),
      db
        .from("jobs")
        .select("id,customer_id,quote_id,status,revision,invoices(id,number)")
        .eq("organization_id", org)
        .order("id")
        .range(from,to),
      db
        .from("invoices")
        .select("id,job_id,number,total_cents,issued_at,payments(cents)")
        .eq("organization_id", org)
        .order("id")
        .range(from,to),
      db
        .from("outbox")
        .select("id,kind,status,created_at")
        .eq("organization_id", org)
        .order("created_at", { ascending: false }).order("id")
        .range(from,to),
      (selectedRequest?appointmentQuery.eq('request_id',selectedRequest):appointmentQuery.gte('end_at',appointmentFrom)).order('start_at').order('id').range(from,to),
      db.from('customer_schedule_preferences').select('id,request_id,appointment_id,appointment_revision,response_version,preferred_local_start,timezone,note,status,created_at').eq('organization_id',org).eq('status','pending').order('created_at',{ascending:false}).order('id').range(from,to),
      db.from('configuration_versions').select('settings').eq('organization_id',org).order('version',{ascending:false}).limit(1).maybeSingle(),
    ]);
    if (results.some((r) => r.error)) throw new Error("FAILED");
    if (!results[0]!.data)
      return NextResponse.json(
        {
          error: "Select a company you have permission to manage.",

        },
        { status: 403 },
      );
    const ready=await db.rpc('production_workflows_ready',{p_org:org});
    const hasMore=results.slice(1).some(r=>Array.isArray(r.data)&&r.data.length>50);
    for(const result of results.slice(1))if(Array.isArray(result.data))result.data=result.data.slice(0,50);
    return NextResponse.json(
      {
        pagination:{page,hasMore,appointmentFrom},
        features:{productionWorkflows:!ready.error&&ready.data===true},
        brand: companyBrand(results[9]!.data?.settings?.brand),
        company: results[0]!.data,
        requests: results[1]!.data,
        customers: results[2]!.data,
        quotes: results[3]!.data,
        jobs: results[4]!.data,
        invoices: results[5]!.data,
        outbox: results[6]!.data,
        appointments: results[7]!.data,
        schedulingPreferences: results[8]!.data,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
