'use client';

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Plus, Loader2, Github } from "lucide-react";
import { createCard } from "@/lib/client-api";
import type { Difficulty, CardType } from "@/data";

export interface AddCardFormDefaults {
    type?: CardType;
    title?: string;
    url?: string;
    description?: string;
    difficulty?: Difficulty;
    tags?: string;
    notes?: string;
    solution?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
    relatedProblems?: string;
    bruteForceSolution?: string;
    optimalSolution?: string;
    alternativeSolution?: string;
}

interface AddCardFormProps {
    cardType: CardType;
    defaults?: AddCardFormDefaults;
    onSubmitted: () => void;
    submitLabel?: string;
}

export function AddCardForm({
    cardType,
    defaults,
    onSubmitted,
    submitLabel = "Add Card",
}: AddCardFormProps) {
    const [title, setTitle] = useState(defaults?.title ?? "");
    const [description, setDescription] = useState(defaults?.description ?? "");
    const [difficulty, setDifficulty] = useState<Difficulty>(
        defaults?.difficulty ?? "medium",
    );
    const [platform, setPlatform] = useState("LeetCode");
    const [url, setUrl] = useState(defaults?.url ?? "");
    const [notes, setNotes] = useState(defaults?.notes ?? "");
    const [bruteForceSolution, setBruteForceSolution] = useState(
        defaults?.bruteForceSolution ?? "",
    );
    const [optimalSolution, setOptimalSolution] = useState(
        defaults?.optimalSolution ?? defaults?.solution ?? "",
    );
    const [alternativeSolution, setAlternativeSolution] = useState(
        defaults?.alternativeSolution ?? "",
    );
    const [timeComplexity, setTimeComplexity] = useState(
        defaults?.timeComplexity ?? "",
    );
    const [spaceComplexity, setSpaceComplexity] = useState(
        defaults?.spaceComplexity ?? "",
    );
    const [relatedProblemsInput, setRelatedProblemsInput] = useState(
        defaults?.relatedProblems ?? "",
    );
    const [tagsInput, setTagsInput] = useState(defaults?.tags ?? "");
    const [solutionTab, setSolutionTab] = useState<"brute" | "optimal" | "alternative">("optimal");
    const [reviewInDays, setReviewInDays] = useState(0);
    const [customDays, setCustomDays] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [syncStatus, setSyncStatus] = useState<"" | "syncing" | "synced" | "failed">("");

    const handleSubmit = async () => {
        if (!title.trim() || !description.trim()) {
            setError("Title and description are required.");
            return;
        }
        setIsSubmitting(true);
        setError("");

        try {
            const tags = tagsInput
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
            const solutions = [
                {
                    name: "Brute Force",
                    content: bruteForceSolution.trim(),
                },
                {
                    name: "Optimal",
                    content: optimalSolution.trim(),
                },
                {
                    name: "Alternative",
                    content: alternativeSolution.trim(),
                },
            ].filter((item) => item.content);

            const relatedProblems = relatedProblemsInput
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                    const [maybeTitle, maybeUrl] = line.split("|").map((part) => part.trim());
                    if (maybeUrl) {
                        return { title: maybeTitle || maybeUrl, url: maybeUrl };
                    }
                    if (/^https?:\/\//i.test(maybeTitle)) {
                        return { title: maybeTitle, url: maybeTitle };
                    }
                    return { title: maybeTitle };
                });

            const finalDays =
                reviewInDays === -1 ? parseInt(customDays) || 0 : reviewInDays;

            await createCard({
                type: cardType,
                title: title.trim(),
                description: description.trim(),
                difficulty,
                tags: tags.length > 0 ? tags : undefined,
                notes: notes.trim() || undefined,
                solution:
                    cardType === "leetcode" && solutions[0]?.content
                        ? solutions[0].content
                        : undefined,
                solutions: cardType === "leetcode" && solutions.length > 0 ? solutions : undefined,
                timeComplexity:
                    cardType === "leetcode" && timeComplexity.trim()
                        ? timeComplexity.trim()
                        : undefined,
                spaceComplexity:
                    cardType === "leetcode" && spaceComplexity.trim()
                        ? spaceComplexity.trim()
                        : undefined,
                relatedProblems:
                    cardType === "leetcode" && relatedProblems.length > 0
                        ? relatedProblems
                        : undefined,
                url:
                    cardType === "leetcode" && url.trim() ? url.trim() : undefined,
                reviewInDays: finalDays > 0 ? finalDays : undefined,
            });

            // Fire-and-forget GitHub sync for DSA cards with solutions
            if (cardType === "leetcode" && solutions.length > 0) {
                setSyncStatus("syncing");
                fetch("/api/github-sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: title.trim(),
                        platform,
                        url: url.trim() || undefined,
                        difficulty,
                        tags,
                        solutions,
                        timeComplexity: timeComplexity.trim() || undefined,
                        spaceComplexity: spaceComplexity.trim() || undefined,
                    }),
                })
                    .then((r) => r.json())
                    .then((data) => setSyncStatus(data.synced ? "synced" : "failed"))
                    .catch(() => setSyncStatus("failed"));
            }

            onSubmitted();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to create card.",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputCls =
        "w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground";

    return (
        <div className="flex flex-col gap-5">
            {error && (
                <div className="p-3 rounded-lg bg-hard-bg text-hard text-sm font-medium">
                    {error}
                </div>
            )}

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Title *</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                        cardType === "leetcode"
                            ? "e.g. Two Sum"
                            : "e.g. ACID Properties"
                    }
                    className={inputCls}
                />
            </div>

            {cardType === "leetcode" && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Platform
                        </label>
                        <select
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value)}
                            className={inputCls + " cursor-pointer"}
                        >
                            <option value="LeetCode">LeetCode</option>
                            <option value="GeeksForGeeks">GeeksForGeeks</option>
                            <option value="Codeforces">Codeforces</option>
                            <option value="CodeChef">CodeChef</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Problem Link
                        </label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://..."
                            className={inputCls}
                        />
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                    Description *
                </label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                        cardType === "leetcode"
                            ? "Problem statement..."
                            : "Concept explanation..."
                    }
                    rows={4}
                    className={`${inputCls} resize-y`}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                    Difficulty *
                </label>
                <div className="flex gap-2">
                    {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                        <button
                            key={d}
                            onClick={() => setDifficulty(d)}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium capitalize transition-all cursor-pointer ${difficulty === d
                                ? d === "easy"
                                    ? "bg-easy-bg text-easy border-easy/40"
                                    : d === "medium"
                                        ? "bg-medium-bg text-medium border-medium/40"
                                        : "bg-hard-bg text-hard border-hard/40"
                                : "border-border text-muted-foreground hover:border-foreground/30"
                                }`}
                        >
                            {d}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Tags</label>
                <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="Comma-separated: Array, Sliding Window, DP"
                    className={inputCls}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Notes</label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Markdown supported. Add notes, intuitions, examples, and fenced code blocks."
                    rows={3}
                    className={`${inputCls} resize-y`}
                />
            </div>

            {cardType === "leetcode" && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground">
                                Time Complexity
                            </label>
                            <input
                                type="text"
                                value={timeComplexity}
                                onChange={(e) => setTimeComplexity(e.target.value)}
                                placeholder="e.g. O(n log n)"
                                className={inputCls}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground">
                                Space Complexity
                            </label>
                            <input
                                type="text"
                                value={spaceComplexity}
                                onChange={(e) => setSpaceComplexity(e.target.value)}
                                placeholder="e.g. O(1)"
                                className={inputCls}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Solutions
                        </label>
                        {/* Solution Tabs */}
                        <div className="flex border-b border-border">
                            {(
                                [
                                    { key: "brute", label: "Brute Force" },
                                    { key: "optimal", label: "Optimal" },
                                    { key: "alternative", label: "Alternative" },
                                ] as const
                            ).map((tab) => {
                                const isActive = solutionTab === tab.key;
                                const hasContent =
                                    tab.key === "brute"
                                        ? bruteForceSolution.trim()
                                        : tab.key === "optimal"
                                            ? optimalSolution.trim()
                                            : alternativeSolution.trim();
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setSolutionTab(tab.key)}
                                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-all cursor-pointer ${isActive
                                            ? "border-blue-500 text-blue-500"
                                            : "border-transparent text-muted-foreground hover:text-foreground"
                                            }`}
                                    >
                                        {tab.label}
                                        {hasContent && !isActive && (
                                            <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {/* Tab Content */}
                        {solutionTab === "brute" && (
                            <textarea
                                value={bruteForceSolution}
                                onChange={(e) => setBruteForceSolution(e.target.value)}
                                placeholder="Brute force approach (Markdown + code fences supported)"
                                rows={6}
                                spellCheck={false}
                                className={`${inputCls} font-mono bg-muted/50 resize-y`}
                            />
                        )}
                        {solutionTab === "optimal" && (
                            <textarea
                                value={optimalSolution}
                                onChange={(e) => setOptimalSolution(e.target.value)}
                                placeholder="Optimal approach (Markdown + code fences supported)"
                                rows={6}
                                spellCheck={false}
                                className={`${inputCls} font-mono bg-muted/50 resize-y`}
                            />
                        )}
                        {solutionTab === "alternative" && (
                            <textarea
                                value={alternativeSolution}
                                onChange={(e) => setAlternativeSolution(e.target.value)}
                                placeholder="Alternative approach (Markdown + code fences supported)"
                                rows={6}
                                spellCheck={false}
                                className={`${inputCls} font-mono bg-muted/50 resize-y`}
                            />
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Related Problems
                        </label>
                        <textarea
                            value={relatedProblemsInput}
                            onChange={(e) => setRelatedProblemsInput(e.target.value)}
                            placeholder={"One per line. Use: Title | https://url\nExample: 3Sum | https://leetcode.com/problems/3sum/"}
                            rows={3}
                            className={`${inputCls} resize-y`}
                        />
                    </div>
                </>
            )}

            {/* First Review Timing */}
            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                    First Review In
                </label>
                <div className="flex gap-2 flex-wrap">
                    {[
                        { label: "Now", value: 0 },
                        { label: "1 day", value: 1 },
                        { label: "3 days", value: 3 },
                        { label: "7 days", value: 7 },
                        { label: "Custom", value: -1 },
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setReviewInDays(opt.value)}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer ${reviewInDays === opt.value
                                ? "bg-blue-500/10 text-blue-500 border-blue-500/40"
                                : "border-border text-muted-foreground hover:border-foreground/30"
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                {reviewInDays === -1 && (
                    <div className="flex items-center gap-2 mt-1">
                        <input
                            type="number"
                            min="1"
                            value={customDays}
                            onChange={(e) => setCustomDays(e.target.value)}
                            placeholder="Number of days"
                            className={`${inputCls} max-w-50`}
                        />
                        <span className="text-sm text-muted-foreground">days</span>
                    </div>
                )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
                <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !title.trim() || !description.trim()}
                    className="gap-2 font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-full px-6"
                >
                    {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Plus className="w-4 h-4" />
                    )}
                    {isSubmitting ? "Adding..." : submitLabel}
                </Button>
            </div>
        </div>
    );
}
