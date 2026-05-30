import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { ApiError, handleApiError, jsonOk, withUser } from "@/lib/api";
import { refreshGoalTargets } from "@/lib/goals";

/**
 * POST /api/goals/topic-items
 * Updates a topic item's status, notes, or title.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();
    const { itemId, status, notes, title } = body;

    if (!itemId) {
      throw new ApiError("itemId is required.", 400);
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch item to verify parent goal
    const { data: itemData, error: itemErr } = await supabase
      .from("goal_topic_items")
      .select("goal_id")
      .eq("id", itemId)
      .single();

    if (itemErr || !itemData) {
      throw new ApiError("Checklist item not found.", 404);
    }

    const goalId = itemData.goal_id;

    // 2. Verify goal ownership
    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .select("id, status")
      .eq("id", goalId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (goalError || !goal) {
      throw new ApiError("Access denied to this goal.", 403);
    }

    // 3. Prepare payload
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (status !== undefined) payload.status = status;
    if (notes !== undefined) payload.notes = notes;
    if (title !== undefined) payload.title = title;

    // 4. Update the item
    const { data: updatedItem, error: updateErr } = await supabase
      .from("goal_topic_items")
      .update(payload)
      .eq("id", itemId)
      .select("*")
      .single();

    if (updateErr) throw new Error(updateErr.message);

    // 5. Refresh goal target progress values in Supabase
    await refreshGoalTargets(goalId, user.id);

    // 6. Auto-sync parent goal status: if all items completed, set goal to completed. Else set back to active.
    const { data: allItems } = await supabase
      .from("goal_topic_items")
      .select("status, notes")
      .eq("goal_id", goalId);

    if (allItems && allItems.length > 0) {
      let allCompleted = true;
      for (const it of allItems) {
        let isDone = it.status === "completed";
        if (it.notes) {
          try {
            const parsed = JSON.parse(it.notes);
            if (parsed.remaining !== undefined && parsed.remaining > 0) {
              isDone = false;
            }
          } catch (e) {}
        }
        if (!isDone) {
          allCompleted = false;
          break;
        }
      }

      const newGoalStatus = allCompleted ? "completed" : "active";
      if (goal.status !== newGoalStatus) {
        await supabase
          .from("goals")
          .update({ status: newGoalStatus, updated_at: new Date().toISOString() })
          .eq("id", goalId);
      }
    }

    return jsonOk({ item: updatedItem });
  } catch (error) {
    return handleApiError(error);
  }
}
