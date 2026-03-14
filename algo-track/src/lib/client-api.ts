import type { Flashcard, CardSolution, RelatedProblem } from "@/data";

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

export async function updateCard(
    cardId: string,
    updates: { notes?: string; tags?: string[] },
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
): Promise<{ card: Flashcard }> {
    return apiFetch("/reviews", {
        method: "POST",
        body: JSON.stringify({ cardId, rating, responseMs }),
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
