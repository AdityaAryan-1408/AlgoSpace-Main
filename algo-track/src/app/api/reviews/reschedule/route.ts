import { NextRequest } from "next/server";
import { ApiError, handleApiError, jsonOk, withUser } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();

    if (
      body?.days == null ||
      typeof body.days !== "number" ||
      !Number.isFinite(body.days) ||
      body.days < 1
    ) {
      throw new ApiError("days must be a positive integer.", 400);
    }

    const supabase = getSupabaseAdmin();
    const now = new Date();
    const endOfDayIso = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
    ).toISOString();

    const nextDate = new Date(now);
    nextDate.setDate(nextDate.getDate() + body.days);

    const { error } = await supabase
      .from("cards")
      .update({
        next_review_at: nextDate.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("user_id", user.id)
      .lte("next_review_at", endOfDayIso);

    if (error) {
      throw new Error(error.message);
    }

    return jsonOk({ success: true, rescheduledTo: nextDate.toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}
