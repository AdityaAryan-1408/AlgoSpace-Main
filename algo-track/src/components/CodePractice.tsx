'use client';

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] rounded-xl border border-border bg-muted/20 animate-pulse flex items-center justify-center">
      <span className="text-xs text-muted-foreground">Loading editor...</span>
    </div>
  ),
});
import { Button } from "@/components/ui/Button";
import { MarkdownContent } from "@/components/MarkdownContent";
import {
    Loader2,
    Lightbulb,
    Send,
    Check,
    X,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    ToggleLeft,
    ToggleRight,
    Wand2,
    Sparkles,
    GitBranch,
    Cpu,
    FileCode2,
    Lock,
    Unlock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Flashcard } from "@/data";
import { fetchSuggestion, type SuggestionResult } from "@/lib/client-api";
import { saveCodeSnapshot } from "@/components/CodeEvolution";
import { RubberDuckGate } from "@/components/RubberDuckGate";
import { ComplexitySandbox } from "@/components/ComplexitySandbox";

const NITPICK_KEY = "algotrack-nitpick-mode";


const AI_REVIEW_KEY = "algotrack-ai-review-";



export interface EvalResult {
    feedback: string;
    isCorrect: boolean;
    suggestedRating: "AGAIN" | "HARD" | "GOOD" | "EASY";
    complexityAnalysis?: {
        userTime: string;
        userSpace: string;
        optimalTime: string;
        optimalSpace: string;
        comparison: string;
    };
    conceptCoverage?: {
        coveredPoints: string[];
        missedPoints: string[];
        misconceptions: string[];
    };
    criteria?: {
        approach?: {
            passed: boolean;
            current: string;
            suggested: string;
            keyIdea: string;
            consider: string;
        };
        efficiency?: {
            passed: boolean;
            userTime: string;
            userSpace: string;
            optimalTime: string;
            optimalSpace: string;
            comparison: string;
        };
        codeStyle?: {
            passed: boolean;
            score: number;
            grade: string;
            comparisonComment: string;
        };
    };
}

interface EleganceResult {
    overallScore: number;
    dimensions: Record<string, { score: number; comment: string }>;
    improvements: Array<{ description: string; before: string; after: string; technique: string }>;
    verdict: string;
}

export interface StoredAiReview {
    result: EvalResult;
    timestamp: string;
    userCode: string;
}

