'use client';

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import type { Flashcard } from "@/data";
import { 
    MessageSquare, 
    Send, 
    Loader2, 
    AlertTriangle, 
    CheckCircle2, 
    XCircle, 
    User, 
    Bot, 
    Eye, 
    Play, 
    Sparkles, 
    BookOpen, 
    ExternalLink, 
    BadgeCheck, 
    HelpCircle 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface VagueInterviewerProps {
    cards: Flashcard[];
    onExit: () => void;
}

interface ChatMsg { 
    role: "user" | "assistant"; 
    content: string; 
}

interface VagueSetup {
    vagueDescription: string;
    hiddenConstraints: string[];
    idealClarifyingQuestions: string[];
    difficulty: string;
}

interface EvalResult {
    score: number;
    feedback: string;
    questionsAsked: number;
    constraintsUncovered: number;
    totalConstraints: number;
    missedAreas: string[];
    suggestedRating: "AGAIN" | "HARD" | "GOOD" | "EASY";
}

export function VagueInterviewer({ cards, onExit }: VagueInterviewerProps) {
    // Setup and active card states
    const [activeCard, setActiveCard] = useState<Flashcard | null>(null);
    const [selectedDifficulty, setSelectedDifficulty] = useState<string>("any");
    const [selectedTopic, setSelectedTopic] = useState<string>("any");

    // Chat Phase states
    const [phase, setPhase] = useState<"setup" | "loading" | "chat" | "evaluating" | "results">("setup");
    const [setup, setSetup] = useState<VagueSetup | null>(null);
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState("");
    const [evaluation, setEvaluation] = useState<EvalResult | null>(null);
    const [showHidden, setShowHidden] = useState(false);
    const [showRealDetails, setShowRealDetails] = useState(false); // only revealed in results phase

    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { 
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
    }, [messages]);

    const getSavedSolution = (card: Flashcard) => {
        if (card.solutions && card.solutions.length > 0) {
            return card.solutions.map(s => `## ${s.name}\n${s.content}`).join("\n\n");
        }
        return card.solution || "";
    };

    const handleStartInterview = async () => {
        setError("");
        
        // Filter cards matching criteria (only DSA/SQL cards are appropriate for vague interviewer)
        const dsaCards = cards.filter(c => c.type === "leetcode" || c.type === "sql");
        if (dsaCards.length === 0) {
            setError("No practice cards available for a mock interview.");
            return;
        }

        let filtered = dsaCards;
        
        if (selectedDifficulty !== "any") {
            filtered = filtered.filter(c => c.difficulty.toLowerCase() === selectedDifficulty.toLowerCase());
        }

        if (selectedTopic !== "any") {
            filtered = filtered.filter(c => 
                c.tags.some(t => t.toLowerCase().includes(selectedTopic.toLowerCase()))
            );
        }

        // Fallback if filter is too tight
        if (filtered.length === 0) {
            filtered = dsaCards;
        }

        const randomCard = filtered[Math.floor(Math.random() * filtered.length)];
        setActiveCard(randomCard);
        
        setPhase("loading");
        setMessages([]);
        setEvaluation(null);
        setShowHidden(false);
        setShowRealDetails(false);

        try {
            const res = await fetch("/api/evaluate/vague-interviewer", {
                method: "POST", 
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    action: "generate", 
                    problemTitle: randomCard.title, 
                    problemDescription: randomCard.description, 
                    savedSolution: getSavedSolution(randomCard), 
                    savedNotes: randomCard.notes, 
                    cardType: randomCard.type 
                }),
            });
            if (!res.ok) { 
                const b = await res.json().catch(() => ({})); 
                throw new Error(b.error || "Failed scenario generation"); 
            }
            const result: VagueSetup = await res.json();
            setSetup(result);
            setMessages([{ role: "assistant", content: result.vagueDescription }]);
            setPhase("chat");
            setTimeout(() => inputRef.current?.focus(), 100);
        } catch (err) { 
            setError(err instanceof Error ? err.message : "Failed scenario initialization. Try again."); 
            setPhase("setup"); 
        }
    };

    const sendQuestion = async () => {
        if (!input.trim() || isSending || !activeCard) return;
        const userMsg = input.trim(); 
        setInput(""); 
        setIsSending(true);
        const updated: ChatMsg[] = [...messages, { role: "user", content: userMsg }];
        setMessages(updated);
        try {
            const res = await fetch("/api/evaluate/vague-interviewer", {
                method: "POST", 
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    action: "respond", 
                    problemTitle: activeCard.title, 
                    problemDescription: activeCard.description, 
                    conversationHistory: updated 
                }),
            });
            if (!res.ok) throw new Error("Failed response");
            const result = await res.json();
            setMessages([...updated, { role: "assistant", content: result.response }]);
        } catch { 
            setMessages([...updated, { role: "assistant", content: "Sorry, my audio link had some interference. Can you ask that again?" }]); 
        } finally { 
            setIsSending(false); 
            setTimeout(() => inputRef.current?.focus(), 100); 
        }
    };

    const handleEvaluate = async () => {
        if (!activeCard) return;
        setPhase("evaluating");
        try {
            const res = await fetch("/api/evaluate/vague-interviewer", {
                method: "POST", 
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    action: "evaluate", 
                    problemTitle: activeCard.title, 
                    problemDescription: activeCard.description, 
                    conversationHistory: messages 
                }),
            });
            if (!res.ok) throw new Error("Failed");
            const result: EvalResult = await res.json();
            setEvaluation(result); 
            setPhase("results");
        } catch { 
            setError("Failed to evaluate"); 
            setPhase("chat"); 
        }
    };

    const handleRatingAccepted = async () => {
        // Here we could update card review status inside AlgoSpace DB,
        // but since this is a standalone challenge, let's gracefully exit.
        setActiveCard(null);
        setPhase("setup");
    };

    const scoreColor = (s: number) => s >= 80 ? "text-emerald-400" : s >= 60 ? "text-blue-400" : s >= 40 ? "text-amber-500" : "text-red-500";
    const scoreGrad = (s: number) => s >= 80 ? "from-emerald-500 to-teal-500" : s >= 60 ? "from-blue-500 to-cyan-500" : s >= 40 ? "from-amber-500 to-orange-500" : "from-red-500 to-pink-500";

    // Extract unique tags/topics from user cards for selector
    const topics = Array.from(
        new Set(
            cards.filter(c => c.type === "leetcode" || c.type === "sql")
                 .flatMap(c => c.tags)
                 .map(t => t.trim())
                 .filter(t => t.length > 0)
        )
    ).slice(0, 12);

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 flex flex-col gap-6">
            
            {/* Setup dashboard view */}
            {phase === "setup" && (
                <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="border border-border/80 rounded-2xl p-6 md:p-8 bg-card/40 backdrop-blur-md shadow-2xl space-y-6"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl shadow-sm">
                            <MessageSquare className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                                Vague Interviewer Challenge
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold uppercase tracking-wider">Spoiler Free</span>
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Decode real-world business scenarios into standard computer science algorithms.</p>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4 pt-2">
                        {/* Difficulty Grid */}
                        <div className="space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Select Target Difficulty</span>
                            <div className="grid grid-cols-4 gap-3">
                                {["any", "easy", "medium", "hard"].map((d) => (
                                    <button
                                        key={d}
                                        onClick={() => setSelectedDifficulty(d)}
                                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-all select-none cursor-pointer ${
                                            selectedDifficulty === d 
                                                ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400 font-bold shadow-sm" 
                                                : "border-border/60 hover:border-border text-muted-foreground"
                                        }`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Topic Tag Pills */}
                        <div className="space-y-2 pt-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Filter by Algorithmic Topic (Optional)</span>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedTopic("any")}
                                    className={`py-1.5 px-3.5 rounded-full border text-xs font-medium transition-all cursor-pointer ${
                                        selectedTopic === "any" 
                                            ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-bold" 
                                            : "border-border/50 text-muted-foreground hover:border-border"
                                    }`}
                                >
                                    Any Topic
                                </button>
                                {topics.map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setSelectedTopic(t)}
                                        className={`py-1.5 px-3.5 rounded-full border text-xs font-medium transition-all cursor-pointer ${
                                            selectedTopic === t 
                                                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-bold" 
                                                : "border-border/50 text-muted-foreground hover:border-border"
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-6 border-t border-border/40">
                        <Button 
                            onClick={handleStartInterview}
                            className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-full font-bold px-6 gap-2 shadow-lg shadow-indigo-950/20"
                        >
                            <Play className="w-4 h-4 fill-current" /> Start Mock Interview
                        </Button>
                        <Button 
                            variant="ghost" 
                            onClick={onExit}
                            className="text-muted-foreground hover:text-foreground text-xs rounded-full px-5"
                        >
                            Go Back
                        </Button>
                    </div>
                </motion.div>
            )}

            {/* Loading Scenario */}
            {phase === "loading" && (
                <div className="border border-border bg-card/35 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-4 shadow-xl">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <div>
                        <h4 className="text-sm font-bold text-foreground">VM scenario loader initializing...</h4>
                        <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">AI Interviewer is translating problem structures into a real-world scenario. Please wait.</p>
                    </div>
                </div>
            )}

            {/* Active Interview Panel */}
            {(phase === "chat" || phase === "evaluating") && activeCard && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    className="border border-border/80 rounded-2xl bg-card/40 backdrop-blur-md shadow-2xl flex flex-col h-[520px] overflow-hidden"
                >
                    {/* Header */}
                    <div className="px-5 py-4 bg-muted/40 border-b border-border/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                                <Bot className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                    Mock Interviewer
                                    <span className="px-2 py-0.5 rounded text-[9px] bg-red-500/10 text-red-500 border border-red-500/20 font-bold uppercase tracking-wider">Hidden Problem</span>
                                </h3>
                                <p className="text-[10px] text-muted-foreground">Ask questions to extract constraints and identify the optimal algorithm.</p>
                            </div>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { setActiveCard(null); setPhase("setup"); }} 
                            className="text-xs text-muted-foreground hover:text-foreground rounded-full"
                        >
                            Exit
                        </Button>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <AnimatePresence>
                            {messages.map((msg, i) => (
                                <motion.div 
                                    key={i} 
                                    initial={{ opacity: 0, y: 5 }} 
                                    animate={{ opacity: 1, y: 0 }} 
                                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${
                                        msg.role === "user" 
                                            ? "bg-blue-500/10 border-blue-500/20 text-blue-500" 
                                            : "bg-indigo-500/10 border-indigo-500/20 text-indigo-500"
                                    }`}>
                                        {msg.role === "user" ? "👤" : "🤖"}
                                    </div>
                                    <div className={`max-w-[78%] p-3.5 rounded-2xl text-xs leading-relaxed border ${
                                        msg.role === "user" 
                                            ? "bg-blue-500/5 border-blue-500/20 text-foreground/90 rounded-tr-none" 
                                            : "bg-muted/40 border-border/50 text-foreground/95 rounded-tl-none"
                                    }`}>
                                        {msg.content}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {isSending && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">🤖</div>
                                <div className="p-3 rounded-2xl bg-muted/40 border border-border/50 rounded-tl-none">
                                    <div className="flex gap-1.5 py-1 px-0.5">
                                        {[0, 150, 300].map(d => (
                                            <span 
                                                key={d} 
                                                className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" 
                                                style={{ animationDelay: `${d}ms` }} 
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Hidden requirements peek segment */}
                    <AnimatePresence>
                        {showHidden && setup && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }} 
                                animate={{ opacity: 1, height: "auto" }} 
                                exit={{ opacity: 0, height: 0 }} 
                                className="border-t border-border bg-amber-500/5 p-4 overflow-hidden space-y-2 shrink-0"
                            >
                                <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Hidden Constraints (Interview Spoilers)</p>
                                <ul className="text-[11px] text-foreground/80 space-y-1">{setup.hiddenConstraints.map((c, i) => <li key={i}>• {c}</li>)}</ul>
                                <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-2">Ideal Clarifying Questions</p>
                                <ul className="text-[11px] text-foreground/80 space-y-1">{setup.idealClarifyingQuestions.map((q, i) => <li key={i}>• {q}</li>)}</ul>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Input Controls */}
                    <div className="p-3 bg-muted/20 border-t border-border/80 flex flex-col gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                            <input 
                                ref={inputRef} 
                                value={input} 
                                onChange={e => setInput(e.target.value)} 
                                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuestion(); } }} 
                                placeholder="Ask the interviewer a clarifying question about constraints, size, memory..." 
                                disabled={isSending || phase === "evaluating"} 
                                className="flex-1 px-4 py-2.5 rounded-full border border-border/80 bg-background text-xs focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50" 
                            />
                            <Button 
                                onClick={sendQuestion} 
                                disabled={!input.trim() || isSending || phase === "evaluating"} 
                                className="rounded-full px-4 h-9 bg-indigo-500 hover:bg-indigo-600 text-white shrink-0" 
                                size="sm"
                            >
                                <Send className="w-3.5 h-3.5" />
                            </Button>
                        </div>

                        <div className="flex items-center justify-between text-[10px] mt-1 text-muted-foreground font-semibold px-1">
                            <span>{messages.filter(m => m.role === "user").length} questions asked</span>
                            <div className="flex gap-2">
                                {setup && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => setShowHidden(!showHidden)} 
                                        className="h-7 text-[10px] text-muted-foreground gap-1 rounded-full px-3 hover:bg-muted"
                                    >
                                        <Eye className="w-3 h-3" />{showHidden ? "Hide Constraints" : "Peek Constraints"}
                                    </Button>
                                )}
                                <Button 
                                    onClick={handleEvaluate} 
                                    disabled={messages.filter(m => m.role === "user").length === 0 || phase === "evaluating"} 
                                    className="rounded-full px-4 h-7 bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-bold gap-1.5 shadow-sm" 
                                    size="sm"
                                >
                                    {phase === "evaluating" ? (
                                        <><Loader2 className="w-3 h-3 animate-spin" />Evaluating...</>
                                    ) : "Done — Evaluate Me"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Results & Spoilers Unlocking View */}
            {phase === "results" && evaluation && activeCard && (
                <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="space-y-6"
                >
                    <div className="border border-border/80 rounded-2xl p-6 bg-card/40 backdrop-blur-md shadow-2xl flex flex-col gap-6">
                        {/* Scoring dashboard */}
                        <div className="flex flex-col items-center gap-3 py-4 text-center">
                            <div className={`text-6xl font-black ${scoreColor(evaluation.score)}`}>{evaluation.score}</div>
                            <div className="h-2 w-full max-w-xs rounded-full bg-muted overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: `${evaluation.score}%` }} 
                                    transition={{ duration: 0.8 }} 
                                    className={`h-full rounded-full bg-gradient-to-r ${scoreGrad(evaluation.score)}`} 
                                />
                            </div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Requirement Extraction Score</p>
                        </div>

                        {/* Fast stats indicators */}
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { v: evaluation.questionsAsked, l: "Questions Asked" }, 
                                { v: evaluation.constraintsUncovered, l: "Constraints Uncovered" }, 
                                { v: evaluation.totalConstraints, l: "Total Constraints" }
                            ].map(({ v, l }) => (
                                <div key={l} className="p-3 rounded-xl bg-muted/20 border border-border/50 text-center">
                                    <p className="text-lg font-bold text-foreground">{v}</p>
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{l}</p>
                                </div>
                            ))}
                        </div>

                        {/* Interview Feedback body */}
                        <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
                            <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5">Feedback Verdict</h4>
                            <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{evaluation.feedback}</p>
                        </div>

                        {/* Missed Areas */}
                        {evaluation.missedAreas.length > 0 && (
                            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                                <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-red-500" /> Areas You Missed</h4>
                                <ul className="text-xs text-foreground/80 space-y-1.5 pl-1">{evaluation.missedAreas.map((a, i) => <li key={i} className="flex items-start gap-1.5">• {a}</li>)}</ul>
                            </div>
                        )}

                        <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-2">
                            <Button 
                                onClick={() => setShowRealDetails(!showRealDetails)}
                                className={`rounded-full px-5 font-bold gap-2 text-xs border ${
                                    showRealDetails 
                                        ? "bg-amber-500/10 border-amber-500/30 text-amber-500" 
                                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                }`}
                            >
                                <Eye className="w-3.5 h-3.5" />
                                {showRealDetails ? "Hide original problem" : "Reveal original problem as reward! 🎁"}
                            </Button>
                            
                            <Button 
                                onClick={handleRatingAccepted}
                                className="rounded-full px-6 font-bold bg-indigo-500 hover:bg-indigo-600 text-white gap-1.5 shadow-md"
                            >
                                <CheckCircle2 className="w-4 h-4" /> Exit Challenge
                            </Button>
                        </div>
                    </div>

                    {/* Unlocked Reward Card Details (Visible after clicking Reveal) */}
                    <AnimatePresence>
                        {showRealDetails && (
                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                className="border border-border/80 rounded-2xl p-6 bg-card/60 backdrop-blur-md shadow-2xl space-y-4"
                            >
                                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border/40 pb-3">
                                    <div className="flex items-center gap-2">
                                        <BadgeCheck className="w-5 h-5 text-emerald-400" />
                                        <h3 className="text-sm font-black text-foreground">{activeCard.title}</h3>
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase border ${
                                            activeCard.difficulty === "hard" 
                                                ? "bg-red-500/10 border-red-500/20 text-red-500" 
                                                : activeCard.difficulty === "medium" 
                                                    ? "bg-orange-500/10 border-orange-500/20 text-orange-500" 
                                                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                        }`}>
                                            {activeCard.difficulty}
                                        </span>
                                    </div>
                                    {activeCard.url && (
                                        <a 
                                            href={activeCard.url} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1 font-bold"
                                        >
                                            LeetCode source <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    {/* Problem description */}
                                    <div className="space-y-1.5">
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> Problem Description</span>
                                        <div className="text-xs text-foreground/80 leading-relaxed max-h-[140px] overflow-y-auto bg-background/40 border border-border/40 p-3 rounded-xl whitespace-pre-wrap">
                                            {activeCard.description}
                                        </div>
                                    </div>

                                    {/* Optimal Solution code */}
                                    {(activeCard.solution || (activeCard.solutions && activeCard.solutions.length > 0)) && (
                                        <div className="space-y-1.5">
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5" /> Optimal Solution</span>
                                            <pre className="text-[11px] font-mono text-zinc-300 leading-relaxed bg-black p-4 rounded-xl overflow-x-auto max-h-[220px] scrollbar-thin">
                                                {getSavedSolution(activeCard)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    );
}
