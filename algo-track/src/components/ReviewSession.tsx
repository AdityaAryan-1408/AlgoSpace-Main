'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { Flashcard } from "@/data";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MarkdownContent, CodeBlock } from "@/components/MarkdownContent";
import { CodePractice } from "@/components/CodePractice";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { RichNotesEditor } from "@/components/RichNotesEditor";
import { FeynmanRecorder } from "@/components/FeynmanRecorder";
import { ConstraintShifter, shouldShowConstraintShifter } from "@/components/ConstraintShifter";
import { DryRunChallenge } from "@/components/DryRunChallenge";
import { NotesPanel } from "@/components/NotesDrawer";
import { VagueInterviewer } from "@/components/VagueInterviewer";
import { SpotTheBug } from "@/components/SpotTheBug";
import { SimilarQuestions } from "@/components/SimilarQuestions";
import { submitCardReview, pauseCardReview, updateCard } from "@/lib/client-api";
import { canPauseCard, isCardPaused } from "@/lib/card-utils";
import { Eye, Loader2, Code, ExternalLink, Brain, Pause, PenLine, Mic, Bug, Pencil, MessageSquare, Search, Maximize2, Minimize2, Palette, CalendarDays } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { useConfirmModal } from "@/components/ConfirmModal";

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
    const [dismissedDryRunPrompt, setDismissedDryRunPrompt] = useState(false);
    const [reviewNote, setReviewNote] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [results, setResults] = useState<ReviewResult[]>([]);
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
        mode === "sprint" ? Math.max(1, timeLimitSeconds ?? 300) : null,
    );
    const [showCustomDate, setShowCustomDate] = useState(false);
    const cardStartTime = useRef(Date.now());
    const sessionStartTime = useRef(Date.now());
    const resultsRef = useRef<ReviewResult[]>([]);
    const completedRef = useRef(false);
    const [notesDrawerOpen, setNotesDrawerOpen] = useState(false);

    // Tomorrow's date string for the custom date picker min value
    const tomorrowStr = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split("T")[0];
    }, []);

    useEffect(() => {
        if (cards[currentIndex]) {
            setReviewNote((cards[currentIndex].metadata?.reviewNote as string) || "");
        }
    }, [currentIndex, cards]);

    const [cheatWarning, setCheatWarning] = useState(false);

    const { confirm: confirmModal, alert: alertModal } = useConfirmModal();

    const toggleFullscreen = async () => {
        if (!isFullscreen) {
            try {
                await document.documentElement.requestFullscreen();
                setIsFullscreen(true);
            } catch (err) {
                console.error("Failed to enter fullscreen", err);
            }
        } else {
            const confirmed = await confirmModal({
                title: "Exit Focus Mode",
                message: "Are you sure you want to exit Focus Mode?",
                confirmLabel: "Exit",
                variant: "warning",
            });
            if (confirmed) {
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
                alertModal({
                    title: "Focus Mode Warning",
                    message: "You switched tabs or minimized the browser during Focus Mode! Stay focused on your review.",
                    variant: "warning",
                });
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
            setDismissedDryRunPrompt(false);
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
        <div className={`transition-all duration-300 ease-in-out w-full mx-auto p-4 md:p-8 pb-32 flex flex-col gap-6 ${isFullscreen ? "fixed inset-0 z-50 bg-background/90 backdrop-blur-xl max-w-none overflow-y-auto pb-40" : "max-w-3xl pb-32"}`}>
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
                    animate={{ 
                        opacity: 1, 
                        x: 0,
                        rotateY: showAnswer ? [0, 12, -8, 0] : 0,
                        scale: showAnswer ? [1, 0.98, 1.01, 1] : 1,
                    }}
                    style={{ perspective: 1000 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ 
                        x: { duration: 0.25 },
                        opacity: { duration: 0.25 },
                        rotateY: { duration: 0.5, ease: "easeInOut" },
                        scale: { duration: 0.4, ease: "easeInOut" }
                    }}
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
                                    {currentCard.type === "leetcode" ? "DSA" : currentCard.type === "sql" ? "SQL" : "CS Core"}
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

                                {/* Dry Run Auto-Prompt */}
                                {!dismissedDryRunPrompt && currentCard.type === "leetcode" && currentCard.history.total >= 3 && (
                                    <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
                                                <Bug className="w-4 h-4 text-cyan-500" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-foreground">Test your actual understanding</h4>
                                                <p className="text-xs text-muted-foreground mt-0.5">You've reviewed this card a few times. Try the Interactive Dry-Run Tracer instead of just revealing the answer.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                            <Button size="sm" onClick={() => setShowDryRun(true)} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full">Start Dry-Run</Button>
                                            <Button size="sm" variant="ghost" onClick={() => setDismissedDryRunPrompt(true)} className="text-muted-foreground hover:text-foreground rounded-full">Not now</Button>
                                        </div>
                                    </div>
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
                                    <div className="bg-muted/10 p-2 rounded-xl border border-border/50 selectable">
                                        <RichNotesEditor
                                            readOnly
                                            initialContent={currentCard.description}
                                            fallbackMarkdown={currentCard.description}
                                        />
                                    </div>
                                )}

                                {(currentCard.metadata?.reviewNote as string) && (
                                    <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 shadow-[0_2px_10px_rgba(59,130,246,0.05)] mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <h4 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <PenLine className="w-3.5 h-3.5 text-blue-500 animate-pulse" /> Previous Review Note
                                        </h4>
                                        <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap selectable pl-1 border-l-2 border-blue-500/30">
                                            {currentCard.metadata?.reviewNote as string}
                                        </div>
                                    </div>
                                )}
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

                                {currentCard.richNotes ? (
                                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                            Notes & Answer
                                        </h4>
                                        <div className="bg-muted/10 p-2 rounded-xl border border-border/50 selectable">
                                            <RichNotesEditor
                                                readOnly
                                                initialContent={currentCard.richNotes}
                                                fallbackMarkdown={currentCard.notes}
                                            />
                                        </div>
                                    </div>
                                ) : currentCard.notes ? (
                                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                            Notes
                                        </h4>
                                        <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap selectable">
                                            <MarkdownContent content={currentCard.notes} />
                                        </div>
                                    </div>
                                ) : null}

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
                                                    <CodeBlock
                                                        language={solution.name.toLowerCase()}
                                                        content={solution.content}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}

                                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 shadow-[0_2px_10px_rgba(59,130,246,0.05)] flex flex-col gap-2 mt-4">
                                    <h4 className="text-xs font-semibold text-blue-500 uppercase tracking-wider flex items-center gap-1.5 text-blue-500">
                                        <PenLine className="w-3.5 h-3.5 text-blue-500" /> Review Note
                                    </h4>
                                    <textarea
                                        value={reviewNote}
                                        onChange={(e) => setReviewNote(e.target.value)}
                                        placeholder="Add a quick note or key takeaway for your next review (optional)..."
                                        className="w-full text-sm p-3 rounded-xl border border-blue-500/10 dark:border-blue-500/10 bg-background/50 focus:bg-background focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none h-20 text-foreground transition-all duration-200"
                                    />
                                </div>

                                {/* Similar Questions (shown static in body when card rated, keeping user context) */}
                                {pendingRating && (currentCard.type === "leetcode" || currentCard.type === "sql") && (pendingRating === "GOOD" || pendingRating === "EASY") && allCards && (
                                    <div className="mt-4 p-4 border border-border rounded-xl bg-muted/10">
                                        <SimilarQuestions
                                            card={currentCard}
                                            allCards={allCards}
                                            onAddToQueue={(cardId) => {
                                                console.log("Queue card:", cardId);
                                            }}
                                        />
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>
          </div>

          {/* Floating Glassmorphic Feedback Dock */}
          <AnimatePresence>
            {(!showAiPractice && !showFeynman && !showDryRun && !showVagueInterviewer && !showSpotTheBug) && (
              <motion.div
                initial={{ opacity: 0, y: 80, x: "-50%" }}
                animate={{ opacity: 1, y: 0, x: "-50%" }}
                exit={{ opacity: 0, y: 80, x: "-50%" }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-xl bg-card/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 shadow-[0_15px_35px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-4 z-40 transition-all relative overflow-hidden"
              >
                {!showAnswer ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {isReverse ? "Reverse Mode" : "Card Active"}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-center sm:justify-end">
                      {isReverse ? (
                        showAnswerInput ? (
                          <form 
                            className="flex items-center gap-1.5 w-full sm:w-auto" 
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
                            <input 
                              value={userAnswer}
                              onChange={e => { setUserAnswer(e.target.value); setAnswerResult(null); }}
                              placeholder="Question title..." 
                              className="border border-border bg-background rounded-full px-3 py-1.5 text-xs outline-none focus:border-blue-500 transition-colors w-32 shadow-sm"
                              autoFocus
                            />
                            <Button type="submit" size="sm" className="rounded-full px-3">Check</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowAnswerInput(false); setAnswerResult(null); }} className="rounded-full px-2">Cancel</Button>
                          </form>
                        ) : (
                          <>
                            <Button
                              onClick={() => setShowAnswer(true)}
                              size="sm"
                              className="gap-1.5 font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-full px-4 py-2 text-xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Reveal Problem
                            </Button>
                            <Button
                              onClick={() => { setShowAnswerInput(true); setUserAnswer(""); setAnswerResult(null); }}
                              variant="outline"
                              size="sm"
                              className="gap-1.5 font-semibold text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 rounded-full px-4 py-2 text-xs border border-blue-500/30"
                            >
                              <PenLine className="w-3.5 h-3.5" />
                              Enter Answer
                            </Button>
                          </>
                        )
                      ) : (
                        <>
                          <Button
                            onClick={() => setShowAnswer(true)}
                            size="sm"
                            className="gap-1.5 font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-full px-4 py-2 text-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Reveal Answer
                          </Button>
                          <Button
                            onClick={() => setShowAiPractice(true)}
                            variant="outline"
                            size="sm"
                            className="gap-1.5 font-semibold text-purple-500 hover:text-purple-600 hover:bg-purple-500/10 rounded-full px-4 py-2 text-xs border border-purple-500/30"
                          >
                            <Brain className="w-3.5 h-3.5" />
                            AI Practice
                          </Button>
                        </>
                      )}
                      
                      {!isReverse && !showAnswerInput && (
                        <div className="flex items-center gap-0.5 border-l border-border/60 pl-1.5 ml-1">
                          <Button
                            onClick={() => setShowFeynman(true)}
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 rounded-full text-orange-500 hover:bg-orange-500/15"
                            title="Feynman Mode"
                          >
                            <Mic className="w-3.5 h-3.5" />
                          </Button>
                          {(currentCard.type === "leetcode" || currentCard.type === "sql") && (
                            <Button
                              onClick={() => setShowDryRun(true)}
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 rounded-full text-cyan-500 hover:bg-cyan-500/15"
                              title="Dry-Run tracer"
                            >
                              <Bug className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            onClick={() => setShowVagueInterviewer(true)}
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 rounded-full text-indigo-500 hover:bg-indigo-500/15"
                            title="Vague Interviewer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </Button>
                          {(currentCard.type === "leetcode" || currentCard.type === "sql") && (currentCard.solution || (currentCard.solutions && currentCard.solutions.length > 0)) && (
                            <Button
                              onClick={() => setShowSpotTheBug(true)}
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 rounded-full text-red-500 hover:bg-red-500/15"
                              title="Spot the Bug"
                            >
                              <Search className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : !pendingRating ? (
                  <div className="flex flex-col gap-2 w-full animate-in fade-in zoom-in-95 duration-200">
                    <p className="text-[11px] text-muted-foreground text-center font-medium uppercase tracking-wider">
                      Rate your understanding
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {(
                        Object.entries(ratingConfig) as [
                          Rating,
                          (typeof ratingConfig)[Rating],
                        ][]
                      ).map(([key, config]) => (
                        <motion.button
                          key={key}
                          whileHover={{ scale: 1.04, y: -1 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleRate(key)}
                          disabled={isSubmitting}
                          className={`flex flex-col items-center gap-0.5 py-1.5 px-2.5 rounded-xl font-semibold transition-all cursor-pointer disabled:opacity-50 ${config.color} border border-black/10 dark:border-white/5 shadow-sm`}
                        >
                          <span className="text-xs">{config.label}</span>
                          <span className="text-[8px] opacity-80 hidden sm:inline-block font-normal">
                            {config.desc}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2.5 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center">
                      Choose Interval
                    </p>
                    
                    <div className="flex flex-wrap items-center justify-center gap-1.5 w-full">
                      <Button size="sm" variant="default" onClick={() => submitFinalReview()} disabled={isSubmitting} className="rounded-full text-[10px] px-2.5 py-0.5 h-7">
                        Auto
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => submitFinalReview(1)} disabled={isSubmitting} className="rounded-full text-[10px] px-2.5 py-0.5 h-7">
                        Tomorrow
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => submitFinalReview(3)} disabled={isSubmitting} className="rounded-full text-[10px] px-2.5 py-0.5 h-7">
                        3 Days
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => submitFinalReview(7)} disabled={isSubmitting} className="rounded-full text-[10px] px-2.5 py-0.5 h-7">
                        7 Days
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => submitFinalReview(14)} disabled={isSubmitting} className="rounded-full text-[10px] px-2.5 py-0.5 h-7">
                        14 Days
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCustomDate(!showCustomDate)}
                        disabled={isSubmitting}
                        className={`rounded-full text-[10px] px-2.5 py-0.5 h-7 gap-1 ${showCustomDate ? "border-cyan-500 text-cyan-500" : ""}`}
                      >
                        <CalendarDays className="w-3 h-3" />
                        Custom
                      </Button>
                      {canPauseCard(currentCard) && !isCardPaused(currentCard) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handlePauseReview}
                          disabled={isSubmitting}
                          className="text-[10px] text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 gap-1 rounded-full px-2.5 py-0.5 h-7"
                        >
                          <Pause className="w-3 h-3" />
                          Pause
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setPendingRating(null)} disabled={isSubmitting} className="text-muted-foreground text-[10px] rounded-full px-2.5 py-0.5 h-7">
                        Back
                      </Button>
                    </div>

                    {showCustomDate && (
                      <div className="flex items-center justify-center gap-2 mt-1 animate-in fade-in slide-in-from-top-1">
                        <input
                          type="date"
                          min={tomorrowStr}
                          className="px-2 py-1 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const picked = new Date(e.target.value + "T00:00:00");
                            const now = new Date();
                            now.setHours(0, 0, 0, 0);
                            const diffDays = Math.max(1, Math.round((picked.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                            setShowCustomDate(false);
                            submitFinalReview(diffDays);
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {isSubmitting && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-md flex flex-col items-center justify-center gap-2 z-50 animate-in fade-in duration-200">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Saving Review...</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        {/* Notes Side Panel */}
        {currentCard && (
          <NotesPanel
            isOpen={notesDrawerOpen}
            onToggle={() => setNotesDrawerOpen(prev => !prev)}
            cardId={currentCard.id}
            cardTitle={currentCard.title}
            richNotes={currentCard.richNotes}
            fallbackMarkdown={currentCard.notes}
            hasNotes={!!(currentCard.richNotes || currentCard.notes.trim())}
          />
        )}
      </div>
    );
}
