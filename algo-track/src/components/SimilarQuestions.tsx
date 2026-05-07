'use client';

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Flashcard } from "@/data";
import { Loader2, ExternalLink, Plus, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Suggestion {
    title: string;
    description: string;
    difficulty: "easy" | "medium" | "hard";
    isExisting: boolean;
    cardId: string | null;
    url: string | null;
    relevance: string;
}

interface SimilarQuestionsProps {
    card: Flashcard;
    allCards: Flashcard[];
    onAddToQueue?: (cardId: string) => void;
}

export function SimilarQuestions({ card, allCards, onAddToQueue }: SimilarQuestionsProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
    const [pattern, setPattern] = useState("");
    const [loading, setLoading] = useState(false);
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

    const handleFetch = async () => {
        if (suggestions) return; // Already fetched
        setLoading(true);
        try {
            const res = await fetch("/api/evaluate/similar-questions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    problemTitle: card.title,
                    problemDescription: card.description,
                    tags: card.tags,
                    difficulty: card.difficulty,
                    existingCards: allCards
                        .filter(c => c.type === "leetcode" && c.id !== card.id)
                        .map(c => ({ id: c.id, title: c.title, tags: c.tags })),
                }),
            });
            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            setSuggestions(data.suggestions || []);
            setPattern(data.pattern || "");
        } catch {
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = (cardId: string) => {
        setAddedIds(prev => new Set(prev).add(cardId));
        onAddToQueue?.(cardId);
    };

    return (
        <div className="mt-4">
            <button
                onClick={handleFetch}
                disabled={loading}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors cursor-pointer disabled:opacity-50"
            >
                <div className="flex items-center gap-2">
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    ) : (
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                    )}
                    Similar Problems
                    {pattern && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500">
                            {pattern}
                        </span>
                    )}
                </div>
            </button>

            <AnimatePresence>
                {suggestions && suggestions.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-2 rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                            {suggestions.map((s, i) => (
                                <div key={i} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-medium text-foreground truncate">{s.title}</span>
                                            <Badge
                                                variant={s.difficulty as "easy" | "medium" | "hard"}
                                                className="capitalize bg-transparent border-current text-current text-[9px] px-1.5 py-0 shrink-0"
                                            >
                                                {s.difficulty}
                                            </Badge>
                                            {s.isExisting && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 shrink-0">
                                                    In Library
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">{s.relevance}</p>
                                    </div>
                                    <div className="shrink-0">
                                        {s.isExisting && s.cardId ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleAdd(s.cardId!)}
                                                disabled={addedIds.has(s.cardId)}
                                                className="text-xs gap-1 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/10"
                                            >
                                                {addedIds.has(s.cardId) ? "Added ✓" : <><Plus className="w-3 h-3" /> Queue</>}
                                            </Button>
                                        ) : s.url ? (
                                            <a
                                                href={s.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                            >
                                                <ExternalLink className="w-3 h-3" /> Open
                                            </a>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
