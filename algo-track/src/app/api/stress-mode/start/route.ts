import { NextRequest } from "next/server";
import { handleApiError, jsonOk, withUser } from "@/lib/api";
import { getStressModeCandidates } from "@/lib/analytics-engine";
import { getSupabaseAdmin } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();
    const limit = body.limit || 3;

    // 1. Get candidates
    const candidates = await getStressModeCandidates(user.id, limit);
    
    if (candidates.length === 0) {
      return jsonOk({ sessionId: null, message: "No due cards for Stress Mode right now!" });
    }

    // 2. Create session in DB
    const supabase = getSupabaseAdmin();
    const { data: sessionData, error: sessionError } = await supabase
      .from("stress_mode_sessions")
      .insert({
        user_id: user.id,
        total_cards: candidates.length,
        status: "active"
      })
      .select()
      .single();

    if (sessionError) throw new Error(sessionError.message);

    // 3. Link candidates
    const sessionCards = candidates.map((c, i) => ({
      session_id: sessionData.id,
      card_id: c.id,
      presented_order: i
    }));

    const { error: cardsError } = await supabase
      .from("stress_mode_session_cards")
      .insert(sessionCards);

    if (cardsError) throw new Error(cardsError.message);

    return jsonOk({ 
      sessionId: sessionData.id, 
      candidates 
    });
  } catch (error) {
    return handleApiError(error);
  }
}
