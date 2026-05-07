'use client';

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Flashcard } from "@/data";
import { getCodeEvolution } from "@/components/CodeEvolution";
import { getStoredAiReview } from "@/components/CodePractice";
import { Loader2, AlertTriangle, ShieldAlert, Eye, EyeOff, Zap, Bug } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AntiPatternsProps {
    cards: Flashcard[];
    onExit: () => void;
}

interface AntiPattern {
    name: string;
    description: string;
    frequency: string;
    severity: "high" | "medium" | "low";
    challenge: {
        title: string;
        buggyCode: string;
        hint: string;
        fix: string;
    };
}

interface AnalysisResult {
    patterns: AntiPattern[];
    overallAssessment: string;
}

export function AntiPatterns({ cards, onExit }: AntiPatternsProps) {
    const [phase, setPhase] = useState<"intro" | "loading" | "results">("intro");
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState("");
    const [expandedChallenge, setExpandedChallenge] = useState<number | null>(null);
    const [showFix, setShowFix] = useState<Set<number>>(new Set());

    // Collect code submissions from localStorage
    const submissions = useMemo(() => {
        const subs: Array<{ problem: string; code: string; rating: string }> = [];
        for (const card of cards.filter(c => c.type === "leetcode")) {
            const review = getStoredAiReview(card.id);
            if (review?.userCode) {
                subs.push({
                    problem: card.title,
                    code: review.userCode,
                    rating: review.result.suggestedRating,
                });
            }
            // Also pull from evolution snapshots
            const evo = getCodeEvolution(card.id);
            for (const snap of evo.slice(-1)) { // latest snapshot
                if (snap.code && !subs.some(s => s.code === snap.code)) {
                    subs.push({
                        problem: card.title,
                        code: snap.code,
                        rating: snap.rating || "GOOD",
                    });
                }
            }
        }
        return subs;
    }, [cards]);

    const handleAnalyze = async () => {
        if (submissions.length < 3) {
            setError("Need at least 3 code submissions to detect patterns. Complete more reviews first!");
            return;
        }
        setPhase("loading");
        setError("");
        try {
            const res = await fetch("/api/evaluate/anti-patterns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    codeSubmissions: submissions.slice(0, 15), // Send up to 15
                }),
            });
            if (!res.ok) throw new Error("Analysis failed");
            const data: AnalysisResult = await res.json();
            setAnalysis(data);
            setPhase("results");
        } catch {
            setError("Failed to analyze patterns");
            setPhase("intro");
        }
    };

    const toggleFix = (i: number) => {
        setShowFix(prev => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i); else next.add(i);
            return next;
        });
    };

    const severityColor = (s: string) =>
        s === "high" ? "text-red-500 bg-red-500/10 border-red-500/20" :
        s === "medium" ? "text-amber-500 bg-amber-500/10 border-amber-500/20" :
        "text-blue-500 bg-blue-500/10 border-blue-500/20";

    return (
        <div className="w-full max-w-3xl mx-auto p-4 md:p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
                        <Bug className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Personal Anti-Patterns</h2>
                        <p className="text-[10px] text-muted-foreground">AI-detected coding habits from your submissions</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={onExit}>Exit</Button>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm text-red-500">{error}</span>
                </div>
            )}

            {phase === "intro" && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-6 py-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                    <div className="text-center max-w-md">
                        <h3 className="text-xl font-bold text-foreground mb-1">Find Your Bad Habits</h3>
                        <p className="text-sm text-muted-foreground">
                            The AI will analyze your {submissions.length} code submissions across different problems
                            to identify recurring anti-patterns unique to your coding style.
                        </p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground text-center">
                        {submissions.length} submissions available from {cards.filter(c => c.type === "leetcode").length} DSA cards
                    </div>
                    <Button
                        onClick={handleAnalyze}
                        disabled={submissions.length < 3}
                        className="rounded-full px-8 py-5 text-base font-bold bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white gap-2 shadow-lg"
                    >
                        <Zap className="w-5 h-5" />
                        Analyze My Code
                    </Button>
                </motion.div>
            )}

            {phase === "loading" && (
                <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                    <p className="text-sm text-muted-foreground">Scanning {submissions.length} submissions for patterns...</p>
                </div>
            )}

            {phase === "results" && analysis && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
                    {/* Assessment */}
                    <div className="p-4 rounded-xl bg-muted/30 border border-border">
                        <p className="text-sm text-foreground/80 leading-relaxed">{analysis.overallAssessment}</p>
                    </div>

                    {/* Patterns */}
                    <div className="flex flex-col gap-3">
                        {analysis.patterns.map((pat, i) => (
                            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                                <button
                                    onClick={() => setExpandedChallenge(expandedChallenge === i ? null : i)}
                                    className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-muted/20 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${severityColor(pat.severity)}`}>
                                            {pat.severity}
                                        </span>
                                        <span className="text-sm font-semibold text-foreground truncate">{pat.name}</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground shrink-0">{pat.frequency}</span>
                                </button>

                                <AnimatePresence>
                                    {expandedChallenge === i && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                                                <p className="text-xs text-foreground/70">{pat.description}</p>

                                                {/* Challenge */}
                                                <div className="rounded-lg border border-border overflow-hidden">
                                                    <div className="px-3 py-2 bg-muted/30 border-b border-border">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                                                            Challenge: {pat.challenge.title}
                                                        </span>
                                                    </div>
                                                    <div className="p-3">
                                                        <p className="text-[10px] text-muted-foreground mb-1">Hint: {pat.challenge.hint}</p>
                                                        <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap bg-muted/20 p-2 rounded-lg border border-border/50">
                                                            {pat.challenge.buggyCode}
                                                        </pre>
                                                    </div>
                                                    <div className="px-3 pb-3">
                                                        <button
                                                            onClick={() => toggleFix(i)}
                                                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                                                        >
                                                            {showFix.has(i) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                            {showFix.has(i) ? "Hide Fix" : "Show Fix"}
                                                        </button>
                                                        {showFix.has(i) && (
                                                            <pre className="mt-2 text-xs font-mono text-emerald-500 whitespace-pre-wrap bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/20">
                                                                {pat.challenge.fix}
                                                            </pre>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-center gap-3 pt-2">
                        <Button variant="outline" onClick={() => setPhase("intro")} className="rounded-full px-5">Re-analyze</Button>
                        <Button variant="ghost" onClick={onExit} className="rounded-full px-5">Exit</Button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
