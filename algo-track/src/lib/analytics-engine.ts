/**
 * Structured Analytics & Weakness Engine (Phase 3)
 *
 * Provides computed metrics for:
 *   - Weakness analysis by tag/topic/difficulty
 *   - Goal progress tracking
 *   - Goal pacing and burn-rate calculations
 *   - Recovery mode planning
 *   - Stress mode candidate selection
 *   - Skill-tree progress computation
 *   - Coach context aggregation
 */

import { getSupabaseAdmin } from "@/lib/db";
import { ReviewRating } from "@/lib/srs";
import { SKILL_TREE, type SkillTreeNode, type SkillNodeState } from "@/data/skill-tree";

// ── Shared types ────────────────────────────────────────────────

interface CardAnalyticsRow {
  id: string;
  type: "leetcode" | "cs";
  title: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[] | null;
  topic_domain: string | null;
  topic_ids: string[] | null;
  easiness_factor: number | string;
  interval_days: number;
  repetition_count: number;
  last_rating: string | null;
  last_reviewed_at: string | null;
  next_review_at: string;
  solved_at: string | null;
  source: string;
  created_at: string;
}

interface ReviewAnalyticsRow {
  card_id: string;
  rating: string;
  reviewed_at: string;
}

// ── Helpers ─────────────────────────────────────────────────────

function daysAgo(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.floor((now - then) / 86_400_000);
}

function isOverdue(nextReview: string): boolean {
  return new Date(nextReview) <= new Date();
}

