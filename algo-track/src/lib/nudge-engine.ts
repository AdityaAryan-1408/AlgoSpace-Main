/**
 * Smart Goal Pacing & Nudges Engine (Phase 5)
 *
 * Generates intelligent, operational nudges based on:
 *   - Goal progress and pacing analysis
 *   - Weakness data (retention gaps)
 *   - Overdue topic items
 *   - Separation of solve vs review targets
 *
 * Nudge policy (from IMPLEMENTATION_PLAN):
 *   - Avoid generic guilt messages
 *   - Be operational: tell the user exactly what to do
 *   - Separate solve targets from review targets
 *   - Reference specific topics/cards when possible
 */

import { getSupabaseAdmin } from "@/lib/db";
import {
  getGoalProgress,
  getGoalPacing,
  getWeaknessAnalysis,
  type GoalProgressMetrics,
  type GoalPacingMetrics,
  type WeakSpot,
} from "@/lib/analytics-engine";

// ── Types ───────────────────────────────────────────────────────

export type NudgePriority = "info" | "warning" | "critical";
export type NudgeCategory =
  | "solve_pace"
  | "review_pace"
  | "retention"
  | "topic_overdue"
  | "topic_neglected"
  | "celebration"
  | "recovery";

export interface SmartNudge {
  /** Unique key for deduplication */
  id: string;
  /** Which goal this relates to (null = general) */
  goalId: string | null;
  /** Category for UI grouping/icon */
  category: NudgeCategory;
  /** Display priority */
  priority: NudgePriority;
  /** Human-readable, actionable nudge text */
  message: string;
  /** Optional: what metric this relates to */
  metricKey?: string;
  /** Optional: numeric value for progress bar/badge */
  value?: number;
}

export interface GoalPacingReport {
  goalId: string;
  goalTitle: string;
  progress: GoalProgressMetrics;
  pacing: GoalPacingMetrics | null;
  nudges: SmartNudge[];
}

export interface SmartNudgesResult {
  goals: GoalPacingReport[];
  generalNudges: SmartNudge[];
  totalNudges: number;
}

// ── Main Entry Point ────────────────────────────────────────────

/**
 * Generate all smart nudges for a user's active goals.
 * Combines goal-specific pacing nudges with general retention nudges.
 */
