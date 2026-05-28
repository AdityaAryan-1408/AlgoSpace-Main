'use client';

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { 
    CheckCircle2, 
    XCircle, 
    ArrowRight, 
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
    Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";

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
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [score, setScore] = useState(0);
    const [phase, setPhase] = useState<"quiz" | "summary">("quiz");

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

    // --- Reset states when active tab changes ---
    useEffect(() => {
        // Reset Tab 1
        setCurrentStep(0);
        setSelectedOption(null);
        setIsAnswered(false);
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
    }, [activeTab]);

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
        if (isAnswered) return;
        setSelectedOption(index);
        setIsAnswered(true);

        const correct = index === questions[currentStep].correctOptionIndex;
        if (correct) {
            setScore(prev => prev + 1);
        }
    };

    const handleNext = () => {
        if (currentStep < questions.length - 1) {
            setCurrentStep(prev => prev + 1);
            setSelectedOption(null);
            setIsAnswered(false);
        } else {
            const finalScore = score + (selectedOption === questions[currentStep].correctOptionIndex ? 1 : 0);
            if (finalScore >= Math.ceil(questions.length * 0.8)) {
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

                                    {/* Control button */}
                                    {isAnswered && (
                                        <div className="flex justify-end pt-1">
                                            <Button
                                                onClick={handleNext}
                                                className="rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold gap-1.5 text-xs px-5 py-2.5 shadow-md shadow-cyan-950/20"
                                            >
                                                {currentStep < questions.length - 1 ? (
                                                    <>Next Question <ArrowRight className="w-3.5 h-3.5" /></>
                                                ) : (
                                                    <>Finish & Review <Award className="w-3.5 h-3.5" /></>
                                                )}
                                            </Button>
                                        </div>
                                    )}
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
                                <div className="space-y-1.5">
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                        <BookOpen className="w-3.5 h-3.5" /> Next Steps
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {suggestedSubtopics.map((topic, i) => (
                                            <div key={i} className="text-[9px] font-semibold text-foreground bg-muted border px-2.5 py-1 rounded-lg">
                                                📚 {topic}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-between pt-2 border-t border-border/60">
                                <Button 
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setScore(0);
                                        setCurrentStep(0);
                                        setSelectedOption(null);
                                        setIsAnswered(false);
                                        setPhase("quiz");
                                    }}
                                    className="rounded-full text-xs text-muted-foreground gap-1"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" /> Retake
                                </Button>
                                <Button 
                                    onClick={() => onComplete(score)}
                                    className="rounded-full bg-foreground text-background hover:bg-foreground/90 font-bold text-xs px-5 py-2"
                                >
                                    Log Review Rating
                                </Button>
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
                            <Button
                                onClick={() => {
                                    // Scale score out of questions length to map cleanly to SRS
                                    const equivalentScore = Math.round((keywordRec.count / keywordRec.total) * questions.length);
                                    onComplete(equivalentScore);
                                }}
                                className="rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs px-6 py-2 shadow-md cursor-pointer shadow-cyan-950/20"
                            >
                                Log Keyword Review
                            </Button>
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
                            <Button
                                onClick={() => {
                                    const solvedCount = Object.keys(clozeAnswers).length;
                                    const pct = solvedCount / parsedClozes.length;
                                    const equiv = Math.round(pct * questions.length);
                                    onComplete(equiv);
                                }}
                                className="rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs px-6 py-2 shadow-md cursor-pointer"
                            >
                                Log Cloze Review
                            </Button>
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
                            <Button
                                onClick={() => {
                                    const solvedPct = matchedPairs.size / conceptMatches.length;
                                    const equivalent = Math.round(solvedPct * questions.length);
                                    onComplete(equivalent);
                                }}
                                className="rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs px-6 py-2 shadow-md cursor-pointer"
                            >
                                Log Matcher Review
                            </Button>
                        </div>
                    </div>
                )}

            </div>

        </div>
    );
}