function overdueDays(nextReview: string): number {
  const diff = Date.now() - new Date(nextReview).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

// ── 1. Weakness Analysis ────────────────────────────────────────

export interface WeakSpot {
  key: string;           // tag or topic_id
  keyType: "tag" | "topic";
  domain: string | null; // dsa | cs | null
  score: number;         // 0-100, higher = weaker
  cardCount: number;
  recentFailRate: number; // AGAIN+HARD ratio in window
  overdueCount: number;
  avgEasinessFactor: number;
  difficultyBreakdown: { easy: number; medium: number; hard: number };
}

export interface WeaknessAnalysis {
  weakSpots: WeakSpot[];
  overallFailRate: number;
  totalCardsAnalysed: number;
  totalOverdueCards: number;
  windowDays: number;
}

export async function getWeaknessAnalysis(
  userId: string,
  windowDays = 30,
): Promise<WeaknessAnalysis> {
  const supabase = getSupabaseAdmin();
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  // Fetch all cards and recent reviews in parallel
  const [cardsResult, reviewsResult] = await Promise.all([
    supabase
      .from("cards")
      .select(
        "id, type, difficulty, tags, topic_domain, topic_ids, easiness_factor, interval_days, repetition_count, last_rating, last_reviewed_at, next_review_at, solved_at, source, created_at, title",
      )
      .eq("user_id", userId),
    supabase
      .from("reviews")
      .select("card_id, rating, reviewed_at")
      .eq("user_id", userId)
      .gte("reviewed_at", since.toISOString()),
  ]);

  if (cardsResult.error) throw new Error(cardsResult.error.message);
  if (reviewsResult.error) throw new Error(reviewsResult.error.message);

  const cards = (cardsResult.data ?? []) as CardAnalyticsRow[];
  const reviews = (reviewsResult.data ?? []) as ReviewAnalyticsRow[];

  // Build per-card review stats within the window
  const cardReviewStats = new Map<string, { total: number; bad: number }>();
  for (const r of reviews) {
    const existing = cardReviewStats.get(r.card_id) ?? { total: 0, bad: 0 };
    existing.total += 1;
    if (r.rating === "AGAIN" || r.rating === "HARD") {
      existing.bad += 1;
    }
    cardReviewStats.set(r.card_id, existing);
  }

  // Aggregate by tag
  const tagAgg = new Map<
    string,
    {
      domain: string | null;
      cards: CardAnalyticsRow[];
      recentBad: number;
      recentTotal: number;
      overdueCount: number;
      totalEf: number;
      easy: number;
      medium: number;
      hard: number;
    }
  >();

  function ensureTagEntry(tag: string, domain: string | null) {
    if (!tagAgg.has(tag)) {
      tagAgg.set(tag, {
        domain,
        cards: [],
        recentBad: 0,
        recentTotal: 0,
        overdueCount: 0,
        totalEf: 0,
        easy: 0,
        medium: 0,
        hard: 0,
      });
    }
    return tagAgg.get(tag)!;
  }

  let totalOverdueCards = 0;

  for (const card of cards) {
    const tags = card.tags ?? [];
    const ef = Number(card.easiness_factor) || 2.5;
    const cardIsOverdue = isOverdue(card.next_review_at);
    if (cardIsOverdue) totalOverdueCards++;

    const reviewStats = cardReviewStats.get(card.id) ?? { total: 0, bad: 0 };

    for (const tag of tags) {
      const entry = ensureTagEntry(tag, card.topic_domain);
      entry.cards.push(card);
      entry.recentBad += reviewStats.bad;
      entry.recentTotal += reviewStats.total;
      entry.totalEf += ef;
      if (cardIsOverdue) entry.overdueCount++;
      entry[card.difficulty]++;
    }

    // Also aggregate by topic_ids
    const topicIds = card.topic_ids ?? [];
    for (const topicId of topicIds) {
      const entry = ensureTagEntry(topicId, card.topic_domain);
      entry.cards.push(card);
      entry.recentBad += reviewStats.bad;
      entry.recentTotal += reviewStats.total;
      entry.totalEf += ef;
      if (cardIsOverdue) entry.overdueCount++;
      entry[card.difficulty]++;
    }
  }

  // Calculate weakness scores
  const weakSpots: WeakSpot[] = [];
  const overallBad = reviews.filter(
    (r) => r.rating === "AGAIN" || r.rating === "HARD",
  ).length;
  const overallFailRate =
    reviews.length > 0 ? Math.round((overallBad / reviews.length) * 100) : 0;

  for (const [key, agg] of tagAgg) {
    const cardCount = agg.cards.length;
    if (cardCount === 0) continue;

    const recentFailRate =
      agg.recentTotal > 0
        ? Math.round((agg.recentBad / agg.recentTotal) * 100)
        : 0;

    const avgEf = agg.totalEf / cardCount;

    // Weakness scoring formula:
    // - Recent fail rate (0-100) * 0.4
    // - Overdue pressure (scaled) * 0.3
    // - Inverse of avg EF (lower EF = weaker) * 0.3
    const failComponent = recentFailRate * 0.4;
    const overdueComponent = Math.min(100, (agg.overdueCount / Math.max(1, cardCount)) * 100) * 0.3;
    const efComponent = Math.min(100, Math.max(0, ((2.5 - avgEf) / 1.2) * 100)) * 0.3;

    const score = Math.round(failComponent + overdueComponent + efComponent);

    const isTopicId = key.includes(".");
    weakSpots.push({
      key,
      keyType: isTopicId ? "topic" : "tag",
      domain: agg.domain,
      score: Math.max(0, Math.min(100, score)),
      cardCount,
      recentFailRate,
      overdueCount: agg.overdueCount,
      avgEasinessFactor: Math.round(avgEf * 100) / 100,
      difficultyBreakdown: {
        easy: agg.easy,
        medium: agg.medium,
        hard: agg.hard,
      },
    });
  }

  // Sort by weakness score descending
  weakSpots.sort((a, b) => b.score - a.score);

  return {
    weakSpots,
    overallFailRate,
    totalCardsAnalysed: cards.length,
    totalOverdueCards,
    windowDays,
  };
}

// ── 2. Goal Progress ────────────────────────────────────────────

export interface GoalProgressMetrics {
  goalId: string;
  goalType: string;
  // DSA metrics
  problemsSolvedInWindow: number;
  retainedWellCount: number;
  retainedWellPct: number;
  distinctTopicsCovered: number;
  // CS metrics
  topicsCompleted: number;
  topicsInProgress: number;
  topicsOverdue: number;
  reviewCoveragePct: number;
  // Targets
  targets: Array<{
    metricKey: string;
    targetValue: number;
    currentValue: number;
    unit: string;
    pct: number;
  }>;
}

export async function getGoalProgress(
  goalId: string,
  userId: string,
): Promise<GoalProgressMetrics | null> {
  const supabase = getSupabaseAdmin();

  // Fetch the goal
  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id, goal_type, start_date, end_date, status")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (goalError) throw new Error(goalError.message);
  if (!goal) return null;

  // Fetch targets
  const { data: targets, error: targetsError } = await supabase
    .from("goal_targets")
    .select("metric_key, target_value, current_value, unit")
    .eq("goal_id", goalId);

  if (targetsError) throw new Error(targetsError.message);

  // Fetch topic items
  const { data: topicItems, error: topicItemsError } = await supabase
    .from("goal_topic_items")
    .select("status, deadline")
    .eq("goal_id", goalId);

  if (topicItemsError) throw new Error(topicItemsError.message);

  // Fetch cards with solved_at in goal window
  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, tags, topic_ids, last_rating, solved_at")
    .eq("user_id", userId)
    .gte("solved_at", goal.start_date)
    .lte("solved_at", goal.end_date);

  if (cardsError) throw new Error(cardsError.message);

  const solvedCards = (cards ?? []) as Array<{
    id: string;
    tags: string[] | null;
    topic_ids: string[] | null;
    last_rating: string | null;
    solved_at: string | null;
  }>;

  const problemsSolvedInWindow = solvedCards.length;
  const retainedWell = solvedCards.filter(
    (c) => c.last_rating === "GOOD" || c.last_rating === "EASY",
  );
  const retainedWellCount = retainedWell.length;
  const retainedWellPct =
    problemsSolvedInWindow > 0
      ? Math.round((retainedWellCount / problemsSolvedInWindow) * 100)
      : 0;

  const allTopics = new Set<string>();
  for (const c of solvedCards) {
    for (const tag of c.tags ?? []) allTopics.add(tag);
    for (const tid of c.topic_ids ?? []) allTopics.add(tid);
  }

  const items = (topicItems ?? []) as Array<{ status: string; deadline: string | null }>;
  const topicsCompleted = items.filter((t) => t.status === "completed").length;
  const topicsInProgress = items.filter((t) => t.status === "in_progress").length;
  const topicsOverdue = items.filter(
    (t) =>
      t.status !== "completed" &&
      t.deadline != null &&
      new Date(t.deadline) < new Date(),
  ).length;

  // Review coverage: what % of topic items have at least one solved card
  const reviewCoveragePct =
    items.length > 0
      ? Math.round((topicsCompleted / items.length) * 100)
      : 0;

  const targetEntries = ((targets ?? []) as Array<{
    metric_key: string;
    target_value: number | string;
    current_value: number | string;
    unit: string;
  }>).map((t) => {
    const targetVal = Number(t.target_value);
    const currentVal = Number(t.current_value);
    return {
      metricKey: t.metric_key,
      targetValue: targetVal,
      currentValue: currentVal,
      unit: t.unit,
      pct: targetVal > 0 ? Math.round((currentVal / targetVal) * 100) : 0,
    };
  });

  return {
    goalId,
    goalType: goal.goal_type as string,
    problemsSolvedInWindow,
    retainedWellCount,
    retainedWellPct,
    distinctTopicsCovered: allTopics.size,
    topicsCompleted,
    topicsInProgress,
    topicsOverdue,
    reviewCoveragePct,
    targets: targetEntries,
  };
}

// ── 3. Goal Pacing ──────────────────────────────────────────────

export interface GoalPacingMetrics {
  goalId: string;
  elapsedDays: number;
  remainingDays: number;
  totalDays: number;
  // Per-target pacing
  targets: Array<{
    metricKey: string;
    targetValue: number;
    currentValue: number;
    remainingWork: number;
    initialPace: number;
    actualPace: number;
    adjustedPace: number;
    status: "on_track" | "slightly_behind" | "at_risk" | "critical";
  }>;
  nudges: string[];
}

export async function getGoalPacing(
  goalId: string,
  userId: string,
): Promise<GoalPacingMetrics | null> {
  const supabase = getSupabaseAdmin();

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id, start_date, end_date")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (goalError) throw new Error(goalError.message);
  if (!goal) return null;

  const { data: targets, error: targetsError } = await supabase
    .from("goal_targets")
    .select("metric_key, target_value, current_value, unit")
    .eq("goal_id", goalId);

  if (targetsError) throw new Error(targetsError.message);

  const startDate = new Date(goal.start_date as string);
  const endDate = new Date(goal.end_date as string);
  const now = new Date();

  const totalDays = Math.max(
    1,
    Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000),
  );
  const elapsedDays = Math.max(
    0,
    Math.ceil((now.getTime() - startDate.getTime()) / 86_400_000),
  );
  const remainingDays = Math.max(1, totalDays - elapsedDays);

  const nudges: string[] = [];

  const targetMetrics = ((targets ?? []) as Array<{
    metric_key: string;
    target_value: number | string;
    current_value: number | string;
    unit: string;
  }>).map((t) => {
    const targetVal = Number(t.target_value);
    const currentVal = Number(t.current_value);
    const remainingWork = Math.max(0, targetVal - currentVal);

    const initialPace =
      totalDays > 0 ? Math.round((targetVal / totalDays) * 10) / 10 : 0;
    const actualPace =
      elapsedDays > 0
        ? Math.round((currentVal / elapsedDays) * 10) / 10
        : 0;
    const adjustedPace =
      remainingDays > 0
        ? Math.round((remainingWork / remainingDays) * 10) / 10
        : remainingWork;

    // Classify pace status
    let status: "on_track" | "slightly_behind" | "at_risk" | "critical";
    const ratio = initialPace > 0 ? actualPace / initialPace : 1;

    if (ratio >= 0.9) {
      status = "on_track";
    } else if (ratio >= 0.7) {
      status = "slightly_behind";
      nudges.push(
        `You are slightly behind on ${t.metric_key}. Do ${adjustedPace} ${t.unit}/day to catch up.`,
      );
    } else if (ratio >= 0.5) {
      status = "at_risk";
      nudges.push(
        `${t.metric_key} is at risk. You need ${adjustedPace} ${t.unit}/day for the next ${remainingDays} days.`,
      );
    } else {
      status = "critical";
      nudges.push(
        `${t.metric_key} is critically behind — ${remainingWork} ${t.unit} remaining with ${remainingDays} days left. Consider adjusting the goal.`,
      );
    }

    return {
      metricKey: t.metric_key,
      targetValue: targetVal,
      currentValue: currentVal,
      remainingWork,
      initialPace,
      actualPace,
      adjustedPace,
      status,
    };
  });

  return {
    goalId,
    elapsedDays,
    remainingDays,
    totalDays,
    targets: targetMetrics,
    nudges,
  };
}

