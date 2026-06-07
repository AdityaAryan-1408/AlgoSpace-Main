'use client';

import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Plus, Loader2, Github, X, ChevronLeft, ChevronRight, CalendarDays, Calendar as CalendarIcon, FileText, Layout, Sparkles } from "lucide-react";
import { createCard, updateCard, fetchAllCards } from "@/lib/client-api";
import type { Difficulty, CardType, Flashcard } from "@/data";
import { RichNotesEditor } from "@/components/RichNotesEditor";
import { motion, AnimatePresence } from "motion/react";
import { isSystemDesignCard } from "@/lib/card-utils";
import { SystemDesignCanvas } from "@/components/SystemDesignCanvas";
import { SystemDesignAssistant } from "@/components/SystemDesignAssistant";

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
    metadata?: Record<string, unknown>;
    richNotes?: string;
}

interface AddCardFormProps {
    cardType: CardType;
    defaults?: AddCardFormDefaults;
    onSubmitted: () => void;
    submitLabel?: string;
    mode?: "add" | "edit";
    cardId?: string;
    cards?: Flashcard[];
}

export function AddCardForm({
    cardType,
    defaults,
    onSubmitted,
    submitLabel = "Add Card",
    mode = "add",
    cardId,
    cards,
}: AddCardFormProps) {
    // SQL cards share the same code-oriented form layout as DSA cards
    const isCodeCard = cardType === "leetcode" || cardType === "sql";
    const [title, setTitle] = useState(defaults?.title ?? "");
    const [description, setDescription] = useState(defaults?.description ?? "");
    const [difficulty, setDifficulty] = useState<Difficulty>(
        defaults?.difficulty ?? "medium",
    );
    const [platform, setPlatform] = useState("LeetCode");
    const [url, setUrl] = useState(defaults?.url ?? "");
    const [notes, setNotes] = useState(defaults?.notes ?? "");
    const [richNotes, setRichNotes] = useState<string | undefined>(defaults?.richNotes);
    const [systemDesignTab, setSystemDesignTab] = useState<"richNotes" | "canvas" | "assistant">("richNotes");
    const [canvasData, setCanvasData] = useState<string>(defaults?.metadata?.systemDesignCanvas as string || "");
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
    const [isReferenceOnly, setIsReferenceOnly] = useState(defaults?.metadata?.reference_only === true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [syncStatus, setSyncStatus] = useState<"" | "syncing" | "synced" | "failed">("");
    const [isScraping, setIsScraping] = useState(false);
    const [scrapeSuccess, setScrapeSuccess] = useState(false);
    const [scrapeFailed, setScrapeFailed] = useState(false);
    const [editorKey, setEditorKey] = useState("editor-desc-init");

    const [fetchedCards, setFetchedCards] = useState<Flashcard[]>([]);
    const [calendarMonth, setCalendarMonth] = useState(() => new Date());
    const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
    const [showDueCalendar, setShowDueCalendar] = useState(false);
    const calendarBtnRef = useRef<HTMLButtonElement>(null);
    const [calendarRect, setCalendarRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (!cards || cards.length === 0) {
            fetchAllCards()
                .then(setFetchedCards)
                .catch(err => console.error("Failed to load cards for calendar:", err));
        }
    }, [cards]);

    const activeCards = cards && cards.length > 0 ? cards : fetchedCards;

    // Group cards by due date (YYYY-MM-DD)
    const cardsByDate = useMemo(() => {
        const map = new Map<string, number>();
        activeCards.forEach(card => {
            let date: Date;
            if (card.nextReview) {
                date = new Date(card.nextReview);
            } else {
                date = new Date();
                date.setDate(date.getDate() + (card.dueInDays || 0));
            }
            
            if (isNaN(date.getTime())) return;
            
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            map.set(dateStr, (map.get(dateStr) || 0) + 1);
        });
        
        return map;
    }, [activeCards]);

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
        return new Date(year, month, 1).getDay();
    };

    const nextCalendarMonth = () => {
        setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
    };

    const prevCalendarMonth = () => {
        setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

    const renderCalendarDays = () => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const days = [];

        // Empty cells for padding before start of month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="w-8 h-8" />);
        }

        // Days of month
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dueCount = cardsByDate.get(dateStr) || 0;
            const dayDate = new Date(year, month, d);
            dayDate.setHours(0, 0, 0, 0);

            const isPast = dayDate < today;
            const isToday = dayDate.getTime() === today.getTime();
            const isSelected = selectedCalendarDate && selectedCalendarDate.getTime() === dayDate.getTime();

            // Workload coloring
            let workloadClass = "text-foreground hover:bg-muted";
            if (isPast) {
                workloadClass = "text-muted-foreground/30 cursor-not-allowed";
            } else if (dueCount > 0) {
                if (dueCount > 20) {
                    workloadClass = "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/30";
                } else if (dueCount > 10) {
                    workloadClass = "bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 hover:bg-orange-500/30";
                } else if (dueCount > 5) {
                    workloadClass = "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-500/30";
                } else {
                    workloadClass = "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30";
                }
            }

            if (isToday) {
                workloadClass += " ring-1 ring-primary ring-offset-1 ring-offset-background";
            }
            if (isSelected) {
                workloadClass += " ring-2 ring-cyan-500 ring-offset-1 ring-offset-background bg-cyan-500/10";
            }

            days.push(
                <button
                    key={`day-${d}`}
                    type="button"
                    disabled={isPast}
                    onClick={() => {
                        setSelectedCalendarDate(dayDate);
                        const diffTime = dayDate.getTime() - today.getTime();
                        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                        setCustomDays(diffDays.toString());
                    }}
                    className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center p-0 text-[10px] font-semibold transition-all relative cursor-pointer ${workloadClass}`}
                >
                    <span>{d}</span>
                    {!isPast && dueCount > 0 && (
                        <span className="text-[7px] font-extrabold leading-none mt-[-1px] opacity-90">{dueCount}</span>
                    )}
                </button>
            );
        }

        return days;
    };

    const handleLeetCodeScrape = async () => {
        if (!title.trim()) return;
        setIsScraping(true);
        setScrapeSuccess(false);
        setScrapeFailed(false);
        setError("");

        try {
            const res = await fetch(`/api/leetcode/scrape?query=${encodeURIComponent(title.trim())}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to auto-fill details from LeetCode.");
            }

            // Successfully scraped! Update states
            setTitle(`${data.frontendId}. ${data.title}`);
            setUrl(data.url);
            setDifficulty(data.difficulty as Difficulty);
            setDescription(data.description);
            setTagsInput(data.tags.join(", "));
            
            // Re-mount the description editor with the new content
            setEditorKey(`editor-desc-${Date.now()}`);

            setScrapeSuccess(true);
            setTimeout(() => setScrapeSuccess(false), 3000);
        } catch (err: any) {
            console.error("Scraper Error:", err);
            setScrapeFailed(true);
            setError(err.message || "Failed to fetch from LeetCode.");
            setTimeout(() => setScrapeFailed(false), 4000);
        } finally {
            setIsScraping(false);
        }
    };

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
                richNotes: richNotes || undefined,
                solution:
                    isCodeCard && compiledSolutions[0]?.content
                        ? compiledSolutions[0].content
                        : undefined,
                solutions: isCodeCard && compiledSolutions.length > 0 ? compiledSolutions : undefined,
                timeComplexity:
                    isCodeCard && timeComplexity.trim()
                        ? timeComplexity.trim()
                        : undefined,
                spaceComplexity:
                    isCodeCard && spaceComplexity.trim()
                        ? spaceComplexity.trim()
                        : undefined,
                relatedProblems:
                    isCodeCard && relatedProblems.length > 0
                        ? relatedProblems
                        : undefined,
                url:
                    isCodeCard && url.trim() ? url.trim() : undefined,
                metadata: {
                    ...(defaults?.metadata || {}),
                    reference_only: isReferenceOnly ? true : undefined,
                    ...(isSystemDesignCard(cardType, tags) ? { systemDesignCanvas: canvasData } : {}),
                },
            };

            if (mode === "edit" && cardId) {
                await updateCard(cardId, payload);
            } else {
                await createCard({
                    type: cardType,
                    ...payload,
                    reviewInDays: isReferenceOnly ? undefined : (finalDays > 0 ? finalDays : undefined),
                });
            }

            // Fire-and-forget GitHub sync for DSA/SQL cards with solutions
            if (isCodeCard && compiledSolutions.length > 0 && mode !== "edit") {
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
                <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-foreground">Title *</label>
                    {isCodeCard && platform === "LeetCode" && (
                        <button
                            type="button"
                            onClick={handleLeetCodeScrape}
                            disabled={isScraping || !title.trim()}
                            className="text-xs font-bold text-cyan-500 hover:text-cyan-600 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isScraping ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" /> Fetching...
                                </>
                            ) : scrapeSuccess ? (
                                <span className="text-emerald-500 flex items-center gap-0.5">✓ Auto-Filled!</span>
                            ) : scrapeFailed ? (
                                <span className="text-red-500">✗ Failed</span>
                            ) : (
                                <>⚡ Auto-Fill LeetCode</>
                            )}
                        </button>
                    )}
                </div>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                        cardType === "leetcode"
                            ? "e.g. Two Sum or 1"
                            : cardType === "sql"
                                ? "e.g. Combine Two Tables or 175"
                                : "e.g. ACID Properties"
                    }
                    className={inputCls}
                />
            </div>

            {isCodeCard && (
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
                            <option value="HackerRank">HackerRank</option>
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
                <RichNotesEditor
                    key={editorKey}
                    initialContent={description}
                    fallbackMarkdown={description}
                    onChange={(content) => setDescription(content)}
                    placeholder={
                        cardType === "leetcode"
                            ? "Paste the exact problem description here..."
                            : cardType === "sql"
                                ? "Paste the SQL problem description here..."
                                : "Concept explanation..."
                    }
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
                {isSystemDesignCard(cardType, tagsInput) ? (
                    <div className="flex flex-col gap-3">
                        {/* Tab Switcher Headers */}
                        <div className="flex border-b border-border gap-1 shrink-0 pb-1">
                            <Button
                                type="button"
                                size="sm"
                                variant={systemDesignTab === "richNotes" ? "secondary" : "ghost"}
                                onClick={() => setSystemDesignTab("richNotes")}
                                className="h-8 px-3 text-xs gap-1.5 rounded-lg cursor-pointer"
                            >
                                <FileText className="w-3.5 h-3.5" />
                                Rich Notes
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={systemDesignTab === "canvas" ? "secondary" : "ghost"}
                                onClick={() => setSystemDesignTab("canvas")}
                                className="h-8 px-3 text-xs gap-1.5 rounded-lg cursor-pointer"
                            >
                                <Layout className="w-3.5 h-3.5" />
                                Canvas Diagram
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={systemDesignTab === "assistant" ? "secondary" : "ghost"}
                                onClick={() => setSystemDesignTab("assistant")}
                                className="h-8 px-3 text-xs gap-1.5 rounded-lg text-purple-400 hover:text-purple-300 cursor-pointer"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                AI Assistant
                            </Button>
                        </div>

                        {/* Tab Contents */}
                        {systemDesignTab === "richNotes" && (
                            <RichNotesEditor
                                key={`rich-notes-${editorKey}`}
                                initialContent={richNotes}
                                fallbackMarkdown={notes}
                                onChange={(content) => {
                                    setRichNotes(content);
                                }}
                                placeholder="Add architectural design specifications here..."
                            />
                        )}

                        {systemDesignTab === "canvas" && (
                            <div className="h-[450px]">
                                <SystemDesignCanvas
                                    value={canvasData}
                                    onChange={(val) => setCanvasData(val)}
                                />
                            </div>
                        )}

                        {systemDesignTab === "assistant" && (
                            <SystemDesignAssistant
                                currentNotes={richNotes || ""}
                                currentCanvas={canvasData}
                                onNotesGenerated={(txt) => {
                                    setRichNotes(txt);
                                    setEditorKey(`editor-notes-${Date.now()}`);
                                }}
                                onDiagramGenerated={(diag) => {
                                    setCanvasData(diag);
                                }}
                                onSelectTab={(tab) => setSystemDesignTab(tab)}
                            />
                        )}
                    </div>
                ) : (
                    <RichNotesEditor
                        key={`rich-notes-${editorKey}`}
                        initialContent={richNotes}
                        fallbackMarkdown={notes}
                        onChange={(content) => {
                            setRichNotes(content);
                        }}
                        placeholder="Type '/' for commands. Add notes, diagrams, code blocks..."
                    />
                )}
            </div>

            {isCodeCard && (
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

            {/* Reference Card Toggle */}
            <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-all select-none">
                <input
                    type="checkbox"
                    id="isReferenceOnly"
                    checked={isReferenceOnly}
                    onChange={(e) => setIsReferenceOnly(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <div className="flex flex-col text-left">
                    <label htmlFor="isReferenceOnly" className="text-sm font-semibold text-foreground cursor-pointer">
                        Keep as Reference Card
                    </label>
                    <span className="text-xs text-muted-foreground mt-0.5">
                        Exclude this card from the daily review queue (it remains accessible and reviewable by topic)
                    </span>
                </div>
            </div>

            {/* First Review Timing (Only for New Cards) */}
            {mode === "add" && !isReferenceOnly && (
              <div className="flex flex-col gap-1.5 relative z-20">
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
                              type="button"
                              onClick={() => {
                                  setReviewInDays(opt.value);
                                  setShowDueCalendar(false);
                                  setSelectedCalendarDate(null);
                              }}
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
                          <span className="text-sm text-muted-foreground mr-1">days</span>
                          
                          <Button
                              ref={calendarBtnRef}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (!showDueCalendar && calendarBtnRef.current) {
                                  setCalendarRect(calendarBtnRef.current.getBoundingClientRect());
                                }
                                setShowDueCalendar(!showDueCalendar);
                              }}
                              className={`rounded-full p-1.5 h-8 w-8 flex items-center justify-center shrink-0 ${showDueCalendar ? "border-cyan-500 text-cyan-500 bg-cyan-500/5" : ""}`}
                              title="Show due workload calendar"
                            >
                              <CalendarIcon className="w-3.5 h-3.5" />
                          </Button>
                          {showDueCalendar && createPortal(
                            <AnimatePresence>
                              <>
                                <div 
                                  className="fixed inset-0 z-[9998] cursor-default" 
                                  onClick={() => setShowDueCalendar(false)} 
                                />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="fixed z-[9999] w-64 bg-card border border-border rounded-2xl shadow-2xl p-3 flex flex-col gap-2 cursor-default text-left"
                                  style={calendarRect ? (() => {
                                    const CALENDAR_H = 340;
                                    const spaceAbove = calendarRect.top;
                                    const placeAbove = spaceAbove >= CALENDAR_H + 8;
                                    return {
                                      top: placeAbove ? undefined : `${calendarRect.bottom + 8}px`,
                                      bottom: placeAbove ? `${window.innerHeight - calendarRect.top + 8}px` : undefined,
                                      left: `${Math.max(8, calendarRect.left + calendarRect.width / 2 - 128)}px`,
                                    };
                                  })() : undefined}
                                >
                                  <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                                    <button
                                      type="button"
                                      onClick={prevCalendarMonth}
                                      className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                      <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-xs font-bold text-foreground">
                                      {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={nextCalendarMonth}
                                      className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-muted-foreground uppercase">
                                    {dayNames.map((dName, idx) => (
                                      <div key={`dayname-${idx}`}>{dName}</div>
                                    ))}
                                  </div>

                                  <div className="grid grid-cols-7 gap-1">
                                    {renderCalendarDays()}
                                  </div>

                                  {selectedCalendarDate ? (() => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const diffTime = selectedCalendarDate.getTime() - today.getTime();
                                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                                    return (
                                      <div className="text-[10px] text-cyan-500 font-semibold text-center border-t border-border/50 pt-1.5">
                                        Selected: {diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow (1 day away)" : `${diffDays} days away`}
                                      </div>
                                    );
                                  })() : (
                                    <div className="text-[9px] text-muted-foreground text-center border-t border-border/50 pt-1.5 font-medium">
                                      Click a day to check days offset
                                    </div>
                                  )}
                                </motion.div>
                              </>
                            </AnimatePresence>,
                            document.body
                          )}
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
                    {isSubmitting ? (mode === "edit" ? "Saving..." : "Adding...") : submitLabel}
                </Button>
            </div>
        </div>
    );
}
