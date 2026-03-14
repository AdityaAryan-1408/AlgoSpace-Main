'use client';

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { X, Download, Loader2, Check, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { PROBLEM_LISTS } from "@/data/problem-lists";
import type { ProblemList, ProblemListItem } from "@/data/problem-lists";
import { createCard } from "@/lib/client-api";
import type { Flashcard } from "@/data";

interface Props {
    onClose: () => void;
    onImported: () => void;
    existingCards: Flashcard[];
}

export function ImportListModal({ onClose, onImported, existingCards }: Props) {
    const [selectedList, setSelectedList] = useState<ProblemList | null>(null);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0, skipped: 0 });
    const [isDone, setIsDone] = useState(false);

    // Get existing URLs to avoid duplicates
    const existingUrls = new Set(existingCards.map((c) => c.url?.replace(/\/$/, "")));

    const getNewProblems = (list: ProblemList): ProblemListItem[] => {
        return list.problems.filter(
            (p) => !existingUrls.has(p.url.replace(/\/$/, "")),
        );
    };

    const handleImport = async () => {
        if (!selectedList) return;
        setImporting(true);

        const newProblems = getNewProblems(selectedList);
        const skipped = selectedList.problems.length - newProblems.length;
        setProgress({ done: 0, total: newProblems.length, skipped });

        for (let i = 0; i < newProblems.length; i++) {
            const p = newProblems[i];
            try {
                await createCard({
                    type: "leetcode",
                    title: p.title,
                    description: `Imported from ${selectedList.name}. Visit the problem link to see the full description.`,
                    difficulty: p.difficulty,
                    tags: p.tags,
                    url: p.url,
                    notes: `Part of the **${selectedList.name}** list.`,
                });
            } catch (err) {
                console.error(`Failed to import "${p.title}":`, err);
            }
            setProgress({ done: i + 1, total: newProblems.length, skipped });
        }

        setIsDone(true);
        setImporting(false);
        onImported();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-card rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] border border-border"
            >
                {/* Header */}
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">
                            {selectedList ? selectedList.name : "Import Problem List"}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {selectedList
                                ? `${selectedList.problems.length} problems • ${getNewProblems(selectedList).length} new`
                                : "Choose a curated problem list to import"}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full shrink-0">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isDone ? (
                        <div className="text-center py-8 flex flex-col items-center gap-3">
                            <div className="w-14 h-14 rounded-full bg-easy/20 flex items-center justify-center">
                                <Check className="w-7 h-7 text-easy" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground">Import Complete!</h3>
                            <p className="text-sm text-muted-foreground">
                                Added {progress.done} new card{progress.done !== 1 ? "s" : ""}.
                                {progress.skipped > 0 && ` Skipped ${progress.skipped} duplicate${progress.skipped !== 1 ? "s" : ""}.`}
                            </p>
                            <Button onClick={onClose} className="mt-4 rounded-full px-6">
                                Back to Dashboard
                            </Button>
                        </div>
                    ) : importing ? (
                        <div className="py-8 flex flex-col items-center gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            <p className="text-sm font-medium text-foreground">
                                Importing {progress.done}/{progress.total}...
                            </p>
                            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                    style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                                />
                            </div>
                            {progress.skipped > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    {progress.skipped} duplicate{progress.skipped !== 1 ? "s" : ""} skipped
                                </p>
                            )}
                        </div>
                    ) : selectedList ? (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">{selectedList.description}</p>

                            {getNewProblems(selectedList).length === 0 ? (
                                <div className="p-4 rounded-xl bg-medium-bg border border-medium/20 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-medium shrink-0" />
                                    <span className="text-sm text-medium">
                                        All problems from this list are already in your collection!
                                    </span>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-wrap gap-2">
                                        {["easy", "medium", "hard"].map((d) => {
                                            const count = getNewProblems(selectedList).filter((p) => p.difficulty === d).length;
                                            if (count === 0) return null;
                                            return (
                                                <Badge key={d} variant={d as "easy" | "medium" | "hard"} className="capitalize bg-transparent border-current text-current">
                                                    {count} {d}
                                                </Badge>
                                            );
                                        })}
                                    </div>

                                    <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
                                        {getNewProblems(selectedList).map((p, i) => (
                                            <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-border last:border-0 text-sm">
                                                <span className="text-foreground truncate mr-2">{p.title}</span>
                                                <Badge variant={p.difficulty} className="capitalize bg-transparent border-current text-current shrink-0 text-[10px]">
                                                    {p.difficulty}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            <div className="flex gap-2 pt-2">
                                <Button variant="ghost" onClick={() => setSelectedList(null)} className="flex-1 font-semibold">
                                    ← Back
                                </Button>
                                <Button
                                    onClick={handleImport}
                                    disabled={getNewProblems(selectedList).length === 0}
                                    className="flex-1 gap-2 font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-full"
                                >
                                    <Download className="w-4 h-4" />
                                    Import {getNewProblems(selectedList).length} Cards
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {PROBLEM_LISTS.map((list) => {
                                const newCount = getNewProblems(list).length;
                                return (
                                    <motion.button
                                        key={list.id}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={() => setSelectedList(list)}
                                        className="w-full p-4 rounded-xl border border-border hover:border-blue-500/40 bg-card transition-all cursor-pointer text-left"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-foreground">{list.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {list.count} problems • {newCount} new
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2">{list.description}</p>
                                    </motion.button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
