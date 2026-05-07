'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import type { Flashcard } from "@/data";
import { Crosshair, Timer, CheckCircle2, XCircle, Trophy, ArrowRight, RotateCcw, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PatternQuizProps {
    cards: Flashcard[];
    onExit: () => void;
}

// Common DSA patterns
const PATTERNS = [
    "Two Pointers", "Sliding Window", "Binary Search", "BFS", "DFS",
    "Dynamic Programming", "Backtracking", "Greedy", "Stack", "Queue",
    "Heap / Priority Queue", "Hash Map", "Trie", "Union Find",
    "Topological Sort", "Monotonic Stack", "Bit Manipulation",
    "Linked List", "Tree Traversal", "Graph", "Divide & Conquer",
    "Sorting", "Prefix Sum", "Intervals", "Math",
];

interface QuizQuestion {
    cardId: string;
    title: string;
    description: string;
    correctPattern: string;
    allTags: string[];
    difficulty: string;
    options: string[];
}

function buildQuizQuestions(cards: Flashcard[]): QuizQuestion[] {
    const eligible = cards.filter(
        c => c.type === "leetcode" && c.tags.length > 0
    );

    const questions: QuizQuestion[] = [];

    for (const card of eligible) {
        // Find the best matching pattern from the card's tags
        const matchedPattern = card.tags.find(tag =>
            PATTERNS.some(p => p.toLowerCase() === tag.toLowerCase())
        ) || card.tags[0];

        if (!matchedPattern) continue;

        // Generate 4 options (1 correct + 3 random wrong ones)
        const wrongOptions = PATTERNS
            .filter(p => p.toLowerCase() !== matchedPattern.toLowerCase())
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);

        const options = [matchedPattern, ...wrongOptions].sort(() => 0.5 - Math.random());

        questions.push({
            cardId: card.id,
            title: card.title,
            description: card.description.length > 200
                ? card.description.substring(0, 200) + "..."
                : card.description,
            correctPattern: matchedPattern,
            allTags: card.tags,
            difficulty: card.difficulty,
            options,
        });
    }

    // Shuffle and limit
    return questions.sort(() => 0.5 - Math.random()).slice(0, 15);
}

const QUESTION_TIME = 8; // seconds per question

