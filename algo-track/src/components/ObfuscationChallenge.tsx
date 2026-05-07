'use client';

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Flashcard } from "@/data";
import { getCodeEvolution } from "@/components/CodeEvolution";
import { getStoredAiReview } from "@/components/CodePractice";
import { Loader2, Eye, ShuffleIcon, Send, ArrowRight, RotateCcw } from "lucide-react";
import { motion } from "motion/react";

interface ObfuscationChallengeProps {
    cards: Flashcard[];
    onExit: () => void;
}

interface ObfuscateResult {
    obfuscatedCode: string;
    variableCount: number;
    linesOfCode: number;
}

interface EvalResult {
    algorithmIdentified: boolean;
    algorithmName: string;
    namingScore: number;
    commentScore: number;
    isEquivalent: boolean;
    overallScore: number;
    feedback: string;
}

export function ObfuscationChallenge({ cards, onExit }: ObfuscationChallengeProps) {
    const [phase, setPhase] = useState<"select" | "loading" | "challenge" | "evaluating" | "result">("select");
    const [selectedCard, setSelectedCard] = useState<Flashcard | null>(null);
    const [originalCode, setOriginalCode] = useState("");
    const [obfuscated, setObfuscated] = useState<ObfuscateResult | null>(null);
    const [userRefactored, setUserRefactored] = useState("");
    const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
    const [error, setError] = useState("");

    // Get cards that have code submissions
    const eligibleCards = useMemo(() => {
        return cards.filter(c => {
            if (c.type !== "leetcode") return false;
            const review = getStoredAiReview(c.id);
            if (review?.userCode) return true;
            const evo = getCodeEvolution(c.id);
            return evo.length > 0;
        });
    }, [cards]);

    const handleSelectCard = async (card: Flashcard) => {
        setSelectedCard(card);
        setError("");
        setPhase("loading");

        // Get the user's code
        const review = getStoredAiReview(card.id);
        let code = review?.userCode || "";
        if (!code) {
            const evo = getCodeEvolution(card.id);
            code = evo[evo.length - 1]?.code || "";
        }
        setOriginalCode(code);

        try {
            const res = await fetch("/api/evaluate/obfuscation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code,
                    problemTitle: card.title,
                    mode: "obfuscate",
                }),
            });
            if (!res.ok) throw new Error("Failed");
            const data: ObfuscateResult = await res.json();
            setObfuscated(data);
            setUserRefactored("");
            setPhase("challenge");
        } catch {
            setError("Failed to obfuscate code");
            setPhase("select");
        }
    };

    const handleSubmitRefactor = async () => {
        if (!userRefactored.trim() || !selectedCard || !obfuscated) return;
        setPhase("evaluating");
        try {
            const res = await fetch("/api/evaluate/obfuscation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: userRefactored,
                    originalCode,
                    obfuscatedCode: obfuscated.obfuscatedCode,
                    problemTitle: selectedCard.title,
                    mode: "evaluate",
                }),
            });
            if (!res.ok) throw new Error("Failed");
            const data: EvalResult = await res.json();
            setEvalResult(data);
            setPhase("result");
        } catch {
            setError("Evaluation failed");
            setPhase("challenge");
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto p-4 md:p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
                        <ShuffleIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Obfuscation Challenge</h2>
                        <p className="text-[10px] text-muted-foreground">Decode & refactor your own obfuscated code</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={onExit}>Exit</Button>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-500">{error}</div>
            )}

            {phase === "select" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                    <div className="text-center py-4">
                        <h3 className="text-xl font-bold mb-1">Choose a Problem</h3>
                        <p className="text-sm text-muted-foreground">
                            Your code will be obfuscated — all variables renamed, all comments stripped.
                            Can you refactor it back into clean code?
                        </p>
                    </div>

                    {eligibleCards.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground text-sm">
                            No eligible cards found. Complete some code reviews first!
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                            {eligibleCards.map(card => (
                                <button
                                    key={card.id}
                                    onClick={() => handleSelectCard(card)}
                                    className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-violet-500/40 bg-card hover:bg-violet-500/5 transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-foreground">{card.title}</span>
                                        <Badge variant={card.difficulty} className="capitalize bg-transparent border-current text-current text-[9px] px-1.5 py-0">
                                            {card.difficulty}
                                        </Badge>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                </button>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}

            {(phase === "loading" || phase === "evaluating") && (
                <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                    <p className="text-sm text-muted-foreground">
                        {phase === "loading" ? "Obfuscating your code..." : "Evaluating your refactoring..."}
                    </p>
                </div>
            )}

            {phase === "challenge" && obfuscated && selectedCard && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                    <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/20 flex items-center gap-2">
                        <ShuffleIcon className="w-4 h-4 text-violet-500" />
                        <span className="text-sm font-medium text-violet-500">{selectedCard.title}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{obfuscated.variableCount} vars • {obfuscated.linesOfCode} lines</span>
                    </div>

                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Obfuscated Code (Decode This)</span>
                        <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap p-4 rounded-xl bg-muted/30 border border-border overflow-x-auto max-h-60">
                            {obfuscated.obfuscatedCode}
                        </pre>
                    </div>

                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Your Clean Refactored Version</span>
                        <textarea
                            value={userRefactored}
                            onChange={e => setUserRefactored(e.target.value)}
                            placeholder="Rewrite the code with proper variable names and comments..."
                            rows={12}
                            className="w-full p-4 rounded-xl border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-y"
                        />
                    </div>

                    <div className="flex justify-center gap-3">
                        <Button variant="outline" onClick={() => setPhase("select")} className="rounded-full px-5">Pick Another</Button>
                        <Button
                            onClick={handleSubmitRefactor}
                            disabled={!userRefactored.trim()}
                            className="rounded-full px-6 bg-violet-500 hover:bg-violet-600 text-white gap-2 shadow-lg"
                        >
                            <Send className="w-4 h-4" /> Submit Refactoring
                        </Button>
                    </div>
                </motion.div>
            )}

            {phase === "result" && evalResult && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
                    {/* Score */}
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                        <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-black ${
                            evalResult.overallScore >= 80 ? "bg-emerald-500/10 text-emerald-500" :
                            evalResult.overallScore >= 60 ? "bg-amber-500/10 text-amber-500" :
                            "bg-red-500/10 text-red-500"
                        }`}>
                            {evalResult.overallScore}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">
                                {evalResult.algorithmIdentified
                                    ? `Algorithm: ${evalResult.algorithmName}`
                                    : "Algorithm not identified"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Naming: {evalResult.namingScore}/10 • Comments: {evalResult.commentScore}/10
                                {evalResult.isEquivalent ? " • ✓ Functionally equivalent" : " • ✗ Not equivalent"}
                            </p>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/20 border border-border">
                        <p className="text-sm text-foreground/80 leading-relaxed">{evalResult.feedback}</p>
                    </div>

                    {/* Show original */}
                    <details className="text-xs">
                        <summary className="text-muted-foreground cursor-pointer hover:text-foreground font-medium">
                            <Eye className="w-3 h-3 inline mr-1" /> View original code
                        </summary>
                        <pre className="mt-2 p-3 rounded-lg bg-muted/30 border border-border text-foreground/70 font-mono whitespace-pre-wrap">{originalCode}</pre>
                    </details>

                    <div className="flex justify-center gap-3">
                        <Button variant="outline" onClick={() => setPhase("select")} className="rounded-full gap-1">
                            <RotateCcw className="w-4 h-4" /> Try Another
                        </Button>
                        <Button variant="ghost" onClick={onExit} className="rounded-full">Exit</Button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
