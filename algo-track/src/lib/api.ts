import { NextRequest, NextResponse } from "next/server";
import { ensureUserByEmail, resolveUserEmail } from "@/lib/user";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      error: message,
      ...(details ? { details } : {}),
    },
    { status },
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof SyntaxError) {
    return jsonError("Invalid JSON body.", 400);
  }

  if (error instanceof Error) {
    return jsonError(error.message, 500);
  }

  return jsonError("Unexpected server error.", 500);
}

export async function withUser(request: NextRequest) {
  const email = resolveUserEmail(request);
  if (!email) {
    throw new ApiError("User email is required.", 400);
  }

  const user = await ensureUserByEmail(email);
  if (!user?.id) {
    throw new ApiError("Unable to resolve user.", 500);
  }

  return user;
}

export function parseJsonBody<T>(body: T | null | undefined, fallback: T): T {
  return body ?? fallback;
}

export function toStringArray(value: unknown, fieldName: string) {
  if (value == null) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ApiError(`${fieldName} must be an array of strings.`, 400);
  }
  return value;
}

export function assertCronAuthorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    throw new ApiError("CRON_SECRET is not configured.", 500);
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError("Unauthorized.", 401);
  }

  const provided = authHeader.slice("Bearer ".length).trim();
  if (!provided || provided !== expected) {
    throw new ApiError("Unauthorized.", 401);
  }
}
