'use client';

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Flashcard } from "@/data";
import { getStoredAiReview } from "@/components/CodePractice";
import { getCodeEvolution } from "@/components/CodeEvolution";
import { Loader2, Languages, ArrowRight, Send, RotateCcw, Check, X } from "lucide-react";
import { motion } from "motion/react";

interface CrossLanguageProps {
    cards: Flashcard[];
    onExit: () => void;
}

const TARGET_LANGUAGES = [
    { id: "python", label: "Python" },
    { id: "javascript", label: "JavaScript" },
    { id: "typescript", label: "TypeScript" },
    { id: "go", label: "Go" },
    { id: "java", label: "Java" },
    { id: "cpp", label: "C++" },
    { id: "rust", label: "Rust" },
    { id: "csharp", label: "C#" },
];

interface TranslationResult {
    isCorrect: boolean;
    correctnessScore: number;
    idiomaticScore: number;
    qualityScore: number;
    overallScore: number;
    feedback: string;
    idiomaticIssues: Array<{ issue: string; before: string; after: string; feature: string }>;
    missingFeatures: string[];
}

export function CrossLanguage({ cards, onExit }: CrossLanguageProps) {
    const [phase, setPhase] = useState<"select" | "translate" | "evaluating" | "result">("select");
    const [selectedCard, setSelectedCard] = useState<Flashcard | null>(null);
    const [originalCode, setOriginalCode] = useState("");
    const [sourceLanguage, setSourceLanguage] = useState("");
    const [targetLanguage, setTargetLanguage] = useState("");
    const [translatedCode, setTranslatedCode] = useState("");
    const [result, setResult] = useState<TranslationResult | null>(null);
    const [error, setError] = useState("");

    // Cards with code submissions
    const eligibleCards = useMemo(() => {
        return cards.filter(c => {
            if (c.type !== "leetcode") return false;
            const review = getStoredAiReview(c.id);
            if (review?.userCode) return true;
            const evo = getCodeEvolution(c.id);
            return evo.length > 0;
        });
    }, [cards]);

    const handleSelectCard = (card: Flashcard) => {
        setSelectedCard(card);
        const review = getStoredAiReview(card.id);
        let code = review?.userCode || "";
        if (!code) {
            const evo = getCodeEvolution(card.id);
            code = evo[evo.length - 1]?.code || "";
        }
        setOriginalCode(code);

        // Auto-detect source language (basic heuristic)
        if (code.includes("def ") || code.includes("print(")) setSourceLanguage("python");
        else if (code.includes("function ") || code.includes("const ") || code.includes("let ")) setSourceLanguage("javascript");
        else if (code.includes("class Solution") && code.includes("public")) setSourceLanguage("java");
        else if (code.includes("#include") || code.includes("vector<")) setSourceLanguage("cpp");
        else if (code.includes("func ") && code.includes("package")) setSourceLanguage("go");
        else setSourceLanguage("cpp");

        setTargetLanguage("");
        setTranslatedCode("");
        setResult(null);
        setPhase("translate");
    };

    const handleSubmit = async () => {
        if (!translatedCode.trim() || !targetLanguage || !selectedCard) return;
        setPhase("evaluating");
        setError("");
        try {
            const res = await fetch("/api/evaluate/cross-language", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    originalCode,
                    translatedCode,
                    sourceLanguage,
                    targetLanguage,
                    problemTitle: selectedCard.title,
                }),
            });
            if (!res.ok) throw new Error("Failed");
            const data: TranslationResult = await res.json();
            setResult(data);
            setPhase("result");
        } catch {
            setError("Evaluation failed");
            setPhase("translate");
        }
    };

    const scoreColor = (score: number) =>
        score >= 8 ? "text-emerald-500" : score >= 6 ? "text-amber-500" : "text-red-500";

    return (
        <div className="w-full max-w-3xl mx-auto p-4 md:p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shadow-lg">
                        <Languages className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Cross-Language Fluency</h2>
                        <p className="text-[10px] text-muted-foreground">Translate your solution into a different language</p>
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
                        <h3 className="text-xl font-bold mb-1">Pick a Solved Problem</h3>
                        <p className="text-sm text-muted-foreground">
                            Choose a problem you&apos;ve already solved. You&apos;ll translate your exact logic into a different language.
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
                                    className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-sky-500/40 bg-card hover:bg-sky-500/5 transition-all cursor-pointer"
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

            {phase === "translate" && selectedCard && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                    {/* Original code */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Your {sourceLanguage} Solution — {selectedCard.title}
                            </span>
                            <select
                                value={sourceLanguage}
                                onChange={e => setSourceLanguage(e.target.value)}
                                className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-background text-foreground cursor-pointer"
                            >
                                {TARGET_LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                            </select>
                        </div>
                        <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap p-4 rounded-xl bg-muted/30 border border-border overflow-x-auto max-h-48">
                            {originalCode}
                        </pre>
                    </div>

                    {/* Target language selection */}
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Translate to:</span>
                        <div className="flex flex-wrap gap-1.5">
                            {TARGET_LANGUAGES.filter(l => l.id !== sourceLanguage).map(l => (
                                <button
                                    key={l.id}
                                    onClick={() => setTargetLanguage(l.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                        targetLanguage === l.id
                                            ? "bg-sky-500/10 text-sky-500 border border-sky-500/30"
                                            : "text-muted-foreground hover:text-foreground bg-muted/30 border border-border"
                                    }`}
                                >
                                    {l.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Translation input */}
                    {targetLanguage && (
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                                Your {TARGET_LANGUAGES.find(l => l.id === targetLanguage)?.label} Translation
                            </span>
                            <textarea
                                value={translatedCode}
                                onChange={e => setTranslatedCode(e.target.value)}
                                placeholder={`Write the same logic in ${TARGET_LANGUAGES.find(l => l.id === targetLanguage)?.label}...`}
                                rows={12}
                                className="w-full p-4 rounded-xl border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/20 resize-y"
                            />
                        </div>
                    )}

                    <div className="flex justify-center gap-3">
                        <Button variant="outline" onClick={() => setPhase("select")} className="rounded-full px-5">Back</Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!translatedCode.trim() || !targetLanguage}
                            className="rounded-full px-6 bg-sky-500 hover:bg-sky-600 text-white gap-2 shadow-lg"
                        >
                            <Send className="w-4 h-4" /> Grade Translation
                        </Button>
                    </div>
                </motion.div>
            )}

            {phase === "evaluating" && (
                <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
                    <p className="text-sm text-muted-foreground">Evaluating your translation...</p>
                </div>
            )}

            {phase === "result" && result && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
                    {/* Overall */}
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                        <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-black ${
                            result.overallScore >= 80 ? "bg-emerald-500/10 text-emerald-500" :
                            result.overallScore >= 60 ? "bg-amber-500/10 text-amber-500" :
                            "bg-red-500/10 text-red-500"
                        }`}>
                            {result.overallScore}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                {result.isCorrect ? (
                                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-500"><Check className="w-3 h-3" /> Correct</span>
                                ) : (
                                    <span className="flex items-center gap-1 text-xs font-bold text-red-500"><X className="w-3 h-3" /> Incorrect</span>
                                )}
                            </div>
                            <div className="flex gap-4">
                                {[
                                    { label: "Correctness", score: result.correctnessScore },
                                    { label: "Idiomatic", score: result.idiomaticScore },
                                    { label: "Quality", score: result.qualityScore },
                                ].map(d => (
                                    <div key={d.label} className="text-center">
                                        <span className={`text-lg font-black ${scoreColor(d.score)}`}>{d.score}</span>
                                        <p className="text-[9px] text-muted-foreground">{d.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/20 border border-border">
                        <p className="text-sm text-foreground/80 leading-relaxed">{result.feedback}</p>
                    </div>

                    {/* Idiomatic Issues */}
                    {result.idiomaticIssues.length > 0 && (
                        <div className="space-y-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-500">Idiomatic Improvements</span>
                            {result.idiomaticIssues.map((issue, i) => (
                                <div key={i} className="rounded-lg border border-border overflow-hidden">
                                    <div className="px-3 py-1.5 bg-muted/30 flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-sky-500 px-1.5 py-0.5 rounded bg-sky-500/10">{issue.feature}</span>
                                        <span className="text-xs text-foreground/80">{issue.issue}</span>
                                    </div>
                                    <div className="grid grid-cols-2 text-xs font-mono">
                                        <div className="p-2 bg-red-500/5 border-r border-border">
                                            <span className="text-[9px] font-bold text-red-500 uppercase">Your Code</span>
                                            <pre className="text-foreground/70 whitespace-pre-wrap mt-1">{issue.before}</pre>
                                        </div>
                                        <div className="p-2 bg-emerald-500/5">
                                            <span className="text-[9px] font-bold text-emerald-500 uppercase">Idiomatic</span>
                                            <pre className="text-foreground/70 whitespace-pre-wrap mt-1">{issue.after}</pre>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Missing Features */}
                    {result.missingFeatures.length > 0 && (
                        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block mb-1">Unused Language Features</span>
                            <div className="flex flex-wrap gap-1.5">
                                {result.missingFeatures.map((f, i) => (
                                    <span key={i} className="px-2 py-1 rounded-md text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        {f}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

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
