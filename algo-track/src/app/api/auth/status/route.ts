import { NextResponse } from "next/server";

export async function GET() {
  const appPassword = process.env.APP_PASSWORD;
  const passwordRequired = !!(appPassword && appPassword.trim().length > 0);

  return NextResponse.json({ passwordRequired });
}
