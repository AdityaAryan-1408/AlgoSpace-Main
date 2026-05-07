'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Flashcard } from "@/data";
import { Zap, Timer, CheckCircle2, XCircle, Trophy, ArrowRight, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BigODrillProps {
    cards: Flashcard[];
    onExit: () => void;
}

interface DrillQuestion {
    cardId: string;
    question: string;
    answer: string;
    type: "time" | "space";
    cardTitle: string;
    difficulty: string;
}

function generateDrills(cards: Flashcard[]): DrillQuestion[] {
    const drills: DrillQuestion[] = [];
    for (const card of cards) {
        if (card.timeComplexity) {
            drills.push({
                cardId: card.id,
                question: `${card.title} — Time Complexity?`,
                answer: card.timeComplexity,
                type: "time",
                cardTitle: card.title,
                difficulty: card.difficulty,
            });
        }
        if (card.spaceComplexity) {
            drills.push({
                cardId: card.id,
                question: `${card.title} — Space Complexity?`,
                answer: card.spaceComplexity,
                type: "space",
                cardTitle: card.title,
                difficulty: card.difficulty,
            });
        }
    }
    // Shuffle
    for (let i = drills.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [drills[i], drills[j]] = [drills[j], drills[i]];
    }
    return drills.slice(0, 20); // Max 20 questions
}

const TIMER_SECONDS = 5;

export function BigODrill({ cards, onExit }: BigODrillProps) {
    const [phase, setPhase] = useState<"ready" | "active" | "reveal" | "complete">("ready");
    const [drills, setDrills] = useState<DrillQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState("");
    const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
    const [results, setResults] = useState<Array<{ question: DrillQuestion; userAnswer: string; correct: boolean }>>([]);
    const [streak, setStreak] = useState(0);
    const [bestStreak, setBestStreak] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const eligible = cards.filter(c => c.timeComplexity || c.spaceComplexity);
        setDrills(generateDrills(eligible));
    }, [cards]);

    const startDrill = () => {
        setPhase("active");
        setCurrentIndex(0);
        setResults([]);
        setStreak(0);
        setBestStreak(0);
        setTimeLeft(TIMER_SECONDS);
        setUserAnswer("");
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const startTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(TIMER_SECONDS);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    useEffect(() => {
        if (phase === "active") startTimer();
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [phase, currentIndex, startTimer]);

    // Auto-submit when time runs out
    useEffect(() => {
        if (timeLeft === 0 && phase === "active") {
            handleSubmit();
        }
    }, [timeLeft, phase]);

    const normalizeAnswer = (a: string) => a.toLowerCase().replace(/\s+/g, "").replace(/^o\(/, "").replace(/\)$/, "");

    const handleSubmit = () => {
        if (phase !== "active") return;
        if (timerRef.current) clearInterval(timerRef.current);

        const current = drills[currentIndex];
        const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(current.answer) ||
            userAnswer.trim().toLowerCase() === current.answer.trim().toLowerCase();
        
        const newStreak = isCorrect ? streak + 1 : 0;
        setStreak(newStreak);
        if (newStreak > bestStreak) setBestStreak(newStreak);

        setResults(prev => [...prev, { question: current, userAnswer: userAnswer.trim() || "(no answer)", correct: isCorrect }]);
        setPhase("reveal");
    };

    const nextQuestion = () => {
        if (currentIndex + 1 >= drills.length) {
            setPhase("complete");
        } else {
            setCurrentIndex(currentIndex + 1);
            setUserAnswer("");
            setPhase("active");
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const correctCount = results.filter(r => r.correct).length;
    const totalAnswered = results.length;
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

    if (drills.length === 0) {
        return (
            <div className="w-full max-w-2xl mx-auto p-8 flex flex-col items-center gap-4">
                <Zap className="w-10 h-10 text-amber-500" />
                <h2 className="text-xl font-bold text-foreground">No Big-O Drills Available</h2>
                <p className="text-sm text-muted-foreground text-center">
                    Add time/space complexity to your cards to unlock rapid-fire Big-O drills.
                </p>
                <Button onClick={onExit} variant="outline" className="rounded-full px-6 mt-4">
                    Back
                </Button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto p-4 md:p-8 flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Big-O Drills</h2>
                        <p className="text-[10px] text-muted-foreground">{TIMER_SECONDS}s per question • Pure recall</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {phase !== "ready" && phase !== "complete" && (
                        <span className="text-xs text-muted-foreground font-medium">
                            {currentIndex + 1} / {drills.length}
                        </span>
                    )}
                    <Button variant="ghost" size="sm" onClick={onExit} className="text-muted-foreground">Exit</Button>
                </div>
            </div>

            {/* Ready Phase */}
            {phase === "ready" && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-6 py-8">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                        <Zap className="w-10 h-10 text-amber-500" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-2xl font-bold text-foreground mb-2">Rapid-Fire Complexity Drills</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            You have {TIMER_SECONDS} seconds to answer each complexity question.
                            Type the Big-O notation (e.g., O(n log n), O(1), O(n²))
                        </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <Badge variant="tag" className="bg-transparent border-tag/30 text-tag">{drills.length} questions</Badge>
                        <span>•</span>
                        <span>{TIMER_SECONDS}s timer</span>
                    </div>
                    <Button onClick={startDrill} className="rounded-full px-8 py-5 text-base font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2 shadow-lg">
                        <Zap className="w-5 h-5" />
                        Start Drills
                    </Button>
                </motion.div>
            )}

            {/* Active Phase */}
            {phase === "active" && drills[currentIndex] && (
                <AnimatePresence mode="wait">
                    <motion.div key={currentIndex} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex flex-col gap-6 py-4">
                        {/* Timer */}
                        <div className="flex items-center justify-center gap-3">
                            <div className={`relative w-16 h-16 rounded-full flex items-center justify-center border-4 transition-colors ${timeLeft <= 2 ? "border-red-500" : timeLeft <= 3 ? "border-amber-500" : "border-emerald-500"}`}>
                                <span className={`text-2xl font-black ${timeLeft <= 2 ? "text-red-500" : timeLeft <= 3 ? "text-amber-500" : "text-emerald-500"}`}>
                                    {timeLeft}
                                </span>
                            </div>
                            {streak > 0 && (
                                <div className="flex items-center gap-1 text-amber-500">
                                    <span className="text-xs font-bold">🔥 {streak}</span>
                                </div>
                            )}
                        </div>

                        {/* Question */}
                        <div className="text-center">
                            <Badge variant={drills[currentIndex].difficulty as any} className="capitalize bg-transparent border-current text-current mb-3">
                                {drills[currentIndex].difficulty}
                            </Badge>
                            <h3 className="text-lg font-bold text-foreground mb-1">
                                {drills[currentIndex].cardTitle}
                            </h3>
                            <p className="text-base font-semibold text-foreground/80">
                                {drills[currentIndex].type === "time" ? "⏱ Time" : "💾 Space"} Complexity?
                            </p>
                        </div>

                        {/* Answer Input */}
                        <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} className="flex items-center gap-2 max-w-sm mx-auto w-full">
                            <input
                                ref={inputRef}
                                value={userAnswer}
                                onChange={e => setUserAnswer(e.target.value)}
                                placeholder="O(n), O(log n), O(n²)..."
                                autoFocus
                                className={`flex-1 px-4 py-3 rounded-full border-2 bg-background text-center text-lg font-mono font-bold focus:outline-none transition-colors ${timeLeft <= 2 ? "border-red-500 focus:border-red-500" : "border-border focus:border-amber-500"}`}
                            />
                            <Button type="submit" className="rounded-full px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold">
                                Go
                            </Button>
                        </form>
                    </motion.div>
                </AnimatePresence>
            )}

            {/* Reveal Phase */}
            {phase === "reveal" && results.length > 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 py-6">
                    {results[results.length - 1].correct ? (
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                            <XCircle className="w-8 h-8 text-red-500" />
                        </div>
                    )}
                    <div className="text-center">
                        <p className={`text-lg font-bold ${results[results.length - 1].correct ? "text-emerald-500" : "text-red-500"}`}>
                            {results[results.length - 1].correct ? "Correct!" : "Incorrect"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Your answer: <span className="font-mono font-bold text-foreground">{results[results.length - 1].userAnswer}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Correct: <span className="font-mono font-bold text-emerald-500">{results[results.length - 1].question.answer}</span>
                        </p>
                    </div>
                    <Button onClick={nextQuestion} className="rounded-full px-6 py-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-2 mt-2">
                        {currentIndex + 1 >= drills.length ? "See Results" : "Next"} <ArrowRight className="w-4 h-4" />
                    </Button>
                </motion.div>
            )}

            {/* Complete Phase */}
            {phase === "complete" && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-6 py-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                        <Trophy className="w-8 h-8 text-amber-500" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-2xl font-bold text-foreground">Drill Complete!</h3>
                        <p className="text-sm text-muted-foreground mt-1">{correctCount} / {totalAnswered} correct</p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-center">
                            <p className={`text-2xl font-black ${accuracy >= 80 ? "text-emerald-500" : accuracy >= 50 ? "text-amber-500" : "text-red-500"}`}>{accuracy}%</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Accuracy</p>
                        </div>
                        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-center">
                            <p className="text-2xl font-black text-amber-500">{bestStreak}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Best Streak</p>
                        </div>
                        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-center">
                            <p className="text-2xl font-black text-foreground">{totalAnswered}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Answered</p>
                        </div>
                    </div>

                    {/* Results List */}
                    <div className="w-full max-w-sm flex flex-col border border-border rounded-xl overflow-hidden bg-card">
                        {results.map((r, i) => (
                            <div key={i} className={`px-4 py-2.5 flex items-center justify-between text-sm ${i !== results.length - 1 ? "border-b border-border" : ""}`}>
                                <div className="flex items-center gap-2">
                                    {r.correct ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                                    <span className="text-xs text-foreground/80 truncate max-w-[150px]">{r.question.cardTitle}</span>
                                    <Badge variant="tag" className="bg-transparent border-tag/30 text-tag text-[9px] px-1.5 py-0">{r.question.type}</Badge>
                                </div>
                                <span className="text-xs font-mono text-muted-foreground">{r.question.answer}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <Button onClick={() => { setDrills(generateDrills(cards.filter(c => c.timeComplexity || c.spaceComplexity))); setPhase("ready"); }} variant="outline" className="rounded-full px-5 gap-2">
                            <RotateCcw className="w-4 h-4" /> Try Again
                        </Button>
                        <Button onClick={onExit} className="rounded-full px-6 bg-amber-500 hover:bg-amber-600 text-white font-semibold">
                            Done
                        </Button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
