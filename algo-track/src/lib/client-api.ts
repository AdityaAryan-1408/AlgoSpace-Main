import type { Flashcard, CardSolution, RelatedProblem } from "@/data";
import type {
    CoachContext,
    RecoveryModePlan,
    SkillNodeProgress,
} from "@/lib/analytics-engine";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`/api${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    });

    const body = await res.json().catch(() => ({ error: "Failed to parse response" }));

    if (!res.ok) {
        throw new Error(body.error || `Request failed: ${res.status}`);
    }

    return body as T;
}

export async function fetchAllCards(): Promise<Flashcard[]> {
    const data = await apiFetch<{ cards: Flashcard[] }>("/cards");
    return data.cards;
}

export async function fetchDueCards(): Promise<Flashcard[]> {
    const data = await apiFetch<{ cards: Flashcard[] }>("/cards?dueOnly=true");
    return data.cards;
}

export async function createCard(input: {
    type: "leetcode" | "cs";
    title: string;
    description: string;
    difficulty: "easy" | "medium" | "hard";
    tags?: string[];
    notes?: string;
    solution?: string;
    solutions?: CardSolution[];
    timeComplexity?: string;
    spaceComplexity?: string;
    relatedProblems?: RelatedProblem[];
    url?: string;
    reviewInDays?: number;
    // New fields
    source?: string;
    solvedAt?: string;
    topicDomain?: string;
    topicIds?: string[];
    metadata?: Record<string, unknown>;
}): Promise<Flashcard> {
    const data = await apiFetch<{ card: Flashcard }>("/cards", {
        method: "POST",
        body: JSON.stringify(input),
    });
    return data.card;
}

export async function deleteCard(cardId: string): Promise<void> {
    await apiFetch(`/cards/${cardId}`, { method: "DELETE" });
}

export async function fetchCardDetails(cardId: string): Promise<Flashcard> {
    const data = await apiFetch<{ card: Flashcard }>(`/cards/${cardId}`);
    return data.card;
}

export async function updateCard(
    cardId: string,
    updates: {
        title?: string;
        description?: string;
        url?: string | null;
        difficulty?: "easy" | "medium" | "hard";
        notes?: string;
        tags?: string[];
        solution?: string | null;
        solutions?: CardSolution[] | null;
        timeComplexity?: string | null;
        spaceComplexity?: string | null;
        relatedProblems?: RelatedProblem[] | null;
        solvedAt?: string | null;
        topicDomain?: string | null;
        topicIds?: string[];
        metadata?: Record<string, unknown>;
    },
): Promise<Flashcard> {
    const data = await apiFetch<{ card: Flashcard }>(`/cards/${cardId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
    });
    return data.card;
}

export async function submitCardReview(
    cardId: string,
    rating: "AGAIN" | "HARD" | "GOOD" | "EASY",
    responseMs?: number,
    manualReviewDays?: number,
): Promise<{ card: Flashcard }> {
    return apiFetch("/reviews", {
        method: "POST",
        body: JSON.stringify({ cardId, rating, responseMs, manualReviewDays }),
    });
}

export async function fetchDashboardStats(): Promise<{
    cardsDueToday: number;
    totalCards: number;
}> {
    const data = await apiFetch<{
        stats: { cardsDueToday: number; totalCards: number };
    }>("/dashboard");
    return data.stats;
}

export interface AnalyticsData {
    performance: Array<{
        date: string;
        total: number;
        good: number;
        accuracy: number | null;
    }>;
    topics: Array<{
        topic: string;
        mastery: number;
        cardCount: number;
        reviewedCount: number;
    }>;
    streak: {
        currentStreak: number;
        longestStreak: number;
        totalReviewDays: number;
    };
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
    return apiFetch<AnalyticsData>("/analytics");
}

// ── Phase 3: Analytics Engine ───────────────────────────────────

export type { CoachContext, RecoveryModePlan, SkillNodeProgress };

export async function fetchCoachOverview(): Promise<CoachContext> {
    return apiFetch<CoachContext>("/coach/overview");
}

export async function fetchRecoveryPlan(): Promise<RecoveryModePlan> {
    return apiFetch<RecoveryModePlan>("/coach/recovery");
}

export async function fetchSkillTreeProgress(): Promise<{
    nodes: SkillNodeProgress[];
}> {
    return apiFetch<{ nodes: SkillNodeProgress[] }>("/skill-tree");
}

// ── Phase 4: Goal CRUD ──────────────────────────────────────────

import type { Goal } from "@/types";
import type { GoalProgressMetrics, GoalPacingMetrics } from "@/lib/analytics-engine";
import type { CreateGoalInput, UpdateGoalInput } from "@/lib/goals";

export type { Goal, GoalProgressMetrics, GoalPacingMetrics, CreateGoalInput, UpdateGoalInput };

export async function fetchGoals(status?: string): Promise<Goal[]> {
    const qs = status ? `?status=${status}` : "";
    const data = await apiFetch<{ goals: Goal[] }>(`/goals${qs}`);
    return data.goals;
}

