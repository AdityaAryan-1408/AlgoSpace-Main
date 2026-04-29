'use client';

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MarkdownContent } from "@/components/MarkdownContent";
import type { Flashcard } from "@/data";
import {
    Bug,
    Loader2,
    Eye,
    EyeOff,
    ChevronDown,
    ChevronUp,
    Check,
    X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TraceStep {
    step: number;
    description: string;
    variables: string;
}

interface DryRunResult {
    code: string;
    input: string;
    inputExplanation: string;
    expectedOutput: string;
    traceSteps: TraceStep[];
    difficulty: "medium" | "hard";
}

interface DryRunChallengeProps {
    card: Flashcard;
    onRate: (rating: "AGAIN" | "HARD" | "GOOD" | "EASY") => void;
    onCancel: () => void;
}

export function DryRunChallenge({ card, onRate, onCancel }: DryRunChallengeProps) {
    const [challenge, setChallenge] = useState<DryRunResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [userAnswer, setUserAnswer] = useState("");
    const [showAnswer, setShowAnswer] = useState(false);
    const [showTrace, setShowTrace] = useState(false);
    const [revealedSteps, setRevealedSteps] = useState<number>(0);
    const [selfRating, setSelfRating] = useState<"correct" | "partial" | "incorrect" | null>(null);

    const generateChallenge = async () => {
        setIsLoading(true);
        setError("");
        setChallenge(null);
        setUserAnswer("");
        setShowAnswer(false);
        setShowTrace(false);
        setRevealedSteps(0);
        setSelfRating(null);

        try {
            const getSavedSolution = () => {
                if (card.solutions && card.solutions.length > 0) {
                    return card.solutions.map((s) => `## ${s.name}\n${s.content}`).join("\n\n");
                }
                return card.solution || "";
            };

            const res = await fetch("/api/evaluate/dry-run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    problemTitle: card.title,
                    problemDescription: card.description,
                    savedSolution: getSavedSolution(),
                    cardType: card.type,
                }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Failed to generate challenge");
            }

            const result: DryRunResult = await res.json();
            setChallenge(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate dry-run challenge");
        } finally {
            setIsLoading(false);
        }
    };

    const revealNextStep = () => {
        if (challenge && revealedSteps < challenge.traceSteps.length) {
            setRevealedSteps((prev) => prev + 1);
        }
    };

    const handleSelfRate = (rating: "correct" | "partial" | "incorrect") => {
        setSelfRating(rating);
    };

    const ratingMap: Record<string, "AGAIN" | "HARD" | "GOOD" | "EASY"> = {
        correct: "EASY",
        partial: "GOOD",
        incorrect: "HARD",
    };

    if (card.type !== "leetcode") {
        return (
            <div className="text-center py-8 text-sm text-muted-foreground">
                Dry-run challenges are only available for DSA problems.
                <div className="mt-3">
                    <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
                        Back to review
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Bug className="w-4 h-4 text-cyan-500" />
                        Dry-Run Challenge
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Trace the code mentally. What&apos;s the output?
                    </p>
                </div>
            </div>

            {/* Generate button */}
            {!challenge && !isLoading && (
                <div className="flex flex-col items-center gap-3 py-6">
                    <p className="text-sm text-foreground/80 text-center max-w-sm">
                        You&apos;ll get a code snippet with a tricky input.
                        Mentally trace the variables and determine the output without running the code.
                    </p>
                    <Button
                        onClick={generateChallenge}
                        className="gap-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-8 py-5 font-semibold text-base"
                    >
                        <Bug className="w-5 h-5" />
                        Start Dry-Run
                    </Button>
                </div>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center gap-2 py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
                    <span className="text-sm text-muted-foreground">
                        Generating dry-run challenge...
                    </span>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500 text-center">
                    {error}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={generateChallenge}
                        className="ml-2 text-red-500"
                    >
                        Try Again
                    </Button>
                </div>
            )}

            {/* Challenge */}
            <AnimatePresence>
                {challenge && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        {/* Code snippet */}
                        <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                            <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center justify-between">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Code to Trace
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    challenge.difficulty === "hard"
                                        ? "bg-red-500/10 text-red-500"
                                        : "bg-orange-500/10 text-orange-500"
                                }`}>
                                    {challenge.difficulty}
                                </span>
                            </div>
                            <div className="p-4">
                                <MarkdownContent content={`\`\`\`\n${challenge.code}\n\`\`\``} />
                            </div>
                        </div>

                        {/* Input */}
                        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-1">
                                Input
                            </p>
                            <p className="text-sm font-mono font-semibold text-foreground">
                                {challenge.input}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {challenge.inputExplanation}
                            </p>
                        </div>

                        {/* User answer */}
                        {!showAnswer && (
                            <div className="space-y-3">
                                <textarea
                                    value={userAnswer}
                                    onChange={(e) => setUserAnswer(e.target.value)}
                                    placeholder="Type the expected output after mentally tracing the code..."
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 placeholder:text-muted-foreground resize-y leading-relaxed"
                                />
                                <div className="flex items-center justify-center gap-3">
                                    <Button
                                        onClick={() => setShowAnswer(true)}
                                        className="gap-2 bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 py-5 font-semibold"
                                    >
                                        <Eye className="w-4 h-4" />
                                        Reveal Answer
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Answer revealed */}
                        {showAnswer && (
                            <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                {/* Expected output */}
                                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-1">
                                        Expected Output
                                    </p>
                                    <p className="text-sm font-mono font-bold text-foreground">
                                        {challenge.expectedOutput}
                                    </p>
                                </div>

                                {/* Your answer */}
                                {userAnswer.trim() && (
                                    <div className="p-4 rounded-xl bg-muted/30 border border-border">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                            Your Answer
                                        </p>
                                        <p className="text-sm font-mono text-foreground">
                                            {userAnswer}
                                        </p>
                                    </div>
                                )}

                                {/* Step-by-step trace */}
                                <div>
                                    <button
                                        onClick={() => setShowTrace(!showTrace)}
                                        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
                                    >
                                        <span>Step-by-Step Trace ({challenge.traceSteps.length} steps)</span>
                                        {showTrace ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>

                                    <AnimatePresence>
                                        {showTrace && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-2 space-y-2">
                                                    {challenge.traceSteps.map((step, i) => (
                                                        <motion.div
                                                            key={step.step}
                                                            initial={i >= revealedSteps ? { opacity: 0.3 } : {}}
                                                            animate={i < revealedSteps ? { opacity: 1 } : { opacity: 0.3 }}
                                                            className={`p-3 rounded-lg border ${
                                                                i < revealedSteps
                                                                    ? "border-border bg-muted/20"
                                                                    : "border-border/30 bg-muted/5"
                                                            }`}
                                                        >
                                                            {i < revealedSteps ? (
                                                                <>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="text-[10px] font-bold text-cyan-500 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                                                                            Step {step.step}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-foreground/80">
                                                                        {step.description}
                                                                    </p>
                                                                    <p className="text-xs font-mono text-muted-foreground mt-1">
                                                                        {step.variables}
                                                                    </p>
                                                                </>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                                                                    <span className="text-xs text-muted-foreground">
                                                                        Step {step.step} — hidden
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </motion.div>
                                                    ))}
                                                    {revealedSteps < challenge.traceSteps.length && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={revealNextStep}
                                                            className="w-full text-xs"
                                                        >
                                                            Reveal Next Step
                                                        </Button>
                                                    )}
                                                    {revealedSteps === 0 && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setRevealedSteps(challenge.traceSteps.length)}
                                                            className="w-full text-xs"
                                                        >
                                                            Reveal All Steps
                                                        </Button>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Self-rating */}
                                {!selfRating ? (
                                    <div className="flex flex-col items-center gap-3 pt-3 border-t border-border">
                                        <p className="text-sm font-medium text-foreground">
                                            How did your mental trace go?
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={() => handleSelfRate("correct")}
                                                className="gap-1.5 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                                            >
                                                <Check className="w-4 h-4" /> Got it right
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => handleSelfRate("partial")}
                                                className="gap-1.5 border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                                            >
                                                Partially right
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => handleSelfRate("incorrect")}
                                                className="gap-1.5 border-red-500/30 text-red-500 hover:bg-red-500/10"
                                            >
                                                <X className="w-4 h-4" /> Got it wrong
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 pt-3 border-t border-border">
                                        <Button
                                            size="lg"
                                            onClick={() => onRate(ratingMap[selfRating])}
                                            className="w-full sm:w-64 rounded-full font-bold bg-foreground text-background hover:bg-foreground/90 py-6"
                                        >
                                            Continue ({ratingMap[selfRating]})
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
                                            Skip
                                        </Button>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cancel */}
            {!challenge && !isLoading && (
                <div className="flex justify-center">
                    <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
                        Back to review
                    </Button>
                </div>
            )}
        </div>
    );
}
