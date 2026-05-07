'use client';

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import type { Flashcard } from "@/data";
import { MessageSquare, Send, Loader2, AlertTriangle, CheckCircle2, XCircle, User, Bot, Eye } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface VagueInterviewerProps {
    card: Flashcard;
    onRate: (rating: "AGAIN" | "HARD" | "GOOD" | "EASY") => void;
    onCancel: () => void;
}

interface ChatMsg { role: "user" | "assistant"; content: string; }

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

export function VagueInterviewer({ card, onRate, onCancel }: VagueInterviewerProps) {
    const [phase, setPhase] = useState<"loading" | "chat" | "evaluating" | "results">("loading");
    const [setup, setSetup] = useState<VagueSetup | null>(null);
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState("");
    const [evaluation, setEvaluation] = useState<EvalResult | null>(null);
    const [showHidden, setShowHidden] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    useEffect(() => { generateVagueDescription(); }, []);

    const getSavedSolution = () => {
        if (card.solutions && card.solutions.length > 0) return card.solutions.map(s => `## ${s.name}\n${s.content}`).join("\n\n");
        return card.solution || "";
    };

    const generateVagueDescription = async () => {
        setPhase("loading"); setError("");
        try {
            const res = await fetch("/api/evaluate/vague-interviewer", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "generate", problemTitle: card.title, problemDescription: card.description, savedSolution: getSavedSolution(), savedNotes: card.notes, cardType: card.type }),
            });
            if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
            const result: VagueSetup = await res.json();
            setSetup(result);
            setMessages([{ role: "assistant", content: result.vagueDescription }]);
            setPhase("chat");
            setTimeout(() => inputRef.current?.focus(), 100);
        } catch (err) { setError(err instanceof Error ? err.message : "Failed"); setPhase("chat"); }
    };

    const sendQuestion = async () => {
        if (!input.trim() || isSending) return;
        const userMsg = input.trim(); setInput(""); setIsSending(true);
        const updated: ChatMsg[] = [...messages, { role: "user", content: userMsg }];
        setMessages(updated);
        try {
            const res = await fetch("/api/evaluate/vague-interviewer", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "respond", problemTitle: card.title, problemDescription: card.description, conversationHistory: updated }),
            });
            if (!res.ok) throw new Error("Failed");
            const result = await res.json();
            setMessages([...updated, { role: "assistant", content: result.response }]);
        } catch { setMessages([...updated, { role: "assistant", content: "Sorry, I had trouble responding. Try again?" }]); }
        finally { setIsSending(false); setTimeout(() => inputRef.current?.focus(), 100); }
    };

    const handleEvaluate = async () => {
        setPhase("evaluating");
        try {
            const res = await fetch("/api/evaluate/vague-interviewer", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "evaluate", problemTitle: card.title, problemDescription: card.description, conversationHistory: messages }),
            });
            if (!res.ok) throw new Error("Failed");
            const result: EvalResult = await res.json();
            setEvaluation(result); setPhase("results");
        } catch { setError("Failed to evaluate"); setPhase("chat"); }
    };

    const scoreColor = (s: number) => s >= 80 ? "text-emerald-500" : s >= 60 ? "text-blue-500" : s >= 40 ? "text-amber-500" : "text-red-500";
    const scoreGrad = (s: number) => s >= 80 ? "from-emerald-500 to-teal-500" : s >= 60 ? "from-blue-500 to-cyan-500" : s >= 40 ? "from-amber-500 to-orange-500" : "from-red-500 to-pink-500";

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground">Vague Interviewer</h3>
                        <p className="text-[10px] text-muted-foreground">Extract requirements from an ambiguous problem</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground text-xs">Exit</Button>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm text-red-500">{error}</span>
                </div>
            )}

            {phase === "loading" && (
                <div className="flex flex-col items-center justify-center gap-3 py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <p className="text-sm text-muted-foreground">The interviewer is preparing your scenario...</p>
                </div>
            )}

            {(phase === "chat" || phase === "evaluating") && (
                <>
                    <div className="flex flex-col gap-3 max-h-80 overflow-y-auto p-1">
                        <AnimatePresence>
                            {messages.map((msg, i) => (
                                <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-blue-500/10" : "bg-indigo-500/10"}`}>
                                        {msg.role === "user" ? <User className="w-3.5 h-3.5 text-blue-500" /> : <Bot className="w-3.5 h-3.5 text-indigo-500" />}
                                    </div>
                                    <div className={`max-w-[80%] p-3 rounded-xl text-sm leading-relaxed ${msg.role === "user" ? "bg-blue-500/10 border border-blue-500/20" : "bg-muted/50 border border-border/50"} text-foreground/90`}>
                                        {msg.content}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {isSending && (
                            <div className="flex gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0"><Bot className="w-3.5 h-3.5 text-indigo-500" /></div>
                                <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
                                    <div className="flex gap-1">
                                        {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="flex items-center gap-2">
                        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuestion(); } }} placeholder="Ask a clarifying question..." disabled={isSending || phase === "evaluating"} className="flex-1 px-4 py-2.5 rounded-full border border-border bg-background text-sm focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50" />
                        <Button onClick={sendQuestion} disabled={!input.trim() || isSending || phase === "evaluating"} className="rounded-full px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white" size="sm"><Send className="w-4 h-4" /></Button>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">{messages.filter(m => m.role === "user").length} questions asked</span>
                        <div className="flex gap-2">
                            {setup && <Button variant="ghost" size="sm" onClick={() => setShowHidden(!showHidden)} className="text-xs text-muted-foreground gap-1"><Eye className="w-3 h-3" />{showHidden ? "Hide" : "Peek"}</Button>}
                            <Button onClick={handleEvaluate} disabled={messages.filter(m => m.role === "user").length === 0 || phase === "evaluating"} className="rounded-full px-5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold gap-2" size="sm">
                                {phase === "evaluating" ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Evaluating...</> : "Done — Evaluate Me"}
                            </Button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {showHidden && setup && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Hidden Constraints</p>
                                    <ul className="text-xs text-foreground/80 space-y-1">{setup.hiddenConstraints.map((c, i) => <li key={i}>• {c}</li>)}</ul>
                                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mt-2">Ideal Questions</p>
                                    <ul className="text-xs text-foreground/80 space-y-1">{setup.idealClarifyingQuestions.map((q, i) => <li key={i}>• {q}</li>)}</ul>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}

            {phase === "results" && evaluation && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                    <div className="flex flex-col items-center gap-3 py-4">
                        <div className={`text-5xl font-black ${scoreColor(evaluation.score)}`}>{evaluation.score}</div>
                        <div className="h-2 w-full max-w-xs rounded-full bg-muted overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${evaluation.score}%` }} transition={{ duration: 0.8 }} className={`h-full rounded-full bg-gradient-to-r ${scoreGrad(evaluation.score)}`} />
                        </div>
                        <p className="text-xs text-muted-foreground">Requirement Extraction Score</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {[{ v: evaluation.questionsAsked, l: "Questions" }, { v: evaluation.constraintsUncovered, l: "Uncovered" }, { v: evaluation.totalConstraints, l: "Total" }].map(({ v, l }) => (
                            <div key={l} className="p-3 rounded-xl bg-muted/30 border border-border/50 text-center">
                                <p className="text-lg font-bold text-foreground">{v}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{l}</p>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                        <p className="text-sm text-foreground/90 leading-relaxed">{evaluation.feedback}</p>
                    </div>
                    {evaluation.missedAreas.length > 0 && (
                        <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1.5">Areas You Missed</p>
                            <ul className="text-xs text-foreground/80 space-y-1">{evaluation.missedAreas.map((a, i) => <li key={i} className="flex items-start gap-1.5"><XCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />{a}</li>)}</ul>
                        </div>
                    )}
                    <div className="flex items-center justify-center gap-3 pt-2">
                        <Button onClick={() => onRate(evaluation.suggestedRating)} className="rounded-full px-6 py-5 font-semibold bg-indigo-500 hover:bg-indigo-600 text-white gap-2">
                            <CheckCircle2 className="w-4 h-4" />Accept Rating: {evaluation.suggestedRating}
                        </Button>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}