export async function fetchGoalById(goalId: string): Promise<Goal> {
    const data = await apiFetch<{ goal: Goal }>(`/goals/${goalId}`);
    return data.goal;
}

export async function createGoalApi(input: CreateGoalInput): Promise<Goal> {
    const data = await apiFetch<{ goal: Goal }>("/goals", {
        method: "POST",
        body: JSON.stringify(input),
    });
    return data.goal;
}

export async function updateGoalApi(
    goalId: string,
    updates: UpdateGoalInput,
): Promise<Goal> {
    const data = await apiFetch<{ goal: Goal }>(`/goals/${goalId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
    });
    return data.goal;
}

export async function deleteGoalApi(goalId: string): Promise<void> {
    await apiFetch(`/goals/${goalId}`, { method: "DELETE" });
}

export async function fetchGoalProgress(goalId: string): Promise<{
    progress: GoalProgressMetrics;
    pacing: GoalPacingMetrics | null;
}> {
    return apiFetch(`/goals/${goalId}/progress`);
}

// ── Phase 5: Smart Nudges ───────────────────────────────────────

import type {
    SmartNudgesResult,
    DailyActionPlan,
} from "@/lib/nudge-engine";

export type { SmartNudgesResult, DailyActionPlan };

export async function fetchSmartNudges(): Promise<SmartNudgesResult> {
    return apiFetch<SmartNudgesResult>("/coach/nudges");
}

export async function fetchDailyActionPlan(
    goalId: string,
): Promise<DailyActionPlan> {
    return apiFetch<DailyActionPlan>(`/goals/${goalId}/daily-plan`);
}

// ── Phase 6: Recovery Mode ──────────────────────────────────────

import type {
    RecoveryPlanPreview,
    RecoveryApplyResult,
} from "@/lib/recovery-planner";

export type { RecoveryPlanPreview, RecoveryApplyResult };

export async function fetchRecoveryPreview(): Promise<RecoveryPlanPreview> {
    return apiFetch<RecoveryPlanPreview>("/coach/recovery?preview=true");
}

export async function applyRecoveryPlanApi(options?: {
    deferByDays?: number;
    flattenOverDays?: number;
}): Promise<RecoveryApplyResult> {
    return apiFetch<RecoveryApplyResult>("/coach/recovery", {
        method: "POST",
        body: JSON.stringify(options ?? {}),
    });
}

// ── Phase 8: Recommendation Engine ──────────────────────────────

import type { RecommendationResult } from "@/lib/recommendation-engine";

export type { RecommendationResult };

export async function fetchRecommendations(
    limit?: number,
): Promise<RecommendationResult> {
    const qs = limit ? `?limit=${limit}` : "";
    return apiFetch<RecommendationResult>(`/coach/recommendations${qs}`);
}

// ── Phase 10: Socratic Chat Window ──────────────────────────────

import type { ChatThread, ChatMessage, ChatMode } from "@/types";

export async function fetchChatThreads(): Promise<{ threads: ChatThread[] }> {
    return apiFetch<{ threads: ChatThread[] }>("/coach/chat");
}

export async function fetchChatMessages(threadId: string): Promise<{ messages: ChatMessage[] }> {
    return apiFetch<{ messages: ChatMessage[] }>(`/coach/chat?threadId=${threadId}`);
}

export async function createChatThread(
    mode: ChatMode,
    title: string,
    cardId?: string
): Promise<{ thread: ChatThread; messages: ChatMessage[] }> {
    return apiFetch<{ thread: ChatThread; messages: ChatMessage[] }>("/coach/chat", {
        method: "POST",
        body: JSON.stringify({ action: "create_thread", mode, title, cardId }),
    });
}

export async function sendChatMessage(
    threadId: string,
    content: string,
    mode: ChatMode
): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage }> {
    return apiFetch<{ userMessage: ChatMessage; assistantMessage: ChatMessage }>("/coach/chat", {
        method: "POST",
        body: JSON.stringify({ action: "send_message", threadId, content, mode }),
    });
}

export async function deleteChatThread(threadId: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/coach/chat?threadId=${threadId}`, {
        method: "DELETE",
    });
}

// ── Phase 11: Dynamic Skill Trees ───────────────────────────────

// ── Phase 12: Stress Mode ───────────────────────────────────────

export async function startStressMode(limit = 3) {
    return apiFetch<{ sessionId: string | null; candidates: any[]; message?: string }>("/stress-mode/start", {
        method: "POST",
        body: JSON.stringify({ limit }),
    });
}

export async function completeStressMode(payload: {
    sessionId: string;
    status: "completed" | "abandoned";
    durationMs: number;
    cardsCompleted: number;
    results: Array<{ cardId: string; rating: string; timeSpentMs: number }>;
}) {
    return apiFetch<{ success: boolean }>("/stress-mode/complete", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}


