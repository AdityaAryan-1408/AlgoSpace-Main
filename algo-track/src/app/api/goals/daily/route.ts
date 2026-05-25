import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";
import { ApiError, handleApiError, jsonOk, withUser } from "@/lib/api";
import { updateGoalTopicItemStatus } from "@/lib/goals";

// GET /api/goals/daily?date=YYYY-MM-DD
// OR GET /api/goals/daily?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    const user = await withUser(request);
    const date = request.nextUrl.searchParams.get("date");
    const startDate = request.nextUrl.searchParams.get("startDate");
    const endDate = request.nextUrl.searchParams.get("endDate");

    const supabase = getSupabaseAdmin();

    // 1. Fetch range of dates for visual calendar indicators (e.g., active week)
    if (startDate && endDate) {
      const { data: goals, error: goalsError } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("goal_type", "custom_checklist")
        .gte("start_date", startDate)
        .lte("start_date", endDate);

      if (goalsError) throw new Error(goalsError.message);
      if (!goals || goals.length === 0) {
        return jsonOk({ checklists: {} });
      }

      const goalIds = goals.map((g) => g.id);
      const { data: items, error: itemsError } = await supabase
        .from("goal_topic_items")
        .select("*")
        .in("goal_id", goalIds);

      if (itemsError) throw new Error(itemsError.message);

      // Group items by goal_id
      const itemsByGoal = new Map<string, any[]>();
      items?.forEach((item) => {
        const arr = itemsByGoal.get(item.goal_id) ?? [];
        arr.push(item);
        itemsByGoal.set(item.goal_id, arr);
      });

      const checklists: Record<string, { goal: any; items: any[] }> = {};
      goals.forEach((goal) => {
        checklists[goal.start_date] = {
          goal,
          items: itemsByGoal.get(goal.id) ?? [],
        };
      });

      return jsonOk({ checklists });
    }

    // 2. Fetch single date details
    if (!date) {
      throw new ApiError("Either date or (startDate AND endDate) parameters are required.");
    }

    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("goal_type", "custom_checklist")
      .eq("start_date", date)
      .maybeSingle();

    if (goalError) throw new Error(goalError.message);
    if (!goal) {
      return jsonOk({ goal: null, items: [] });
    }

    const { data: items, error: itemsError } = await supabase
      .from("goal_topic_items")
      .select("*")
      .eq("goal_id", goal.id)
      .order("created_at", { ascending: true });

    if (itemsError) throw new Error(itemsError.message);

    return jsonOk({ goal, items });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/goals/daily
