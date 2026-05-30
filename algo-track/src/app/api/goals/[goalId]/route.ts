import { NextRequest } from "next/server";
import {
  ApiError,
  handleApiError,
  jsonError,
  jsonOk,
  withUser,
} from "@/lib/api";
import { getGoalById, updateGoal, deleteGoal, refreshGoalTargets } from "@/lib/goals";
import { getSupabaseAdmin } from "@/lib/db";

interface RouteContext {
  params: Promise<{ goalId: string }>;
}

/**
 * GET /api/goals/[goalId]
 * Returns a single goal with targets and topic items.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await withUser(request);
    const { goalId } = await context.params;

    const goal = await getGoalById(goalId, user.id);
    if (!goal) {
      return jsonError("Goal not found.", 404);
    }

    return jsonOk({ goal });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/goals/[goalId]
 * Updates a goal's fields (title, description, status, dates, topicItems).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await withUser(request);
    const { goalId } = await context.params;
    const body = await request.json();

    const hasUpdate =
      body?.title !== undefined ||
      body?.description !== undefined ||
      body?.status !== undefined ||
      body?.startDate !== undefined ||
      body?.endDate !== undefined ||
      body?.topicItems !== undefined;

    if (!body || !hasUpdate) {
      throw new ApiError(
        "At least one field is required.",
      );
    }

    const supabase = getSupabaseAdmin();

    // Verify goal ownership
    const { data: dbGoal } = await supabase
      .from("goals")
      .select("id, goal_type")
      .eq("id", goalId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!dbGoal) {
      return jsonError("Goal not found.", 404);
    }

    // 1. Update Core Metadata
    const goalUpdates: any = {};
    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        throw new ApiError("title must be a non-empty string.");
      }
      goalUpdates.title = body.title.trim();
    }
    if (body.description !== undefined) goalUpdates.description = body.description;
    if (body.status !== undefined) goalUpdates.status = body.status;
    if (body.startDate !== undefined) goalUpdates.start_date = body.startDate;
    if (body.endDate !== undefined) goalUpdates.end_date = body.endDate;
    goalUpdates.updated_at = new Date().toISOString();

    const { error: coreError } = await supabase
      .from("goals")
      .update(goalUpdates)
      .eq("id", goalId)
      .eq("user_id", user.id);

    if (coreError) throw coreError;

    // 2. If structured checklist, synchronize tasks/topic items
    if (dbGoal.goal_type === "structured_checklist" && body.topicItems !== undefined && Array.isArray(body.topicItems)) {
      const { data: existingItems } = await supabase
        .from("goal_topic_items")
        .select("id")
        .eq("goal_id", goalId);

      const dbItemIds = (existingItems || []).map((i: any) => i.id);
      const incomingIds: string[] = [];

      for (const item of body.topicItems) {
        const totalNum = Number(item.total || 0);
        const remainingNum = Math.max(0, Math.min(totalNum, Number(item.remaining || 0)));
        
        const itemNotes = JSON.stringify({
          total: totalNum,
          remaining: remainingNum,
          unit: item.unit || "items"
        });
        const itemStatus = remainingNum === 0 ? "completed" : (remainingNum === totalNum ? "not_started" : "in_progress");

        if (item.id && dbItemIds.includes(item.id)) {
          incomingIds.push(item.id);
          const { error: upError } = await supabase
            .from("goal_topic_items")
            .update({
              title: item.title,
              status: itemStatus,
              notes: itemNotes
            })
            .eq("id", item.id);
          if (upError) throw upError;
        } else {
          const { data: newIns, error: insError } = await supabase
            .from("goal_topic_items")
            .insert({
              goal_id: goalId,
              topic_domain: "general",
              topic_id: `general-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              title: item.title,
              status: itemStatus,
              notes: itemNotes
            })
            .select("id")
            .single();
          if (insError) throw insError;
          if (newIns?.id) {
            incomingIds.push(newIns.id);
          }
        }
      }

      // Delete removed items
      const deleteIds = dbItemIds.filter((id: string) => !incomingIds.includes(id));
      if (deleteIds.length > 0) {
        const { error: delError } = await supabase
          .from("goal_topic_items")
          .delete()
          .in("id", deleteIds);
        if (delError) throw delError;
      }

      // Sync aggregate targets
      await refreshGoalTargets(goalId, user.id);
    }

    const goal = await getGoalById(goalId, user.id);
    return jsonOk({ goal });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/goals/[goalId]
 * Deletes a goal and cascades to targets and topic items.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await withUser(request);
    const { goalId } = await context.params;

    const deleted = await deleteGoal(goalId, user.id);
    if (!deleted) {
      return jsonError("Goal not found.", 404);
    }

    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
