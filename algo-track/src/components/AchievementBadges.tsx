'use client';

import { Award, Lock } from "lucide-react";
import type { AnalyticsData } from "@/lib/client-api";
import type { Flashcard } from "@/data";

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

interface Props {
    cards: Flashcard[];
    streak: AnalyticsData["streak"];
}

export function AchievementBadges({ cards, streak }: Props) {
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
        <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center gap-2 mb-4">
                <Award className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-foreground">
                    Achievements
                    <span className="text-xs text-muted-foreground font-normal ml-2">
                        {unlocked.length}/{BADGES.length} unlocked
                    </span>
                </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {unlocked.map((badge) => (
                    <div
                        key={badge.id}
                        className="flex flex-col items-center gap-1 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 transition-transform hover:scale-105"
                        title={badge.description}
                    >
                        <span className="text-2xl">{badge.icon}</span>
                        <span className="text-[11px] font-semibold text-foreground text-center leading-tight">
                            {badge.title}
                        </span>
                        <span className="text-[9px] text-muted-foreground text-center leading-tight">
                            {badge.description}
                        </span>
                    </div>
                ))}

                {locked.map((badge) => (
                    <div
                        key={badge.id}
                        className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted/30 border border-border opacity-50"
                        title={`Locked: ${badge.description}`}
                    >
                        <Lock className="w-5 h-5 text-muted-foreground" />
                        <span className="text-[11px] font-semibold text-muted-foreground text-center leading-tight">
                            {badge.title}
                        </span>
                        <span className="text-[9px] text-muted-foreground text-center leading-tight">
                            {badge.description}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
