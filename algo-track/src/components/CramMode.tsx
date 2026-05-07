'use client';

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Flashcard } from "@/data";
import { Building2, Loader2, AlertTriangle, Calendar, ArrowRight, Target, BookOpen, Zap, Clock, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CramModeProps {
    cards: Flashcard[];
    onStartReview: (cardIds: string[]) => void;
    onExit: () => void;
}

interface CramAnalysis {
    companyProfile: string;
    prioritizedTags: string[];
    tagRelevance: Array<{ tag: string; relevance: "high" | "medium" | "low"; reason: string }>;
    missingTopics: string[];
    studyPlan: string;
    focusAreas: string[];
}

const POPULAR_COMPANIES = [
    "Google", "Meta", "Amazon", "Apple", "Microsoft",
    "Netflix", "Uber", "Airbnb", "Stripe", "Bloomberg",
    "Goldman Sachs", "JP Morgan", "Coinbase", "Databricks", "Palantir",
];

export function CramMode({ cards, onStartReview, onExit }: CramModeProps) {
    const [phase, setPhase] = useState<"setup" | "loading" | "plan">("setup");
    const [company, setCompany] = useState("");
    const [daysUntil, setDaysUntil] = useState(7);
    const [analysis, setAnalysis] = useState<CramAnalysis | null>(null);
    const [error, setError] = useState("");

    const dsaCards = useMemo(() => cards.filter(c => c.type === "leetcode"), [cards]);
    const allTags = useMemo(() => {
        const tags = new Set<string>();
        dsaCards.forEach(c => c.tags.forEach(t => tags.add(t)));
        return Array.from(tags);
    }, [dsaCards]);

    const handleAnalyze = async () => {
        if (!company.trim()) return;
        setPhase("loading");
        setError("");

        try {
            const res = await fetch("/api/evaluate/cram-mode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    company: company.trim(),
                    daysUntilInterview: daysUntil,
                    cardTitles: dsaCards.map(c => c.title),
                    cardTags: allTags,
                }),
            });
            if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
            const result: CramAnalysis = await res.json();
            setAnalysis(result);
            setPhase("plan");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Analysis failed");
            setPhase("setup");
        }
    };

    // Build prioritized card list from analysis
    const prioritizedCards = useMemo(() => {
        if (!analysis) return [];

        const tagPriority = new Map<string, number>();
        analysis.tagRelevance.forEach(({ tag, relevance }) => {
            tagPriority.set(tag.toLowerCase(), relevance === "high" ? 3 : relevance === "medium" ? 2 : 1);
        });
        analysis.prioritizedTags.forEach((tag, i) => {
            const key = tag.toLowerCase();
            if (!tagPriority.has(key)) tagPriority.set(key, Math.max(1, 3 - Math.floor(i / 3)));
        });

        return dsaCards
            .map(card => {
                let score = 0;
                card.tags.forEach(t => { score += tagPriority.get(t.toLowerCase()) || 0; });
                // Boost due cards
                if (card.dueInDays <= 0) score += 2;
                // Boost cards with weaker ratings
                if (card.lastRating === "AGAIN" || card.lastRating === "HARD") score += 1;
                return { card, score };
            })
            .filter(c => c.score > 0)
            .sort((a, b) => b.score - a.score);
    }, [analysis, dsaCards]);

    const relevanceColor = (r: string) =>
        r === "high" ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" :
        r === "medium" ? "text-amber-500 bg-amber-500/10 border-amber-500/20" :
        "text-muted-foreground bg-muted border-border";

    return (
        <div className="w-full max-w-3xl mx-auto p-4 md:p-8 flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-lg">
                        <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Cram Mode</h2>
                        <p className="text-[10px] text-muted-foreground">Company-specific interview prep</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={onExit} className="text-muted-foreground">Exit</Button>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm text-red-500">{error}</span>
                </div>
            )}

            {/* Setup Phase */}
            {phase === "setup" && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
                    <div className="flex flex-col items-center gap-4 py-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
                            <Building2 className="w-8 h-8 text-rose-500" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-foreground mb-1">Interview Cram Mode</h3>
                            <p className="text-sm text-muted-foreground max-w-md">
                                Enter your target company and interview date. The AI will analyze the company&apos;s
                                interview patterns and prioritize your existing cards accordingly.
                            </p>
                        </div>
                    </div>

                    {/* Company input */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company</label>
                        <input
                            value={company}
                            onChange={e => setCompany(e.target.value)}
                            placeholder="e.g., Google, Meta, Amazon..."
                            className="px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                        />
                        <div className="flex flex-wrap gap-1.5">
                            {POPULAR_COMPANIES.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setCompany(c)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                        company === c
                                            ? "bg-rose-500/10 text-rose-500 border border-rose-500/30"
                                            : "text-muted-foreground hover:text-foreground bg-muted/30 border border-border"
                                    }`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Days input */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Days Until Interview</label>
                        <div className="flex items-center gap-3">
                            {[3, 5, 7, 14, 30].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDaysUntil(d)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                                        daysUntil === d
                                            ? "bg-rose-500/10 text-rose-500 border border-rose-500/30"
                                            : "text-muted-foreground hover:text-foreground bg-muted/30 border border-border"
                                    }`}
                                >
                                    {d}d
                                </button>
                            ))}
                            <input
                                type="number"
                                value={daysUntil}
                                onChange={e => setDaysUntil(Math.max(1, Number(e.target.value)))}
                                min={1}
                                max={90}
                                className="w-16 px-2 py-2 rounded-lg border border-border bg-background text-foreground text-sm text-center focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                            />
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{dsaCards.length} DSA cards • {allTags.length} tags</span>
                        <span className="text-xs text-muted-foreground">{dsaCards.filter(c => c.dueInDays <= 0).length} due now</span>
                    </div>

                    <Button
                        onClick={handleAnalyze}
                        disabled={!company.trim()}
                        className="rounded-full px-8 py-5 text-base font-bold bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white gap-2 shadow-lg self-center"
                    >
                        <Target className="w-5 h-5" />
                        Analyze & Build Plan
                    </Button>
                </motion.div>
            )}

            {/* Loading */}
            {phase === "loading" && (
                <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                    <p className="text-sm text-muted-foreground">Analyzing {company}&apos;s interview patterns...</p>
                </div>
            )}

            {/* Plan Phase */}
            {phase === "plan" && analysis && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
                    {/* Company Profile */}
                    <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-4 h-4 text-rose-500" />
                            <span className="text-sm font-bold text-rose-500">{company}</span>
                            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {daysUntil} days left
                            </span>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed">{analysis.companyProfile}</p>
                    </div>

                    {/* Focus Areas */}
                    <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5 text-rose-500" /> Focus Areas
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {analysis.focusAreas.map((area, i) => (
                                <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                    {area}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Tag Relevance */}
                    <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-rose-500" /> Topic Relevance
                        </h4>
                        <div className="flex flex-col gap-1.5">
                            {analysis.tagRelevance.slice(0, 10).map(({ tag, relevance, reason }, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border/50">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${relevanceColor(relevance)}`}>
                                        {relevance}
                                    </span>
                                    <span className="text-sm font-medium text-foreground">{tag}</span>
                                    <span className="text-xs text-muted-foreground ml-auto truncate max-w-[200px]">{reason}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Missing Topics */}
                    {analysis.missingTopics.length > 0 && (
                        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                            <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Missing Topics
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                                {analysis.missingTopics.map((topic, i) => (
                                    <span key={i} className="px-2 py-1 rounded-md text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        {topic}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Study Plan */}
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> Study Plan
                        </h4>
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{analysis.studyPlan}</p>
                    </div>

                    {/* Prioritized Cards */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-rose-500" /> Prioritized Cards ({prioritizedCards.length})
                            </h4>
                        </div>
                        <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-card max-h-60 overflow-y-auto">
                            {prioritizedCards.slice(0, 15).map(({ card, score }, i) => (
                                <div key={card.id} className={`px-4 py-2.5 flex items-center justify-between text-sm ${i !== Math.min(14, prioritizedCards.length - 1) ? "border-b border-border" : ""}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-muted-foreground w-5">{i + 1}</span>
                                        <span className="text-xs text-foreground/80 truncate max-w-[200px]">{card.title}</span>
                                        <Badge variant={card.difficulty} className="capitalize bg-transparent border-current text-current text-[9px] px-1.5 py-0">
                                            {card.difficulty}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {card.dueInDays <= 0 ? (
                                            <span className="text-[10px] font-bold text-medium">Due now</span>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground">in {card.dueInDays}d</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-center gap-3 pt-2">
                        <Button variant="outline" onClick={() => setPhase("setup")} className="rounded-full px-5">
                            Change Company
                        </Button>
                        <Button
                            onClick={() => onStartReview(prioritizedCards.map(c => c.card.id))}
                            disabled={prioritizedCards.length === 0}
                            className="rounded-full px-6 py-5 font-semibold bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white gap-2 shadow-lg"
                        >
                            <Zap className="w-4 h-4" />
                            Start Cram Review ({prioritizedCards.length} cards)
                        </Button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