// ── 4. Recovery Mode ────────────────────────────────────────────

export interface RecoveryCard {
  id: string;
  title: string;
  difficulty: string;
  overdueDays: number;
  lastRating: string | null;
  bucket: "red" | "amber" | "green";
}

export interface RecoveryModePlan {
  isRecoveryNeeded: boolean;
  totalOverdue: number;
  daysSinceLastReview: number;
  recommendedDailyCap: number;
  redCards: RecoveryCard[];
  amberCards: RecoveryCard[];
  greenCards: RecoveryCard[];
}

export async function getRecoveryModePlan(
  userId: string,
): Promise<RecoveryModePlan> {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  // Get overdue cards
  const { data: overdueCards, error: cardsError } = await supabase
    .from("cards")
    .select(
      "id, title, difficulty, last_rating, last_reviewed_at, next_review_at, repetition_count, easiness_factor",
    )
    .eq("user_id", userId)
    .lte("next_review_at", nowIso)
    .order("next_review_at", { ascending: true });

  if (cardsError) throw new Error(cardsError.message);

  // Get most recent review date
  const { data: lastReview, error: lastReviewError } = await supabase
    .from("reviews")
    .select("reviewed_at")
    .eq("user_id", userId)
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastReviewError) throw new Error(lastReviewError.message);

  const daysSinceLastReview = lastReview
    ? daysAgo(lastReview.reviewed_at as string)
    : 999;

  const cards = (overdueCards ?? []) as Array<{
    id: string;
    title: string;
    difficulty: string;
    last_rating: string | null;
    last_reviewed_at: string | null;
    next_review_at: string;
    repetition_count: number;
    easiness_factor: number | string;
  }>;

  // Classify into buckets
  const redCards: RecoveryCard[] = [];
  const amberCards: RecoveryCard[] = [];
  const greenCards: RecoveryCard[] = [];

  for (const card of cards) {
    const od = overdueDays(card.next_review_at);
    const ef = Number(card.easiness_factor) || 2.5;
    const hasFailed =
      card.last_rating === "AGAIN" || card.last_rating === "HARD";

    const recoveryCard: RecoveryCard = {
      id: card.id,
      title: card.title,
      difficulty: card.difficulty,
      overdueDays: od,
      lastRating: card.last_rating,
      bucket: "amber", // default
    };

    if (hasFailed || (od > 7 && ef < 2.0)) {
      // Red: overdue AND previously failed or very low EF
      recoveryCard.bucket = "red";
      redCards.push(recoveryCard);
    } else if (ef >= 2.5 && card.repetition_count >= 3 && od <= 3) {
      // Green: stable cards, mildly overdue
      recoveryCard.bucket = "green";
      greenCards.push(recoveryCard);
    } else {
      // Amber: everything else
      amberCards.push(recoveryCard);
    }
  }

  const totalOverdue = cards.length;

  // Recommended daily cap based on backlog size
  let recommendedDailyCap: number;
  if (totalOverdue <= 10) {
    recommendedDailyCap = totalOverdue;
  } else if (totalOverdue <= 30) {
    recommendedDailyCap = 20;
  } else if (totalOverdue <= 100) {
    recommendedDailyCap = 30;
  } else {
    recommendedDailyCap = 40;
  }

  // Recovery is needed if:
  // - No reviews for 2+ days AND overdue backlog exists
  // - OR total overdue is large (>20)
  const isRecoveryNeeded =
    (daysSinceLastReview >= 2 && totalOverdue > 0) || totalOverdue > 20;

  return {
    isRecoveryNeeded,
    totalOverdue,
    daysSinceLastReview,
    recommendedDailyCap,
    redCards,
    amberCards,
    greenCards,
  };
}

