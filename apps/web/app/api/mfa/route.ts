import { NextResponse } from "next/server";
// Authenticator enrollment is removed from this app. Email identity verification remains required.
export async function POST() {
  return NextResponse.json({ error: "Authenticator setup is no longer used. Sign in with your email." }, {
    status: 410, headers: { "Cache-Control": "no-store" },
  });
}
