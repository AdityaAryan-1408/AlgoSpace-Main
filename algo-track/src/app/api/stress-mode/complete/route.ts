import { NextRequest } from "next/server";
import { handleApiError, jsonOk, withUser } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();
    const { sessionId, status, durationMs, cardsCompleted, results } = body;

    // results is array of { cardId, rating, timeSpentMs }

    const supabase = getSupabaseAdmin();

    // 1. Update session status
    const { error: sessionError } = await supabase
      .from("stress_mode_sessions")
      .update({
        status, 
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        cards_completed: cardsCompleted,
      })
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (sessionError) throw new Error(sessionError.message);

    // 2. Update individual session cards
    if (results && results.length > 0) {
      for (const res of results) {
        await supabase
          .from("stress_mode_session_cards")
          .update({
            completed_at: new Date().toISOString(),
            rating: res.rating,
            time_spent_ms: res.timeSpentMs
          })
          .eq("session_id", sessionId)
          .eq("card_id", res.cardId);
      }
    }

    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
