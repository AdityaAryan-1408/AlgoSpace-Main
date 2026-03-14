'use client';

import { useState, useEffect } from "react";
import { Trophy, Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const STORAGE_KEY = "algotrack-contests";

export interface ContestEntry {
    id: string;
    name: string;
    date: string;
    platform: "LeetCode" | "Codeforces" | "CodeChef" | "Other";
    rank?: number;
    solved: number;
    total: number;
    rating?: number;
    url?: string;
}

export function ContestTracker() {
    const [contests, setContests] = useState<ContestEntry[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        name: "",
        date: new Date().toISOString().split("T")[0],
        platform: "LeetCode" as ContestEntry["platform"],
        rank: "",
        solved: "",
        total: "4",
        rating: "",
        url: "",
    });

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setContests(JSON.parse(saved));
            } catch { /* empty */ }
        }
    }, []);

    const save = (updated: ContestEntry[]) => {
        setContests(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    };

    const handleAdd = () => {
        if (!form.name.trim() || !form.solved) return;
        const entry: ContestEntry = {
            id: Date.now().toString(),
            name: form.name.trim(),
            date: form.date,
            platform: form.platform,
            rank: form.rank ? parseInt(form.rank) : undefined,
            solved: parseInt(form.solved) || 0,
            total: parseInt(form.total) || 4,
            rating: form.rating ? parseInt(form.rating) : undefined,
            url: form.url.trim() || undefined,
        };
        save([entry, ...contests]);
        setForm({ name: "", date: new Date().toISOString().split("T")[0], platform: "LeetCode", rank: "", solved: "", total: "4", rating: "", url: "" });
        setShowForm(false);
    };

    const handleDelete = (id: string) => {
        save(contests.filter((c) => c.id !== id));
    };

    const totalSolved = contests.reduce((s, c) => s + c.solved, 0);
    const avgSolveRate =
        contests.length > 0
            ? Math.round(
                contests.reduce((s, c) => s + (c.solved / c.total) * 100, 0) /
                contests.length,
            )
            : 0;

    const inputCls =
        "w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground";

    return (
        <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-semibold text-foreground">
                        Contest History
                        {contests.length > 0 && (
                            <span className="text-xs text-muted-foreground font-normal ml-2">
                                {contests.length} contest{contests.length !== 1 ? "s" : ""} • {totalSolved} solved • {avgSolveRate}% avg
                            </span>
                        )}
                    </h3>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowForm(!showForm)}
                    className="gap-1 text-muted-foreground hover:text-foreground"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Log
                </Button>
            </div>

            {/* Add form */}
            {showForm && (
                <div className="mb-4 p-3 rounded-lg border border-border bg-muted/20 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="Contest name (e.g. Weekly Contest 432)"
                            className={`${inputCls} col-span-2`}
                        />
                        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
                        <select
                            value={form.platform}
                            onChange={(e) => setForm({ ...form, platform: e.target.value as ContestEntry["platform"] })}
                            className={inputCls}
                        >
                            <option value="LeetCode">LeetCode</option>
                            <option value="Codeforces">Codeforces</option>
                            <option value="CodeChef">CodeChef</option>
                            <option value="Other">Other</option>
                        </select>
                        <input type="number" value={form.solved} onChange={(e) => setForm({ ...form, solved: e.target.value })} placeholder="Solved" className={inputCls} />
                        <input type="number" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} placeholder="Total problems" className={inputCls} />
                        <input type="number" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} placeholder="Rank (optional)" className={inputCls} />
                        <input type="number" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} placeholder="Rating (optional)" className={inputCls} />
                        <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="Contest URL (optional)" className={`${inputCls} col-span-2`} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleAdd} disabled={!form.name.trim() || !form.solved} className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-4">
                            Add Contest
                        </Button>
                    </div>
                </div>
            )}

            {/* Contest list */}
            {contests.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                    No contests logged yet. Click &quot;Log&quot; to add your first contest.
                </p>
            ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {contests.map((c) => (
                        <div
                            key={c.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors group"
                        >
                            <div className="flex flex-col gap-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-foreground truncate">
                                        {c.name}
                                    </span>
                                    <Badge className="text-[9px] uppercase tracking-wide shrink-0">
                                        {c.platform}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span>{c.date}</span>
                                    <span className="font-semibold text-foreground">
                                        {c.solved}/{c.total} solved
                                    </span>
                                    {c.rank && <span>Rank #{c.rank}</span>}
                                    {c.rating && <span>Rating: {c.rating}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {c.url && (
                                    <a
                                        href={c.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-muted-foreground hover:text-foreground p-1"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                )}
                                <button
                                    onClick={() => handleDelete(c.id)}
                                    className="text-muted-foreground hover:text-red-500 p-1"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
