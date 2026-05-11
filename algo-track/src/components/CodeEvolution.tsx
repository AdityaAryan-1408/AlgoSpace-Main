'use client';

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { GitCompare, ChevronDown, ChevronUp, Clock, ArrowRight, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useConfirmModal } from "@/components/ConfirmModal";

const EVOLUTION_KEY = "algotrack-code-evolution-";

export interface CodeSnapshot {
    code: string;
    timestamp: string;
    rating?: string;
}

export function getCodeEvolution(cardId: string): CodeSnapshot[] {
    try {
        const raw = localStorage.getItem(EVOLUTION_KEY + cardId);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveCodeSnapshot(cardId: string, code: string, rating?: string) {
    if (!code.trim()) return;
    const snapshots = getCodeEvolution(cardId);
    // Don't save duplicates (same code as last snapshot)
    if (snapshots.length > 0 && snapshots[snapshots.length - 1].code.trim() === code.trim()) return;
    snapshots.push({
        code: code.trim(),
        timestamp: new Date().toISOString(),
        rating,
    });
    // Keep at most 20 snapshots
    const trimmed = snapshots.slice(-20);
    try {
        localStorage.setItem(EVOLUTION_KEY + cardId, JSON.stringify(trimmed));
    } catch {
        // Storage full
    }
}

export function clearCodeEvolution(cardId: string) {
    localStorage.removeItem(EVOLUTION_KEY + cardId);
}

interface CodeEvolutionProps {
    cardId: string;
    cardTitle: string;
}

export function CodeEvolution({ cardId, cardTitle }: CodeEvolutionProps) {
    const [snapshots, setSnapshots] = useState<CodeSnapshot[]>([]);
    const [expanded, setExpanded] = useState(false);
    const [diffIndex, setDiffIndex] = useState<[number, number]>([0, -1]); // [left, right]

    useEffect(() => {
        const s = getCodeEvolution(cardId);
        setSnapshots(s);
        if (s.length >= 2) {
            setDiffIndex([0, s.length - 1]);
        }
    }, [cardId]);

    const { confirm: confirmModal } = useConfirmModal();

    const handleClear = async () => {
        const confirmed = await confirmModal({
            title: "Clear History",
            message: "Clear all code evolution history for this card?",
            confirmLabel: "Clear",
            variant: "warning",
        });
        if (!confirmed) return;
        clearCodeEvolution(cardId);
        setSnapshots([]);
    };

    if (snapshots.length < 2) return null;

    const leftSnapshot = snapshots[diffIndex[0]];
    const rightSnapshot = snapshots[diffIndex[1] === -1 ? snapshots.length - 1 : diffIndex[1]];

    const leftLines = leftSnapshot.code.split("\n");
    const rightLines = rightSnapshot.code.split("\n");

    // Simple line-by-line diff
    const maxLines = Math.max(leftLines.length, rightLines.length);
    const diffLines: Array<{
        left: string;
        right: string;
        type: "same" | "changed" | "added" | "removed";
    }> = [];

    for (let i = 0; i < maxLines; i++) {
        const l = leftLines[i];
        const r = rightLines[i];
        if (l === undefined && r !== undefined) {
            diffLines.push({ left: "", right: r, type: "added" });
        } else if (l !== undefined && r === undefined) {
            diffLines.push({ left: l, right: "", type: "removed" });
        } else if (l === r) {
            diffLines.push({ left: l, right: r, type: "same" });
        } else {
            diffLines.push({ left: l, right: r!, type: "changed" });
        }
    }

    const changedCount = diffLines.filter(d => d.type !== "same").length;
    const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    return (
        <div className="mt-4">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-teal-500" />
                    Code Evolution
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-500">
                        {snapshots.length} versions
                    </span>
                </div>
                {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-3 rounded-xl border border-border bg-card overflow-hidden">
                            {/* Version selector */}
                            <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-2 text-xs">
                                    <select
                                        value={diffIndex[0]}
                                        onChange={e => setDiffIndex([Number(e.target.value), diffIndex[1]])}
                                        className="px-2 py-1 rounded-md border border-border bg-background text-foreground text-xs cursor-pointer"
                                    >
                                        {snapshots.map((s, i) => (
                                            <option key={i} value={i}>
                                                v{i + 1} — {formatDate(s.timestamp)} {s.rating ? `(${s.rating})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                    <select
                                        value={diffIndex[1] === -1 ? snapshots.length - 1 : diffIndex[1]}
                                        onChange={e => setDiffIndex([diffIndex[0], Number(e.target.value)])}
                                        className="px-2 py-1 rounded-md border border-border bg-background text-foreground text-xs cursor-pointer"
                                    >
                                        {snapshots.map((s, i) => (
                                            <option key={i} value={i}>
                                                v{i + 1} — {formatDate(s.timestamp)} {s.rating ? `(${s.rating})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground">
                                        {changedCount} line{changedCount !== 1 ? "s" : ""} changed
                                    </span>
                                    <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs text-muted-foreground gap-1 hover:text-red-500">
                                        <Trash2 className="w-3 h-3" /> Clear
                                    </Button>
                                </div>
                            </div>

                            {/* Side-by-side diff */}
                            <div className="max-h-80 overflow-auto">
                                <table className="w-full text-xs font-mono border-collapse">
                                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                                        <tr>
                                            <th className="text-left px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-r border-border w-1/2">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    v{diffIndex[0] + 1} — {formatDate(leftSnapshot.timestamp)}
                                                </div>
                                            </th>
                                            <th className="text-left px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-1/2">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    v{(diffIndex[1] === -1 ? snapshots.length : diffIndex[1] + 1)} — {formatDate(rightSnapshot.timestamp)}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {diffLines.map((line, i) => (
                                            <tr key={i} className={
                                                line.type === "changed" ? "bg-amber-500/5" :
                                                line.type === "added" ? "bg-emerald-500/5" :
                                                line.type === "removed" ? "bg-red-500/5" : ""
                                            }>
                                                <td className={`px-3 py-0.5 border-r border-border whitespace-pre-wrap break-all ${
                                                    line.type === "removed" ? "text-red-500 line-through" :
                                                    line.type === "changed" ? "text-amber-600 dark:text-amber-400" :
                                                    "text-foreground/80"
                                                }`}>
                                                    {line.left || "\u00A0"}
                                                </td>
                                                <td className={`px-3 py-0.5 whitespace-pre-wrap break-all ${
                                                    line.type === "added" ? "text-emerald-600 dark:text-emerald-400" :
                                                    line.type === "changed" ? "text-emerald-600 dark:text-emerald-400" :
                                                    "text-foreground/80"
                                                }`}>
                                                    {line.right || "\u00A0"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Timeline */}
                            <div className="px-4 py-3 border-t border-border bg-muted/10">
                                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                                    {snapshots.map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                if (i < (diffIndex[1] === -1 ? snapshots.length - 1 : diffIndex[1])) {
                                                    setDiffIndex([i, diffIndex[1]]);
                                                } else {
                                                    setDiffIndex([diffIndex[0], i]);
                                                }
                                            }}
                                            className={`shrink-0 w-6 h-6 rounded-full text-[9px] font-bold transition-all cursor-pointer ${
                                                i === diffIndex[0] || i === (diffIndex[1] === -1 ? snapshots.length - 1 : diffIndex[1])
                                                    ? "bg-teal-500 text-white shadow-sm"
                                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                                            }`}
                                            title={`v${i + 1} — ${formatDate(s.timestamp)}${s.rating ? ` (${s.rating})` : ""}`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
