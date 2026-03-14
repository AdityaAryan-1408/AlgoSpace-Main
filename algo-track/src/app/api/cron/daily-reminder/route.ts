import { NextRequest } from "next/server";
import {
  assertCronAuthorized,
  handleApiError,
  jsonOk,
} from "@/lib/api";
import { runDailyReminderJob } from "@/lib/reminder";

export async function POST(request: NextRequest) {
  try {
    assertCronAuthorized(request);
    const result = await runDailyReminderJob();
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