// ── 5. Stress Mode Candidates ───────────────────────────────────

export interface StressModeCandidate {
  id: string;
  title: string;
  difficulty: string;
  tags: string[];
  overdueDays: number;
  lastRating: string | null;
}

export async function getStressModeCandidates(
  userId: string,
  limit = 3,
): Promise<StressModeCandidate[]> {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  // Pull due LeetCode cards, biased toward recall pressure
  const { data, error } = await supabase
    .from("cards")
    .select(
      "id, title, difficulty, tags, last_rating, next_review_at",
    )
    .eq("user_id", userId)
    .eq("type", "leetcode")
    .lte("next_review_at", nowIso)
    .order("next_review_at", { ascending: true })
    .limit(limit * 3); // Fetch more than needed so we can randomize

  if (error) throw new Error(error.message);

  const candidates = ((data ?? []) as Array<{
    id: string;
    title: string;
    difficulty: string;
    tags: string[] | null;
    last_rating: string | null;
    next_review_at: string;
  }>).map((card) => ({
    id: card.id,
    title: card.title,
    difficulty: card.difficulty,
    tags: card.tags ?? [],
    overdueDays: overdueDays(card.next_review_at),
    lastRating: card.last_rating,
  }));

  // Shuffle and pick `limit` cards to add randomness
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, limit);
}

