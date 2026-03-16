'use client';

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Plus, Loader2, Github, X } from "lucide-react";
import { createCard, updateCard } from "@/lib/client-api";
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
    solutions?: { name: string; content: string }[];
    timeComplexity?: string;
    spaceComplexity?: string;
    relatedProblems?: string;
}

interface AddCardFormProps {
    cardType: CardType;
    defaults?: AddCardFormDefaults;
    onSubmitted: () => void;
    submitLabel?: string;
    mode?: "add" | "edit";
    cardId?: string;
}

export function AddCardForm({
    cardType,
    defaults,
    onSubmitted,
    submitLabel = "Add Card",
    mode = "add",
    cardId,
}: AddCardFormProps) {
    const [title, setTitle] = useState(defaults?.title ?? "");
    const [description, setDescription] = useState(defaults?.description ?? "");
    const [difficulty, setDifficulty] = useState<Difficulty>(
        defaults?.difficulty ?? "medium",
    );
    const [platform, setPlatform] = useState("LeetCode");
    const [url, setUrl] = useState(defaults?.url ?? "");
    const [notes, setNotes] = useState(defaults?.notes ?? "");
    const [solutions, setSolutions] = useState<{ id: string; name: string; content: string }[]>(
        defaults?.solutions?.length 
            ? defaults.solutions.map((s, i) => ({ id: `sol-${Date.now()}-${i}`, name: s.name, content: s.content }))
            : [
                  { id: `brute-${Date.now()}`, name: "Brute Force", content: "" },
                  { id: `optimal-${Date.now()}`, name: "Optimal", content: defaults?.solution ?? "" },
                  { id: `alt-${Date.now()}`, name: "Alternative", content: "" },
              ]
    );
    const [activeTabId, setActiveTabId] = useState(solutions[1]?.id || solutions[0]?.id);
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
            const compiledSolutions = solutions
                .filter(item => item.content.trim())
                .map(item => ({ name: item.name.trim() || "Solution", content: item.content.trim() }));

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

            const payload = {
                title: title.trim(),
                description: description.trim(),
                difficulty,
                tags: tags.length > 0 ? tags : undefined,
                notes: notes.trim() || undefined,
                solution:
                    cardType === "leetcode" && compiledSolutions[0]?.content
                        ? compiledSolutions[0].content
                        : undefined,
                solutions: cardType === "leetcode" && compiledSolutions.length > 0 ? compiledSolutions : undefined,
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
            };

            if (mode === "edit" && cardId) {
                await updateCard(cardId, payload);
            } else {
                await createCard({
                    type: cardType,
                    ...payload,
                    reviewInDays: finalDays > 0 ? finalDays : undefined,
                });
            }

            // Fire-and-forget GitHub sync for DSA cards with solutions
            if (cardType === "leetcode" && compiledSolutions.length > 0 && mode !== "edit") {
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
                        solutions: compiledSolutions,
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
                        <div className="flex border-b border-border overflow-x-auto custom-scrollbar items-center pb-1">
                            {solutions.map((tab) => {
                                const isActive = activeTabId === tab.id;
                                const hasContent = tab.content.trim().length > 0;
                                return (
                                    <div key={tab.id} className="group relative flex items-center shrink-0">
                                      <input
                                          value={tab.name}
                                          onChange={(e) => setSolutions(solutions.map(s => s.id === tab.id ? { ...s, name: e.target.value } : s))}
                                          onClick={() => setActiveTabId(tab.id)}
                                          className={`px-3 py-2 text-sm font-medium border-b-2 transition-all cursor-pointer bg-transparent focus:outline-none focus:bg-muted/30 w-32 md:w-36 ${isActive
                                              ? "border-blue-500 text-blue-500"
                                              : "border-transparent text-muted-foreground hover:text-foreground"
                                              }`}
                                      />
                                      {hasContent && !isActive && (
                                          <span className="absolute right-7 top-4 w-1.5 h-1.5 rounded-full bg-blue-500 inline-block pointer-events-none" />
                                      )}
                                      <button 
                                        onClick={() => {
                                          if (solutions.length <= 1) return;
                                          const newS = solutions.filter(s => s.id !== tab.id);
                                          setSolutions(newS);
                                          if (isActive) setActiveTabId(newS[0]?.id || "");
                                        }}
                                        className="opacity-0 group-hover:opacity-100 absolute right-2 top-2 hover:bg-muted p-1 rounded transition-opacity"
                                        title="Remove solution tab"
                                      >
                                        <X size={14} className="text-muted-foreground hover:text-red-500 transition-colors" />
                                      </button>
                                    </div>
                                );
                            })}
                            <button
                                onClick={() => {
                                  const newId = `sol-${Date.now()}`;
                                  setSolutions([...solutions, { id: newId, name: `Solution ${solutions.length + 1}`, content: "" }]);
                                  setActiveTabId(newId);
                                }}
                                className="ml-2 w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors shrink-0 border border-border/50"
                                title="Add another solution tab"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        {/* Tab Content */}
                        {solutions.map(tab => tab.id === activeTabId && (
                            <textarea
                                key={tab.id}
                                value={tab.content}
                                onChange={(e) => setSolutions(solutions.map(s => s.id === tab.id ? { ...s, content: e.target.value } : s))}
                                placeholder={`${tab.name} approach (Markdown + code fences supported)`}
                                rows={6}
                                spellCheck={false}
                                className={`${inputCls} font-mono bg-muted/50 resize-y`}
                            />
                        ))}
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

            {/* First Review Timing (Only for New Cards) */}
            {mode === "add" && (
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
            )}

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
