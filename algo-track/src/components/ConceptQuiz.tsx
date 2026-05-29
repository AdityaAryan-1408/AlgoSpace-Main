'use client';

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { 
    CheckCircle2, 
    XCircle, 
    ArrowRight, 
    ArrowLeft,
    RotateCcw, 
    HelpCircle, 
    Award, 
    Sparkles, 
    BookOpen, 
    Brain, 
    X,
    CheckSquare,
    Type,
    Layers,
    ListChecks,
    Check,
    Loader2,
    Plus,
    ClipboardCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { createCard } from "@/lib/client-api";

export interface QuizQuestion {
    id: string;
    questionText: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
    subtopic: string;
}

interface ConceptQuizProps {
    questions: QuizQuestion[];
    suggestedSubtopics: string[];
    onComplete: (score: number) => void;
    onCancel: () => void;
    title: string;
    keywords?: string[];
    clozeSentences?: string[];
    conceptMatches?: Array<{ term: string; definition: string }>;
}

export function ConceptQuiz({ 
    questions = [], 
    suggestedSubtopics = [], 
    onComplete, 
    onCancel,
    title,
    keywords = [],
    clozeSentences = [],
    conceptMatches = []
}: ConceptQuizProps) {
    // Supported tabs: "quiz", "keywords", "cloze", "matching"
    const [activeTab, setActiveTab] = useState<"quiz" | "keywords" | "cloze" | "matching">("quiz");

    // --- Tab 1: MCQ Quiz State ---
    const [currentStep, setCurrentStep] = useState(0);
    const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
    const [score, setScore] = useState(0);
    const [phase, setPhase] = useState<"quiz" | "summary">("quiz");

    const isAnswered = userAnswers[currentStep] !== undefined;
    const selectedOption = userAnswers[currentStep] !== undefined ? userAnswers[currentStep] : null;

    // --- Tab 2: Keywords Checklist State ---
    const [checkedKeywords, setCheckedKeywords] = useState<Record<string, boolean>>({});

    // --- Tab 3: Cloze Deletion State ---
    const [selectedClozeIndex, setSelectedClozeIndex] = useState<number | null>(null);
    const [clozeAnswers, setClozeAnswers] = useState<Record<number, string>>({}); // index -> answered word
    const [clozeErrors, setClozeErrors] = useState<Record<number, boolean>>({}); // index -> flash red
    const [clozeSuccess, setClozeSuccess] = useState<Record<number, boolean>>({}); // index -> locked green

    // --- Tab 4: Concept Matcher State ---
    const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
    const [selectedDef, setSelectedDef] = useState<string | null>(null);
    const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set()); // set of terms
    const [incorrectTerm, setIncorrectTerm] = useState<string | null>(null);
    const [incorrectDef, setIncorrectDef] = useState<string | null>(null);

    // --- State to hold logged scores for each tab ---
    const [loggedScores, setLoggedScores] = useState<Record<string, number>>({});

    // --- Subtopic deep dive states ---
    const [selectedExploreSubtopic, setSelectedExploreSubtopic] = useState<string | null>(null);
    const [subtopicExplanation, setSubtopicExplanation] = useState<{
        briefSummary: string;
        keyTakeaways: string[];
        illustrativeExample: string;
    } | null>(null);
    const [isSubtopicLoading, setIsSubtopicLoading] = useState(false);
    const [subtopicError, setSubtopicError] = useState("");
    const [subtopicAddedStatus, setSubtopicAddedStatus] = useState(false);

    const handleExploreSubtopic = async (topic: string) => {
        setSelectedExploreSubtopic(topic);
        setSubtopicExplanation(null);
        setSubtopicError("");
        setSubtopicAddedStatus(false);
        setIsSubtopicLoading(true);

        try {
            const res = await fetch("/api/evaluate/explain-subtopic", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subtopic: topic, parentConcept: title })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to fetch explanation from AI Coach.");
            }

            const data = await res.json();
            setSubtopicExplanation(data);
        } catch (err) {
            console.error("Explore subtopic error:", err);
            setSubtopicError(err instanceof Error ? err.message : "Failed to load explanation.");
        } finally {
            setIsSubtopicLoading(false);
        }
    };

    const handleAddSubtopicAsCard = async () => {
        if (!selectedExploreSubtopic || !subtopicExplanation) return;
        try {
            const notesContent = `### AI Deep-Dive Guide\n\n${subtopicExplanation.briefSummary}\n\n#### Key Technical Takeaways:\n${subtopicExplanation.keyTakeaways.map(pt => `- ${pt}`).join("\n")}\n\n#### Practical/Illustrative Example:\n\`\`\`\n${subtopicExplanation.illustrativeExample}\n\`\`\``;
            
            await createCard({
                type: "cs",
                title: selectedExploreSubtopic,
                description: `Deep-dive active recall flashcard generated from recommended Next Step under '${title}'.`,
                difficulty: "medium",
                notes: notesContent,
                tags: ["Concept Checkup", "Next Steps", title.replace(/\s+/g, "-")]
            });

            setSubtopicAddedStatus(true);
            confetti({
                particleCount: 50,
                spread: 40,
                origin: { y: 0.8 }
            });
        } catch (err) {
            console.error("Failed to add subtopic card:", err);
            alert("Failed to save flashcard. Please try again.");
        }
    };

    // Helper to get rating labels, colors, and types based on percentage (0-100)
    const getRatingFromPercent = (pct: number) => {
        if (pct >= 90) return { label: "Instinctive 🧠", rating: "EASY", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" };
        if (pct >= 70) return { label: "Fluent ✨", rating: "GOOD", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" };
        if (pct >= 40) return { label: "Rusty ⚠️", rating: "HARD", color: "text-orange-500 bg-orange-500/10 border-orange-500/20" };
        return { label: "Forgot ❌", rating: "AGAIN", color: "text-red-500 bg-red-500/10 border-red-500/20" };
    };

    // --- Reset states when active card changes ---
    useEffect(() => {
        // Reset Tab 1
        setCurrentStep(0);
        setUserAnswers({});
        setScore(0);
        setPhase("quiz");

        // Reset Tab 2
        setCheckedKeywords({});

        // Reset Tab 3
        setSelectedClozeIndex(null);
        setClozeAnswers({});
        setClozeErrors({});
        setClozeSuccess({});

        // Reset Tab 4
        setSelectedTerm(null);
        setSelectedDef(null);
        setMatchedPairs(new Set());
        setIncorrectTerm(null);
        setIncorrectDef(null);

        // Reset logged scores
        setLoggedScores({});
    }, [title]);

    // Parse Cloze Sentences into fragments and expected answers
    const parsedClozes = useMemo(() => {
        return clozeSentences.map((sentence, idx) => {
            const regex = /\{\{(.*?)\}\}/g;
            const match = regex.exec(sentence);
            const answer = match ? match[1] : "";
            const cleanText = sentence.replace(/\{\{(.*?)\}\}/g, "____");
            const parts = cleanText.split("____");
            return {
                id: idx,
                prefix: parts[0] || "",
                suffix: parts[1] || "",
                answer: answer
            };
        });
    }, [clozeSentences]);

    // Shuffled Word Bank for Clozes
    const clozeWordBank = useMemo(() => {
        const words = parsedClozes.map(c => c.answer).filter(Boolean);
        return [...words].sort(() => Math.random() - 0.5);
    }, [parsedClozes]);

    // Shuffled Terms and Definitions for Concept Matcher
    const matcherTerms = useMemo(() => {
        return [...conceptMatches].map(c => c.term).sort(() => Math.random() - 0.5);
    }, [conceptMatches]);

    const matcherDefs = useMemo(() => {
        return [...conceptMatches].map(c => c.definition).sort(() => Math.random() - 0.5);
    }, [conceptMatches]);

    // --- Handlers ---
    const handleOptionSelect = (index: number) => {
        if (userAnswers[currentStep] !== undefined) return;
        
        setUserAnswers(prev => ({ ...prev, [currentStep]: index }));

        const correct = index === questions[currentStep].correctOptionIndex;
        if (correct) {
            setScore(prev => prev + 1);
        }
    };

    const handleNext = () => {
        if (currentStep < questions.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            if (score >= Math.ceil(questions.length * 0.8)) {
                confetti({
                    particleCount: 100,
                    spread: 60,
                    origin: { y: 0.6 },
                    colors: ['#06b6d4', '#10b981', '#3b82f6']
                });
            }
            setPhase("summary");
        }
    };

    // Keyword Checklist Grading
    const keywordRec = useMemo(() => {
        const total = keywords.length || 1;
        const checkedCount = Object.values(checkedKeywords).filter(Boolean).length;
        const pct = (checkedCount / total) * 100;
        let rating = "AGAIN";
        let color = "text-red-500 bg-red-500/10 border-red-500/20";
        let label = "Forgot ❌";

        if (pct >= 90) {
            rating = "EASY";
            color = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
            label = "Instinctive 🧠";
        } else if (pct >= 70) {
            rating = "GOOD";
            color = "text-blue-500 bg-blue-500/10 border-blue-500/20";
            label = "Fluent ✨";
        } else if (pct >= 40) {
            rating = "HARD";
            color = "text-orange-500 bg-orange-500/10 border-orange-500/20";
            label = "Rusty ⚠️";
        }

        return { rating, color, label, count: checkedCount, total };
    }, [checkedKeywords, keywords]);

    // Cloze Selection Handler
    const handleWordBankSelect = (word: string) => {
        if (selectedClozeIndex === null) return;
        const target = parsedClozes[selectedClozeIndex];
        
        if (target.answer.toLowerCase() === word.toLowerCase()) {
            setClozeAnswers(prev => ({ ...prev, [selectedClozeIndex]: word }));
            setClozeSuccess(prev => ({ ...prev, [selectedClozeIndex]: true }));
            setClozeErrors(prev => ({ ...prev, [selectedClozeIndex]: false }));
            setSelectedClozeIndex(null);

            // Check if all clozes completed
            const newlyCompleted = Object.keys(clozeAnswers).length + 1 === parsedClozes.length;
            if (newlyCompleted) {
                confetti({
                    particleCount: 50,
                    spread: 40,
                    origin: { y: 0.7 }
                });
            }
        } else {
            // Flash red for mistake
            setClozeErrors(prev => ({ ...prev, [selectedClozeIndex]: true }));
            setTimeout(() => {
                setClozeErrors(prev => ({ ...prev, [selectedClozeIndex]: false }));
            }, 800);
        }
    };

    // Concept Matcher Handlers
    const handleMatcherSelect = (type: "term" | "def", value: string) => {
        if (type === "term") {
            if (matchedPairs.has(value)) return;
            setSelectedTerm(value);
            // If definition already selected, check match
            if (selectedDef) {
                checkMatch(value, selectedDef);
            }
        } else {
            const isDefMatched = conceptMatches.some(pair => pair.definition === value && matchedPairs.has(pair.term));
            if (isDefMatched) return;
            setSelectedDef(value);
            if (selectedTerm) {
                checkMatch(selectedTerm, value);
            }
        }
    };

    const checkMatch = (term: string, definition: string) => {
        const correctPair = conceptMatches.find(c => c.term === term);
        if (correctPair && correctPair.definition === definition) {
            setMatchedPairs(prev => {
                const next = new Set(prev);
                next.add(term);
                if (next.size === conceptMatches.length) {
                    confetti({
                        particleCount: 60,
                        spread: 50,
                        origin: { y: 0.6 }
                    });
                }
                return next;
            });
            setSelectedTerm(null);
            setSelectedDef(null);
        } else {
            // Wrong match - flash red
            setIncorrectTerm(term);
            setIncorrectDef(definition);
            setTimeout(() => {
                setIncorrectTerm(null);
                setIncorrectDef(null);
                setSelectedTerm(null);
                setSelectedDef(null);
            }, 800);
        }
    };

    // Suggested rating helper for MCQs
    const getSuggestedRating = (finalScore: number) => {
        const percentage = (finalScore / questions.length) * 100;
        if (percentage >= 90) return { label: "Instinctive 🧠", rating: "EASY", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" };
        if (percentage >= 70) return { label: "Fluent ✨", rating: "GOOD", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" };
        if (percentage >= 40) return { label: "Rusty ⚠️", rating: "HARD", color: "text-orange-500 bg-orange-500/10 border-orange-500/20" };
        return { label: "Forgot ❌", rating: "AGAIN", color: "text-red-500 bg-red-500/10 border-red-500/20" };
    };

    const finalRec = getSuggestedRating(score);

    // Determine what tabs are available
    const hasKeywords = keywords.length > 0;
    const hasCloze = clozeSentences.length > 0;
    const hasMatching = conceptMatches.length > 0;

    const availableTabs = useMemo(() => {
        const tabs: ("quiz" | "keywords" | "cloze" | "matching")[] = ["quiz"];
        if (keywords.length > 0) tabs.push("keywords");
        if (clozeSentences.length > 0) tabs.push("cloze");
        if (conceptMatches.length > 0) tabs.push("matching");
        return tabs;
    }, [keywords, clozeSentences, conceptMatches]);

    return (
        <div className="w-full flex flex-col gap-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
                        <Brain className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            Concept Checkup Portal
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 font-bold uppercase tracking-wider">Multi-Mode</span>
                        </h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Tested on: {title}</p>
                    </div>
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onCancel}
                    className="w-8 h-8 rounded-full text-muted-foreground hover:text-foreground"
                    title="Exit Checkup"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>

            {/* Premium Tab Bar Selector */}
            <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-muted/30 border border-border/30">
                <button
                    onClick={() => setActiveTab("quiz")}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                        activeTab === "quiz" 
                            ? "bg-cyan-500 text-white shadow-sm" 
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                >
                    <Brain className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">AI Quiz</span>
                    <span className="sm:hidden">Quiz</span>
                </button>
                <button
                    onClick={() => setActiveTab("keywords")}
                    disabled={!hasKeywords}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                        !hasKeywords ? "opacity-40 cursor-not-allowed" : ""
                    } ${
                        activeTab === "keywords" 
                            ? "bg-cyan-500 text-white shadow-sm" 
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                >
                    <ListChecks className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Keywords</span>
                    <span className="sm:hidden">Pills</span>
                </button>
                <button
                    onClick={() => setActiveTab("cloze")}
                    disabled={!hasCloze}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                        !hasCloze ? "opacity-40 cursor-not-allowed" : ""
                    } ${
                        activeTab === "cloze" 
                            ? "bg-cyan-500 text-white shadow-sm" 
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                >
                    <Type className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Cloze</span>
                    <span className="sm:hidden">Cloze</span>
                </button>
                <button
                    onClick={() => setActiveTab("matching")}
                    disabled={!hasMatching}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                        !hasMatching ? "opacity-40 cursor-not-allowed" : ""
                    } ${
                        activeTab === "matching" 
                            ? "bg-cyan-500 text-white shadow-sm" 
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                >
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Matcher</span>
                    <span className="sm:hidden">Match</span>
                </button>
            </div>

            {/* TAB CONTENT AREA */}
            <div className="min-h-[260px] flex flex-col justify-between">
                
                {/* 1. MCQ Quiz Tab */}
                {activeTab === "quiz" && (
                    phase === "quiz" ? (
                        <div className="space-y-4">
                            {/* Stepper */}
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 flex gap-1.5">
                                    {questions.map((_, i) => (
                                        <div 
                                            key={i} 
                                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                                i === currentStep 
                                                    ? "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" 
                                                    : i < currentStep 
                                                        ? "bg-emerald-500" 
                                                        : "bg-muted"
                                            }`}
                                        />
                                    ))}
                                </div>
                                <span className="text-xs font-semibold text-muted-foreground shrink-0 leading-none">
                                    {currentStep + 1} / {questions.length}
                                </span>
                            </div>

                            {/* Question Block */}
                            {questions.length > 0 && (
                                <motion.div
                                    key={questions[currentStep].id}
                                    initial={{ opacity: 0, x: 15 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-4 pt-1"
                                >
                                    <div className="p-4 rounded-xl border border-border/80 bg-muted/20">
                                        <span className="text-[9px] font-bold text-cyan-500 uppercase tracking-widest block mb-1">
                                            Topic: {questions[currentStep].subtopic}
                                        </span>
                                        <h4 className="text-sm font-bold text-foreground leading-relaxed">
                                            {questions[currentStep].questionText}
                                        </h4>
                                    </div>

                                    {/* Options */}
                                    <div className="grid grid-cols-1 gap-2">
                                        {questions[currentStep].options.map((option, idx) => {
                                            const isSelected = selectedOption === idx;
                                            const isCorrect = idx === questions[currentStep].correctOptionIndex;
                                            
                                            let optionStyle = "border-border/60 bg-card hover:border-cyan-500/40 hover:bg-cyan-500/5 text-foreground/90";
                                            let icon = null;

                                            if (isAnswered) {
                                                if (isCorrect) {
                                                    optionStyle = "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold shadow-sm";
                                                    icon = <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
                                                } else if (isSelected) {
                                                    optionStyle = "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400 font-semibold shadow-sm";
                                                    icon = <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
                                                } else {
                                                    optionStyle = "border-border/40 bg-card opacity-50 text-muted-foreground";
                                                }
                                            }

                                            return (
                                                <button
                                                    key={idx}
                                                    disabled={isAnswered}
                                                    onClick={() => handleOptionSelect(idx)}
                                                    className={`w-full flex items-center justify-between gap-3 text-left p-3 rounded-xl border text-xs leading-relaxed transition-all duration-200 cursor-pointer ${optionStyle}`}
                                                >
                                                    <span className="flex-1">{option}</span>
                                                    {icon}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Explanation */}
                                    {isAnswered && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            className="p-3.5 rounded-xl border leading-relaxed text-xs bg-cyan-500/5 border-cyan-500/20 text-muted-foreground"
                                        >
                                            <div className="flex items-center gap-1 font-bold mb-1 text-foreground">
                                                <HelpCircle className="w-3.5 h-3.5 text-cyan-500" />
                                                <span>Explanation</span>
                                            </div>
                                            <p>{questions[currentStep].explanation}</p>
                                        </motion.div>
                                    )}

                                    {/* Control buttons */}
                                    <div className="flex items-center justify-between pt-1 w-full gap-3">
                                        {currentStep > 0 ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentStep(prev => prev - 1)}
                                                className="rounded-full text-xs font-semibold px-4 py-2 border-cyan-500/20 text-cyan-500 hover:bg-cyan-500/10 cursor-pointer flex items-center gap-1"
                                            >
                                                <ArrowLeft className="w-3.5 h-3.5" /> Back
                                            </Button>
                                        ) : (
                                            <div /> // Spacer
                                        )}
                                        
                                        {isAnswered && (
                                            <Button
                                                onClick={handleNext}
                                                className="rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold gap-1.5 text-xs px-5 py-2.5 shadow-md shadow-cyan-950/20 cursor-pointer"
                                            >
                                                {currentStep < questions.length - 1 ? (
                                                    <>Next Question <ArrowRight className="w-3.5 h-3.5" /></>
                                                ) : (
                                                    <>Finish & Review <Award className="w-3.5 h-3.5" /></>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    ) : (
                        /* Summary */
                        <div className="space-y-4">
                            <div className="border border-border/80 bg-card rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                                <div className="text-xl font-black text-foreground">
                                    Score: {score} / {questions.length}
                                </div>
                                <p className="text-[11px] text-muted-foreground">AI MCQ recall check completed successfully.</p>
                            </div>

                            {/* Suggested SRS Action */}
                            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <Sparkles className="w-4.5 h-4.5 text-cyan-500" />
                                    <div>
                                        <h5 className="text-xs font-bold text-foreground">AI Suggested Rating</h5>
                                        <p className="text-[9px] text-muted-foreground">Derived from score accuracy.</p>
                                    </div>
                                </div>
                                <div className={`px-4 py-1 rounded-full border text-xs font-extrabold shadow-sm ${finalRec.color}`}>
                                    {finalRec.label}
                                </div>
                            </div>

                            {/* Suggested Follow-up subtopics */}
                            {suggestedSubtopics.length > 0 && (
                                <div className="space-y-1.5 text-left">
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                        <BookOpen className="w-3.5 h-3.5" /> Next Steps (Click to Explore & Add)
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {suggestedSubtopics.map((topic, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => handleExploreSubtopic(topic)}
                                                className="text-[9px] font-bold text-foreground bg-muted hover:bg-cyan-500/10 border hover:border-cyan-500/35 px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 group shadow-sm active:scale-95"
                                            >
                                                📚 {topic} 
                                                <Sparkles className="w-2.5 h-2.5 text-muted-foreground group-hover:text-cyan-500 transition-colors" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Detailed Question Review Accordion */}
                            <div className="space-y-2 mt-4 pt-4 border-t border-border/40 text-left">
                                <h5 className="text-[10px] font-bold text-foreground flex items-center gap-1.5 mb-2.5 uppercase tracking-wider">
                                    <ListChecks className="w-4 h-4 text-cyan-500" /> Review Explanations & Selections
                                </h5>
                                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                                    {questions.map((q, idx) => {
                                        const userAns = userAnswers[idx];
                                        const isCorrect = userAns === q.correctOptionIndex;
                                        
                                        return (
                                            <div 
                                                key={q.id} 
                                                className={`p-3 rounded-xl border transition-all duration-200 ${
                                                    isCorrect 
                                                        ? "border-emerald-500/15 bg-emerald-500/5" 
                                                        : "border-red-500/15 bg-red-500/5"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1">
                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5">
                                                            Question {idx + 1} • {q.subtopic}
                                                        </span>
                                                        <h6 className="text-xs font-bold text-foreground leading-relaxed">
                                                            {q.questionText}
                                                        </h6>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 border ${
                                                        isCorrect 
                                                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                                            : "bg-red-500/10 text-red-500 border-red-500/20"
                                                    }`}>
                                                        {isCorrect ? "Correct" : "Incorrect"}
                                                    </span>
                                                </div>

                                                <div className="mt-2.5 space-y-1.5">
                                                    {q.options.map((opt, oIdx) => {
                                                        const isCorrectOpt = oIdx === q.correctOptionIndex;
                                                        const isSelectedOpt = oIdx === userAns;
                                                        
                                                        let optStyle = "border-border/40 bg-background/50 text-muted-foreground";
                                                        if (isCorrectOpt) {
                                                            optStyle = "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold";
                                                        } else if (isSelectedOpt) {
                                                            optStyle = "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 font-semibold";
                                                        }

                                                        return (
                                                            <div 
                                                                key={oIdx} 
                                                                className={`p-2 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${optStyle}`}
                                                            >
                                                                <span>{opt}</span>
                                                                {isCorrectOpt && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                                                                {!isCorrectOpt && isSelectedOpt && <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="mt-2.5 p-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/10 text-[11px] leading-relaxed text-muted-foreground">
                                                    <span className="font-bold text-foreground flex items-center gap-1 mb-0.5">
                                                        <HelpCircle className="w-3 h-3 text-cyan-500" /> Explanation:
                                                    </span>
                                                    {q.explanation}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between pt-4 border-t border-border/60">
                                <Button 
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setScore(0);
                                        setCurrentStep(0);
                                        setUserAnswers({});
                                        setPhase("quiz");
                                    }}
                                    className="rounded-full text-xs text-muted-foreground gap-1 cursor-pointer hover:bg-muted"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" /> Retake
                                </Button>
                                {loggedScores.quiz !== undefined ? (
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full border text-[10px] font-bold shadow-sm flex items-center gap-1 ${getRatingFromPercent(loggedScores.quiz).color}`}>
                                            <Check className="w-3 h-3 text-emerald-500 shrink-0" /> MCQ Logged: {getRatingFromPercent(loggedScores.quiz).label} ({Math.round(loggedScores.quiz)}%)
                                        </span>
                                        <Button
                                            onClick={() => setLoggedScores(prev => ({ ...prev, quiz: (score / questions.length) * 100 }))}
                                            variant="outline"
                                            size="sm"
                                            className="rounded-full text-[10px] h-7 px-3 border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/10 cursor-pointer"
                                        >
                                            Update
                                        </Button>
                                    </div>
                                ) : (
                                    <Button 
                                        onClick={() => setLoggedScores(prev => ({ ...prev, quiz: (score / questions.length) * 100 }))}
                                        className="rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs px-5 py-2 shadow-md cursor-pointer"
                                    >
                                        Log MCQ Score
                                    </Button>
                                )}
                            </div>
                        </div>
                    )
                )}

                {/* 2. Keywords Checklist Tab */}
                {activeTab === "keywords" && (
                    <div className="space-y-4">
                        <div className="p-3.5 rounded-xl border border-cyan-500/10 bg-cyan-500/5 text-xs text-muted-foreground leading-relaxed">
                            💡 **Mental Sandbox**: Say the details of this concept out loud or inside your head. Then check off all keywords you successfully recalled.
                        </div>

                        <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1">
                            {keywords.map((word) => {
                                const isChecked = !!checkedKeywords[word];
                                return (
                                    <button
                                        key={word}
                                        onClick={() => setCheckedKeywords(prev => ({ ...prev, [word]: !isChecked }))}
                                        className={`flex items-center gap-2 p-2.5 border rounded-xl text-xs font-semibold text-left transition-all duration-200 select-none cursor-pointer ${
                                            isChecked 
                                                ? "border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shadow-sm" 
                                                : "border-border/60 hover:border-cyan-500/30 bg-card text-foreground"
                                        }`}
                                    >
                                        <div className={`w-4.5 h-4.5 rounded-md flex items-center justify-center border transition-all duration-150 ${
                                            isChecked ? "border-cyan-500 bg-cyan-500 text-white" : "border-border bg-card"
                                        }`}>
                                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                        </div>
                                        <span className="truncate">{word}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Grading Pill */}
                        <div className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="text-xs font-medium text-foreground">
                                Recalled: **{keywordRec.count}** / {keywordRec.total} keywords
                            </div>
                            <div className={`px-4.5 py-1 rounded-full border text-xs font-black shadow-sm ${keywordRec.color}`}>
                                Suggested: {keywordRec.label}
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="flex justify-end pt-2 border-t border-border/60">
                            {loggedScores.keywords !== undefined ? (
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full border text-[10px] font-bold shadow-sm flex items-center gap-1 ${getRatingFromPercent(loggedScores.keywords).color}`}>
                                        <Check className="w-3 h-3 text-emerald-500 shrink-0" /> Keywords Logged: {getRatingFromPercent(loggedScores.keywords).label} ({Math.round(loggedScores.keywords)}%)
                                    </span>
                                    <Button
                                        onClick={() => setLoggedScores(prev => ({ ...prev, keywords: (keywordRec.count / keywords.length) * 100 }))}
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full text-[10px] h-7 px-3 border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/10 cursor-pointer"
                                    >
                                        Update
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    onClick={() => setLoggedScores(prev => ({ ...prev, keywords: (keywordRec.count / keywords.length) * 100 }))}
                                    className="rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs px-6 py-2 shadow-md cursor-pointer shadow-cyan-950/20"
                                >
                                    Log Keyword Progress
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. Cloze Deletion Tab */}
                {activeTab === "cloze" && (
                    <div className="space-y-4">
                        <div className="p-3 border border-border/60 bg-muted/20 rounded-xl">
                            <h4 className="text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                                <CheckSquare className="w-4 h-4 text-cyan-500" /> Match the Cloze Sentences
                            </h4>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                Select a blank slot below, then click the correct word from the **Word Bank** to fill it in.
                            </p>
                        </div>

                        {/* Cloze sentences listing */}
                        <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                            {parsedClozes.map((cloze, idx) => {
                                const isSelected = selectedClozeIndex === idx;
                                const answered = clozeAnswers[idx];
                                const hasError = clozeErrors[idx];
                                const success = clozeSuccess[idx];

                                return (
                                    <div 
                                        key={cloze.id}
                                        onClick={() => !success && setSelectedClozeIndex(idx)}
                                        className={`p-3 rounded-xl border text-xs leading-relaxed transition-all duration-200 cursor-pointer select-none ${
                                            success 
                                                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100" 
                                                : isSelected 
                                                    ? "border-cyan-500 bg-cyan-500/5 ring-1 ring-cyan-500/50" 
                                                    : hasError 
                                                        ? "border-red-500 bg-red-500/5 animate-pulse" 
                                                        : "border-border/60 hover:border-cyan-500/20 bg-card hover:bg-muted/10 text-foreground"
                                        }`}
                                    >
                                        <span>{cloze.prefix}</span>
                                        <span className={`inline-flex items-center justify-center px-3.5 py-0.5 mx-1 font-bold border rounded-md text-[11px] tracking-wide transition-all ${
                                            success 
                                                ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                                                : isSelected 
                                                    ? "border-cyan-500 bg-cyan-500/10 text-cyan-600 animate-pulse" 
                                                    : hasError 
                                                        ? "border-red-500 bg-red-500/10 text-red-500" 
                                                        : "border-border bg-muted/40 text-muted-foreground/60"
                                        }`}>
                                            {success ? answered : "?"}
                                        </span>
                                        <span>{cloze.suffix}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Word Bank */}
                        <div className="space-y-1.5 pt-1 border-t border-border/40">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">
                                Word Bank (Select correct word)
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {clozeWordBank.map((word) => {
                                    const isUsed = Object.values(clozeAnswers).includes(word);
                                    return (
                                        <button
                                            key={word}
                                            disabled={isUsed || selectedClozeIndex === null}
                                            onClick={() => handleWordBankSelect(word)}
                                            className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                                                isUsed
                                                    ? "border-border/20 bg-muted/20 opacity-30 text-muted-foreground cursor-not-allowed"
                                                    : selectedClozeIndex === null
                                                        ? "border-border bg-card text-muted-foreground/60 cursor-not-allowed"
                                                        : "border-cyan-500/30 hover:border-cyan-500 hover:bg-cyan-500/5 text-cyan-600 dark:text-cyan-400 active:scale-95"
                                            }`}
                                        >
                                            {word}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Complete review log */}
                        <div className="flex justify-end pt-2 border-t border-border/60">
                            {loggedScores.cloze !== undefined ? (
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full border text-[10px] font-bold shadow-sm flex items-center gap-1 ${getRatingFromPercent(loggedScores.cloze).color}`}>
                                        <Check className="w-3 h-3 text-emerald-500 shrink-0" /> Cloze Logged: {getRatingFromPercent(loggedScores.cloze).label} ({Math.round(loggedScores.cloze)}%)
                                    </span>
                                    <Button
                                        onClick={() => {
                                            const solvedCount = Object.keys(clozeAnswers).length;
                                            const pct = (solvedCount / parsedClozes.length) * 100;
                                            setLoggedScores(prev => ({ ...prev, cloze: pct }));
                                        }}
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full text-[10px] h-7 px-3 border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/10 cursor-pointer"
                                    >
                                        Update
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    onClick={() => {
                                        const solvedCount = Object.keys(clozeAnswers).length;
                                        const pct = (solvedCount / parsedClozes.length) * 100;
                                        setLoggedScores(prev => ({ ...prev, cloze: pct }));
                                    }}
                                    className="rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs px-6 py-2 shadow-md cursor-pointer"
                                >
                                    Log Cloze Score
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* 4. Concept Matcher Tab */}
                {activeTab === "matching" && (
                    <div className="space-y-4">
                        <div className="p-3 border border-border/60 bg-muted/20 rounded-xl text-xs leading-relaxed text-muted-foreground">
                            🧩 **Active Association**: Pair the key terms on the left with their correct definitions on the right. Tap a term, then tap its matching definition.
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Terms Column */}
                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
                                    Terms
                                </span>
                                {matcherTerms.map((term) => {
                                    const isMatched = matchedPairs.has(term);
                                    const isSelected = selectedTerm === term;
                                    const isWrong = incorrectTerm === term;

                                    return (
                                        <button
                                            key={term}
                                            disabled={isMatched}
                                            onClick={() => handleMatcherSelect("term", term)}
                                            className={`w-full text-left p-2.5 border rounded-xl text-xs font-bold transition-all duration-200 select-none cursor-pointer ${
                                                isMatched 
                                                    ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 opacity-60" 
                                                    : isSelected 
                                                        ? "border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shadow-sm ring-1 ring-cyan-500/40" 
                                                        : isWrong 
                                                            ? "border-red-500 bg-red-500/10 text-red-500 animate-shake" 
                                                            : "border-border/60 hover:border-cyan-500/30 bg-card text-foreground"
                                            }`}
                                        >
                                            {term}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Definitions Column */}
                            <div className="space-y-2 max-h-[220px] overflow-y-auto pl-0.5 border-l border-border/40">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
                                    Definitions
                                </span>
                                {matcherDefs.map((def) => {
                                    const isMatched = conceptMatches.some(pair => pair.definition === def && matchedPairs.has(pair.term));
                                    const isSelected = selectedDef === def;
                                    const isWrong = incorrectDef === def;

                                    return (
                                        <button
                                            key={def}
                                            disabled={isMatched}
                                            onClick={() => handleMatcherSelect("def", def)}
                                            className={`w-full text-left p-2.5 border rounded-xl text-[10px] leading-snug font-medium transition-all duration-200 select-none cursor-pointer ${
                                                isMatched 
                                                    ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600/80 dark:text-emerald-400/80 opacity-60" 
                                                    : isSelected 
                                                        ? "border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shadow-sm ring-1 ring-cyan-500/40" 
                                                        : isWrong 
                                                            ? "border-red-500 bg-red-500/10 text-red-500 animate-shake" 
                                                            : "border-border/60 hover:border-cyan-500/30 bg-card text-foreground/90"
                                            }`}
                                        >
                                            {def}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Progression Info */}
                        <div className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="text-xs font-semibold text-foreground">
                                Matched: **{matchedPairs.size}** / {conceptMatches.length} pairs
                            </div>
                            {matchedPairs.size === conceptMatches.length ? (
                                <div className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                                    🎉 All Matchings Completed!
                                </div>
                            ) : (
                                <div className="text-[10px] text-muted-foreground">
                                    Pair terms with their matching definitions.
                                </div>
                            )}
                        </div>

                        {/* Submit */}
                        <div className="flex justify-end pt-2 border-t border-border/60">
                            {loggedScores.matching !== undefined ? (
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full border text-[10px] font-bold shadow-sm flex items-center gap-1 ${getRatingFromPercent(loggedScores.matching).color}`}>
                                        <Check className="w-3 h-3 text-emerald-500 shrink-0" /> Matcher Logged: {getRatingFromPercent(loggedScores.matching).label} ({Math.round(loggedScores.matching)}%)
                                    </span>
                                    <Button
                                        onClick={() => {
                                            const solvedPct = (matchedPairs.size / conceptMatches.length) * 100;
                                            setLoggedScores(prev => ({ ...prev, matching: solvedPct }));
                                        }}
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full text-[10px] h-7 px-3 border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/10 cursor-pointer"
                                    >
                                        Update
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    onClick={() => {
                                        const solvedPct = (matchedPairs.size / conceptMatches.length) * 100;
                                        setLoggedScores(prev => ({ ...prev, matching: solvedPct }));
                                    }}
                                    className="rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs px-6 py-2 shadow-md cursor-pointer"
                                >
                                    Log Matcher Progress
                                </Button>
                            )}
                        </div>
                    </div>
                )}

            </div>

            {/* 5. Consolidated Summary Section */}
            <div className="mt-6 p-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 shadow-lg flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-cyan-500/15 pb-2.5">
                    <h4 className="text-xs font-bold text-cyan-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 animate-pulse text-cyan-500" /> Consolidated Review Board
                    </h4>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 font-bold uppercase tracking-wider">
                        {Object.keys(loggedScores).length} / {availableTabs.length} Modes Logged
                    </span>
                </div>

                {/* Sub-modes checklists */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {availableTabs.map((tab) => {
                        const isLogged = loggedScores[tab] !== undefined;
                        const pct = loggedScores[tab];
                        const rating = isLogged ? getRatingFromPercent(pct) : null;
                        
                        const labelMap = {
                            quiz: "AI Quiz",
                            keywords: "Keywords",
                            cloze: "Cloze",
                            matching: "Matcher"
                        };

                        return (
                            <div 
                                key={tab} 
                                className={`p-2.5 rounded-xl border flex flex-col justify-between h-16 transition-all duration-200 ${
                                    isLogged 
                                        ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/10" 
                                        : "border-border/60 bg-muted/20 opacity-60"
                                }`}
                            >
                                <span className="text-[10px] font-bold text-muted-foreground">{labelMap[tab]}</span>
                                {isLogged && rating ? (
                                    <div className="flex items-center justify-between mt-1">
                                        <span className={`text-[9px] font-black uppercase tracking-wider ${rating.color}`}>
                                            {rating.rating}
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                                            {Math.round(pct)}% <Check className="w-3 h-3 text-emerald-500" />
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-[9px] text-muted-foreground font-semibold mt-1 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-pulse" /> Pending
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Consolidated result suggestion & Final Submission Action */}
                <div className="p-3 rounded-xl bg-card border border-cyan-500/15 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5 text-center sm:text-left">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Consolidated SRS Suggestion</span>
                        {Object.keys(loggedScores).length > 0 ? (
                            <div className="flex items-center gap-2 justify-center sm:justify-start">
                                <span className="text-sm font-extrabold text-foreground">{Math.round(Object.keys(loggedScores).reduce((acc, k) => acc + loggedScores[k], 0) / Object.keys(loggedScores).length)}% Average</span>
                                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${
                                    getRatingFromPercent(Object.keys(loggedScores).reduce((acc, k) => acc + loggedScores[k], 0) / Object.keys(loggedScores).length).color
                                }`}>
                                    {getRatingFromPercent(Object.keys(loggedScores).reduce((acc, k) => acc + loggedScores[k], 0) / Object.keys(loggedScores).length).label}
                                </span>
                            </div>
                        ) : (
                            <span className="text-xs font-semibold text-muted-foreground">Log at least one mode to view suggestion</span>
                        )}
                    </div>

                    <Button
                        onClick={() => {
                            const loggedKeys = Object.keys(loggedScores);
                            if (loggedKeys.length === 0) return;
                            const avgPct = loggedKeys.reduce((acc, k) => acc + loggedScores[k], 0) / loggedKeys.length;
                            const equivalentAvgScore = Math.round((avgPct / 100) * questions.length);
                            onComplete(equivalentAvgScore);
                        }}
                        disabled={Object.keys(loggedScores).length === 0}
                        className="rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold text-xs px-6 py-2.5 shadow-md shadow-cyan-950/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 animate-pulse hover:animate-none"
                    >
                        Log Final Consolidated Review
                    </Button>
                </div>
            </div>

            {/* Subtopic Explorer Dialog Overlay */}
            <AnimatePresence>
                {selectedExploreSubtopic && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, y: 15 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 15 }}
                            className="w-full max-w-lg overflow-hidden border border-cyan-500/25 bg-card/95 shadow-2xl rounded-2xl flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="p-4 border-b border-border/80 flex items-center justify-between bg-cyan-500/5">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-cyan-500 animate-pulse" />
                                    <div className="text-left">
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">
                                            AI Subtopic Deep-Dive Explorer
                                        </span>
                                        <h3 className="text-sm font-extrabold text-foreground leading-snug">
                                            {selectedExploreSubtopic}
                                        </h3>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedExploreSubtopic(null)}
                                    className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-5 overflow-y-auto space-y-4 text-left">
                                {isSubtopicLoading ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                                        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                                        <div>
                                            <p className="text-xs font-bold text-foreground">AI Technical Coach is synthesizing concept...</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">Fetching summary, trade-offs, and design examples.</p>
                                        </div>
                                    </div>
                                ) : subtopicError ? (
                                    <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
                                        <span className="text-lg">⚠️</span>
                                        <p className="text-xs font-bold text-red-500">{subtopicError}</p>
                                        <Button 
                                            onClick={() => handleExploreSubtopic(selectedExploreSubtopic)}
                                            size="sm" 
                                            variant="outline"
                                            className="rounded-full text-[10px] border-red-500/20 text-red-500 mt-2"
                                        >
                                            Try Again
                                        </Button>
                                    </div>
                                ) : subtopicExplanation ? (
                                    <div className="space-y-4">
                                        {/* Brief Summary */}
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest block">
                                                Concept Summary
                                            </span>
                                            <p className="text-xs leading-relaxed text-foreground bg-cyan-500/5 p-3 rounded-xl border border-cyan-500/10">
                                                {subtopicExplanation.briefSummary}
                                            </p>
                                        </div>

                                        {/* Key Takeaways */}
                                        <div className="space-y-2">
                                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block">
                                                High-Yield Takeaways
                                            </span>
                                            <div className="space-y-1.5">
                                                {subtopicExplanation.keyTakeaways.map((takeaway, tIdx) => (
                                                    <div key={tIdx} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                        <span>{takeaway}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Illustrative Example */}
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest block">
                                                Illustrative Example / Mechanics
                                            </span>
                                            <pre className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[10px] font-mono leading-relaxed text-zinc-300 overflow-x-auto">
                                                {subtopicExplanation.illustrativeExample}
                                            </pre>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            {/* Modal Footer Actions */}
                            {!isSubtopicLoading && subtopicExplanation && (
                                <div className="p-4 border-t border-border/80 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        <Brain className="w-3.5 h-3.5 text-cyan-500" /> Pre-configured for CS recall checks
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedExploreSubtopic(null)}
                                            className="rounded-full text-xs font-semibold px-4 flex-1 sm:flex-initial"
                                        >
                                            Dismiss
                                        </Button>
                                        {subtopicAddedStatus ? (
                                            <span className="px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold flex items-center justify-center gap-1 shadow-sm shrink-0 animate-bounce">
                                                <ClipboardCheck className="w-4 h-4" /> Added to Cards!
                                            </span>
                                        ) : (
                                            <Button
                                                onClick={handleAddSubtopicAsCard}
                                                size="sm"
                                                className="rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold text-xs px-4 flex items-center justify-center gap-1 shadow-md shadow-cyan-950/20 flex-1 sm:flex-initial cursor-pointer"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Add as Flashcard
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}