// ── 6. Skill Tree Progress ──────────────────────────────────────

export interface SkillNodeProgress {
  nodeId: string;
  label: string;
  domain: string;
  state: SkillNodeState;
  cardCount: number;
  reviewedCount: number;
  avgMastery: number;     // 0-100
  recentActivity: number; // reviews in last 14 days
}

export async function getSkillTreeProgress(
  userId: string,
): Promise<SkillNodeProgress[]> {
  const supabase = getSupabaseAdmin();
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Fetch cards and recent reviews
  const [cardsResult, reviewsResult] = await Promise.all([
    supabase
      .from("cards")
      .select(
        "id, tags, topic_ids, easiness_factor, repetition_count, last_rating",
      )
      .eq("user_id", userId),
    supabase
      .from("reviews")
      .select("card_id, rating, reviewed_at")
      .eq("user_id", userId)
      .gte("reviewed_at", fourteenDaysAgo.toISOString()),
  ]);

  if (cardsResult.error) throw new Error(cardsResult.error.message);
  if (reviewsResult.error) throw new Error(reviewsResult.error.message);

  const cards = (cardsResult.data ?? []) as Array<{
    id: string;
    tags: string[] | null;
    topic_ids: string[] | null;
    easiness_factor: number | string;
    repetition_count: number;
    last_rating: string | null;
  }>;

  const recentReviews = (reviewsResult.data ?? []) as ReviewAnalyticsRow[];

  // Count recent reviews per card
  const recentReviewsByCard = new Map<string, number>();
  for (const r of recentReviews) {
    recentReviewsByCard.set(
      r.card_id,
      (recentReviewsByCard.get(r.card_id) ?? 0) + 1,
    );
  }

  // For each skill-tree node, compute progress
  const progressMap = new Map<
    string,
    {
      cardCount: number;
      reviewedCount: number;
      totalEf: number;
      recentActivity: number;
      goodCount: number;
    }
  >();

  // Initialize all nodes
  for (const node of SKILL_TREE) {
    progressMap.set(node.id, {
      cardCount: 0,
      reviewedCount: 0,
      totalEf: 0,
      recentActivity: 0,
      goodCount: 0,
    });
  }

  // Map cards to nodes via linkedTags and linkedTopicIds
  for (const card of cards) {
    const cardTags = new Set(card.tags ?? []);
    const cardTopics = new Set(card.topic_ids ?? []);
    const ef = Number(card.easiness_factor) || 2.5;
    const isReviewed = card.repetition_count > 0;
    const isGood =
      card.last_rating === "GOOD" || card.last_rating === "EASY";
    const recentCount = recentReviewsByCard.get(card.id) ?? 0;

    for (const node of SKILL_TREE) {
      const matchesTag = node.linkedTags.some((t) => cardTags.has(t));
      const matchesTopic = node.linkedTopicIds.some((t) => cardTopics.has(t));

      if (matchesTag || matchesTopic) {
        const entry = progressMap.get(node.id)!;
        entry.cardCount += 1;
        if (isReviewed) entry.reviewedCount += 1;
        entry.totalEf += ef;
        entry.recentActivity += recentCount;
        if (isGood) entry.goodCount += 1;
      }
    }
  }

  // Determine node states
  // First, compute which nodes have prerequisites met
  const nodeStatusMap = new Map<string, SkillNodeState>();

  function computeState(node: SkillTreeNode): SkillNodeState {
    if (nodeStatusMap.has(node.id)) return nodeStatusMap.get(node.id)!;

    const entry = progressMap.get(node.id)!;

    // Check prerequisites
    const prereqsMet = node.prerequisiteNodeIds.every((prereqId) => {
      const prereqNode = SKILL_TREE.find((n) => n.id === prereqId);
      if (!prereqNode) return true;
      const prereqState = computeState(prereqNode);
      return prereqState !== "locked";
    });

    let state: SkillNodeState;

    if (!prereqsMet) {
      state = "locked";
    } else if (entry.cardCount === 0) {
      state = "available";
    } else {
      const avgEf = entry.totalEf / entry.cardCount;
      const goodRatio =
        entry.reviewedCount > 0 ? entry.goodCount / entry.reviewedCount : 0;

      if (avgEf >= 2.8 && goodRatio >= 0.85 && entry.reviewedCount >= 3) {
        state = "mastered";
      } else if (avgEf >= 2.3 && goodRatio >= 0.6) {
        state = "stable";
      } else if (entry.reviewedCount > 0 && goodRatio < 0.5) {
        state = "weak";
      } else {
        state = "active";
      }
    }

    nodeStatusMap.set(node.id, state);
    return state;
  }

  return SKILL_TREE.map((node) => {
    const state = computeState(node);
    const entry = progressMap.get(node.id)!;
    const avgMastery =
      entry.cardCount > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                ((entry.totalEf / entry.cardCount - 1.3) / 1.7) * 100,
              ),
            ),
          )
        : 0;

    return {
      nodeId: node.id,
      label: node.label,
      domain: node.domain,
      state,
      cardCount: entry.cardCount,
      reviewedCount: entry.reviewedCount,
      avgMastery,
      recentActivity: entry.recentActivity,
    };
  });
}

