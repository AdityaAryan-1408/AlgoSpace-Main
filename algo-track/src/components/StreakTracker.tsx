'use client';

import { Flame, Trophy, Calendar } from "lucide-react";
import type { AnalyticsData } from "@/lib/client-api";

interface Props {
    streak: AnalyticsData["streak"];
}

export function StreakTracker({ streak }: Props) {
    const { currentStreak, longestStreak, totalReviewDays } = streak;

    return (
        <div className="grid grid-cols-3 gap-3">
            {/* Current Streak */}
            <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl border border-border bg-background">
                <Flame
                    className={`w-6 h-6 ${currentStreak > 0 ? "text-orange-500" : "text-muted-foreground"}`}
                />
                <span className={`text-2xl font-bold tabular-nums ${currentStreak > 0 ? "text-orange-500" : "text-muted-foreground"}`}>
                    {currentStreak}
                </span>
                <span className="text-xs text-muted-foreground">
                    Day streak
                </span>
            </div>

            {/* Longest Streak */}
            <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl border border-border bg-background">
                <Trophy className="w-6 h-6 text-amber-500" />
                <span className="text-2xl font-bold tabular-nums text-foreground">
                    {longestStreak}
                </span>
                <span className="text-xs text-muted-foreground">
                    Best streak
                </span>
            </div>

            {/* Total Review Days */}
            <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl border border-border bg-background">
                <Calendar className="w-6 h-6 text-blue-500" />
                <span className="text-2xl font-bold tabular-nums text-foreground">
                    {totalReviewDays}
                </span>
                <span className="text-xs text-muted-foreground">
                    Active days
                </span>
            </div>
        </div>
    );
}