export function getStoredAiReview(cardId: string): StoredAiReview | null {
    try {
        const raw = localStorage.getItem(AI_REVIEW_KEY + cardId);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

interface HintResult {
    hint: string;
    level: number;
}

interface Props {
    card: Flashcard;
    onRate: (rating: "AGAIN" | "HARD" | "GOOD" | "EASY") => void;
    onCancel: () => void;
}

export function CodePractice({ card, onRate, onCancel }: Props) {
    const isDSA = card.type === "leetcode" || card.type === "sql";
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);
    const [code, setCode] = useState("");
    const [isDuckUnlocked, setIsDuckUnlocked] = useState(false);
    const [selectedCurve, setSelectedCurve] = useState<"user" | "optimal" | null>(null);

    useEffect(() => {
        setIsDuckUnlocked(false);
        setSelectedCurve(null);
    }, [card.id]);

    const isGateLocked = card.difficulty === "hard" && isDSA && !isDuckUnlocked;

    const [strictMode, setStrictMode] = useState(false);
    const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [evalError, setEvalError] = useState("");
    const [hints, setHints] = useState<HintResult[]>([]);
    const [hintLevel, setHintLevel] = useState(0);
    const [isHinting, setIsHinting] = useState(false);

    const [selectedRating, setSelectedRating] = useState<EvalResult["suggestedRating"] | null>(null);
    const [suggestionResult, setSuggestionResult] = useState<SuggestionResult | null>(null);
    const [isFetchingSuggestion, setIsFetchingSuggestion] = useState(false);
    const [showSuggestion, setShowSuggestion] = useState(false);
    const [eleganceResult, setEleganceResult] = useState<EleganceResult | null>(null);
    const [isFetchingElegance, setIsFetchingElegance] = useState(false);
    const [showElegance, setShowElegance] = useState(false);
    const [showSandbox, setShowSandbox] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem(NITPICK_KEY);
        if (saved === "true") setStrictMode(true);
    }, []);

    const toggleNitpick = () => {
        const next = !strictMode;
        setStrictMode(next);
        localStorage.setItem(NITPICK_KEY, String(next));
    };

    // Build up solution text from the card data
    const getSavedSolution = () => {
        if (card.solutions && card.solutions.length > 0) {
            return card.solutions.map((s) => `## ${s.name}\n${s.content}`).join("\n\n");
        }
        return card.solution || "";
    };

    const handleEvaluate = async () => {
        if (!code.trim()) return;
        setIsEvaluating(true);
        setEvalError("");
        setEvalResult(null);
        setSuggestionResult(null);
        setShowSuggestion(false);

        try {
            const res = await fetch("/api/evaluate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userAnswer: code,
                    savedSolution: getSavedSolution(),
                    savedNotes: card.notes,
                    problemTitle: card.title,
                    problemDescription: card.description,
                    cardType: card.type,
                    strictMode,
                }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Evaluation failed");
            }

            const result: EvalResult = await res.json();
            setEvalResult(result);
            setSelectedRating(result.suggestedRating);

            // Save code evolution snapshot
            saveCodeSnapshot(card.id, code, result.suggestedRating);

            // Save to localStorage (replaces previous review)
            const stored: StoredAiReview = {
                result,
                timestamp: new Date().toISOString(),
                userCode: code,
            };
            localStorage.setItem(AI_REVIEW_KEY + card.id, JSON.stringify(stored));
        } catch (err) {
            setEvalError(err instanceof Error ? err.message : "Evaluation failed");
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleShowSuggestion = async () => {
        // Toggle collapse if already fetched
        if (suggestionResult) {
            setShowSuggestion(!showSuggestion);
            return;
        }

        if (!evalResult) return;

        // Client-side short-circuit: perfect solution → no improvements
        if (evalResult.isCorrect && evalResult.suggestedRating === "EASY") {
            setSuggestionResult({ hasImprovements: false });
            setShowSuggestion(true);
            return;
        }

        // Client-side short-circuit: completely wrong → show stored solution
        if (!evalResult.isCorrect && evalResult.suggestedRating === "AGAIN") {
            const stored = getSavedSolution();
            if (stored) {
                setSuggestionResult({
                    hasImprovements: true,
                    type: "rewrite",
                    suggestion: `Your approach needs a different strategy. Here's the reference solution:\n\n${stored}`,
                });
                setShowSuggestion(true);
                return;
            }
        }

        // Otherwise, call the AI for a targeted suggestion
        setIsFetchingSuggestion(true);
        try {
            const result = await fetchSuggestion({
                userCode: code,
                savedSolution: getSavedSolution(),
                problemTitle: card.title,
                problemDescription: card.description,
                cardType: card.type,
                aiFeedback: evalResult.feedback,
            });
            setSuggestionResult(result);
            setShowSuggestion(true);
        } catch (err) {
            console.error("Failed to fetch suggestion:", err);
            setEvalError("Failed to load suggestion");
        } finally {
            setIsFetchingSuggestion(false);
        }
    };

    const handleHint = async () => {
        if (hintLevel >= 3) return;
        setIsHinting(true);
        const nextLevel = hintLevel + 1;

        try {
            const res = await fetch("/api/hint", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userCode: code,
                    savedSolution: getSavedSolution(),
                    savedNotes: card.notes,
                    problemTitle: card.title,
                    problemDescription: card.description,
                    cardType: card.type,
                    hintLevel: nextLevel,
                }),
            });

            if (!res.ok) throw new Error("Hint request failed");

            const result: HintResult = await res.json();
            setHints((prev) => [...prev, result]);
            setHintLevel(nextLevel);
        } catch {
            setEvalError("Failed to get hint");
        } finally {
            setIsHinting(false);
        }
    };

    const ratingColors: Record<string, string> = {
        AGAIN: "bg-red-500 text-white",
        HARD: "bg-orange-500 text-white",
        GOOD: "bg-blue-500 text-white",
        EASY: "bg-emerald-500 text-white",
    };

    const ratingLabels = {
        AGAIN: { label: "Forgot", emoji: "❌", desc: "No recall" },
        HARD: { label: "Rusty", emoji: "⚠️", desc: "Hesitant" },
        GOOD: { label: "Fluent", emoji: "✨", desc: "Fluent" },
        EASY: { label: "Instinctive", emoji: "🧠", desc: "Auto-pilot" }
    } as const;

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">


                    {/* Nitpick Toggle */}
                    <button
                        onClick={toggleNitpick}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${strictMode
                            ? "border-amber-500/40 text-amber-500 bg-amber-500/5"
                            : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {strictMode ? (
                            <ToggleRight className="w-4 h-4" />
                        ) : (
                            <ToggleLeft className="w-4 h-4" />
                        )}
                        {strictMode ? "Strict" : "Relaxed"}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleHint}
                        disabled={isHinting || hintLevel >= 3 || isGateLocked}
                        className="gap-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                    >
                        {isHinting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Lightbulb className="w-4 h-4" />
                        )}
                        Hint {hintLevel > 0 ? `(${hintLevel}/3)` : ""}
                    </Button>
                    <Button
                        onClick={handleEvaluate}
                        disabled={isEvaluating || !code.trim() || isGateLocked}
                        className="gap-1.5 bg-foreground text-background hover:bg-foreground/90 rounded-full px-5 font-semibold"
                    >
                        {isEvaluating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        Evaluate
                    </Button>
                </div>
            </div>

            {/* Hints */}
            <AnimatePresence>
                {hints.map((h, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20"
                    >
                        <div className="flex items-start gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                                    Hint {h.level}
                                </span>
                                <div className="text-sm text-foreground mt-1">
                                    <MarkdownContent content={h.hint} />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Editor */}
            {isDSA ? (
                card.difficulty === "hard" ? (
                    !isDuckUnlocked ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Left column: Rubber Duck Gate */}
                            <div className="h-[520px]">
                                <RubberDuckGate card={card} onUnlock={() => setIsDuckUnlocked(true)} />
                            </div>
                            {/* Right column: Blurred Mock Editor */}
                            <div className="relative rounded-xl border border-border bg-card/25 overflow-hidden h-[520px] flex flex-col shadow-lg">
                                {/* Editor mock header */}
                                <div className="flex items-center gap-1.5 px-4 py-2.5 bg-muted/40 border-b border-border/50 select-none text-[11px] text-muted-foreground font-semibold">
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/30"></span>
                                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/30"></span>
                                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/30"></span>
                                    <span className="ml-2 font-mono">solution.cpp - locked</span>
                                </div>
                                {/* Blurred simulated editor content */}
                                <div className="flex-1 p-4 font-mono text-xs text-zinc-600/30 space-y-2 select-none filter blur-[4px]">
                                    <div>#include &lt;iostream&gt;</div>
                                    <div>#include &lt;vector&gt;</div>
                                    <div className="pl-4">class Solution {"{"}</div>
                                    <div className="pl-8">public:</div>
                                    <div className="pl-12">vector&lt;int&gt; solve(int n, vector&lt;int&gt;&amp; nums) {"{"}</div>
                                    <div className="pl-16">// Algorithmic details are hidden until approved...</div>
                                    <div className="pl-16">// Explain logic to your Rubber Duck.</div>
                                    <div className="pl-12">{"}"}</div>
                                    <div className="pl-8">{"}"};</div>
                                </div>
                                {/* Glowing Lock Overlay */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black/60 backdrop-blur-[2px] z-10">
                                    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                                        <Lock className="w-5 h-5 text-amber-500 animate-pulse" />
                                    </div>
                                    <h5 className="text-xs font-black text-amber-500 uppercase tracking-wider">Editor Locked</h5>
                                    <p className="text-[10px] text-zinc-400 mt-2 max-w-[200px] leading-relaxed">
                                        Explain your logic and time complexities to the Rubber Duck on the left to unlock typing!
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-border overflow-hidden">
                            <Editor
                                height="320px"
                                language={card.type === "sql" ? "mysql" : "cpp"}
                                value={code}
                                onChange={(val) => setCode(val || "")}
                                theme="vs-dark"
                                options={{
                                    fontSize: 14,
                                    minimap: { enabled: false },
                                    lineNumbers: "on",
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    tabSize: 4,
                                    wordWrap: "on",
                                    padding: { top: 12 },
                                    placeholder: "Write your solution here...",
                                }}
                            />
                        </div>
                    )
                ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                        <Editor
                            height="320px"
                            language={card.type === "sql" ? "mysql" : "cpp"}
                            value={code}
                            onChange={(val) => setCode(val || "")}
                            theme="vs-dark"
                            options={{
                                fontSize: 14,
                                minimap: { enabled: false },
                                lineNumbers: "on",
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                tabSize: 4,
                                wordWrap: "on",
                                padding: { top: 12 },
                                placeholder: "Write your solution here...",
                            }}
                        />
                    </div>
                )
            ) : (
                <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Explain this concept in your own words... Include key points, definitions, and examples."
                    rows={12}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground resize-y leading-relaxed"
                />
            )}

            {/* Error */}
            {evalError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm text-red-500">{evalError}</span>
                </div>
            )}

            {/* AI Feedback */}
            <AnimatePresence>
                {evalResult && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-border bg-card overflow-hidden"
                    >
                        {/* Header */}
                        <div
                            className={`px-4 py-3 flex items-center gap-2 ${evalResult.isCorrect
                                ? "bg-emerald-500/10 border-b border-emerald-500/20"
                                : "bg-red-500/10 border-b border-red-500/20"
                                }`}
                        >
                            {evalResult.isCorrect ? (
                                <Check className="w-5 h-5 text-emerald-500" />
                            ) : (
                                <X className="w-5 h-5 text-red-500" />
                            )}
                            <span
                                className={`text-sm font-bold ${evalResult.isCorrect ? "text-emerald-500" : "text-red-500"}`}
                            >
                                {evalResult.isCorrect ? "Correct!" : "Needs Improvement"}
                            </span>
                            <span
                                className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold ${ratingColors[evalResult.suggestedRating]}`}
                            >
                                {ratingLabels[evalResult.suggestedRating].emoji} {ratingLabels[evalResult.suggestedRating].label}
                            </span>
                        </div>

                        {/* Feedback body */}
                        <div className="p-4 pb-36 space-y-4">
                            {/* LeetCode-style Criteria Badges & Greetings for DSA evaluations */}
                            {isDSA && evalResult.criteria && (
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center gap-3 px-1 py-0.5">
                                        <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold select-none transition-all ${
                                            (evalResult.criteria.approach?.passed ?? evalResult.isCorrect)
                                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                        }`}>
                                            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                                            Approach
                                        </div>
                                        <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold select-none transition-all ${
                                            (evalResult.criteria.efficiency?.passed ?? evalResult.isCorrect)
                                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                        }`}>
                                            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                                            Efficiency
                                        </div>
                                        <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold select-none transition-all ${
                                            (evalResult.criteria.codeStyle?.passed ?? evalResult.isCorrect)
                                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                        }`}>
                                            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                                            Code Style
                                        </div>
                                    </div>

                                    <div className="text-sm font-semibold text-indigo-200/90 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 leading-relaxed shadow-sm">
                                        {evalResult.isCorrect
                                            ? `Congratulations! You passed this attempt, building on your prior experience with ${card.title}.`
                                            : `Keep practicing! You are close to mastering ${card.title}. Let's refine the approach.`
                                        }
                                    </div>
                                </div>
                            )}

                            <div className="text-sm text-foreground/90 leading-relaxed">
                                <MarkdownContent content={evalResult.feedback} />
                            </div>

                            {/* LeetCode criteria cards */}
                            {isDSA && evalResult.criteria ? (
                                <div className="space-y-4">
                                    {/* Approach Card */}
                                    {evalResult.criteria.approach && (
                                        <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                                            <div className="flex items-center gap-2 text-indigo-400">
                                                <GitBranch className="w-4 h-4" />
                                                <span className="text-xs font-bold uppercase tracking-wider">Approach Analysis</span>
                                            </div>
                                            <div className="space-y-1.5 text-sm text-foreground/90 leading-relaxed">
                                                <p><span className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Current:</span> <span className="font-semibold text-foreground">{evalResult.criteria.approach.current}</span></p>
                                                <p><span className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Suggested:</span> <span className="font-semibold text-emerald-400">{evalResult.criteria.approach.suggested}</span></p>
                                                <p><span className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Key Idea:</span> <span className="text-foreground/90">{evalResult.criteria.approach.keyIdea}</span></p>
                                            </div>
                                            {evalResult.criteria.approach.consider && (
                                                <div className="mt-2 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-xs text-indigo-300 leading-relaxed">
                                                    <span className="font-bold block mb-1 text-[10px] uppercase tracking-wider text-indigo-400">Consider:</span>
                                                    {evalResult.criteria.approach.consider}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Efficiency Card */}
                                    {evalResult.criteria.efficiency && (
                                        <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                                            <div className="flex items-center gap-2 text-cyan-400">
                                                <Cpu className="w-4 h-4" />
                                                <span className="text-xs font-bold uppercase tracking-wider">Complexity & Efficiency</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mt-1">
                                                {/* Your Complexity Box */}
                                                {(() => {
                                                    const userTime = evalResult.criteria.efficiency.userTime;
                                                    const userCurve = (() => {
                                                        const cleaned = userTime.toLowerCase().replace(/\s+/g, '');
                                                        if (cleaned.includes("o(1)")) return "O(1)";
                                                        if (cleaned.includes("o(logn)") || cleaned.includes("o(log(n))")) return "O(logN)";
                                                        if (cleaned.includes("o(n^2)") || cleaned.includes("o(n2)")) return "O(N^2)";
                                                        if (cleaned.includes("o(nlogn)") || cleaned.includes("o(nlog(n))")) return "O(NlogN)";
                                                        if (cleaned.includes("o(n)")) return "O(N)";
                                                        return "O(N)";
                                                    })();
                                                    const userColorInfo = (() => {
                                                        switch(userCurve) {
                                                            case "O(1)": return { text: "text-emerald-400", stroke: "#10b981", name: "Constant Time - O(1)", desc: "Best case efficiency. Execution time stays flat and independent of input size N." };
                                                            case "O(logN)": return { text: "text-teal-400", stroke: "#06b6d4", name: "Logarithmic Time - O(log N)", desc: "Excellent efficiency. Scaled dynamically by halving size on each operation." };
                                                            case "O(N)": return { text: "text-amber-400", stroke: "#f59e0b", name: "Linear Time - O(N)", desc: "Fair efficiency. Operations scale directly 1:1 with input size N (45-degree slope)." };
                                                            case "O(NlogN)": return { text: "text-indigo-400", stroke: "#6366f1", name: "Linearithmic Time - O(N log N)", desc: "Moderate efficiency. Standard performance for sorting algorithms." };
                                                            case "O(N^2)": return { text: "text-red-400", stroke: "#ef4444", name: "Quadratic Time - O(N²)", desc: "Suboptimal efficiency. Time scales quadratically, making it poor for large input size N." };
                                                            default: return { text: "text-cyan-400", stroke: "#22d3ee", name: "Linear Time - O(N)", desc: "Operations scale proportionally with size." };
                                                        }
                                                    })();
                                                    
                                                    let cx = 95, cy = 35;
                                                    if (userCurve === "O(logN)") { cx = 95; cy = 24; }
                                                    else if (userCurve === "O(N)") { cx = 95; cy = 15; }
                                                    else if (userCurve === "O(NlogN)") { cx = 95; cy = 6; }
                                                    else if (userCurve === "O(N^2)") { cx = 38; cy = 5; }

                                                    return (
                                                        <div 
                                                            onClick={() => setSelectedCurve(selectedCurve === "user" ? null : "user")}
                                                            className={`p-3 rounded-lg transition-all flex items-center justify-between group relative cursor-pointer border ${
                                                                selectedCurve === "user" 
                                                                    ? "bg-cyan-500/10 border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.15)]" 
                                                                    : "bg-muted/30 border-border/50 hover:bg-muted/50 hover:border-cyan-500/30"
                                                            }`}
                                                        >
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Your Complexity</p>
                                                                <p className="text-sm font-mono font-semibold text-foreground">Time: {evalResult.criteria.efficiency.userTime}</p>
                                                                <p className="text-sm font-mono font-semibold text-foreground">Space: {evalResult.criteria.efficiency.userSpace}</p>
                                                            </div>
                                                            
                                                            {/* Compact SVG Mathematical Growth Curve Chart */}
                                                            <div className="relative shrink-0 ml-2">
                                                                <svg className="w-16 h-10 text-muted-foreground/15" viewBox="0 0 100 40" fill="none">
                                                                    {/* Axis Lines */}
                                                                    <line x1="5" y1="35" x2="95" y2="35" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                                                                    <line x1="5" y1="5" x2="5" y2="35" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                                                                    
                                                                    {/* Standard Math Big-O Growth Curves */}
                                                                    <path d="M 5 35 L 95 35" stroke={userCurve === "O(1)" ? userColorInfo.stroke : "rgba(255,255,255,0.04)"} strokeWidth={userCurve === "O(1)" ? "2.5" : "1"} />
                                                                    <path d="M 5 35 Q 30 25, 95 24" stroke={userCurve === "O(logN)" ? userColorInfo.stroke : "rgba(255,255,255,0.04)"} strokeWidth={userCurve === "O(logN)" ? "2.5" : "1"} />
                                                                    <path d="M 5 35 L 95 15" stroke={userCurve === "O(N)" ? userColorInfo.stroke : "rgba(255,255,255,0.04)"} strokeWidth={userCurve === "O(N)" ? "2.5" : "1"} />
                                                                    <path d="M 5 35 Q 45 28, 95 6" stroke={userCurve === "O(NlogN)" ? userColorInfo.stroke : "rgba(255,255,255,0.04)"} strokeWidth={userCurve === "O(NlogN)" ? "2.5" : "1"} />
                                                                    <path d="M 5 35 Q 18 32, 38 5" stroke={userCurve === "O(N^2)" ? userColorInfo.stroke : "rgba(255,255,255,0.04)"} strokeWidth={userCurve === "O(N^2)" ? "2.5" : "1"} />
                                                                    
                                                                    {/* Highlight active pointer circle */}
                                                                    <circle cx={cx} cy={cy} r="2.5" fill={userColorInfo.stroke} className="shadow-lg group-hover:scale-125 transition-transform" />
                                                                    <circle cx={cx} cy={cy} r="5" fill={userColorInfo.stroke} className="animate-ping opacity-45" />
                                                                </svg>
                                                            </div>

                                                            {/* Tooltip Overlay */}
                                                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col z-20 w-64 p-3 rounded-xl bg-zinc-950/97 border border-border/85 shadow-2xl text-[10px] leading-relaxed animate-in fade-in zoom-in-95 duration-150 text-left">
                                                                <span className="font-bold text-cyan-400 mb-1">Complexity Growth Chart</span>
                                                                <div className="flex items-center justify-between mb-1.5 border-b border-border/20 pb-1">
                                                                    <span className="font-semibold text-foreground">{userColorInfo.name}</span>
                                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                                                        userCurve === "O(1)" || userCurve === "O(logN)" ? "bg-emerald-500/10 text-emerald-400" :
                                                                        userCurve === "O(N)" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
                                                                    }`}>
                                                                        {userCurve === "O(1)" ? "Optimal" :
                                                                         userCurve === "O(logN)" ? "Excellent" :
                                                                         userCurve === "O(N)" ? "Fair" :
                                                                         userCurve === "O(NlogN)" ? "Acceptable" : "Suboptimal"}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[9px] text-zinc-400 mb-2 leading-relaxed">
                                                                    {userColorInfo.desc}
                                                                </p>
                                                                <div className="flex flex-col gap-1 border-t border-border/10 pt-1.5 text-[8px] text-zinc-500 font-mono">
                                                                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> O(1) - Constant</div>
                                                                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> O(log N) - Logarithmic</div>
                                                                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> O(N) - Linear (45° line)</div>
                                                                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> O(N log N) - Linearithmic</div>
                                                                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> O(N²) - Quadratic (steep curve)</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Optimal Complexity Box */}
                                                {(() => {
                                                    const optimalTime = evalResult.criteria.efficiency.optimalTime;
                                                    const optimalCurve = (() => {
                                                        const cleaned = optimalTime.toLowerCase().replace(/\s+/g, '');
                                                        if (cleaned.includes("o(1)")) return "O(1)";
                                                        if (cleaned.includes("o(logn)") || cleaned.includes("o(log(n))")) return "O(logN)";
                                                        if (cleaned.includes("o(n^2)") || cleaned.includes("o(n2)")) return "O(N^2)";
                                                        if (cleaned.includes("o(nlogn)") || cleaned.includes("o(nlog(n))")) return "O(NlogN)";
                                                        if (cleaned.includes("o(n)")) return "O(N)";
                                                        return "O(N)";
                                                    })();
                                                    const optimalColorInfo = (() => {
                                                        switch(optimalCurve) {
                                                            case "O(1)": return { text: "text-emerald-400", stroke: "#10b981", name: "Constant Time - O(1)", desc: "Best case efficiency. Execution time stays flat and independent of input size N." };
                                                            case "O(logN)": return { text: "text-teal-400", stroke: "#06b6d4", name: "Logarithmic Time - O(log N)", desc: "Excellent efficiency. Scaled dynamically by halving size on each operation." };
                                                            case "O(N)": return { text: "text-amber-400", stroke: "#f59e0b", name: "Linear Time - O(N)", desc: "Fair efficiency. Operations scale directly 1:1 with input size N (45-degree slope)." };
                                                            case "O(NlogN)": return { text: "text-indigo-400", stroke: "#6366f1", name: "Linearithmic Time - O(N log N)", desc: "Moderate efficiency. Standard performance for sorting algorithms." };
                                                            case "O(N^2)": return { text: "text-red-400", stroke: "#ef4444", name: "Quadratic Time - O(N²)", desc: "Suboptimal efficiency. Time scales quadratically, making it poor for large input size N." };
                                                            default: return { text: "text-cyan-400", stroke: "#22d3ee", name: "Linear Time - O(N)", desc: "Operations scale proportionally with size." };
                                                        }
                                                    })();
                                                    
                                                    let cx = 95, cy = 35;
                                                    if (optimalCurve === "O(logN)") { cx = 95; cy = 24; }
                                                    else if (optimalCurve === "O(N)") { cx = 95; cy = 15; }
                                                    else if (optimalCurve === "O(NlogN)") { cx = 95; cy = 6; }
                                                    else if (optimalCurve === "O(N^2)") { cx = 38; cy = 5; }

                                                    return (
                                                        <div 
                                                            onClick={() => setSelectedCurve(selectedCurve === "optimal" ? null : "optimal")}
                                                            className={`p-3 rounded-lg transition-all flex items-center justify-between group relative cursor-pointer border ${
                                                                selectedCurve === "optimal" 
                                                                    ? "bg-cyan-500/10 border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.15)]" 
                                                                    : "bg-muted/30 border-border/50 hover:bg-muted/50 hover:border-cyan-500/30"
                                                            }`}
                                                        >
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Optimal Complexity</p>
                                                                <p className="text-sm font-mono font-semibold text-foreground">Time: {evalResult.criteria.efficiency.optimalTime}</p>
                                                                <p className="text-sm font-mono font-semibold text-foreground">Space: {evalResult.criteria.efficiency.optimalSpace}</p>
                                                            </div>
                                                            
                                                            {/* Compact SVG Mathematical Growth Curve Chart */}
                                                            <div className="relative shrink-0 ml-2">
                                                                <svg className="w-16 h-10 text-muted-foreground/15" viewBox="0 0 100 40" fill="none">
                                                                    {/* Axis Lines */}
                                                                    <line x1="5" y1="35" x2="95" y2="35" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                                                                    <line x1="5" y1="5" x2="5" y2="35" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                                                                    
                                                                    {/* Standard Math Big-O Growth Curves */}
                                                                    <path d="M 5 35 L 95 35" stroke={optimalCurve === "O(1)" ? optimalColorInfo.stroke : "rgba(255,255,255,0.04)"} strokeWidth={optimalCurve === "O(1)" ? "2.5" : "1"} />
                                                                    <path d="M 5 35 Q 30 25, 95 24" stroke={optimalCurve === "O(logN)" ? optimalColorInfo.stroke : "rgba(255,255,255,0.04)"} strokeWidth={optimalCurve === "O(logN)" ? "2.5" : "1"} />
                                                                    <path d="M 5 35 L 95 15" stroke={optimalCurve === "O(N)" ? optimalColorInfo.stroke : "rgba(255,255,255,0.04)"} strokeWidth={optimalCurve === "O(N)" ? "2.5" : "1"} />
                                                                    <path d="M 5 35 Q 45 28, 95 6" stroke={optimalCurve === "O(NlogN)" ? optimalColorInfo.stroke : "rgba(255,255,255,0.04)"} strokeWidth={optimalCurve === "O(NlogN)" ? "2.5" : "1"} />
                                                                    <path d="M 5 35 Q 18 32, 38 5" stroke={optimalCurve === "O(N^2)" ? optimalColorInfo.stroke : "rgba(255,255,255,0.04)"} strokeWidth={optimalCurve === "O(N^2)" ? "2.5" : "1"} />
                                                                    
                                                                    {/* Highlight active pointer circle */}
                                                                    <circle cx={cx} cy={cy} r="2.5" fill={optimalColorInfo.stroke} className="shadow-lg group-hover:scale-125 transition-transform" />
                                                                    <circle cx={cx} cy={cy} r="5" fill={optimalColorInfo.stroke} className="animate-ping opacity-45" />
                                                                </svg>
                                                            </div>

                                                            {/* Tooltip Overlay */}
                                                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col z-20 w-64 p-3 rounded-xl bg-zinc-950/97 border border-border/85 shadow-2xl text-[10px] leading-relaxed animate-in fade-in zoom-in-95 duration-150 text-left">
                                                                <span className="font-bold text-cyan-400 mb-1">Complexity Growth Chart</span>
                                                                <div className="flex items-center justify-between mb-1.5 border-b border-border/20 pb-1">
                                                                    <span className="font-semibold text-foreground">{optimalColorInfo.name}</span>
                                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-400`}>
                                                                        Optimal
                                                                    </span>
                                                                </div>
                                                                <p className="text-[9px] text-zinc-400 mb-2 leading-relaxed">
                                                                    {optimalColorInfo.desc}
                                                                </p>
                                                                <div className="flex flex-col gap-1 border-t border-border/10 pt-1.5 text-[8px] text-zinc-500 font-mono">
                                                                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> O(1) - Constant</div>
                                                                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> O(log N) - Logarithmic</div>
                                                                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> O(N) - Linear (45° line)</div>
                                                                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> O(N log N) - Linearithmic</div>
                                                                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> O(N²) - Quadratic (steep curve)</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            {evalResult.criteria.efficiency.comparison && (
                                                <p className="text-xs text-muted-foreground leading-relaxed italic mt-1">
                                                    {evalResult.criteria.efficiency.comparison}
                                                </p>
                                            )}

                                            {/* Beautiful Inline Complexity Explorer (Dropdown style expansion) */}
                                            <AnimatePresence>
                                                {selectedCurve && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: "auto" }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        transition={{ duration: 0.25 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="mt-3 pt-3 border-t border-border/30 space-y-4 text-left">
                                                            <div className="flex items-center justify-between border-b border-border/20 pb-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                                                    <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400">
                                                                        Complexity Explorer
                                                                    </h4>
                                                                </div>
                                                                <button 
                                                                    onClick={() => setSelectedCurve(null)}
                                                                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>

                                                            {(() => {
                                                                const isUser = selectedCurve === "user";
                                                                const timeVal = isUser ? evalResult.criteria.efficiency.userTime : evalResult.criteria.efficiency.optimalTime;
                                                                const spaceVal = isUser ? evalResult.criteria.efficiency.userSpace : evalResult.criteria.efficiency.optimalSpace;
                                                                const curve = (() => {
                                                                    const cleaned = timeVal.toLowerCase().replace(/\s+/g, '');
                                                                    if (cleaned.includes("o(1)")) return "O(1)";
                                                                    if (cleaned.includes("o(logn)") || cleaned.includes("o(log(n))")) return "O(logN)";
                                                                    if (cleaned.includes("o(n^2)") || cleaned.includes("o(n2)")) return "O(N^2)";
                                                                    if (cleaned.includes("o(nlogn)") || cleaned.includes("o(nlog(n))")) return "O(NlogN)";
                                                                    if (cleaned.includes("o(n)")) return "O(N)";
                                                                    return "O(N)";
                                                                })();
                                                                const colorInfo = (() => {
                                                                    switch(curve) {
                                                                        case "O(1)": return { text: "text-emerald-400", stroke: "#10b981", name: "Constant Time - O(1)", desc: "Execution operations stay flat. The code does not scale with size (e.g. hash lookup)." };
                                                                        case "O(logN)": return { text: "text-teal-400", stroke: "#06b6d4", name: "Logarithmic Time - O(log N)", desc: "Excellent growth rate. Input volume is divided rapidly on each step (e.g. binary search trees)." };
                                                                        case "O(N)": return { text: "text-amber-400", stroke: "#f59e0b", name: "Linear Time - O(N)", desc: "Standard linear growth. Work scales 1:1 proportionally with input N (45-degree slope, e.g. single array loop)." };
                                                                        case "O(NlogN)": return { text: "text-indigo-400", stroke: "#6366f1", name: "Linearithmic Time - O(N log N)", desc: "Good sorting threshold. Ideal limit for general comparison sorting algorithms (e.g. Merge Sort)." };
                                                                        case "O(N^2)": return { text: "text-red-400", stroke: "#ef4444", name: "Quadratic Time - O(N²)", desc: "Suboptimal growth rate. Work increases quadratically with N (e.g. double nested loops)." };
                                                                        default: return { text: "text-cyan-400", stroke: "#22d3ee", name: "Linear Time - O(N)", desc: "Operations scale proportionally with size." };
                                                                    }
                                                                })();
                                                                
                                                                let cx = 95, cy = 35;
                                                                if (curve === "O(logN)") { cx = 95; cy = 24; }
                                                                else if (curve === "O(N)") { cx = 95; cy = 15; }
                                                                else if (curve === "O(NlogN)") { cx = 95; cy = 6; }
                                                                else if (curve === "O(N^2)") { cx = 38; cy = 5; }

                                                                return (
                                                                    <div className="space-y-4">
                                                                        <div className="p-3.5 rounded-xl border border-border/50 bg-muted/20">
                                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                                                                                {isUser ? "YOUR SOLUTION PERFORMANCE" : "OPTIMAL REFERENCE DESIGN"}
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                <p className="text-sm font-mono font-black text-foreground">Time Complexity: <span className={colorInfo.text}>{timeVal}</span></p>
                                                                                <p className="text-sm font-mono font-black text-foreground">Space Complexity: <span className="text-cyan-400">{spaceVal}</span></p>
                                                                            </div>
                                                                        </div>

                                                                        {/* Large Scale CS Growth Curve Chart */}
                                                                        <div className="p-4 rounded-xl border border-border/40 bg-zinc-900/60 relative flex flex-col items-center">
                                                                            <div className="text-[9px] font-black tracking-wider text-muted-foreground uppercase self-start mb-3">
                                                                                Big-O Scalability Curves
                                                                            </div>
                                                                            <svg className="w-full h-36 text-muted-foreground/10" viewBox="0 0 100 40" fill="none">
                                                                                {/* Background Grid Gridlines */}
                                                                                <line x1="5" y1="35" x2="95" y2="35" stroke="rgba(255,255,255,0.08)" strokeWidth="0.75" />
                                                                                <line x1="5" y1="5" x2="95" y2="5" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" strokeDasharray="1 1" />
                                                                                <line x1="5" y1="20" x2="95" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" strokeDasharray="1 1" />
                                                                                <line x1="5" y1="5" x2="5" y2="35" stroke="rgba(255,255,255,0.08)" strokeWidth="0.75" />
                                                                                
                                                                                {/* Curves */}
                                                                                <path d="M 5 35 L 95 35" stroke={curve === "O(1)" ? colorInfo.stroke : "rgba(255,255,255,0.04)"} strokeWidth={curve === "O(1)" ? "2.5" : "0.75"} />
                                                                                <path d="M 5 35 Q 30 25, 95 24" stroke={curve === "O(logN)" ? colorInfo.stroke : "rgba(255,255,255,0.04)"} strokeWidth={curve === "O(logN)" ? "2.5" : "0.75"} />
                                                                                <path d="M 5 35 L 95 15" stroke={curve === "O(N)" ? colorInfo.stroke : "rgba(255,255,255,0.04)"} strokeWidth={curve === "O(N)" ? "2.5" : "0.75"} />
                                                                                <path d="M 5 35 Q 45 28, 95 6" stroke={curve === "O(NlogN)" ? colorInfo.stroke : "rgba(255,255,255,0.04)"} strokeWidth={curve === "O(NlogN)" ? "2.5" : "0.75"} />
                                                                                <path d="M 5 35 Q 18 32, 38 5" stroke={curve === "O(N^2)" ? colorInfo.stroke : "rgba(255,255,255,0.04)"} strokeWidth={curve === "O(N^2)" ? "2.5" : "0.75"} />
                                                                                
                                                                                {/* Glowing terminator mark */}
                                                                                <circle cx={cx} cy={cy} r="2.5" fill={colorInfo.stroke} />
                                                                                <circle cx={cx} cy={cy} r="5" fill={colorInfo.stroke} className="animate-ping opacity-45" />
                                                                                
                                                                                {/* Chart Labels */}
                                                                                <text x="42" y="7" fill="rgba(239, 68, 68, 0.4)" fontSize="3.5" className="font-mono">O(N²)</text>
                                                                                <text x="75" y="10" fill="rgba(99, 102, 241, 0.4)" fontSize="3.5" className="font-mono">O(N log N)</text>
                                                                                <text x="96" y="14" fill="rgba(245, 158, 17, 0.4)" fontSize="3.5" className="font-mono">O(N)</text>
                                                                                <text x="96" y="23" fill="rgba(6, 182, 212, 0.4)" fontSize="3.5" className="font-mono">O(log N)</text>
                                                                                <text x="96" y="34" fill="rgba(16, 185, 129, 0.4)" fontSize="3.5" className="font-mono">O(1)</text>
                                                                            </svg>
                                                                        </div>

                                                                        {/* Explanations of complexity */}
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                                                            <div className="space-y-2">
                                                                                <h5 className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                                                                                    Time Complexity (TC)
                                                                                </h5>
                                                                                <p className="text-[10px] text-zinc-400 leading-relaxed">
                                                                                    TC measures the execution operations relative to the input size <span className="font-mono font-bold text-foreground">N</span>. It models performance scaling, not raw CPU seconds.
                                                                                </p>
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <h5 className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                                                                                    Space Complexity (SC)
                                                                                </h5>
                                                                                <p className="text-[10px] text-zinc-400 leading-relaxed">
                                                                                    SC measures the peak auxiliary memory (variables, call stacks, dynamic structures) allocated by your code relative to <span className="font-mono font-bold text-foreground">N</span>.
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="pt-3 border-t border-border/20 text-[10px] text-zinc-400">
                                                                            <span className="font-bold text-foreground block mb-0.5">{colorInfo.name}</span>
                                                                            <p className="leading-relaxed">{colorInfo.desc}</p>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>


                                            {/* Live Complexity Sandbox Integration */}
                                            <div className="mt-3 pt-3 border-t border-border/40">
                                                <button
                                                    onClick={() => setShowSandbox(!showSandbox)}
                                                    className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Cpu className="w-4 h-4 text-cyan-500" />
                                                        Live Complexity Sandbox
                                                    </div>
                                                    {showSandbox ? (
                                                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                    )}
                                                </button>

                                                <AnimatePresence>
                                                    {showSandbox && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: "auto" }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="mt-2">
                                                                <ComplexitySandbox 
                                                                    complexity={evalResult.criteria.efficiency.userTime} 
                                                                    optimalComplexity={evalResult.criteria.efficiency.optimalTime} 
                                                                />
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    )}

                                    {/* Code Style & Rating Card */}
                                    {evalResult.criteria.codeStyle && (
                                        <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                                            <div className="flex items-center gap-2 text-emerald-400">
                                                <FileCode2 className="w-4 h-4" />
                                                <span className="text-xs font-bold uppercase tracking-wider">Stored Solution Comparison</span>
                                            </div>

                                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-3.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                                <div className="relative flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 border-dashed border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)] shrink-0 mx-auto sm:mx-0">
                                                    <span className="text-base font-black text-emerald-400 leading-none">{evalResult.criteria.codeStyle.score}</span>
                                                    <span className="text-[9px] text-emerald-500/80 font-bold uppercase mt-1">Score</span>
                                                </div>

                                                <div className="flex-1 space-y-1 text-center sm:text-left">
                                                    <div className="flex items-center justify-center sm:justify-start gap-2">
                                                        <span className="text-xs font-semibold text-muted-foreground">Stored Solution Grade:</span>
                                                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase">
                                                            {evalResult.criteria.codeStyle.grade}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                                                        {evalResult.criteria.codeStyle.comparisonComment}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {/* Complexity for DSA (Fallback) */}
                                    {evalResult.complexityAnalysis && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                                    Your Complexity
                                                </p>
                                                <p className="text-sm font-mono font-semibold text-foreground">
                                                    Time: {evalResult.complexityAnalysis.userTime}
                                                </p>
                                                <p className="text-sm font-mono font-semibold text-foreground">
                                                    Space: {evalResult.complexityAnalysis.userSpace}
                                                </p>
                                            </div>
                                            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                                    Optimal
                                                </p>
                                                <p className="text-sm font-mono font-semibold text-foreground">
                                                    Time: {evalResult.complexityAnalysis.optimalTime}
                                                </p>
                                                <p className="text-sm font-mono font-semibold text-foreground">
                                                    Space: {evalResult.complexityAnalysis.optimalSpace}
                                                </p>
                                            </div>
                                            {evalResult.complexityAnalysis.comparison && (
                                                <div className="col-span-2 text-xs text-muted-foreground">
                                                    {evalResult.complexityAnalysis.comparison}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Concept coverage for CS Core */}
                            {evalResult.conceptCoverage && (
                                <div className="space-y-2">
                                    {evalResult.conceptCoverage.coveredPoints.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-1">
                                                ✓ Covered
                                            </p>
                                            <ul className="text-xs text-foreground/80 space-y-0.5 ml-3">
                                                {evalResult.conceptCoverage.coveredPoints.map((p, i) => (
                                                    <li key={i} className="list-disc">{p}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {evalResult.conceptCoverage.missedPoints.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-1">
                                                ✗ Missed
                                            </p>
                                            <ul className="text-xs text-foreground/80 space-y-0.5 ml-3">
                                                {evalResult.conceptCoverage.missedPoints.map((p, i) => (
                                                    <li key={i} className="list-disc">{p}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {evalResult.conceptCoverage.misconceptions.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-1">
                                                ⚠ Misconceptions
                                            </p>
                                            <ul className="text-xs text-foreground/80 space-y-0.5 ml-3">
                                                {evalResult.conceptCoverage.misconceptions.map((p, i) => (
                                                    <li key={i} className="list-disc">{p}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Show Suggested Solution */}
                            <div className="mt-2">
                                <button
                                    onClick={handleShowSuggestion}
                                    disabled={isFetchingSuggestion}
                                    className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-2">
                                        {isFetchingSuggestion ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                                        ) : (
                                            <Wand2 className="w-4 h-4 text-purple-500" />
                                        )}
                                        Show Suggested Solution
                                    </div>
                                    {showSuggestion ? (
                                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    )}
                                </button>

                                <AnimatePresence>
                                    {showSuggestion && suggestionResult && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-2 p-4 rounded-xl border border-border bg-muted/20">
                                                {!suggestionResult.hasImprovements ? (
                                                    <div className="flex items-center gap-2 text-sm text-emerald-500 font-medium">
                                                        <Check className="w-4 h-4" />
                                                        Nothing to improve here — your solution looks great!
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                                                suggestionResult.type === "rewrite" ? "text-orange-500" : "text-purple-500"
                                                            }`}>
                                                                {suggestionResult.type === "rewrite" ? "Needs Different Approach" : "Suggested Changes"}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-foreground/90 leading-relaxed">
                                                            <MarkdownContent content={suggestionResult.suggestion || ""} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Code Elegance Score (DSA only) */}
                            {isDSA && (
                                <div className="mt-2">
                                    <button
                                        onClick={async () => {
                                            if (eleganceResult) { setShowElegance(!showElegance); return; }
                                            setIsFetchingElegance(true);
                                            try {
                                                const res = await fetch("/api/evaluate/elegance", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({
                                                        userCode: code,
                                                        problemTitle: card.title,
                                                        problemDescription: card.description,

                                                    }),
                                                });
                                                if (!res.ok) throw new Error("Failed");
                                                const result: EleganceResult = await res.json();
                                                setEleganceResult(result);
                                                setShowElegance(true);
                                            } catch { setEvalError("Failed to get elegance score"); }
                                            finally { setIsFetchingElegance(false); }
                                        }}
                                        disabled={isFetchingElegance}
                                        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <div className="flex items-center gap-2">
                                            {isFetchingElegance ? (
                                                <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                                            ) : (
                                                <Sparkles className="w-4 h-4 text-cyan-500" />
                                            )}
                                            Elegance Score
                                            {eleganceResult && (
                                                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    eleganceResult.overallScore >= 80 ? "bg-emerald-500/10 text-emerald-500" :
                                                    eleganceResult.overallScore >= 60 ? "bg-amber-500/10 text-amber-500" :
                                                    "bg-red-500/10 text-red-500"
                                                }`}>{eleganceResult.overallScore}/100</span>
                                            )}
                                        </div>
                                        {showElegance ? (
                                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                        )}
                                    </button>

                                    <AnimatePresence>
                                        {showElegance && eleganceResult && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-2 p-4 rounded-xl border border-border bg-muted/20 space-y-4">
                                                    {/* Overall Score */}
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black ${
                                                            eleganceResult.overallScore >= 80 ? "bg-emerald-500/10 text-emerald-500" :
                                                            eleganceResult.overallScore >= 60 ? "bg-amber-500/10 text-amber-500" :
                                                            "bg-red-500/10 text-red-500"
                                                        }`}>
                                                            {eleganceResult.overallScore}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-foreground">Elegance Score</p>
                                                            <p className="text-xs text-muted-foreground">{eleganceResult.verdict}</p>
                                                        </div>
                                                    </div>

                                                    {/* Dimensions */}
                                                    <div className="grid grid-cols-5 gap-2">
                                                        {Object.entries(eleganceResult.dimensions).map(([key, { score, comment }]) => (
                                                            <div key={key} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/30 border border-border/50" title={comment}>
                                                                <span className={`text-lg font-black ${
                                                                    score >= 8 ? "text-emerald-500" : score >= 6 ? "text-amber-500" : "text-red-500"
                                                                }`}>{score}</span>
                                                                <span className="text-[9px] font-medium text-muted-foreground capitalize text-center leading-tight">{key}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Improvements */}
                                                    {eleganceResult.improvements.length > 0 && (
                                                        <div className="space-y-3">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-500">Suggested Polish</span>
                                                            {eleganceResult.improvements.map((imp, i) => (
                                                                <div key={i} className="rounded-lg border border-border overflow-hidden">
                                                                    <div className="px-3 py-1.5 bg-muted/30 flex items-center gap-2">
                                                                        <span className="text-[10px] font-bold text-cyan-500 px-1.5 py-0.5 rounded bg-cyan-500/10">{imp.technique}</span>
                                                                        <span className="text-xs text-foreground/80">{imp.description}</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 text-xs font-mono">
                                                                        <div className="p-2 bg-red-500/5 border-r border-border">
                                                                            <span className="text-[9px] font-bold text-red-500 uppercase">Before</span>
                                                                            <pre className="text-foreground/70 whitespace-pre-wrap mt-1">{imp.before}</pre>
                                                                        </div>
                                                                        <div className="p-2 bg-emerald-500/5">
                                                                            <span className="text-[9px] font-bold text-emerald-500 uppercase">After</span>
                                                                            <pre className="text-foreground/70 whitespace-pre-wrap mt-1">{imp.after}</pre>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* Floating Glassmorphic Feedback Dock for Code Practice */}
                            {isMounted && createPortal(
                                <motion.div
                                    initial={{ opacity: 0, y: 50, x: "-50%" }}
                                    animate={{ opacity: 1, y: 0, x: "-50%" }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                    className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-xl bg-card/85 dark:bg-card/75 backdrop-blur-xl border border-border/85 shadow-[0_15px_35px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-2xl p-4 z-50 overflow-hidden flex flex-col gap-3"
                                >
                                    <div className="flex flex-col gap-1 w-full text-center">
                                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">
                                            AI suggests rating this as <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${ratingColors[evalResult.suggestedRating]}`}>{ratingLabels[evalResult.suggestedRating].emoji} {ratingLabels[evalResult.suggestedRating].label}</span>
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(["AGAIN", "HARD", "GOOD", "EASY"] as const).map((r) => {
                                            const isActive = selectedRating === r;
                                            let activeBorder = "border-blue-500 bg-blue-500/10 text-blue-400";
                                            if (r === "AGAIN") activeBorder = "border-red-500 bg-red-500/10 text-red-400";
                                            if (r === "HARD") activeBorder = "border-orange-500 bg-orange-500/10 text-orange-400";
                                            if (r === "EASY") activeBorder = "border-emerald-500 bg-emerald-500/10 text-emerald-400";
                                            
                                            return (
                                                <motion.button
                                                    key={r}
                                                    whileHover={{ scale: 1.04, y: -1 }}
                                                    whileTap={{ scale: 0.96 }}
                                                    onClick={() => setSelectedRating(r)}
                                                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl font-bold transition-all text-xs border cursor-pointer gap-0.5 ${
                                                        isActive 
                                                            ? `${activeBorder} border-2 shadow-md` 
                                                            : "border-border/50 bg-muted/20 opacity-70 hover:opacity-100"
                                                    }`}
                                                >
                                                    <span className="text-sm">{ratingLabels[r].emoji}</span>
                                                    <span className="text-[11px] font-extrabold">
                                                        {ratingLabels[r].label} {r === evalResult.suggestedRating && "✨"}
                                                    </span>
                                                    <span className="text-[9px] font-medium opacity-50 leading-none mt-0.5 text-center px-0.5">
                                                        {ratingLabels[r].desc}
                                                    </span>
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center justify-center gap-3 mt-1">
                                        <Button
                                            size="sm"
                                            disabled={!selectedRating}
                                            onClick={() => selectedRating && onRate(selectedRating)}
                                            className="rounded-full font-black bg-foreground text-background hover:bg-foreground/90 px-5 py-1 text-xs h-8"
                                        >
                                            Continue to Scheduling
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={onCancel}
                                            className="text-muted-foreground text-xs h-8 px-3 rounded-full hover:bg-muted/40"
                                        >
                                            Skip review
                                        </Button>
                                    </div>
                                </motion.div>,
                                document.body
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cancel */}
            {!evalResult && (
                <div className="flex justify-center">
                    <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
                        Back to review
                    </Button>
                </div>
            )}
        </div>
    );
}