// ── 7. Coach Context ────────────────────────────────────────────

export interface CoachContext {
  totalCards: number;
  totalDue: number;
  totalOverdue: number;
  currentStreak: number;
  weakSpots: WeakSpot[];
  strengths: Array<{ topic: string; mastery: number; cardCount: number }>;
  activeGoalCount: number;
  recoveryNeeded: boolean;
  recentAccuracy: number; // last 7 days
  difficultyDistribution: { easy: number; medium: number; hard: number };
}

export async function getCoachContext(
  userId: string,
): Promise<CoachContext> {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Run parallel queries
  const [
    totalResult,
    dueResult,
    recentReviewsResult,
    goalsResult,
    cardsResult,
    lastReviewResult,
  ] = await Promise.all([
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .lte("next_review_at", nowIso),
    supabase
      .from("reviews")
      .select("rating")
      .eq("user_id", userId)
      .gte("reviewed_at", weekAgo.toISOString()),
    supabase
      .from("goals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("cards")
      .select("difficulty")
      .eq("user_id", userId),
    supabase
      .from("reviews")
      .select("reviewed_at")
      .eq("user_id", userId)
      .order("reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Handle errors
  for (const r of [totalResult, dueResult, recentReviewsResult, goalsResult, cardsResult, lastReviewResult]) {
    if (r.error) throw new Error(r.error.message);
  }

  const totalCards = totalResult.count ?? 0;
  const totalDue = dueResult.count ?? 0;

  // Recent accuracy
  const recentReviews = (recentReviewsResult.data ?? []) as Array<{ rating: string }>;
  const goodRecent = recentReviews.filter(
    (r) => r.rating === "GOOD" || r.rating === "EASY",
  ).length;
  const recentAccuracy =
    recentReviews.length > 0
      ? Math.round((goodRecent / recentReviews.length) * 100)
      : 0;

  // Active goals
  const activeGoalCount = goalsResult.count ?? 0;

  // Difficulty distribution
  const allCards = (cardsResult.data ?? []) as Array<{ difficulty: string }>;
  const difficultyDistribution = { easy: 0, medium: 0, hard: 0 };
  for (const c of allCards) {
    if (c.difficulty in difficultyDistribution) {
      difficultyDistribution[c.difficulty as keyof typeof difficultyDistribution]++;
    }
  }

  // Streak: check days since last review
  const daysSinceLastReview = lastReviewResult.data
    ? daysAgo(lastReviewResult.data.reviewed_at as string)
    : 999;

  // Simple streak calc (just seeing if reviewed today/yesterday)
  const currentStreak = daysSinceLastReview <= 1 ? 1 : 0;

  // Get weakness analysis (top 5) and strengths
  const weakness = await getWeaknessAnalysis(userId, 14);
  const weakSpots = weakness.weakSpots.slice(0, 5);

  // Strengths: spots with score < 20 and decent card count
  const strengths = weakness.weakSpots
    .filter((w) => w.score < 20 && w.cardCount >= 2)
    .map((w) => ({
      topic: w.key,
      mastery: 100 - w.score,
      cardCount: w.cardCount,
    }))
    .slice(0, 5);

  const recoveryNeeded =
    (daysSinceLastReview >= 2 && totalDue > 0) || totalDue > 20;

  return {
    totalCards,
    totalDue,
    totalOverdue: weakness.totalOverdueCards,
    currentStreak,
    weakSpots,
    strengths,
    activeGoalCount,
    recoveryNeeded,
    recentAccuracy,
    difficultyDistribution,
  };
}
