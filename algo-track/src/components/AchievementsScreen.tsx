'use client';

import { useState, useEffect } from "react";
import { Award, Lock, Loader2 } from "lucide-react";
import type { AnalyticsData } from "@/lib/client-api";
import type { Flashcard } from "@/data";
import { fetchAllCards, fetchAnalytics } from "@/lib/client-api";

interface BadgeDef {
    id: string;
    icon: string;
    title: string;
    description: string;
    check: (ctx: BadgeContext) => boolean;
}

interface BadgeContext {
    totalCards: number;
    totalReviewDays: number;
    currentStreak: number;
    longestStreak: number;
    easyCount: number;
    mediumCount: number;
    hardCount: number;
}

const BADGES: BadgeDef[] = [
    {
        id: "first-card",
        icon: "🌱",
        title: "First Seed",
        description: "Add your first card",
        check: (ctx) => ctx.totalCards >= 1,
    },
    {
        id: "10-cards",
        icon: "📚",
        title: "Getting Started",
        description: "Add 10 cards",
        check: (ctx) => ctx.totalCards >= 10,
    },
    {
        id: "25-cards",
        icon: "📖",
        title: "Bookworm",
        description: "Add 25 cards",
        check: (ctx) => ctx.totalCards >= 25,
    },
    {
        id: "50-cards",
        icon: "🗃️",
        title: "Half Century",
        description: "Add 50 cards",
        check: (ctx) => ctx.totalCards >= 50,
    },
    {
        id: "100-cards",
        icon: "💯",
        title: "Centurion",
        description: "Add 100 cards",
        check: (ctx) => ctx.totalCards >= 100,
    },
    {
        id: "first-review",
        icon: "✅",
        title: "First Step",
        description: "Complete your first review day",
        check: (ctx) => ctx.totalReviewDays >= 1,
    },
    {
        id: "7-day-streak",
        icon: "🔥",
        title: "On Fire",
        description: "7-day review streak",
        check: (ctx) => ctx.longestStreak >= 7,
    },
    {
        id: "14-day-streak",
        icon: "⚡",
        title: "Unstoppable",
        description: "14-day review streak",
        check: (ctx) => ctx.longestStreak >= 14,
    },
    {
        id: "30-day-streak",
        icon: "👑",
        title: "Royalty",
        description: "30-day review streak",
        check: (ctx) => ctx.longestStreak >= 30,
    },
    {
        id: "easy-10",
        icon: "🟢",
        title: "Easy Peasy",
        description: "Solve 10 Easy problems",
        check: (ctx) => ctx.easyCount >= 10,
    },
    {
        id: "medium-10",
        icon: "🟡",
        title: "Stepping Up",
        description: "Solve 10 Medium problems",
        check: (ctx) => ctx.mediumCount >= 10,
    },
    {
        id: "hard-5",
        icon: "🔴",
        title: "Hard Hitter",
        description: "Solve 5 Hard problems",
        check: (ctx) => ctx.hardCount >= 5,
    },
    {
        id: "hard-10",
        icon: "💎",
        title: "Diamond Grinder",
        description: "Solve 10 Hard problems",
        check: (ctx) => ctx.hardCount >= 10,
    },
    {
        id: "30-review-days",
        icon: "📅",
        title: "Habit Formed",
        description: "Review on 30 different days",
        check: (ctx) => ctx.totalReviewDays >= 30,
    },
];

export function AchievementsScreen() {
    const [cards, setCards] = useState<Flashcard[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([fetchAllCards(), fetchAnalytics()])
            .then(([fetchedCards, fetchedAnalytics]) => {
                setCards(fetchedCards);
                setAnalytics(fetchedAnalytics);
            })
            .catch((err) => console.error("Failed to load achievements data", err))
            .finally(() => setLoading(false));
    }, []);

    if (loading || !analytics) {
        return (
            <div className="flex-1 flex items-center justify-center p-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const streak = analytics.streak;
    const ctx: BadgeContext = {
        totalCards: cards.length,
        totalReviewDays: streak.totalReviewDays,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        easyCount: cards.filter((c) => c.difficulty === "easy").length,
        mediumCount: cards.filter((c) => c.difficulty === "medium").length,
        hardCount: cards.filter((c) => c.difficulty === "hard").length,
    };

    const unlocked = BADGES.filter((b) => b.check(ctx));
    const locked = BADGES.filter((b) => !b.check(ctx));

    return (
        <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Achievements</h1>
                <p className="text-muted-foreground mt-1">
                    Track your milestones and build your routine.
                </p>
            </div>

            <div className="rounded-xl border border-border bg-background p-6">
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border">
                    <div className="p-3 bg-amber-500/10 rounded-xl">
                        <Award className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">
                            Unlocked Badges
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {unlocked.length} of {BADGES.length} obtained
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {unlocked.map((badge) => (
                        <div
                            key={badge.id}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 transition-transform hover:scale-105"
                            title={badge.description}
                        >
                            <span className="text-4xl">{badge.icon}</span>
                            <div className="text-center space-y-1">
                                <span className="block text-sm font-semibold text-foreground leading-tight">
                                    {badge.title}
                                </span>
                                <span className="block text-xs text-muted-foreground leading-tight">
                                    {badge.description}
                                </span>
                            </div>
                        </div>
                    ))}

                    {locked.map((badge) => (
                        <div
                            key={badge.id}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/30 border border-border opacity-50"
                            title={`Locked: ${badge.description}`}
                        >
                            <div className="relative">
                                <span className="text-4xl grayscale blur-[2px]">{badge.icon}</span>
                                <Lock className="absolute inset-0 m-auto w-6 h-6 text-muted-foreground drop-shadow-md" />
                            </div>
                            <div className="text-center space-y-1">
                                <span className="block text-sm font-semibold text-muted-foreground leading-tight">
                                    {badge.title}
                                </span>
                                <span className="block text-xs text-muted-foreground leading-tight">
                                    {badge.description}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
