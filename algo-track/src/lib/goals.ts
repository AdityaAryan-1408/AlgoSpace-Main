/**
 * Goal CRUD & Progress Engine (Phase 4)
 *
 * Provides full CRUD for goals, goal targets, and goal topic items,
 * plus progress tracking and update logic.
 */

import { getSupabaseAdmin } from "@/lib/db";
import {
  type Goal,
  type GoalTarget,
  type GoalTopicItem,
  type GoalDbRow,
  type GoalTargetDbRow,
  type GoalTopicItemDbRow,
  mapGoalRowToGoal,
  mapGoalTargetRow,
  mapGoalTopicItemRow,
} from "@/types";

// ── Goal CRUD ───────────────────────────────────────────────────

export interface CreateGoalInput {
  title: string;
  description?: string;
  goalType: string;
  status?: string;
  startDate: string;   // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  targets?: Array<{
    metricKey: string;
    targetValue: number;
    unit: string;
    config?: Record<string, unknown>;
  }>;
  topicItems?: Array<{
    topicDomain: string;
    topicId: string;
    title: string;
    deadline?: string | null;
  }>;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * List all goals for a user, optionally filtered by status.
 */
export async function listGoals(
  userId: string,
  status?: string,
): Promise<Goal[]> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const goals = ((data ?? []) as GoalDbRow[]).map(mapGoalRowToGoal);

  // Fetch targets and topic items for each goal
  if (goals.length > 0) {
    const goalIds = goals.map((g) => g.id);

    const [targetsResult, topicItemsResult] = await Promise.all([
      supabase
        .from("goal_targets")
        .select("*")
        .in("goal_id", goalIds),
      supabase
        .from("goal_topic_items")
        .select("*")
        .in("goal_id", goalIds),
    ]);

    if (targetsResult.error) throw new Error(targetsResult.error.message);
    if (topicItemsResult.error) throw new Error(topicItemsResult.error.message);

    const targetsByGoal = new Map<string, GoalTarget[]>();
    for (const row of (targetsResult.data ?? []) as GoalTargetDbRow[]) {
      const mapped = mapGoalTargetRow(row);
      const arr = targetsByGoal.get(mapped.goalId) ?? [];
      arr.push(mapped);
      targetsByGoal.set(mapped.goalId, arr);
    }

    const topicsByGoal = new Map<string, GoalTopicItem[]>();
    for (const row of (topicItemsResult.data ?? []) as GoalTopicItemDbRow[]) {
      const mapped = mapGoalTopicItemRow(row);
      const arr = topicsByGoal.get(mapped.goalId) ?? [];
      arr.push(mapped);
      topicsByGoal.set(mapped.goalId, arr);
    }

    for (const goal of goals) {
      goal.targets = targetsByGoal.get(goal.id) ?? [];
      goal.topicItems = topicsByGoal.get(goal.id) ?? [];
    }
  }

  return goals;
}

/**
 * Get a single goal by ID, including targets and topic items.
 */
export async function getGoalById(
  goalId: string,
  userId: string,
): Promise<Goal | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const goal = mapGoalRowToGoal(data as GoalDbRow);

  // Fetch targets and topic items in parallel
  const [targetsResult, topicItemsResult] = await Promise.all([
    supabase
      .from("goal_targets")
      .select("*")
      .eq("goal_id", goalId),
    supabase
      .from("goal_topic_items")
      .select("*")
      .eq("goal_id", goalId)
      .order("created_at", { ascending: true }),
  ]);

  if (targetsResult.error) throw new Error(targetsResult.error.message);
  if (topicItemsResult.error) throw new Error(topicItemsResult.error.message);

  goal.targets = ((targetsResult.data ?? []) as GoalTargetDbRow[]).map(
    mapGoalTargetRow,
  );
  goal.topicItems = ((topicItemsResult.data ?? []) as GoalTopicItemDbRow[]).map(
    mapGoalTopicItemRow,
  );

  return goal;
}

/**
 * Create a new goal with optional targets and topic items.
 */
export async function createGoal(
  userId: string,
  input: CreateGoalInput,
): Promise<Goal> {
  const supabase = getSupabaseAdmin();

  // Insert the goal
  const { data: goalData, error: goalError } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description ?? "",
      goal_type: input.goalType,
      status: input.status ?? "active",
      start_date: input.startDate,
      end_date: input.endDate,
    })
    .select("id")
    .single();

  if (goalError) throw new Error(goalError.message);
  const goalId = goalData.id as string;

  // Insert targets if provided
  if (input.targets && input.targets.length > 0) {
    const targetRows = input.targets.map((t) => ({
      goal_id: goalId,
      metric_key: t.metricKey,
      target_value: t.targetValue,
      current_value: 0,
      unit: t.unit,
      config: t.config ?? {},
    }));

    const { error: targetsError } = await supabase
      .from("goal_targets")
      .insert(targetRows);

    if (targetsError) throw new Error(targetsError.message);
  }

  // Insert topic items if provided
  if (input.topicItems && input.topicItems.length > 0) {
    const topicRows = input.topicItems.map((t) => ({
      goal_id: goalId,
      topic_domain: t.topicDomain,
      topic_id: t.topicId,
      title: t.title,
      status: "not_started",
      deadline: t.deadline ?? null,
      notes: "",
    }));

    const { error: topicError } = await supabase
      .from("goal_topic_items")
      .insert(topicRows);

    if (topicError) throw new Error(topicError.message);
  }

  return (await getGoalById(goalId, userId))!;
}

