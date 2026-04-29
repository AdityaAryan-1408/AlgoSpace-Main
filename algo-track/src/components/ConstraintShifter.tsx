'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Flashcard } from "@/data";
import {
    Shuffle,
    Loader2,
    AlertTriangle,
    Lightbulb,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ConstraintResult {
    constraint: string;
    hint: string;
    difficulty: "medium" | "hard";
    category: string;
}

interface ConstraintShifterProps {
    card: Flashcard;
    onDismiss: () => void;
}

const CONSTRAINT_CACHE_KEY = "algotrack-constraint-";

function getCachedConstraint(cardId: string): ConstraintResult | null {
    try {
        const raw = localStorage.getItem(CONSTRAINT_CACHE_KEY + cardId);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Expire after 24 hours
        if (Date.now() - parsed.timestamp > 86_400_000) {
            localStorage.removeItem(CONSTRAINT_CACHE_KEY + cardId);
            return null;
        }
        return parsed.result;
    } catch {
        return null;
    }
}

function cacheConstraint(cardId: string, result: ConstraintResult) {
    try {
        localStorage.setItem(
            CONSTRAINT_CACHE_KEY + cardId,
            JSON.stringify({ result, timestamp: Date.now() })
        );
    } catch {
        // Storage full
    }
}

/**
 * Checks if a card qualifies for constraint shifting.
 * A card qualifies when it has been rated EASY at least 3 times.
 */
export function shouldShowConstraintShifter(card: Flashcard): boolean {
    if (!card.history) return false;
    const easyCount = card.lastRating === "EASY" ? card.history.good : 0;
    // Show if total is >= 3 and most recent rating is EASY
    return card.history.total >= 3 && card.lastRating === "EASY";
}

export function ConstraintShifter({ card, onDismiss }: ConstraintShifterProps) {
    const [constraint, setConstraint] = useState<ConstraintResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [showHint, setShowHint] = useState(false);

    useEffect(() => {
        const cached = getCachedConstraint(card.id);
        if (cached) {
            setConstraint(cached);
        }
    }, [card.id]);

    const fetchConstraint = async () => {
        setIsLoading(true);
        setError("");

        try {
            const getSavedSolution = () => {
                if (card.solutions && card.solutions.length > 0) {
                    return card.solutions.map((s) => `## ${s.name}\n${s.content}`).join("\n\n");
                }
                return card.solution || "";
            };

            const res = await fetch("/api/evaluate/constraint", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    problemTitle: card.title,
                    problemDescription: card.description,
                    savedSolution: getSavedSolution(),
                    cardType: card.type,
                    easyCount: card.history.good,
                }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Failed to generate constraint");
            }

            const result: ConstraintResult = await res.json();
            setConstraint(result);
            cacheConstraint(card.id, result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate constraint");
        } finally {
            setIsLoading(false);
        }
    };

    const generateNew = async () => {
        localStorage.removeItem(CONSTRAINT_CACHE_KEY + card.id);
        setConstraint(null);
        setShowHint(false);
        await fetchConstraint();
    };

    const categoryColors: Record<string, string> = {
        space: "text-blue-500 bg-blue-500/10 border-blue-500/20",
        time: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        approach: "text-purple-500 bg-purple-500/10 border-purple-500/20",
        "edge-case": "text-orange-500 bg-orange-500/10 border-orange-500/20",
        "in-place": "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
        depth: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
        application: "text-pink-500 bg-pink-500/10 border-pink-500/20",
        comparison: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden"
        >
            <div className="px-4 py-3 flex items-center justify-between border-b border-amber-500/10">
                <div className="flex items-center gap-2">
                    <Shuffle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
                        Constraint Shift
                    </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                    You&apos;ve mastered this — try a twist!
                </span>
            </div>

            <div className="p-4">
                {!constraint && !isLoading && !error && (
                    <div className="flex flex-col items-center gap-3 py-3">
                        <p className="text-sm text-foreground/80 text-center max-w-sm">
                            You&apos;ve rated this card <strong>Easy</strong> multiple times. 
                            Ready for an extra challenge?
                        </p>
                        <Button
                            onClick={fetchConstraint}
                            className="gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full px-6 py-4 font-semibold"
                        >
                            <Shuffle className="w-4 h-4" />
                            Generate Constraint
                        </Button>
                    </div>
                )}

                {isLoading && (
                    <div className="flex items-center justify-center gap-2 py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                        <span className="text-sm text-muted-foreground">
                            Generating constraint...
                        </span>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <span className="text-sm text-red-500">{error}</span>
                    </div>
                )}

                <AnimatePresence>
                    {constraint && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-3"
                        >
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-sm font-semibold text-foreground leading-relaxed">
                                    {constraint.constraint}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Badge
                                    variant={constraint.difficulty === "hard" ? "hard" : "medium"}
                                    className="capitalize bg-transparent border-current text-current text-[10px]"
                                >
                                    {constraint.difficulty}
                                </Badge>
                                {constraint.category && (
                                    <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                        categoryColors[constraint.category] || "text-muted-foreground bg-muted border-border"
                                    }`}>
                                        {constraint.category}
                                    </span>
                                )}
                            </div>

                            {/* Hint toggle */}
                            <button
                                onClick={() => setShowHint(!showHint)}
                                className="flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors cursor-pointer"
                            >
                                <Lightbulb className="w-3.5 h-3.5" />
                                {showHint ? "Hide Hint" : "Show Hint"}
                                {showHint ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            <AnimatePresence>
                                {showHint && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs text-foreground/80">
                                            <Lightbulb className="w-3.5 h-3.5 text-amber-500 inline mr-1" />
                                            {constraint.hint}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="flex items-center gap-2 pt-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={generateNew}
                                    disabled={isLoading}
                                    className="text-xs text-muted-foreground hover:text-foreground gap-1"
                                >
                                    <Shuffle className="w-3 h-3" />
                                    Different Constraint
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex justify-end mt-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDismiss}
                        className="text-xs text-muted-foreground"
                    >
                        Dismiss
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
