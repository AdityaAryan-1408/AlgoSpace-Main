/**
 * Recommendation Engine (Phase 8)
 *
 * Generates personalized recommendations based on:
 *   - Weakness analysis (prefer tags with poor recent performance)
 *   - Already-solved URLs (exclude duplicates)
 *   - Difficulty matching (based on weakness severity)
 *   - CS topic coverage gaps
 *
 * Output:
 *   - suggestedProblems: DSA problems to solve next
 *   - suggestedTopics: CS theory topics to study
 *   - priorityActions: high-level actionable items
 */

import { getSupabaseAdmin } from "@/lib/db";
import { getWeaknessAnalysis, type WeakSpot } from "@/lib/analytics-engine";
import { PROBLEM_LISTS, type ProblemListItem } from "@/data/problem-lists";
import { CS_TOPICS, type CsTopic, getTopicsByDomain } from "@/data/cs-topics";

// ── Types ───────────────────────────────────────────────────────

export interface SuggestedProblem {
  title: string;
  url: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  reason: string;
  category: "recovery" | "strengthen" | "stretch";
}

export interface SuggestedTopic {
  topicId: string;
  domain: string;
  label: string;
  description: string;
  reason: string;
  subtopics?: string[];
  suggestedCardCount: number;
}

export interface PriorityAction {
  id: string;
  type: "review" | "solve" | "study" | "create_cards";
  message: string;
  priority: "high" | "medium" | "low";
}

export interface RecommendationResult {
  suggestedProblems: SuggestedProblem[];
  suggestedTopics: SuggestedTopic[];
  priorityActions: PriorityAction[];
}

// ── Helpers ─────────────────────────────────────────────────────

/** Build a flat list of all problems from all curated lists */
function getAllProblems(): ProblemListItem[] {
  const seen = new Set<string>();
  const problems: ProblemListItem[] = [];

  for (const list of PROBLEM_LISTS) {
    for (const p of list.problems) {
      const key = p.url.toLowerCase().replace(/\/$/, "");
      if (!seen.has(key)) {
        seen.add(key);
        problems.push(p);
      }
    }
  }

  return problems;
}

/** Choose difficulty based on weakness severity */
function chooseDifficulty(weaknessScore: number): "easy" | "medium" | "hard" {
  if (weaknessScore >= 60) return "easy";     // Very weak — start easy
  if (weaknessScore >= 30) return "medium";   // Moderate — medium challenge
  return "hard";                               // Strong area — stretch
}

// ── Main Engine ─────────────────────────────────────────────────

export async function getRecommendations(
  userId: string,
  limit = 6,
): Promise<RecommendationResult> {
  const supabase = getSupabaseAdmin();

  // 1. Get weakness analysis and user's existing cards in parallel
  const [weakness, cardsResult] = await Promise.all([
    getWeaknessAnalysis(userId, 14),
    supabase
      .from("cards")
      .select("url, tags, topic_ids, topic_domain")
      .eq("user_id", userId),
  ]);

  if (cardsResult.error) throw new Error(cardsResult.error.message);

  const existingCards = (cardsResult.data ?? []) as Array<{
    url: string | null;
    tags: string[] | null;
    topic_ids: string[] | null;
    topic_domain: string | null;
  }>;

  // Build set of already-solved URLs
  const solvedUrls = new Set<string>();
  for (const card of existingCards) {
    if (card.url) {
      solvedUrls.add(card.url.toLowerCase().replace(/\/$/, ""));
    }
  }

  // Build set of existing topic_ids
  const coveredTopicIds = new Set<string>();
  for (const card of existingCards) {
    for (const tid of card.topic_ids ?? []) {
      coveredTopicIds.add(tid);
    }
  }

  // 2. Generate DSA problem recommendations
  const suggestedProblems = generateProblemRecommendations(
    weakness.weakSpots,
    solvedUrls,
    Math.ceil(limit * 0.6), // ~60% problems
  );

  // 3. Generate CS topic recommendations
  const suggestedTopics = generateTopicRecommendations(
    weakness.weakSpots,
    coveredTopicIds,
    Math.ceil(limit * 0.4), // ~40% topics
  );

  // 4. Generate priority actions
  const priorityActions = generatePriorityActions(
    weakness,
    suggestedProblems,
    suggestedTopics,
  );

  return {
    suggestedProblems,
    suggestedTopics,
    priorityActions,
  };
}