// Handles adding a new item, or toggling completion of an existing item
export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();
    const { date, title, status, itemId } = body;

    const supabase = getSupabaseAdmin();

    // 1. Update status or title if itemId is provided
    if (itemId) {
      // Find the goal first to verify ownership
      const { data: itemData, error: itemErr } = await supabase
        .from("goal_topic_items")
        .select("goal_id")
        .eq("id", itemId)
        .single();

      if (itemErr || !itemData) {
        throw new ApiError("Item not found.");
      }

      // Verify goal ownership
      const { data: goal, error: goalError } = await supabase
        .from("goals")
        .select("id")
        .eq("id", itemData.goal_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (goalError || !goal) {
        throw new ApiError("Goal access denied.");
      }

      const updatePayload: any = {
        updated_at: new Date().toISOString()
      };
      if (status !== undefined) {
        updatePayload.status = status;
      }
      if (title !== undefined) {
        if (!title.trim()) {
          throw new ApiError("title cannot be empty.");
        }
        updatePayload.title = title.trim();
      }

      const { data: updatedItem, error: updateError } = await supabase
        .from("goal_topic_items")
        .update(updatePayload)
        .eq("id", itemId)
        .select("*")
        .single();

      if (updateError) throw new Error(updateError.message);

      // Automatically sync parent checklist goal status
      const { data: allItems } = await supabase
        .from("goal_topic_items")
        .select("status")
        .eq("goal_id", itemData.goal_id);

      if (allItems && allItems.length > 0) {
        const allCompleted = allItems.every((it) => it.status === "completed");
        const newGoalStatus = allCompleted ? "completed" : "active";
        await supabase
          .from("goals")
          .update({ status: newGoalStatus })
          .eq("id", itemData.goal_id);
      }

      return jsonOk({ updated: updatedItem });
    }

    // 2. Add a new item to checklist
    if (!date) {
      throw new ApiError("date is required (YYYY-MM-DD) to add an item.");
    }
    if (!title || !title.trim()) {
      throw new ApiError("title is required to add an item.");
    }

    // Find or create daily checklist goal for this date
    let { data: goal, error: goalError } = await supabase
      .from("goals")
      .select("id")
      .eq("user_id", user.id)
      .eq("goal_type", "custom_checklist")
      .eq("start_date", date)
      .maybeSingle();

    if (goalError) throw new Error(goalError.message);

    let goalId = goal?.id;

    if (!goalId) {
      // Create new daily checklist goal
      const { data: newGoal, error: newGoalError } = await supabase
        .from("goals")
        .insert({
          user_id: user.id,
          title: `Daily Checklist: ${date}`,
          description: "Custom daily checklist items",
          goal_type: "custom_checklist",
          status: "active",
          start_date: date,
          end_date: date,
        })
        .select("id")
        .single();

      if (newGoalError) throw new Error(newGoalError.message);
      goalId = newGoal.id;
    } else {
      // If goal already exists, reset its status to active when adding a new item
      await supabase
        .from("goals")
        .update({ status: "active" })
        .eq("id", goalId);
    }

    // Insert new item in goal_topic_items
    const { data: newItem, error: newItemError } = await supabase
      .from("goal_topic_items")
      .insert({
        goal_id: goalId,
        topic_domain: "custom",
        topic_id: `item-${Date.now()}`,
        title: title.trim(),
        status: "not_started",
        deadline: date,
      })
      .select("*")
      .single();

    if (newItemError) throw new Error(newItemError.message);

    return jsonOk({ item: newItem, goalId });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/goals/daily
// Deletes a checklist item. If the goal becomes empty, deletes the goal.
export async function DELETE(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();
    const { itemId, goalId } = body;

    if (!itemId || !goalId) {
      throw new ApiError("itemId and goalId are required.");
    }

    const supabase = getSupabaseAdmin();

    // Verify goal ownership
    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .select("id")
      .eq("id", goalId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (goalError || !goal) {
      throw new ApiError("Goal not found or access denied.");
    }

    // Delete item
    const { error: deleteError } = await supabase
      .from("goal_topic_items")
      .delete()
      .eq("id", itemId)
      .eq("goal_id", goalId);

    if (deleteError) throw new Error(deleteError.message);

    // Check if any items are left in the checklist
    const { count, error: countError } = await supabase
      .from("goal_topic_items")
      .select("id", { count: "exact", head: true })
      .eq("goal_id", goalId);

    if (countError) throw new Error(countError.message);

    if (count === 0) {
      // Delete the empty goal
      await supabase.from("goals").delete().eq("id", goalId);
      return jsonOk({ deleted: true, goalDeleted: true });
    }

    // Automatically sync parent checklist goal status on item deletion
    const { data: remainingItems } = await supabase
      .from("goal_topic_items")
      .select("status")
      .eq("goal_id", goalId);

    if (remainingItems && remainingItems.length > 0) {
      const allCompleted = remainingItems.every((it) => it.status === "completed");
      const newGoalStatus = allCompleted ? "completed" : "active";
      await supabase
        .from("goals")
        .update({ status: newGoalStatus })
        .eq("id", goalId);
    }

    return jsonOk({ deleted: true, goalDeleted: false });
  } catch (error) {
    return handleApiError(error);
  }
}