export function PatternQuiz({ cards, onExit }: PatternQuizProps) {
    const [phase, setPhase] = useState<"ready" | "active" | "reveal" | "complete">("ready");
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [results, setResults] = useState<Array<{
        question: QuizQuestion;
        selected: string | null;
        correct: boolean;
        timeSpent: number;
    }>>([]);
    const [streak, setStreak] = useState(0);
    const [bestStreak, setBestStreak] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const questionStartRef = useRef(Date.now());

    useEffect(() => {
        setQuestions(buildQuizQuestions(cards));
    }, [cards]);

    const startQuiz = () => {
        setPhase("active");
        setCurrentIndex(0);
        setResults([]);
        setStreak(0);
        setBestStreak(0);
        setTimeLeft(QUESTION_TIME);
        setSelectedOption(null);
        questionStartRef.current = Date.now();
    };

    const startTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(QUESTION_TIME);
        questionStartRef.current = Date.now();
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

    // Auto-submit on timeout
    useEffect(() => {
        if (timeLeft === 0 && phase === "active") {
            handleSelect(null);
        }
    }, [timeLeft, phase]);

    const handleSelect = (option: string | null) => {
        if (phase !== "active") return;
        if (timerRef.current) clearInterval(timerRef.current);

        const current = questions[currentIndex];
        const isCorrect = option !== null && option.toLowerCase() === current.correctPattern.toLowerCase();
        const timeSpent = Math.round((Date.now() - questionStartRef.current) / 1000);

        setSelectedOption(option);
        const newStreak = isCorrect ? streak + 1 : 0;
        setStreak(newStreak);
        if (newStreak > bestStreak) setBestStreak(newStreak);

        setResults(prev => [...prev, { question: current, selected: option, correct: isCorrect, timeSpent }]);
        setPhase("reveal");
    };

    const nextQuestion = () => {
        if (currentIndex + 1 >= questions.length) {
            setPhase("complete");
        } else {
            setCurrentIndex(currentIndex + 1);
            setSelectedOption(null);
            setPhase("active");
        }
    };

    const correctCount = results.filter(r => r.correct).length;
    const totalAnswered = results.length;
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    const avgTime = totalAnswered > 0 ? (results.reduce((sum, r) => sum + r.timeSpent, 0) / totalAnswered).toFixed(1) : "0";

    const timerColor = timeLeft <= 2 ? "text-red-500 border-red-500" : timeLeft <= 4 ? "text-amber-500 border-amber-500" : "text-emerald-500 border-emerald-500";
    const timerProgress = (timeLeft / QUESTION_TIME) * 100;

    if (questions.length === 0) {
        return (
            <div className="w-full max-w-2xl mx-auto p-8 flex flex-col items-center gap-4">
                <Crosshair className="w-10 h-10 text-violet-500" />
                <h2 className="text-xl font-bold text-foreground">No Pattern Quiz Available</h2>
                <p className="text-sm text-muted-foreground text-center">
                    Add more DSA cards with tags (e.g., &quot;Sliding Window&quot;, &quot;Two Pointers&quot;) to unlock pattern quizzes.
                </p>
                <Button onClick={onExit} variant="outline" className="rounded-full px-6 mt-4">Back</Button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto p-4 md:p-8 flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
                        <Crosshair className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Pattern ID Quiz</h2>
                        <p className="text-[10px] text-muted-foreground">{QUESTION_TIME}s to identify the pattern</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {phase !== "ready" && phase !== "complete" && (
                        <span className="text-xs text-muted-foreground font-medium">
                            {currentIndex + 1} / {questions.length}
                        </span>
                    )}
                    <Button variant="ghost" size="sm" onClick={onExit} className="text-muted-foreground">Exit</Button>
                </div>
            </div>

            {/* Ready Phase */}
            {phase === "ready" && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-6 py-8">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                        <Crosshair className="w-10 h-10 text-violet-500" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-2xl font-bold text-foreground mb-2">Rapid Pattern Identification</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            Read each problem description and quickly identify the underlying algorithm pattern.
                            You have {QUESTION_TIME} seconds per question.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 font-medium">{questions.length} questions</span>
                        <span>•</span>
                        <span>{QUESTION_TIME}s timer</span>
                        <span>•</span>
                        <span>No coding</span>
                    </div>
                    <Button onClick={startQuiz} className="rounded-full px-8 py-5 text-base font-bold bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white gap-2 shadow-lg">
                        <Zap className="w-5 h-5" />
                        Start Quiz
                    </Button>
                </motion.div>
            )}

            {/* Active Phase */}
            {phase === "active" && questions[currentIndex] && (
                <AnimatePresence mode="wait">
                    <motion.div key={currentIndex} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex flex-col gap-5">
                        {/* Timer Bar */}
                        <div className="relative">
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: "100%" }}
                                    animate={{ width: `${timerProgress}%` }}
                                    transition={{ duration: 0.5 }}
                                    className={`h-full rounded-full transition-colors ${timeLeft <= 2 ? "bg-red-500" : timeLeft <= 4 ? "bg-amber-500" : "bg-violet-500"}`}
                                />
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center gap-1.5">
                                    {streak > 0 && <span className="text-xs font-bold text-amber-500">🔥 {streak}</span>}
                                </div>
                                <span className={`text-sm font-mono font-bold ${timerColor.split(" ")[0]}`}>
                                    {timeLeft}s
                                </span>
                            </div>
                        </div>

                        {/* Problem Description */}
                        <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${questions[currentIndex].difficulty === "easy" ? "bg-easy/10 text-easy" : questions[currentIndex].difficulty === "medium" ? "bg-medium/10 text-medium" : "bg-hard/10 text-hard"}`}>
                                    {questions[currentIndex].difficulty}
                                </span>
                                <span className="text-xs text-muted-foreground">{questions[currentIndex].title}</span>
                            </div>
                            <p className="text-sm text-foreground/90 leading-relaxed">
                                {questions[currentIndex].description}
                            </p>
                        </div>

                        {/* Pattern Options */}
                        <div className="grid grid-cols-2 gap-3">
                            {questions[currentIndex].options.map((option) => (
                                <motion.button
                                    key={option}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleSelect(option)}
                                    className="p-4 rounded-xl border-2 border-border bg-card hover:border-violet-500 hover:bg-violet-500/5 transition-all text-sm font-semibold text-foreground cursor-pointer text-center"
                                >
                                    {option}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                </AnimatePresence>
            )}

            {/* Reveal Phase */}
            {phase === "reveal" && results.length > 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 py-4">
                    {results[results.length - 1].correct ? (
                        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                        </div>
                    ) : (
                        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
                            <XCircle className="w-7 h-7 text-red-500" />
                        </div>
                    )}
                    <p className={`text-lg font-bold ${results[results.length - 1].correct ? "text-emerald-500" : "text-red-500"}`}>
                        {results[results.length - 1].correct ? "Correct!" : results[results.length - 1].selected === null ? "Time's Up!" : "Wrong!"}
                    </p>
                    {results[results.length - 1].selected && !results[results.length - 1].correct && (
                        <p className="text-xs text-muted-foreground">
                            Your answer: <span className="font-semibold text-foreground">{results[results.length - 1].selected}</span>
                        </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                        Correct pattern: <span className="font-semibold text-emerald-500">{results[results.length - 1].question.correctPattern}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                        All tags: {results[results.length - 1].question.allTags.join(", ")}
                    </p>
                    <Button onClick={nextQuestion} className="rounded-full px-6 py-4 bg-violet-500 hover:bg-violet-600 text-white font-semibold gap-2 mt-1">
                        {currentIndex + 1 >= questions.length ? "See Results" : "Next"} <ArrowRight className="w-4 h-4" />
                    </Button>
                </motion.div>
            )}

            {/* Complete Phase */}
            {phase === "complete" && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-6 py-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                        <Trophy className="w-8 h-8 text-violet-500" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-2xl font-bold text-foreground">Quiz Complete!</h3>
                        <p className="text-sm text-muted-foreground mt-1">{correctCount} / {totalAnswered} correct</p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-center">
                            <p className={`text-2xl font-black ${accuracy >= 80 ? "text-emerald-500" : accuracy >= 50 ? "text-amber-500" : "text-red-500"}`}>{accuracy}%</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Accuracy</p>
                        </div>
                        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-center">
                            <p className="text-2xl font-black text-violet-500">{bestStreak}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Best Streak</p>
                        </div>
                        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-center">
                            <p className="text-2xl font-black text-foreground">{avgTime}s</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Time</p>
                        </div>
                    </div>

                    {/* Results List */}
                    <div className="w-full max-w-sm flex flex-col border border-border rounded-xl overflow-hidden bg-card">
                        {results.map((r, i) => (
                            <div key={i} className={`px-4 py-2.5 flex items-center justify-between text-sm ${i !== results.length - 1 ? "border-b border-border" : ""}`}>
                                <div className="flex items-center gap-2">
                                    {r.correct ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                                    <span className="text-xs text-foreground/80 truncate max-w-[120px]">{r.question.title}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-emerald-500">{r.question.correctPattern}</span>
                                    <span className="text-[10px] text-muted-foreground">{r.timeSpent}s</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <Button onClick={() => { setQuestions(buildQuizQuestions(cards)); setPhase("ready"); }} variant="outline" className="rounded-full px-5 gap-2">
                            <RotateCcw className="w-4 h-4" /> Try Again
                        </Button>
                        <Button onClick={onExit} className="rounded-full px-6 bg-violet-500 hover:bg-violet-600 text-white font-semibold">
                            Done
                        </Button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