// ── DSA Problem Recommendations ─────────────────────────────────

function generateProblemRecommendations(
  weakSpots: WeakSpot[],
  solvedUrls: Set<string>,
  limit: number,
): SuggestedProblem[] {
  const allProblems = getAllProblems();
  const suggested: SuggestedProblem[] = [];
  const usedUrls = new Set<string>();

  // Get top weak tags (only tag-type, not topic IDs)
  const weakTags = weakSpots
    .filter((w) => w.keyType === "tag" && w.score >= 20)
    .slice(0, 5);

  // 1. Recovery problems — from weakest tags, easier difficulty
  for (const tag of weakTags.slice(0, 2)) {
    const targetDifficulty = chooseDifficulty(tag.score);
    const candidates = allProblems.filter((p) => {
      const url = p.url.toLowerCase().replace(/\/$/, "");
      if (solvedUrls.has(url) || usedUrls.has(url)) return false;
      if (!p.tags.some((t) => t.toLowerCase() === tag.key.toLowerCase())) return false;
      // For recovery, prefer easier than or equal to target
      const diffRank = { easy: 0, medium: 1, hard: 2 };
      return diffRank[p.difficulty] <= diffRank[targetDifficulty];
    });

    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      usedUrls.add(pick.url.toLowerCase().replace(/\/$/, ""));
      suggested.push({
        ...pick,
        reason: `Strengthen "${tag.key}" (${tag.recentFailRate}% recent fail rate)`,
        category: "recovery",
      });
    }
  }

  // 2. Strengthen problems — from moderately weak tags
  for (const tag of weakTags.slice(0, 3)) {
    if (suggested.length >= limit - 1) break;

    const candidates = allProblems.filter((p) => {
      const url = p.url.toLowerCase().replace(/\/$/, "");
      if (solvedUrls.has(url) || usedUrls.has(url)) return false;
      return p.tags.some((t) => t.toLowerCase() === tag.key.toLowerCase());
    });

    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      usedUrls.add(pick.url.toLowerCase().replace(/\/$/, ""));
      suggested.push({
        ...pick,
        reason: `Practice "${tag.key}" to improve retention`,
        category: "strengthen",
      });
    }
  }

  // 3. Stretch problem — harder problem from any tag
  if (suggested.length < limit) {
    const hardProblems = allProblems.filter((p) => {
      const url = p.url.toLowerCase().replace(/\/$/, "");
      return !solvedUrls.has(url) && !usedUrls.has(url) && p.difficulty === "hard";
    });

    if (hardProblems.length > 0) {
      const pick = hardProblems[Math.floor(Math.random() * hardProblems.length)];
      usedUrls.add(pick.url.toLowerCase().replace(/\/$/, ""));
      suggested.push({
        ...pick,
        reason: "Stretch challenge to push your limits",
        category: "stretch",
      });
    }
  }

  // 4. Fill remaining slots with random unsolved problems
  while (suggested.length < limit) {
    const candidates = allProblems.filter((p) => {
      const url = p.url.toLowerCase().replace(/\/$/, "");
      return !solvedUrls.has(url) && !usedUrls.has(url);
    });

    if (candidates.length === 0) break;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    usedUrls.add(pick.url.toLowerCase().replace(/\/$/, ""));
    suggested.push({
      ...pick,
      reason: "Explore new problem patterns",
      category: "strengthen",
    });
  }

  return suggested;
}

// ── CS Topic Recommendations ────────────────────────────────────