export async function getSmartNudges(
  userId: string,
): Promise<SmartNudgesResult> {
  const supabase = getSupabaseAdmin();

  // 1. Fetch active goals
  const { data: goalsData, error: goalsError } = await supabase
    .from("goals")
    .select("id, title, goal_type, start_date, end_date, status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (goalsError) throw new Error(goalsError.message);

  const activeGoals = (goalsData ?? []) as Array<{
    id: string;
    title: string;
    goal_type: string;
    start_date: string;
    end_date: string;
    status: string;
  }>;

  // 2. In parallel: get weakness analysis + goal metrics
  const [weakness, ...goalResults] = await Promise.all([
    getWeaknessAnalysis(userId, 14),
    ...activeGoals.map(async (goal) => {
      const [progress, pacing] = await Promise.all([
        getGoalProgress(goal.id, userId),
        getGoalPacing(goal.id, userId),
      ]);
      return { goal, progress, pacing };
    }),
  ]);

  // 3. Fetch overdue topic items across all active goals
  const goalIds = activeGoals.map((g) => g.id);
  let overdueTopicItems: Array<{
    goal_id: string;
    topic_id: string;
    title: string;
    deadline: string | null;
    status: string;
  }> = [];

  if (goalIds.length > 0) {
    const { data: topicItems, error: topicError } = await supabase
      .from("goal_topic_items")
      .select("goal_id, topic_id, title, deadline, status")
      .in("goal_id", goalIds)
      .neq("status", "completed");

    if (topicError) throw new Error(topicError.message);
    overdueTopicItems = ((topicItems ?? []) as typeof overdueTopicItems).filter(
      (t) => t.deadline != null && new Date(t.deadline) < new Date(),
    );
  }

  // 4. Build per-goal nudge reports
  const goalReports: GoalPacingReport[] = [];

  for (const result of goalResults) {
    const { goal, progress, pacing } = result;
    if (!progress) continue;

    const nudges: SmartNudge[] = [];

    // ── Solve-pace nudges ──
    if (pacing) {
      for (const target of pacing.targets) {
        const { metricKey, adjustedPace, actualPace, initialPace, remainingWork, status } = target;

        if (metricKey === "problems_solved") {
          nudges.push(...generateSolvePaceNudges(
            goal.id,
            adjustedPace,
            actualPace,
            initialPace,
            remainingWork,
            pacing.remainingDays,
            status,
          ));
        }

        if (metricKey === "retained_pct") {
          nudges.push(...generateRetentionPaceNudges(
            goal.id,
            target.currentValue,
            target.targetValue,
            progress,
          ));
        }

        if (metricKey === "topics_completed") {
          nudges.push(...generateTopicPaceNudges(
            goal.id,
            target.currentValue,
            target.targetValue,
            pacing.remainingDays,
            progress.topicsOverdue,
            status,
          ));
        }
      }
    }

    // ── Overdue topic item nudges ──
    const goalOverdueItems = overdueTopicItems.filter(
      (t) => t.goal_id === goal.id,
    );
    for (const item of goalOverdueItems.slice(0, 3)) {
      const deadlineDays = item.deadline
        ? Math.floor(
            (Date.now() - new Date(item.deadline).getTime()) / 86_400_000,
          )
        : 0;

      nudges.push({
        id: `topic-overdue-${item.topic_id}`,
        goalId: goal.id,
        category: "topic_overdue",
        priority: deadlineDays > 7 ? "critical" : "warning",
        message: `"${item.title}" is overdue by ${deadlineDays} day${deadlineDays !== 1 ? "s" : ""}. Finish the review card set first, then mark the topic complete.`,
      });
    }

    // ── Celebration nudges ──
    if (pacing && pacing.targets.every((t) => t.status === "on_track")) {
      nudges.push({
        id: `celebration-${goal.id}`,
        goalId: goal.id,
        category: "celebration",
        priority: "info",
        message: `Great pace! You're on track for "${goal.title}". Keep it up!`,
      });
    }

    goalReports.push({
      goalId: goal.id,
      goalTitle: goal.title,
      progress,
      pacing,
      nudges,
    });
  }

  // 5. Build general (non-goal) nudges
  const generalNudges: SmartNudge[] = generateWeaknessNudges(weakness.weakSpots);

  // Add recovery nudge if many overdue
  if (weakness.totalOverdueCards > 20) {
    generalNudges.push({
      id: "recovery-backlog",
      goalId: null,
      category: "recovery",
      priority: "warning",
      message: `You have ${weakness.totalOverdueCards} overdue cards. Consider using Recovery Mode to work through the backlog in manageable chunks.`,
      value: weakness.totalOverdueCards,
    });
  }

  const totalNudges =
    goalReports.reduce((sum, r) => sum + r.nudges.length, 0) +
    generalNudges.length;

  return {
    goals: goalReports,
    generalNudges,
    totalNudges,
  };
}

// ── Nudge Generators ────────────────────────────────────────────

function generateSolvePaceNudges(
  goalId: string,
  adjustedPace: number,
  actualPace: number,
  initialPace: number,
  remainingWork: number,
  remainingDays: number,
  status: string,
): SmartNudge[] {
  const nudges: SmartNudge[] = [];
  const deficit = Math.round((initialPace - actualPace) * remainingDays);

  if (status === "slightly_behind") {
    nudges.push({
      id: `solve-pace-behind-${goalId}`,
      goalId,
      category: "solve_pace",
      priority: "warning",
      metricKey: "problems_solved",
      message: `You are ${Math.abs(deficit)} problems behind schedule. Solve ${adjustedPace} problems/day for the next ${Math.min(7, remainingDays)} days to catch up.`,
      value: adjustedPace,
    });
  } else if (status === "at_risk") {
    nudges.push({
      id: `solve-pace-risk-${goalId}`,
      goalId,
      category: "solve_pace",
      priority: "critical",
      metricKey: "problems_solved",
      message: `${remainingWork} problems remaining with ${remainingDays} days left. Target ${adjustedPace} problems/day — focus on medium difficulty for best time/value.`,
      value: adjustedPace,
    });
  } else if (status === "critical") {
    nudges.push({
      id: `solve-pace-critical-${goalId}`,
      goalId,
      category: "solve_pace",
      priority: "critical",
      metricKey: "problems_solved",
      message: `Significantly behind — ${remainingWork} problems for ${remainingDays} days (need ${adjustedPace}/day). Consider extending the goal deadline or reducing the target.`,
      value: adjustedPace,
    });
  }

  return nudges;
}

function generateRetentionPaceNudges(
  goalId: string,
  currentRetention: number,
  targetRetention: number,
  progress: GoalProgressMetrics,
): SmartNudge[] {
  const nudges: SmartNudge[] = [];
  const gap = targetRetention - currentRetention;

  if (gap > 20) {
    // Major retention gap
    const weakCards = progress.problemsSolvedInWindow - progress.retainedWellCount;
    nudges.push({
      id: `retention-critical-${goalId}`,
      goalId,
      category: "retention",
      priority: "critical",
      metricKey: "retained_pct",
      message: `Your solve pace is fine, but retention is ${currentRetention}% (target: ${targetRetention}%). Review ${Math.min(weakCards, 15)} of your recent medium cards tonight.`,
      value: currentRetention,
    });
  } else if (gap > 10) {
    nudges.push({
      id: `retention-warning-${goalId}`,
      goalId,
      category: "retention",
      priority: "warning",
      metricKey: "retained_pct",
      message: `Retention at ${currentRetention}%, target is ${targetRetention}%. Focus on reviewing cards you rated AGAIN or HARD recently.`,
      value: currentRetention,
    });
  } else if (gap > 0 && gap <= 10) {
    nudges.push({
      id: `retention-info-${goalId}`,
      goalId,
      category: "review_pace",
      priority: "info",
      metricKey: "retained_pct",
      message: `Retention is ${currentRetention}% — close to your ${targetRetention}% target. A quick review session tonight will help lock it in.`,
      value: currentRetention,
    });
  }

  return nudges;
}

function generateTopicPaceNudges(
  goalId: string,
  currentTopics: number,
  targetTopics: number,
  remainingDays: number,
  overdueTopics: number,
  status: string,
): SmartNudge[] {
  const nudges: SmartNudge[] = [];
  const remaining = targetTopics - currentTopics;

  if (status === "slightly_behind" || status === "at_risk") {
    const pace = remainingDays > 0 ? Math.ceil(remaining / (remainingDays / 7)) : remaining;
    nudges.push({
      id: `topic-pace-${goalId}`,
      goalId,
      category: "topic_neglected",
      priority: status === "at_risk" ? "critical" : "warning",
      metricKey: "topics_completed",
      message: `${remaining} topics remaining. Complete about ${pace} topic${pace !== 1 ? "s" : ""}/week to stay on track.`,
      value: remaining,
    });
  }

  if (overdueTopics > 0) {
    nudges.push({
      id: `topic-overdue-count-${goalId}`,
      goalId,
      category: "topic_overdue",
      priority: "warning",
      message: `${overdueTopics} topic${overdueTopics !== 1 ? "s are" : " is"} past their deadline. Prioritize the${overdueTopics === 1 ? "" : "se"} before starting new ones.`,
      value: overdueTopics,
    });
  }

  return nudges;
}

function generateWeaknessNudges(weakSpots: WeakSpot[]): SmartNudge[] {
  const nudges: SmartNudge[] = [];
  const topWeak = weakSpots.slice(0, 3);

  for (const spot of topWeak) {
    if (spot.score >= 60) {
      nudges.push({
        id: `weakness-${spot.key}`,
        goalId: null,
        category: "retention",
        priority: "warning",
        message: `"${spot.key}" is a weak area (${spot.recentFailRate}% recent fail rate, ${spot.overdueCount} overdue). Prioritize reviewing these ${spot.cardCount} cards.`,
        value: spot.score,
      });
    } else if (spot.score >= 40 && spot.overdueCount > 0) {
      nudges.push({
        id: `weakness-${spot.key}`,
        goalId: null,
        category: "topic_neglected",
        priority: "info",
        message: `${spot.overdueCount} overdue cards in "${spot.key}". A quick review session would help maintain your progress.`,
        value: spot.overdueCount,
      });
    }
  }

  return nudges;
}

// ── API: Per-Goal Pacing Summary ────────────────────────────────

/**
 * Get a concise daily action plan for a specific goal.
 */
export interface DailyActionPlan {
  goalId: string;
  goalTitle: string;
  date: string;
  solveTodayCount: number;     // how many new problems to solve
  reviewTodayCount: number;    // how many cards to review
  focusTopics: string[];       // which topics to prioritize
  nudges: SmartNudge[];
  overallStatus: "on_track" | "slightly_behind" | "at_risk" | "critical";
}

export async function getDailyActionPlan(
  goalId: string,
  userId: string,
): Promise<DailyActionPlan | null> {
  const supabase = getSupabaseAdmin();

  // Fetch goal
  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id, title, goal_type, start_date, end_date")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (goalError) throw new Error(goalError.message);
  if (!goal) return null;

  const [progress, pacing] = await Promise.all([
    getGoalProgress(goalId, userId),
    getGoalPacing(goalId, userId),
  ]);

  if (!progress || !pacing) return null;

  // Determine daily solve target from pacing
  const solveTarget = pacing.targets.find(
    (t) => t.metricKey === "problems_solved",
  );
  const solveTodayCount = solveTarget
    ? Math.ceil(solveTarget.adjustedPace)
    : 0;

  // Determine review count from due cards
  const nowIso = new Date().toISOString();
  const { data: dueCards, error: dueError } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .lte("next_review_at", nowIso);

  if (dueError) throw new Error(dueError.message);
  const reviewTodayCount = Math.min(dueCards?.length ?? (dueCards as unknown as number) ?? 0, 20);

  // Get overdue topic items for focus suggestion
  const { data: overdueItems } = await supabase
    .from("goal_topic_items")
    .select("title")
    .eq("goal_id", goalId)
    .neq("status", "completed")
    .not("deadline", "is", null)
    .lte("deadline", nowIso)
    .limit(3);

  const focusTopics = ((overdueItems ?? []) as Array<{ title: string }>)
    .map((t) => t.title);

  // Get weakness-based focus if no overdue topics
  if (focusTopics.length === 0) {
    const weakness = await getWeaknessAnalysis(userId, 7);
    const topWeak = weakness.weakSpots
      .filter((w) => w.score >= 30)
      .slice(0, 2)
      .map((w) => w.key);
    focusTopics.push(...topWeak);
  }

  // Compute overall status (worst across targets)
  const statuses = pacing.targets.map((t) => t.status);
  const statusRank = { on_track: 0, slightly_behind: 1, at_risk: 2, critical: 3 } as const;
  const worstStatus = statuses.reduce(
    (worst, s) =>
      statusRank[s] > statusRank[worst] ? s : worst,
    "on_track" as keyof typeof statusRank,
  );

  // Generate nudges
  const nudges: SmartNudge[] = [];
  for (const target of pacing.targets) {
    if (target.metricKey === "problems_solved") {
      nudges.push(...generateSolvePaceNudges(
        goalId,
        target.adjustedPace,
        target.actualPace,
        target.initialPace,
        target.remainingWork,
        pacing.remainingDays,
        target.status,
      ));
    }
    if (target.metricKey === "retained_pct") {
      nudges.push(...generateRetentionPaceNudges(
        goalId,
        target.currentValue,
        target.targetValue,
        progress,
      ));
    }
  }

  return {
    goalId,
    goalTitle: goal.title as string,
    date: new Date().toISOString().slice(0, 10),
    solveTodayCount,
    reviewTodayCount: dueCards?.length != null ? Math.min(Number(dueCards.length) || 0, 20) : 0,
    focusTopics,
    nudges,
    overallStatus: worstStatus,
  };
}
