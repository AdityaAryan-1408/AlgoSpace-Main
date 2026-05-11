'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import type { Flashcard } from "@/data";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MarkdownContent } from "@/components/MarkdownContent";
import { CodePractice } from "@/components/CodePractice";
import { FeynmanRecorder } from "@/components/FeynmanRecorder";
import { ConstraintShifter, shouldShowConstraintShifter } from "@/components/ConstraintShifter";
import { DryRunChallenge } from "@/components/DryRunChallenge";
import { NotesDrawer } from "@/components/NotesDrawer";
import { VagueInterviewer } from "@/components/VagueInterviewer";
import { SpotTheBug } from "@/components/SpotTheBug";
import { SimilarQuestions } from "@/components/SimilarQuestions";
import { submitCardReview, pauseCardReview, updateCard } from "@/lib/client-api";
import { canPauseCard, isCardPaused } from "@/lib/card-utils";
import { Eye, Loader2, Code, ExternalLink, Brain, Pause, PenLine, Mic, Bug, Pencil, MessageSquare, Search, Maximize2, Minimize2, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";

export interface ReviewResult {
    card: Flashcard;
    rating: "AGAIN" | "HARD" | "GOOD" | "EASY";
    responseMs: number;
}

interface ReviewSessionProps {
    cards: Flashcard[];
    allCards?: Flashcard[];
    onComplete: (results: ReviewResult[], durationMs: number) => void;
    onCancel: () => void;
    mode?: "standard" | "random-quiz" | "sprint" | "reverse";
    timeLimitSeconds?: number;
}

const ratingConfig = {
    AGAIN: {
        label: "Again",
        color: "bg-red-500 hover:bg-red-600 text-white",
        desc: "Review tomorrow",
    },
    HARD: {
        label: "Hard",
        color: "bg-orange-500 hover:bg-orange-600 text-white",
        desc: "Short interval",
    },
    GOOD: {
        label: "Good",
        color: "bg-blue-500 hover:bg-blue-600 text-white",
        desc: "Normal interval",
    },
    EASY: {
        label: "Easy",
        color: "bg-emerald-500 hover:bg-emerald-600 text-white",
        desc: "Longer interval",
    },
} as const;

type Rating = keyof typeof ratingConfig;

function stripCodeFences(value: string) {
    return value.replace(/```\w*\n?|```/g, "");
}

function formatTimer(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getReversePrompt(card: Flashcard) {
    const source =
        card.solutions?.[0]?.content?.trim() ||
        card.solution?.trim() ||
        card.notes.trim() ||
        card.description.trim();

    if (!source) {
        return "No solution or notes available for reverse review.";
    }

    return stripCodeFences(source);
}

export function ReviewSession({
    cards,
    allCards,
    onComplete,
    onCancel,
    mode = "standard",
    timeLimitSeconds,
}: ReviewSessionProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showAnswer, setShowAnswer] = useState(false);
    const [showAiPractice, setShowAiPractice] = useState(false);
    const [showFeynman, setShowFeynman] = useState(false);
    const [showDryRun, setShowDryRun] = useState(false);
    const [showVagueInterviewer, setShowVagueInterviewer] = useState(false);
    const [showSpotTheBug, setShowSpotTheBug] = useState(false);
    const [showConstraintShifter, setShowConstraintShifter] = useState(true);
    const [showAnswerInput, setShowAnswerInput] = useState(false);
    const [userAnswer, setUserAnswer] = useState("");
    const [answerResult, setAnswerResult] = useState<"correct" | "incorrect" | null>(null);
    const [pendingRating, setPendingRating] = useState<Rating | null>(null);
    const [reviewNote, setReviewNote] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [results, setResults] = useState<ReviewResult[]>([]);
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
        mode === "sprint" ? Math.max(1, timeLimitSeconds ?? 300) : null,
    );
    const cardStartTime = useRef(Date.now());
    const sessionStartTime = useRef(Date.now());
    const resultsRef = useRef<ReviewResult[]>([]);
    const completedRef = useRef(false);
    const [notesDrawerOpen, setNotesDrawerOpen] = useState(false);

    useEffect(() => {
        if (cards[currentIndex]) {
            setReviewNote((cards[currentIndex].metadata?.reviewNote as string) || "");
        }
    }, [currentIndex, cards]);

    const [cheatWarning, setCheatWarning] = useState(false);

    const toggleFullscreen = async () => {
        if (!isFullscreen) {
            try {
                await document.documentElement.requestFullscreen();
                setIsFullscreen(true);
            } catch (err) {
                console.error("Failed to enter fullscreen", err);
            }
        } else {
            if (confirm("Are you sure you want to exit Focus Mode?")) {
                if (document.fullscreenElement) {
                    await document.exitFullscreen();
                }
                setIsFullscreen(false);
            }
        }
    };

    useEffect(() => {
        if (isFullscreen) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const fixedContainer = document.querySelector('.fixed.inset-0.overflow-y-auto');
            if (fixedContainer) fixedContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement && isFullscreen) {
                setIsFullscreen(false);
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden && document.fullscreenElement) {
                alert("Warning: You switched tabs or minimized the browser during Focus Mode! Stay focused on your review.");
                setCheatWarning(true);
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isFullscreen]);

    // Keyboard shortcut: N to toggle notes drawer
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
            if (e.key === 'n' && !isTyping && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                setNotesDrawerOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

    const currentCard = cards[currentIndex];
    const progress = (currentIndex / cards.length) * 100;
    const isReverse = mode === "reverse";
    const isRandomQuiz = mode === "random-quiz";
    const isSprint = mode === "sprint";
    const hidePromptMeta = isReverse && !showAnswer;
    const solutionBlocks =
        currentCard?.solutions && currentCard.solutions.length > 0
            ? currentCard.solutions
            : currentCard?.solution
                ? [{ name: "Solution", content: currentCard.solution }]
                : [];

    const finishSession = useCallback(
        (finalResults: ReviewResult[]) => {
            if (completedRef.current) return;
            completedRef.current = true;
            
            // Gamification: Confetti explosion!
            if (finalResults.length > 0) {
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 },
                    colors: ['#00b8a3', '#ffc01e', '#ff375f', '#3b82f6']
                });
            }

            const durationMs = Date.now() - sessionStartTime.current;
            onComplete(finalResults, durationMs);
        },
        [onComplete],
    );

    useEffect(() => {
        if (!isSprint) {
            setRemainingSeconds(null);
            return;
        }

        const initial = Math.max(1, timeLimitSeconds ?? 300);
        setRemainingSeconds(initial);

        const interval = setInterval(() => {
            setRemainingSeconds((current) => {
                if (current == null) return current;
                if (current <= 1) {
                    clearInterval(interval);
                    finishSession(resultsRef.current);
                    return 0;
                }
                return current - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isSprint, timeLimitSeconds, finishSession]);

    const advance = (
        newResults: ReviewResult[],
        nextIndex: number,
    ) => {
        if (completedRef.current) return;

        if (nextIndex < cards.length) {
            setCurrentIndex(nextIndex);
            setShowAnswer(false);
            setShowAiPractice(false);
            setShowFeynman(false);
            setShowDryRun(false);
            setShowVagueInterviewer(false);
            setShowSpotTheBug(false);
            setShowConstraintShifter(true);
            setShowAnswerInput(false);
            setUserAnswer("");
            setAnswerResult(null);
            setPendingRating(null);
            cardStartTime.current = Date.now();
        } else {
            finishSession(newResults);
        }
    };

    const handleRate = (rating: Rating) => {
        setPendingRating(rating);
        setShowAiPractice(false);
        setShowFeynman(false);
        setShowDryRun(false);
        setShowVagueInterviewer(false);
        setShowSpotTheBug(false);
        setShowAnswer(true);
    };

    const submitFinalReview = async (manualDays?: number) => {
        if (!pendingRating || isSubmitting || completedRef.current) return;

        const responseMs = Date.now() - cardStartTime.current;
        setIsSubmitting(true);

        const result: ReviewResult = { card: currentCard, rating: pendingRating, responseMs };
        const newResults = [...results, result];
        setResults(newResults);
        resultsRef.current = newResults;

        try {
            await submitCardReview(currentCard.id, pendingRating, responseMs, manualDays);
            if (reviewNote !== (currentCard.metadata?.reviewNote || "")) {
                await updateCard(currentCard.id, {
                    metadata: { ...currentCard.metadata, reviewNote }
                });
            }
        } catch (err) {
            console.error("Failed to submit review:", err);
        } finally {
            setIsSubmitting(false);
            advance(newResults, currentIndex + 1);
        }
    };

    const handlePauseReview = async () => {
        if (!pendingRating || isSubmitting || completedRef.current) return;

        const responseMs = Date.now() - cardStartTime.current;
        setIsSubmitting(true);

        const result: ReviewResult = { card: currentCard, rating: pendingRating, responseMs };
        const newResults = [...results, result];
        setResults(newResults);
        resultsRef.current = newResults;

        try {
            // Submit the review first so it counts
            await submitCardReview(currentCard.id, pendingRating, responseMs);
            // Then pause the card
            await pauseCardReview(currentCard.id);
        } catch (err) {
            console.error("Failed to pause review:", err);
        } finally {
            setIsSubmitting(false);
            advance(newResults, currentIndex + 1);
        }
    };

    if (!currentCard) return null;

    return (
        <div className={`transition-all duration-300 ease-in-out w-full mx-auto p-4 md:p-8 flex flex-col gap-6 ${isFullscreen ? "fixed inset-0 z-50 bg-background/90 backdrop-blur-xl max-w-none overflow-y-auto" : "max-w-3xl"}`}>
          <div className={`w-full mx-auto flex flex-col gap-6 ${isFullscreen ? "max-w-4xl my-auto" : ""}`}>
            {/* Progress bar */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-blue-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                </div>
                <span className="text-sm font-medium text-muted-foreground shrink-0">
                    {currentIndex + 1} / {cards.length}
                </span>
                {remainingSeconds != null && (
                    <span
                        className={`text-xs font-semibold shrink-0 ${remainingSeconds <= 60 ? "text-hard" : "text-muted-foreground"}`}
                    >
                        {formatTimer(remainingSeconds)}
                    </span>
                )}
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleFullscreen}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted"
                        title={isFullscreen ? "Exit Focus Mode" : "Enter Focus Mode"}
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => advance(resultsRef.current, currentIndex + 1)}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Skip this question for now"
                    >
                        Skip
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCancel}
                        className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                    >
                        End early
                    </Button>
                </div>
            </div>

            {/* Card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentCard.id}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.25 }}
                    className={`border border-border rounded-2xl shadow-sm overflow-hidden ${isFullscreen ? "bg-card/60 backdrop-blur-2xl shadow-2xl border-white/5" : "bg-card"}`}
                >
                    {/* Card Header */}
                    <div className="p-6 border-b border-border">
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                    variant={currentCard.difficulty}
                                    className="capitalize bg-transparent border-current text-current"
                                >
                                    {currentCard.difficulty}
                                </Badge>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                                    {currentCard.type === "leetcode" ? "DSA" : "CS Core"}
                                </span>
                                {currentCard.timeComplexity && (
                                    <Badge
                                        variant="tag"
                                        className="bg-transparent border-tag/30 text-tag font-normal text-[10px] px-2 py-0"
                                    >
                                        Time: {currentCard.timeComplexity}
                                    </Badge>
                                )}
                                {currentCard.spaceComplexity && (
                                    <Badge
                                        variant="tag"
                                        className="bg-transparent border-tag/30 text-tag font-normal text-[10px] px-2 py-0"
                                    >
                                        Space: {currentCard.spaceComplexity}
                                    </Badge>
                                )}
                            </div>
                            {!hidePromptMeta && currentCard.url && (
                                <a
                                    href={currentCard.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors"
                                >
                                    Open <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                        <h2 className="text-xl font-bold text-foreground">
                            {hidePromptMeta ? "Guess the problem" : currentCard.title}
                        </h2>
                        {!hidePromptMeta && (
                            <div className="flex items-center gap-2 flex-wrap mt-2">
                                {currentCard.tags.map((tag) => (
                                    <Badge
                                        key={tag}
                                        variant="tag"
                                        className="bg-transparent border-tag/30 text-tag font-normal text-[10px] px-2 py-0"
                                    >
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        )}
                        {(isRandomQuiz || isReverse || isSprint) && (
                            <div className="flex items-center gap-2 mt-3">
                                {isRandomQuiz && (
                                    <Badge className="text-[10px] uppercase tracking-wide">
                                        Random Quiz
                                    </Badge>
                                )}
                                {isReverse && (
                                    <Badge className="text-[10px] uppercase tracking-wide">
                                        Reverse Review
                                    </Badge>
                                )}
                                {isSprint && (
                                    <Badge className="text-[10px] uppercase tracking-wide">
                                        Sprint Mode
                                    </Badge>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Card Body */}
                    <div className="p-6">
                        {showAiPractice ? (
                            <CodePractice
                                card={currentCard}
                                onRate={handleRate}
                                onCancel={() => setShowAiPractice(false)}
                            />
                        ) : showFeynman ? (
                            <FeynmanRecorder
                                card={currentCard}
                                onRate={handleRate}
                                onCancel={() => setShowFeynman(false)}
                            />
                        ) : showDryRun ? (
                            <DryRunChallenge
                                card={currentCard}
                                onRate={handleRate}
                                onCancel={() => setShowDryRun(false)}
                            />
                        ) : showVagueInterviewer ? (
                            <VagueInterviewer
                                card={currentCard}
                                onRate={handleRate}
                                onCancel={() => setShowVagueInterviewer(false)}
                            />
                        ) : showSpotTheBug ? (
                            <SpotTheBug
                                card={currentCard}
                                onRate={handleRate}
                                onCancel={() => setShowSpotTheBug(false)}
                            />
                        ) : !showAnswer ? (
                            <div className="flex flex-col gap-4">
                                {/* Constraint Shifter - shown for mastered cards */}
                                {showConstraintShifter && shouldShowConstraintShifter(currentCard) && (
                                    <ConstraintShifter
                                        card={currentCard}
                                        onDismiss={() => setShowConstraintShifter(false)}
                                    />
                                )}

                                {isReverse ? (
                                    <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                            Solution
                                        </h4>
                                        <pre className="text-sm font-mono text-foreground/90 leading-relaxed whitespace-pre-wrap overflow-x-auto selectable">
                                            {getReversePrompt(currentCard)}
                                        </pre>
                                    </div>
                                ) : isRandomQuiz ? (
                                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                        <p className="text-base font-semibold text-foreground">
                                            What&apos;s the approach?
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Think through the pattern before revealing your answer.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap selectable">
                                        <MarkdownContent content={currentCard.description} />
                                    </div>
                                )}

                                <div className="mt-2 flex flex-col items-center gap-3">
                                    <div className="flex justify-center gap-3 flex-wrap">
                                        {!showAnswerInput && (
                                            <Button
                                                onClick={() => setShowAnswer(true)}
                                                className="gap-2 font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 py-5 text-base"
                                            >
                                                <Eye className="w-5 h-5" />
                                                {isReverse ? "Reveal Problem" : "Reveal Answer"}
                                            </Button>
                                        )}
                                        {isReverse ? (
                                            showAnswerInput ? (
                                                <form 
                                                    className="flex flex-col gap-2 items-center" 
                                                    onSubmit={(e) => {
                                                        e.preventDefault();
                                                        if (userAnswer.toLowerCase().trim() === currentCard.title.toLowerCase().trim()) {
                                                            setAnswerResult("correct");
                                                            setShowAnswer(true);
                                                        } else {
                                                            setAnswerResult("incorrect");
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            value={userAnswer}
                                                            onChange={e => { setUserAnswer(e.target.value); setAnswerResult(null); }}
                                                            placeholder="Question name..." 
                                                            className="border border-border bg-card rounded-full px-4 py-2.5 outline-none focus:border-blue-500 transition-colors w-64 shadow-sm"
                                                            autoFocus
                                                        />
                                                        <Button type="submit" variant="default" className="rounded-full px-6 py-5">Check</Button>
                                                        <Button type="button" variant="ghost" onClick={() => { setShowAnswerInput(false); setAnswerResult(null); }} className="rounded-full px-4 py-5 font-semibold">Cancel</Button>
                                                    </div>
                                                    {answerResult === "incorrect" && (
                                                        <span className="text-red-500 text-sm font-medium animate-in fade-in slide-in-from-top-1">
                                                            Incorrect, try again!
                                                        </span>
                                                    )}
                                                </form>
                                            ) : (
                                                <Button
                                                    onClick={() => { setShowAnswerInput(true); setUserAnswer(""); setAnswerResult(null); }}
                                                    variant="ghost"
                                                    className="gap-2 font-semibold text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 rounded-full px-6 py-5 text-base border border-blue-500/30"
                                                >
                                                    <PenLine className="w-5 h-5" />
                                                    Enter your answer
                                                </Button>
                                            )
                                        ) : (
                                            <Button
                                                onClick={() => setShowAiPractice(true)}
                                                variant="ghost"
                                                className="gap-2 font-semibold text-purple-500 hover:text-purple-600 hover:bg-purple-500/10 rounded-full px-6 py-5 text-base border border-purple-500/30"
                                            >
                                                <Brain className="w-5 h-5" />
                                                Practice with AI
                                            </Button>
                                        )}
                                    </div>

                                    {/* Feature buttons row */}
                                    {!isReverse && !showAnswerInput && (
                                        <div className="flex items-center gap-2 flex-wrap justify-center">
                                            <Button
                                                onClick={() => setShowFeynman(true)}
                                                variant="ghost"
                                                className="gap-1.5 text-sm font-medium text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 rounded-full px-4 py-3 border border-orange-500/20"
                                            >
                                                <Mic className="w-4 h-4" />
                                                Feynman Mode
                                            </Button>
                                            {currentCard.type === "leetcode" && (
                                                <Button
                                                    onClick={() => setShowDryRun(true)}
                                                    variant="ghost"
                                                    className="gap-1.5 text-sm font-medium text-cyan-500 hover:text-cyan-600 hover:bg-cyan-500/10 rounded-full px-4 py-3 border border-cyan-500/20"
                                                >
                                                    <Bug className="w-4 h-4" />
                                                    Dry-Run
                                                </Button>
                                            )}
                                            <Button
                                                onClick={() => setShowVagueInterviewer(true)}
                                                variant="ghost"
                                                className="gap-1.5 text-sm font-medium text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/10 rounded-full px-4 py-3 border border-indigo-500/20"
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                                Vague Interviewer
                                            </Button>
                                            {currentCard.type === "leetcode" && (currentCard.solution || (currentCard.solutions && currentCard.solutions.length > 0)) && (
                                                <Button
                                                    onClick={() => setShowSpotTheBug(true)}
                                                    variant="ghost"
                                                    className="gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-full px-4 py-3 border border-red-500/20"
                                                >
                                                    <Search className="w-4 h-4" />
                                                    Spot the Bug
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className="mt-6 flex flex-col gap-4"
                            >
                                {isReverse && (
                                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                            Problem
                                        </h4>
                                        <p className="text-sm font-semibold text-foreground mb-2">
                                            {currentCard.title}
                                        </p>
                                        <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap selectable">
                                            <MarkdownContent content={currentCard.description} />
                                        </div>
                                    </div>
                                )}

                                {isRandomQuiz && (
                                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                            Problem Statement
                                        </h4>
                                        <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap selectable">
                                            <MarkdownContent content={currentCard.description} />
                                        </div>
                                    </div>
                                )}

                                {currentCard.notes && (
                                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                            Notes
                                        </h4>
                                        <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap selectable">
                                            <MarkdownContent content={currentCard.notes} />
                                        </div>
                                    </div>
                                )}

                                {(currentCard.metadata?.reviewNote as string) && (
                                    <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                                        <h4 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <PenLine className="w-3.5 h-3.5" /> Previous Review Note
                                        </h4>
                                        <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap selectable">
                                            {currentCard.metadata?.reviewNote as string}
                                        </div>
                                    </div>
                                )}

                                {solutionBlocks.length > 0 &&
                                    solutionBlocks.map((solution, index) => {
                                        const hasCodeFences = /```[\w+-]*\n/.test(solution.content);
                                        return (
                                            <div
                                                key={`${solution.name}-${index}`}
                                                className="p-4 rounded-xl bg-muted/50 border border-border/50"
                                            >
                                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                    <Code className="w-3.5 h-3.5" /> {solution.name}
                                                </h4>
                                                {hasCodeFences ? (
                                                    <MarkdownContent content={solution.content} />
                                                ) : (
                                                    <pre className="text-sm font-mono text-foreground/90 leading-relaxed whitespace-pre-wrap overflow-x-auto selectable">
                                                        {solution.content}
                                                    </pre>
                                                )}
                                            </div>
                                        );
                                    })}

                                {/* Rating Buttons */}
                                <div className="mt-2">
                                    {!pendingRating ? (
                                        <>
                                            <p className="text-xs text-muted-foreground text-center mb-3">
                                                How did it go?
                                            </p>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                {(
                                                    Object.entries(ratingConfig) as [
                                                        Rating,
                                                        (typeof ratingConfig)[Rating],
                                                    ][]
                                                ).map(([key, config]) => (
                                                    <motion.button
                                                        key={key}
                                                        whileHover={{ scale: 1.03 }}
                                                        whileTap={{ scale: 0.97 }}
                                                        onClick={() => handleRate(key)}
                                                        disabled={isSubmitting}
                                                        className={`flex flex-col items-center gap-1 py-3 px-4 rounded-xl font-semibold transition-all cursor-pointer disabled:opacity-50 ${config.color}`}
                                                    >
                                                        <span className="text-sm">{config.label}</span>
                                                        <span className="text-[10px] opacity-80">
                                                            {config.desc}
                                                        </span>
                                                    </motion.button>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-4 bg-muted/20 p-4 rounded-xl border border-border mt-4">
                                            {/* Similar Questions (after successful review) */}
                                            {currentCard.type === "leetcode" && (pendingRating === "GOOD" || pendingRating === "EASY") && allCards && (
                                                <div className="w-full">
                                                    <SimilarQuestions
                                                        card={currentCard}
                                                        allCards={allCards}
                                                        onAddToQueue={(cardId) => {
                                                            // The queue management is handled by parent page
                                                            console.log("Queue card:", cardId);
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            <p className="text-sm font-semibold text-foreground text-center mb-1">
                                                When do you want to review this next?
                                            </p>
                                            <div className="w-full max-w-sm">
                                                <textarea 
                                                    value={reviewNote}
                                                    onChange={(e) => setReviewNote(e.target.value)}
                                                    placeholder="Add a quick note for your next review (optional)..."
                                                    className="w-full text-sm p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none h-16 text-foreground"
                                                />
                                            </div>
                                            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                                                <Button size="sm" variant="default" onClick={() => submitFinalReview()} disabled={isSubmitting}>
                                                    Auto (Depends on rating)
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => submitFinalReview(1)} disabled={isSubmitting}>
                                                    Tomorrow
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => submitFinalReview(3)} disabled={isSubmitting}>
                                                    3 Days
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => submitFinalReview(7)} disabled={isSubmitting}>
                                                    7 Days
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => submitFinalReview(14)} disabled={isSubmitting}>
                                                    14 Days
                                                </Button>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => setPendingRating(null)} disabled={isSubmitting} className="text-muted-foreground mt-2">
                                                Wait, let me change rating
                                            </Button>
                                            {canPauseCard(currentCard) && !isCardPaused(currentCard) && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handlePauseReview}
                                                    disabled={isSubmitting}
                                                    className="text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 gap-1.5 mt-1"
                                                >
                                                    <Pause className="w-3.5 h-3.5" />
                                                    Pause reviews for this card
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>

            {isSubmitting && (
                <div className="flex justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
            )}
          </div>

        {/* Notes FAB */}
        {currentCard && (
          <>
            <button
              onClick={() => setNotesDrawerOpen(!notesDrawerOpen)}
              className={`fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer ${
                notesDrawerOpen
                  ? 'bg-primary text-primary-foreground'
                  : currentCard.richNotes || currentCard.notes.trim()
                    ? 'bg-primary/90 text-primary-foreground animate-pulse-slow'
                    : 'bg-muted/80 text-muted-foreground hover:bg-muted border border-border'
              }`}
              title="Toggle Notes (N)"
            >
              <FileText className="w-5 h-5" />
            </button>

            <NotesDrawer
              isOpen={notesDrawerOpen}
              onClose={() => setNotesDrawerOpen(false)}
              cardId={currentCard.id}
              cardTitle={currentCard.title}
              richNotes={currentCard.richNotes}
              fallbackMarkdown={currentCard.notes}
            />
          </>
        )}
      </div>
    );
}
