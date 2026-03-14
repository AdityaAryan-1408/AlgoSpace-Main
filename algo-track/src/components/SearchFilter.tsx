'use client';

import { useState, useMemo, useEffect } from "react";
import { Search, X, Filter } from "lucide-react";
import type { Flashcard, Difficulty } from "@/data";

interface Props {
    cards: Flashcard[];
    onFiltered: (cards: Flashcard[]) => void;
}

type StatusFilter = "all" | "due" | "upcoming";

export function SearchFilter({ cards, onFiltered }: Props) {
    const [query, setQuery] = useState("");
    const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
    const [status, setStatus] = useState<StatusFilter>("all");
    const [selectedTag, setSelectedTag] = useState<string>("all");
    const [showFilters, setShowFilters] = useState(false);

    // Get all unique tags
    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        cards.forEach((c) => c.tags.forEach((t) => tagSet.add(t)));
        return Array.from(tagSet).sort();
    }, [cards]);

    // Compute filtered results
    const filtered = useMemo(() => {
        let result = cards;

        // Text search
        if (query.trim()) {
            const q = query.toLowerCase();
            result = result.filter(
                (c) =>
                    c.title.toLowerCase().includes(q) ||
                    c.description.toLowerCase().includes(q) ||
                    c.tags.some((t) => t.toLowerCase().includes(q)),
            );
        }

        // Difficulty
        if (difficulty !== "all") {
            result = result.filter((c) => c.difficulty === difficulty);
        }

        // Status
        if (status === "due") {
            result = result.filter((c) => c.dueInDays <= 0);
        } else if (status === "upcoming") {
            result = result.filter((c) => c.dueInDays > 0);
        }

        // Tag
        if (selectedTag !== "all") {
            result = result.filter((c) => c.tags.includes(selectedTag));
        }

        return result;
    }, [cards, query, difficulty, status, selectedTag]);

    // Notify parent via effect (not during render)
    useEffect(() => {
        onFiltered(filtered);
    }, [filtered, onFiltered]);

    const hasActiveFilters =
        difficulty !== "all" || status !== "all" || selectedTag !== "all";

    return (
        <div className="mb-4 space-y-3">
            {/* Search bar */}
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search cards by title, description, or tag..."
                        className="w-full pl-10 pr-8 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                    />
                    {query && (
                        <button
                            onClick={() => setQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer flex items-center gap-1.5 ${hasActiveFilters || showFilters
                        ? "border-blue-500/40 text-blue-500 bg-blue-500/5"
                        : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                >
                    <Filter className="w-4 h-4" />
                    Filters
                    {hasActiveFilters && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                </button>
            </div>

            {/* Filter pills */}
            {showFilters && (
                <div className="flex flex-wrap gap-4 p-3 rounded-lg border border-border bg-muted/30">
                    {/* Difficulty */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                            Difficulty
                        </span>
                        <div className="flex gap-1">
                            {(["all", "easy", "medium", "hard"] as const).map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setDifficulty(d)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer capitalize ${difficulty === d
                                        ? d === "easy"
                                            ? "bg-easy/10 text-easy"
                                            : d === "medium"
                                                ? "bg-medium/10 text-medium"
                                                : d === "hard"
                                                    ? "bg-hard/10 text-hard"
                                                    : "bg-blue-500/10 text-blue-500"
                                        : "text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                            Status
                        </span>
                        <div className="flex gap-1">
                            {(
                                [
                                    { key: "all", label: "All" },
                                    { key: "due", label: "Due Now" },
                                    { key: "upcoming", label: "Upcoming" },
                                ] as const
                            ).map((s) => (
                                <button
                                    key={s.key}
                                    onClick={() => setStatus(s.key)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${status === s.key
                                        ? "bg-blue-500/10 text-blue-500"
                                        : "text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tag */}
                    {allTags.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                Tag
                            </span>
                            <select
                                value={selectedTag}
                                onChange={(e) => setSelectedTag(e.target.value)}
                                className="px-2.5 py-1 rounded-md text-xs font-medium bg-background border border-border text-foreground cursor-pointer"
                            >
                                <option value="all">All tags</option>
                                {allTags.map((tag) => (
                                    <option key={tag} value={tag}>
                                        {tag}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {hasActiveFilters && (
                        <button
                            onClick={() => {
                                setDifficulty("all");
                                setStatus("all");
                                setSelectedTag("all");
                            }}
                            className="self-end text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