function generateTopicRecommendations(
  weakSpots: WeakSpot[],
  coveredTopicIds: Set<string>,
  limit: number,
): SuggestedTopic[] {
  const suggested: SuggestedTopic[] = [];
  const usedIds = new Set<string>();

  // 1. Topics referenced in weak spots but with poor coverage
  const weakTopicSpots = weakSpots
    .filter((w) => w.keyType === "topic" && w.score >= 20)
    .slice(0, 3);

  for (const spot of weakTopicSpots) {
    if (suggested.length >= limit) break;
    if (usedIds.has(spot.key)) continue;

    const topic = CS_TOPICS.find((t) => t.id === spot.key);
    if (!topic) continue;

    usedIds.add(topic.id);
    suggested.push({
      topicId: topic.id,
      domain: topic.domain,
      label: topic.label,
      description: topic.description,
      reason: `Weak area: ${spot.recentFailRate}% recent fail rate on ${spot.cardCount} cards`,
      subtopics: topic.subtopics,
      suggestedCardCount: Math.max(3, Math.ceil(spot.cardCount * 0.3)),
    });
  }

  // 2. Uncovered topics — topics the user has no cards for yet
  const allDomains = ["cs", "database", "system-design", "devops", "cloud", "web"] as const;

  for (const domain of allDomains) {
    if (suggested.length >= limit) break;

    const domainTopics = getTopicsByDomain(domain);
    const uncovered = domainTopics.filter(
      (t) => !coveredTopicIds.has(t.id) && !usedIds.has(t.id),
    );

    if (uncovered.length > 0) {
      // Pick the first uncovered topic in this domain
      const topic = uncovered[0];
      usedIds.add(topic.id);
      suggested.push({
        topicId: topic.id,
        domain: topic.domain,
        label: topic.label,
        description: topic.description,
        reason: `New topic: no cards in your collection for this yet`,
        subtopics: topic.subtopics,
        suggestedCardCount: 5,
      });
    }
  }

  return suggested.slice(0, limit);
}

// ── Priority Actions ────────────────────────────────────────────

function generatePriorityActions(
  weakness: { totalOverdueCards: number; overallFailRate: number; weakSpots: WeakSpot[] },
  problems: SuggestedProblem[],
  topics: SuggestedTopic[],
): PriorityAction[] {
  const actions: PriorityAction[] = [];

  // Overdue review action
  if (weakness.totalOverdueCards > 0) {
    actions.push({
      id: "review-overdue",
      type: "review",
      message: `Review ${Math.min(20, weakness.totalOverdueCards)} overdue cards to maintain retention.`,
      priority: weakness.totalOverdueCards > 10 ? "high" : "medium",
    });
  }

  // Recovery problems action
  const recoveryProblems = problems.filter((p) => p.category === "recovery");
  if (recoveryProblems.length > 0) {
    actions.push({
      id: "solve-recovery",
      type: "solve",
      message: `Solve ${recoveryProblems.length} recovery problem${recoveryProblems.length !== 1 ? "s" : ""} in your weak areas: ${recoveryProblems.map((p) => p.tags[0]).join(", ")}.`,
      priority: "high",
    });
  }

  // New topic study action
  const newTopics = topics.filter((t) => t.reason.startsWith("New topic"));
  if (newTopics.length > 0) {
    actions.push({
      id: "study-new-topic",
      type: "study",
      message: `Start studying "${newTopics[0].label}" and create ${newTopics[0].suggestedCardCount} flashcards.`,
      priority: "medium",
    });
  }

  // Card creation action for weak topics
  const weakTopics = topics.filter((t) => !t.reason.startsWith("New topic"));
  if (weakTopics.length > 0) {
    actions.push({
      id: "create-cards-weak",
      type: "create_cards",
      message: `Create more cards for "${weakTopics[0].label}" to improve coverage.`,
      priority: "low",
    });
  }

  // Stretch challenge
  const stretchProblems = problems.filter((p) => p.category === "stretch");
  if (stretchProblems.length > 0) {
    actions.push({
      id: "solve-stretch",
      type: "solve",
      message: `Try a stretch problem: "${stretchProblems[0].title}" (${stretchProblems[0].difficulty}).`,
      priority: "low",
    });
  }

  return actions;
}
