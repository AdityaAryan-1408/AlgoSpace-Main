import { NextRequest } from "next/server";
import { ApiError, handleApiError, jsonOk, withUser } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/db";
import { mapCardRowToFlashcard } from "@/lib/cards";

interface RouteContext {
  params: Promise<{ cardId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await withUser(request);
    const { cardId } = await context.params;
    const body = await request.json();

    const action = body?.action;
    if (action !== "pause" && action !== "resume") {
      throw new ApiError('action must be "pause" or "resume".', 400);
    }

    const supabase = getSupabaseAdmin();

    // Fetch current card to merge metadata
    const { data: existingCard, error: fetchError } = await supabase
      .from("cards")
      .select("*")
      .eq("user_id", user.id)
      .eq("id", cardId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!existingCard) {
      throw new ApiError("Card not found.", 404);
    }

    const currentMetadata = (existingCard.metadata as Record<string, unknown>) || {};

    if (action === "pause") {
      const updatedMetadata = {
        ...currentMetadata,
        review_paused: true,
        review_paused_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("cards")
        .update({
          metadata: updatedMetadata,
          next_review_at: "9999-12-31T23:59:59.999Z",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("id", cardId);

      if (error) throw new Error(error.message);
    } else {
      // Resume
      const resumeInDays = body?.resumeInDays;
      if (
        resumeInDays == null ||
        typeof resumeInDays !== "number" ||
        !Number.isFinite(resumeInDays) ||
        resumeInDays < 1
      ) {
        throw new ApiError("resumeInDays must be a positive integer.", 400);
      }

      const { review_paused, review_paused_at, ...restMetadata } = currentMetadata;
      void review_paused;
      void review_paused_at;

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + resumeInDays);

      const { error } = await supabase
        .from("cards")
        .update({
          metadata: restMetadata,
          next_review_at: nextDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("id", cardId);

      if (error) throw new Error(error.message);
    }

    // Return the updated card
    const { data: updatedRow, error: refetchError } = await supabase
      .from("cards")
      .select("*")
      .eq("user_id", user.id)
      .eq("id", cardId)
      .maybeSingle();

    if (refetchError) throw new Error(refetchError.message);
    if (!updatedRow) throw new ApiError("Card not found after update.", 500);

    const card = mapCardRowToFlashcard(updatedRow);
    return jsonOk({ card });
  } catch (error) {
    return handleApiError(error);
  }
}
