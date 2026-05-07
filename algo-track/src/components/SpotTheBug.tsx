'use client';

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Flashcard } from "@/data";
import { Bug, Loader2, AlertTriangle, CheckCircle2, XCircle, Eye, EyeOff, Timer, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SpotTheBugProps {
    card: Flashcard;
    onRate: (rating: "AGAIN" | "HARD" | "GOOD" | "EASY") => void;
    onCancel: () => void;
}

interface BugChallenge {
    buggyCode: string;
    bugType: string;
    bugDescription: string;
    bugLine: number;
    hint: string;
    difficulty: string;
}

interface BugEvaluation {
    isCorrect: boolean;
    feedback: string;
    correctFix: string;
    suggestedRating: "AGAIN" | "HARD" | "GOOD" | "EASY";
    debuggingSkill: string;
}

const TIME_LIMIT = 180; // 3 minutes

export function SpotTheBug({ card, onRate, onCancel }: SpotTheBugProps) {
    const [phase, setPhase] = useState<"loading" | "challenge" | "evaluating" | "results">("loading");
    const [challenge, setChallenge] = useState<BugChallenge | null>(null);
    const [userFix, setUserFix] = useState("");
    const [error, setError] = useState("");
    const [evaluation, setEvaluation] = useState<BugEvaluation | null>(null);
    const [showHint, setShowHint] = useState(false);
    const [showBugReveal, setShowBugReveal] = useState(false);
    const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { generateChallenge(); }, []);

    useEffect(() => {
        if (phase === "challenge") {
            setTimeLeft(TIME_LIMIT);
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current!);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [phase]);

    const getSavedSolution = () => {
        if (card.solutions && card.solutions.length > 0) return card.solutions[0].content;
        return card.solution || "";
    };

    const generateChallenge = async () => {
        setPhase("loading"); setError("");
        try {
            const res = await fetch("/api/evaluate/spot-bug", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "generate", problemTitle: card.title, problemDescription: card.description, savedSolution: getSavedSolution(), cardType: card.type }),
            });
            if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
            const result: BugChallenge = await res.json();
            setChallenge(result);
            setPhase("challenge");
            setTimeout(() => textareaRef.current?.focus(), 200);
        } catch (err) { setError(err instanceof Error ? err.message : "Failed to generate challenge"); setPhase("challenge"); }
    };

    const handleSubmit = async () => {
        if (!userFix.trim() || !challenge) return;
        if (timerRef.current) clearInterval(timerRef.current);
        setPhase("evaluating");

        try {
            const res = await fetch("/api/evaluate/spot-bug", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "evaluate", problemTitle: card.title, savedSolution: getSavedSolution(), buggyCode: challenge.buggyCode, userFix: userFix.trim() }),
            });
            if (!res.ok) throw new Error("Failed");
            const result: BugEvaluation = await res.json();
            setEvaluation(result); setPhase("results");
        } catch { setError("Failed to evaluate your fix"); setPhase("challenge"); }
    };

    const handleGiveUp = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setShowBugReveal(true);
    };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

    const bugTypeLabels: Record<string, { label: string; color: string }> = {
        "off-by-one": { label: "Off-by-one", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
        "wrong-operator": { label: "Wrong Operator", color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
        "missing-edge-case": { label: "Missing Edge Case", color: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
        "wrong-variable": { label: "Wrong Variable", color: "text-red-500 bg-red-500/10 border-red-500/20" },
        "wrong-bounds": { label: "Wrong Bounds", color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" },
        "missing-return": { label: "Missing Return", color: "text-pink-500 bg-pink-500/10 border-pink-500/20" },
        "wrong-init": { label: "Wrong Init", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
        "logic-error": { label: "Logic Error", color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" },
    };

    const stripCodeFences = (code: string) => code.replace(/```\w*\n?|```/g, "").trim();

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                        <Bug className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground">Spot the Bug</h3>
                        <p className="text-[10px] text-muted-foreground">Find and describe the hidden bug</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {phase === "challenge" && (
                        <div className={`flex items-center gap-1.5 text-sm font-mono font-bold ${timeLeft <= 30 ? "text-red-500" : timeLeft <= 60 ? "text-amber-500" : "text-muted-foreground"}`}>
                            <Timer className="w-3.5 h-3.5" />
                            {formatTime(timeLeft)}
                        </div>
                    )}
                    <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground text-xs">Exit</Button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm text-red-500">{error}</span>
                </div>
            )}

            {/* Loading */}
            {phase === "loading" && (
                <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                    <p className="text-sm text-muted-foreground">Generating buggy code...</p>
                </div>
            )}

            {/* Challenge */}
            {phase === "challenge" && challenge && (
                <div className="flex flex-col gap-4">
                    <div className="p-4 rounded-xl bg-muted/50 border border-border/50 overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Buggy Code — {card.title}</h4>
                            <Badge variant={challenge.difficulty as any} className="capitalize bg-transparent border-current text-current text-[10px]">
                                {challenge.difficulty}
                            </Badge>
                        </div>
                        <pre className="text-sm font-mono text-foreground/90 leading-relaxed whitespace-pre-wrap overflow-x-auto selectable">
                            {stripCodeFences(challenge.buggyCode)}
                        </pre>
                    </div>

                    {/* Hint */}
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowHint(!showHint)} className="flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors cursor-pointer">
                            <Lightbulb className="w-3.5 h-3.5" />
                            {showHint ? "Hide Hint" : "Show Hint"}
                        </button>
                    </div>
                    <AnimatePresence>
                        {showHint && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs text-foreground/80">
                                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 inline mr-1" />
                                    {challenge.hint}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* User Fix Input */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                            Describe the bug & your fix
                        </label>
                        <textarea
                            ref={textareaRef}
                            value={userFix}
                            onChange={e => setUserFix(e.target.value)}
                            placeholder="I found a bug on line X. The issue is... The fix should be..."
                            className="w-full min-h-24 text-sm p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-red-500 resize-y font-mono"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <Button variant="ghost" size="sm" onClick={handleGiveUp} className="text-xs text-muted-foreground gap-1">
                            {showBugReveal ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            {showBugReveal ? "Hide Answer" : "Give Up — Reveal Bug"}
                        </Button>
                        <Button onClick={handleSubmit} disabled={!userFix.trim()} className="rounded-full px-6 bg-red-500 hover:bg-red-600 text-white font-semibold gap-2">
                            Submit Fix
                        </Button>
                    </div>

                    {/* Bug reveal (give up) */}
                    <AnimatePresence>
                        {showBugReveal && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${bugTypeLabels[challenge.bugType]?.color || "text-muted-foreground bg-muted border-border"}`}>
                                            {bugTypeLabels[challenge.bugType]?.label || challenge.bugType}
                                        </span>
                                        {challenge.bugLine > 0 && <span className="text-[10px] text-muted-foreground">Line {challenge.bugLine}</span>}
                                    </div>
                                    <p className="text-sm text-foreground/90">{challenge.bugDescription}</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Evaluating */}
            {phase === "evaluating" && (
                <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                    <p className="text-sm text-muted-foreground">Evaluating your fix...</p>
                </div>
            )}

            {/* Results */}
            {phase === "results" && evaluation && challenge && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                    <div className="flex flex-col items-center gap-3 py-4">
                        {evaluation.isCorrect ? (
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                                <XCircle className="w-8 h-8 text-red-500" />
                            </div>
                        )}
                        <p className={`text-lg font-bold ${evaluation.isCorrect ? "text-emerald-500" : "text-red-500"}`}>
                            {evaluation.isCorrect ? "Bug Found!" : "Not Quite Right"}
                        </p>
                        <Badge className={`text-[10px] ${evaluation.debuggingSkill === "expert" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : evaluation.debuggingSkill === "intermediate" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"}`}>
                            {evaluation.debuggingSkill} debugger
                        </Badge>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                        <p className="text-sm text-foreground/90 leading-relaxed">{evaluation.feedback}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1.5">Correct Fix</p>
                        <p className="text-sm text-foreground/90 font-mono">{evaluation.correctFix}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${bugTypeLabels[challenge.bugType]?.color || "text-muted-foreground bg-muted border-border"}`}>
                                {bugTypeLabels[challenge.bugType]?.label || challenge.bugType}
                            </span>
                            <span className="text-xs text-muted-foreground">{challenge.bugDescription}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-3 pt-2">
                        <Button onClick={() => onRate(evaluation.suggestedRating)} className="rounded-full px-6 py-5 font-semibold bg-red-500 hover:bg-red-600 text-white gap-2">
                            <CheckCircle2 className="w-4 h-4" />Accept Rating: {evaluation.suggestedRating}
                        </Button>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}