/**
 * Update a goal's core fields (title, description, status, dates).
 */
export async function updateGoal(
  goalId: string,
  userId: string,
  updates: UpdateGoalInput,
): Promise<Goal | null> {
  const supabase = getSupabaseAdmin();

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.startDate !== undefined) payload.start_date = updates.startDate;
  if (updates.endDate !== undefined) payload.end_date = updates.endDate;

  const { data, error } = await supabase
    .from("goals")
    .update(payload)
    .eq("id", goalId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return getGoalById(goalId, userId);
}

/**
 * Delete a goal and its related targets/topic items (cascade).
 */
export async function deleteGoal(
  goalId: string,
  userId: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("goals")
    .delete()
    .eq("id", goalId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data !== null;
}

// ── Goal Target Management ──────────────────────────────────────

/**
 * Update current_value on a specific goal target.
 */
export async function updateGoalTargetValue(
  targetId: string,
  goalId: string,
  userId: string,
  currentValue: number,
): Promise<GoalTarget | null> {
  const supabase = getSupabaseAdmin();

  // Verify ownership
  const { data: goal } = await supabase
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!goal) return null;

  const { data, error } = await supabase
    .from("goal_targets")
    .update({ current_value: currentValue })
    .eq("id", targetId)
    .eq("goal_id", goalId)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapGoalTargetRow(data as GoalTargetDbRow);
}

// ── Goal Topic Item Management ──────────────────────────────────

/**
 * Update a topic item's status within a goal.
 */
export async function updateGoalTopicItemStatus(
  itemId: string,
  goalId: string,
  userId: string,
  status: string,
  notes?: string,
): Promise<GoalTopicItem | null> {
  const supabase = getSupabaseAdmin();

  // Verify ownership
  const { data: goal } = await supabase
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!goal) return null;

  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (notes !== undefined) payload.notes = notes;

  const { data, error } = await supabase
    .from("goal_topic_items")
    .update(payload)
    .eq("id", itemId)
    .eq("goal_id", goalId)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapGoalTopicItemRow(data as GoalTopicItemDbRow);
}

// ── Auto-Refresh Progress Targets ───────────────────────────────

/**
 * Recompute current_value for all targets of a goal based on live data.
 * Call this after reviews, new cards, etc.
 */
export async function refreshGoalTargets(
  goalId: string,
  userId: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Fetch goal dates
  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("start_date, end_date, goal_type")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (goalError) throw new Error(goalError.message);
  if (!goal) return;

  // Fetch targets
  const { data: targets, error: targetsError } = await supabase
    .from("goal_targets")
    .select("id, metric_key")
    .eq("goal_id", goalId);

  if (targetsError) throw new Error(targetsError.message);
  if (!targets || targets.length === 0) return;

  // Fetch cards in goal window
  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, last_rating, solved_at, topic_ids, tags")
    .eq("user_id", userId);

  if (cardsError) throw new Error(cardsError.message);

  const allCards = (cards ?? []) as Array<{
    id: string;
    last_rating: string | null;
    solved_at: string | null;
    topic_ids: string[] | null;
    tags: string[] | null;
  }>;

  // Cards solved within goal window
  const startDate = goal.start_date as string;
  const endDate = goal.end_date as string;
  const solvedInWindow = allCards.filter(
    (c) =>
      c.solved_at != null &&
      c.solved_at >= startDate &&
      c.solved_at <= endDate,
  );

  const retainedWell = solvedInWindow.filter(
    (c) => c.last_rating === "GOOD" || c.last_rating === "EASY",
  );

  // Fetch topic items for completion counting
  const { data: topicItems } = await supabase
    .from("goal_topic_items")
    .select("status")
    .eq("goal_id", goalId);

  const completedTopics = ((topicItems ?? []) as Array<{ status: string }>).filter(
    (t) => t.status === "completed",
  ).length;

  // Update each target
  for (const target of targets as Array<{ id: string; metric_key: string }>) {
    let newValue = 0;

    switch (target.metric_key) {
      case "problems_solved":
        newValue = solvedInWindow.length;
        break;
      case "retained_pct":
        newValue =
          solvedInWindow.length > 0
            ? Math.round(
                (retainedWell.length / solvedInWindow.length) * 100,
              )
            : 0;
        break;
      case "topics_completed":
        newValue = completedTopics;
        break;
      default:
        // Unknown metric, skip
        continue;
    }

    await supabase
      .from("goal_targets")
      .update({ current_value: newValue })
      .eq("id", target.id);
  }
}
