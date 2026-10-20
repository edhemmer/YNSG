import {NextResponse} from "next/server";
import {authenticated,failure} from "../../../lib/session";
import {recordOwnerSessionIp} from "../../../lib/owner-security";
import {handleSessionPost} from "../../../lib/auth-session-handler";
export async function POST(request:Request){return handleSessionPost(request);}
export async function GET(request:Request) {
  try {
    const { db, user } = await authenticated();
    const { data, error } = await db
      .from("memberships")
      .select("organization_id,role")
      .eq("user_id", user.id)
      .is("revoked_at", null);
    if (error) throw error;
    for(const m of data||[])
      if(['owner','admin'].includes(m.role))
        await recordOwnerSessionIp(db,request,m.organization_id);
    return NextResponse.json(
      { email: user.email, memberships: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
