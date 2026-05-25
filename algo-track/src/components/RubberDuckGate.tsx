'use client';

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { MessageSquare, Send, Loader2, Lock, Unlock, Sparkles, HelpCircle, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Flashcard } from "@/data";

interface RubberDuckGateProps {
    card: Flashcard;
    onUnlock: () => void;
}

interface ChatMsg {
    role: "user" | "assistant";
    content: string;
    verdict?: string;
    hints?: string[];
    approved?: boolean;
}

export function RubberDuckGate({ card, onUnlock }: RubberDuckGateProps) {
    const [messages, setMessages] = useState<ChatMsg[]>([
        {
            role: "assistant",
            content: `Quack! 🦆 I'm your Rubber Duck Logic Gate. Since this is a **Hard** difficulty challenge, your editor is locked. Before you start typing syntax, you must explain your intended approach to me in plain English! Tell me:\n\n1. What data structures you plan to use.\n2. Your high-level logical strategy.\n3. The expected Time and Space complexity.\n\nOnce I approve your logic, the editor will unlock!`,
        }
    ]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState("");
    const [approved, setApproved] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const getSavedSolution = () => {
        if (card.solutions && card.solutions.length > 0) {
            return card.solutions.map((s) => `## ${s.name}\n${s.content}`).join("\n\n");
        }
        return card.solution || "";
    };

    const handleSend = async () => {
        if (!input.trim() || isSending || approved) return;
        const userMsg = input.trim();
        setInput("");
        setIsSending(true);
        setError("");

        const updatedHistory = [...messages, { role: "user" as const, content: userMsg }];
        setMessages(updatedHistory);

        try {
            const apiHistory = updatedHistory.slice(1, -1).map(m => ({ role: m.role, content: m.content }));

            const res = await fetch("/api/evaluate/rubber-duck", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    problemTitle: card.title,
                    problemDescription: card.description,
                    savedSolution: getSavedSolution(),
                    savedNotes: card.notes,
                    userExplanation: userMsg,
                    conversationHistory: apiHistory,
                }),
            });

            if (!res.ok) {
                throw new Error("Logic evaluation failed.");
            }

            const result = await res.json();
            
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: result.feedback,
                    verdict: result.verdict,
                    hints: result.hints,
                    approved: result.approved,
                }
            ]);

            if (result.approved) {
                setApproved(true);
                // Satisfying delay for confetti/unlock action
                setTimeout(() => {
                    onUnlock();
                }, 2500);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Duck had an error processing. Try again!");
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: "Quack... I had some internet bubbles. Let's try that explanation again!",
                }
            ]);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-card/40 border border-border/80 rounded-2xl overflow-hidden backdrop-blur-md shadow-2xl">
            {/* Header */}
            <div className="px-4 py-3 bg-muted/30 border-b border-border/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <span className="text-2xl animate-bounce duration-1000 inline-block">🦆</span>
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-foreground flex items-center gap-1.5">
                            Rubber Duck Gate
                            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold uppercase tracking-wider">Hard Mode</span>
                        </h4>
                        <p className="text-[10px] text-muted-foreground">Explain logic to unlock editor</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {approved ? (
                        <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                            <Unlock className="w-3.5 h-3.5 animate-pulse" />
                            Approved
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 text-amber-500 text-xs font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                            <Lock className="w-3.5 h-3.5" />
                            Locked
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                        >
                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${
                                msg.role === "user" 
                                    ? "bg-blue-500/10 border-blue-500/20 text-blue-500" 
                                    : msg.approved 
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                                        : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                            }`}>
                                {msg.role === "user" ? "👤" : "🦆"}
                            </div>

                            {/* Message Container */}
                            <div className="flex flex-col gap-1 max-w-[80%]">
                                <div className={`p-3.5 rounded-2xl text-xs leading-relaxed border shadow-sm ${
                                    msg.role === "user"
                                        ? "bg-blue-500/5 border-blue-500/20 text-foreground/90 rounded-tr-none"
                                        : msg.approved
                                            ? "bg-emerald-500/5 border-emerald-500/20 text-foreground/90 rounded-tl-none"
                                            : "bg-muted/35 border-border/50 text-foreground/90 rounded-tl-none"
                                }`}>
                                    {/* Verdict badge for AI reviews */}
                                    {msg.verdict && (
                                        <div className={`mb-2 font-bold flex items-center gap-1.5 ${
                                            msg.approved ? "text-emerald-400" : "text-amber-500"
                                        }`}>
                                            {msg.approved ? <Sparkles className="w-3.5 h-3.5" /> : <HelpCircle className="w-3.5 h-3.5" />}
                                            {msg.verdict}
                                        </div>
                                    )}
                                    <div className="whitespace-pre-wrap">{msg.content}</div>

                                    {/* Hints list if present */}
                                    {msg.hints && msg.hints.length > 0 && (
                                        <div className="mt-3 pt-2.5 border-t border-border/50 space-y-1.5">
                                            <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest block">Duck Hints</span>
                                            {msg.hints.map((hint, hIdx) => (
                                                <div key={hIdx} className="text-[11px] text-muted-foreground bg-amber-500/5 border border-amber-500/10 p-2 rounded-lg leading-relaxed">
                                                    💡 {hint}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Sending bubbles indicator */}
                {isSending && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">🦆</div>
                        <div className="p-3 rounded-2xl bg-muted/40 border border-border/50 rounded-tl-none">
                            <div className="flex gap-1.5 items-center py-1 px-0.5">
                                {[0, 150, 300].map(d => (
                                    <span 
                                        key={d} 
                                        className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" 
                                        style={{ animationDelay: `${d}ms` }} 
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div ref={chatEndRef} />
            </div>

            {/* Locked screen celebration overlay */}
            <AnimatePresence>
                {approved && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="absolute inset-0 bg-emerald-950/85 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 z-10"
                    >
                        <motion.div 
                            initial={{ scale: 0.5, rotate: -20 }}
                            animate={{ scale: [1, 1.2, 1], rotate: [0, 10, 0] }}
                            transition={{ duration: 0.6 }}
                            className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-4 text-3xl shadow-[0_0_30px_rgba(16,185,129,0.3)] text-emerald-400"
                        >
                            🎉
                        </motion.div>
                        <h4 className="text-lg font-black text-emerald-400 tracking-tight flex items-center gap-1.5">
                            Logic Approved!
                            <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
                        </h4>
                        <p className="text-xs text-indigo-200 mt-2 max-w-xs leading-relaxed">
                            Excellent work. Your approach is mathematically correct. Unlocking the editor code view now...
                        </p>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: "80%" }}
                            transition={{ duration: 1.8, ease: "easeInOut" }}
                            className="h-1 bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full mt-5"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error Message */}
            {error && (
                <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/25 text-red-500 text-[11px] font-medium flex items-center gap-1.5">
                    ⚠️ {error}
                </div>
            )}

            {/* Textarea Input area */}
            <div className="p-3 bg-muted/15 border-t border-border/80 flex items-center gap-2">
                <textarea
                    rows={2}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isSending || approved}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="Type your explanation here... (e.g. 'I will use a Hashmap to store frequencies, then iterate through...')"
                    className="flex-1 px-3 py-2 rounded-xl border border-border/80 bg-background text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 placeholder:text-muted-foreground resize-none leading-relaxed transition-all"
                />
                <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isSending || approved}
                    className="h-10 w-10 shrink-0 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center p-0"
                >
                    {isSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <ArrowRight className="w-4.5 h-4.5" />
                    )}
                </Button>
            </div>
        </div>
    );
}
