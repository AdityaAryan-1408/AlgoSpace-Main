'use client';

import type { Flashcard } from "@/data";

interface Props {
    cards: Flashcard[];
}

export function ProblemCountWidget({ cards }: Props) {
    const easy = cards.filter((c) => c.difficulty === "easy").length;
    const medium = cards.filter((c) => c.difficulty === "medium").length;
    const hard = cards.filter((c) => c.difficulty === "hard").length;
    const total = cards.length;

    const segments = [
        { label: "Easy", count: easy, color: "bg-easy", textColor: "text-easy" },
        { label: "Medium", count: medium, color: "bg-medium", textColor: "text-medium" },
        { label: "Hard", count: hard, color: "bg-hard", textColor: "text-hard" },
    ];

    return (
        <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Problems Solved</h3>
                <span className="text-2xl font-bold tabular-nums text-foreground">{total}</span>
            </div>

            {/* Stacked bar */}
            {total > 0 && (
                <div className="h-3 w-full rounded-full overflow-hidden flex mb-3">
                    {segments.map((seg) =>
                        seg.count > 0 ? (
                            <div
                                key={seg.label}
                                className={`${seg.color} h-full transition-all duration-500`}
                                style={{ width: `${(seg.count / total) * 100}%` }}
                                title={`${seg.label}: ${seg.count}`}
                            />
                        ) : null,
                    )}
                </div>
            )}

            {/* Counts */}
            <div className="grid grid-cols-3 gap-2">
                {segments.map((seg) => (
                    <div key={seg.label} className="flex flex-col items-center">
                        <span className={`text-lg font-bold tabular-nums ${seg.textColor}`}>
                            {seg.count}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                            {seg.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
