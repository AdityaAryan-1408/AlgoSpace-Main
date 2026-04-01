'use client';

import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Flashcard } from "@/data";
import { fetchSuggestion, type SuggestionResult } from "@/lib/client-api";

const NITPICK_KEY = "algotrack-nitpick-mode";

const AI_REVIEW_KEY = "algotrack-ai-review-";

const LANGUAGES = [
    { id: "cpp", label: "C++" },
    { id: "python", label: "Python" },
    { id: "java", label: "Java" },
    { id: "javascript", label: "JavaScript" },
    { id: "typescript", label: "TypeScript" },
    { id: "go", label: "Go" },
    { id: "rust", label: "Rust" },
] as const;

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
    const isDSA = card.type === "leetcode";
    const [code, setCode] = useState("");
    const [language, setLanguage] = useState("cpp");
    const [strictMode, setStrictMode] = useState(false);
    const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [evalError, setEvalError] = useState("");
    const [hints, setHints] = useState<HintResult[]>([]);
    const [hintLevel, setHintLevel] = useState(0);
    const [isHinting, setIsHinting] = useState(false);
    const [showLangPicker, setShowLangPicker] = useState(false);
    const [selectedRating, setSelectedRating] = useState<EvalResult["suggestedRating"] | null>(null);
    const [suggestionResult, setSuggestionResult] = useState<SuggestionResult | null>(null);
    const [isFetchingSuggestion, setIsFetchingSuggestion] = useState(false);
    const [showSuggestion, setShowSuggestion] = useState(false);

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

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    {isDSA && (
                        <div className="relative">
                            <button
                                onClick={() => setShowLangPicker(!showLangPicker)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                                {LANGUAGES.find((l) => l.id === language)?.label || language}
                                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            {showLangPicker && (
                                <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 py-1 min-w-30">
                                    {LANGUAGES.map((lang) => (
                                        <button
                                            key={lang.id}
                                            onClick={() => {
                                                setLanguage(lang.id);
                                                setShowLangPicker(false);
                                            }}
                                            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 cursor-pointer ${language === lang.id ? "text-blue-500 font-medium" : "text-foreground"}`}
                                        >
                                            {lang.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

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
                        disabled={isHinting || hintLevel >= 3}
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
                        disabled={isEvaluating || !code.trim()}
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
                <div className="rounded-xl border border-border overflow-hidden">
                    <Editor
                        height="320px"
                        language={language}
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
                                {evalResult.suggestedRating}
                            </span>
                        </div>

                        {/* Feedback body */}
                        <div className="p-4 space-y-4">
                            <div className="text-sm text-foreground/90 leading-relaxed">
                                <MarkdownContent content={evalResult.feedback} />
                            </div>

                            {/* Complexity for DSA */}
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

                            {/* Accept Rating */}
                            <div className="flex flex-col gap-3 pt-4 border-t border-border mt-4">
                                <span className="text-sm text-foreground text-center font-medium">
                                    AI suggests rating this as <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ratingColors[evalResult.suggestedRating]}`}>{evalResult.suggestedRating}</span>
                                </span>
                                <p className="text-xs text-muted-foreground text-center mb-1">Select a rating to continue:</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {(["AGAIN", "HARD", "GOOD", "EASY"] as const).map((r) => (
                                        <Button
                                            key={r}
                                            variant="outline"
                                            onClick={() => setSelectedRating(r)}
                                            className={`rounded-xl py-6 font-semibold transition-all ${
                                                selectedRating === r
                                                    ? `border-2 ${r === 'AGAIN' ? 'border-red-500 bg-red-500/5' : r === 'HARD' ? 'border-orange-500 bg-orange-500/5' : r === 'GOOD' ? 'border-blue-500 bg-blue-500/5' : 'border-emerald-500 bg-emerald-500/5'} font-bold`
                                                    : "opacity-60 hover:opacity-100"
                                            }`}
                                        >
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={selectedRating === r ? (r === 'AGAIN' ? 'text-red-500' : r === 'HARD' ? 'text-orange-500' : r === 'GOOD' ? 'text-blue-500' : 'text-emerald-500') : ""}>
                                                    {r} {r === evalResult.suggestedRating && "✨"}
                                                </span>
                                            </div>
                                        </Button>
                                    ))}
                                </div>
                                <div className="flex flex-col items-center gap-2 mt-4">
                                    <Button
                                        size="lg"
                                        disabled={!selectedRating}
                                        onClick={() => selectedRating && onRate(selectedRating)}
                                        className="w-full sm:w-64 rounded-full font-bold bg-foreground text-background hover:bg-foreground/90 py-6"
                                    >
                                        Continue to Scheduling
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onCancel}
                                        className="text-muted-foreground"
                                    >
                                        Skip review
                                    </Button>
                                </div>
                            </div>
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
