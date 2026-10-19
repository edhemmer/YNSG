import { NextResponse } from "next/server";
import { authenticated, failure } from "../../../lib/session";
import { z } from "zod";
import {portalAccess,portalPage} from "../../../lib/customer-portal-contract";
export async function GET(request: Request) {
  try {
    const { db, user } = await authenticated();
    const query=z.object({organization:z.uuid().optional(),page:z.coerce.number().int().min(0).max(10000).default(0)}).strict().safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if(!query.success)return NextResponse.json({error:'Choose a valid business and history page.'},{status:400,headers:{'Cache-Control':'private, no-store'}});
    const org=query.data.organization,page=query.data.page;
    const access = await db
      .from("customer_access")
      .select("organization_id,customer_id,can_view_billing,can_approve",{count:"exact"})
      .eq("user_id", user.id).limit(1000);
    if (access.error||!access.data||access.count!==access.data.length) throw Error("UNVERIFIED");
    const companies = await db
      .from("organizations")
      .select("id,display_name,timezone",{count:"exact"}).limit(1000);
    if (companies.error||!companies.data||companies.count!==companies.data.length) throw Error("UNVERIFIED");
    if (!org)
      return NextResponse.json(
        portalAccess.parse({ email: user.email, access: access.data, companies: companies.data }),
        { headers: { "Cache-Control": "no-store" } },
      );
    portalAccess.parse({email:user.email,access:access.data,companies:companies.data});
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
        .select("id,display_name",{count:"exact"})
        .eq("organization_id", org)
        .in("id", ids).limit(1000),
      db
        .from("properties")
        .select("id,street,city,region,postal_code",{count:"exact"})
        .eq("organization_id", org)
        .in("customer_id", ids).limit(1000),
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
        .select("id,number,total_cents,issued_at")
        .eq("organization_id", org)
        .in("customer_id", ids)
        .order("issued_at", { ascending: false })
        .order("id")
        .range(from, from + 20),
    ]);
    if (results.some((r) => r.error||!Array.isArray(r.data))) throw new Error("FAILED");
    if(results.slice(0,2).some(r=>!r.data||r.count!==r.data.length))throw Error("UNVERIFIED");
    const invoices=results[4].data?.slice(0,20)||[];
    const invoiceIds=invoices.map(i=>i.id);
    const payments=invoiceIds.length?await db.from("payments").select("id,invoice_id,cents",{count:"exact"}).eq("organization_id",org).in("invoice_id",invoiceIds).range(0,9999):{data:[],count:0,error:null};
    const paymentRows=z.array(z.object({id:z.uuid(),invoice_id:z.uuid(),cents:z.number().int().min(-999999999).max(999999999)}).strict()).max(10000).parse(payments.data);
    if(payments.error||payments.count!==paymentRows.length||new Set(paymentRows.map(p=>p.id)).size!==paymentRows.length||paymentRows.some(p=>!invoiceIds.includes(p.invoice_id)))throw Error("UNVERIFIED");
    // Staff using their customer account must not inherit the whole business calendar.
    // Empty embedded scopes restrict parent rows through either linked customer relation.
    const appts = await db
      .from("appointments")
      .select("id,start_at,end_at,arrival_at,status,timezone,customer_response,job_scope:jobs(),request_scope:service_requests()")
      .in("job_scope.customer_id",ids)
      .in("request_scope.customer_id",ids)
      .or("job_scope.not.is.null,request_scope.not.is.null")
      .eq("organization_id", org)
      .order("start_at", { ascending: false })
      .order("id")
      .range(from, from + 20);
    if (appts.error||!Array.isArray(appts.data)||appts.data.length>21||results.slice(2).some(r=>r.data!.length>21)) throw Error("UNVERIFIED");
    const currentAccess=await db.from("customer_access").select("organization_id,customer_id,can_view_billing,can_approve",{count:"exact"}).eq("user_id",user.id).eq("organization_id",org).limit(1000);
    const accessShape=z.array(z.object({organization_id:z.uuid(),customer_id:z.uuid(),can_view_billing:z.boolean(),can_approve:z.boolean()}).strict()).max(1000).parse(currentAccess.data);
    const signature=(rows:typeof accessShape)=>rows.map(a=>[a.organization_id,a.customer_id,a.can_view_billing,a.can_approve].join(':')).sort().join('|');
    if(currentAccess.error||currentAccess.count!==accessShape.length||signature(accessShape)!==signature(relationships))throw Error("UNVERIFIED");
    const hasMore = results.slice(2).some((r) => (r.data?.length || 0) > 20) || (appts.data?.length || 0) > 20;
    return NextResponse.json(
      portalPage.parse({
        organization:org,
        company: companies.data.find((c) => c.id === org),
        customers: results[0].data,
        properties: results[1].data,
        requests: results[2].data?.slice(0, 20),
        jobs: results[3].data?.slice(0, 20),
        invoices: invoices.map(i=>({...i,payments:paymentRows.filter(p=>p.invoice_id===i.id).map(p=>({cents:p.cents}))})),
        appointments: appts.data?.slice(0, 20),
        page,
        hasMore,
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if(e instanceof Error&&e.message==="UNAUTHORIZED")return failure(e);
    return NextResponse.json({error:"Your complete account history could not be verified. Please try again."},{status:503,headers:{"Cache-Control":"private, no-store"}});
  }
}
