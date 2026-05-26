import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const password = body?.password;

    if (typeof password !== "string" || !password.trim()) {
      return NextResponse.json(
        { error: "Password is required." },
        { status: 400 },
      );
    }

    const appPassword = process.env.APP_PASSWORD;

    // If no password is configured, always succeed
    if (!appPassword || !appPassword.trim()) {
      return NextResponse.json({ success: true });
    }

    if (password.trim() !== appPassword.trim()) {
      return NextResponse.json(
        { error: "Incorrect password." },
        { status: 401 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
}
