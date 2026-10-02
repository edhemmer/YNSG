import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, failure } from "../../../lib/session";
export async function GET(request: Request) {
  try {
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .parse(new URL(request.url).searchParams.get("page") || 0);
    const { db } = await authenticated();
    const r = await db.rpc("platform_owner_accounts", { p_page: page });
    if (r.error)
      return NextResponse.json(
        { error: "Developer administrator verification is required." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    return NextResponse.json(
      { owners: r.data.slice(0, 50), hasMore: r.data.length > 50, page },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
