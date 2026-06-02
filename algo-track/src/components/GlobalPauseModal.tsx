'use client';

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Loader2, Pause, Play, Clock, Plus, X, Shuffle } from "lucide-react";
import { motion } from "motion/react";
import { createPortal } from "react-dom";
import {
    pauseAllReviews,
    resumeAllReviews,
    extendGlobalPause,
    redistributeReviews,
    shuffleAllReviews,
    type GlobalPauseStatus,
} from "@/lib/client-api";
import { useConfirmModal } from "@/components/ConfirmModal";

interface GlobalPauseModalProps {
    pauseStatus: GlobalPauseStatus;
    onClose: () => void;
    onChanged: () => void;
}

type PauseType = "all" | "leetcode" | "cs" | "sql";

const TABS = [
    { id: "all" as const, label: "All", icon: "🌐" },
    { id: "leetcode" as const, label: "DSA", icon: "💻" },
    { id: "cs" as const, label: "CS Core", icon: "📚" },
    { id: "sql" as const, label: "SQL", icon: "🗄️" },
];

const PAUSE_PRESETS = [
    { days: 7, label: "1 Week" },
    { days: 14, label: "2 Weeks" },
    { days: 30, label: "1 Month" },
];

const EXTEND_PRESETS = [
    { days: 3, label: "+3 Days" },
    { days: 7, label: "+1 Week" },
    { days: 14, label: "+2 Weeks" },
];

export function GlobalPauseModal({
    pauseStatus,
    onClose,
    onChanged,
}: GlobalPauseModalProps) {
    const [activeTab, setActiveTab] = useState<PauseType>("all");
    const [selectedDays, setSelectedDays] = useState<number | null>(7);
    const [customDays, setCustomDays] = useState("");
    const [useCustom, setUseCustom] = useState(false);
    const [autoResume, setAutoResume] = useState(true);
    const [cardsPerDay, setCardsPerDay] = useState<number>(7);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showExtend, setShowExtend] = useState(false);
    const { alert: alertModal } = useConfirmModal();

    const getTabStatus = (tabId: PauseType) => {
        if (tabId === "all") return pauseStatus;
        return pauseStatus.types?.[tabId] || { active: false, startedAt: null, until: null, autoResume: false, remainingDays: null };
    };

    const tabStatus = getTabStatus(activeTab);

    const effectiveDays = useCustom
        ? parseInt(customDays, 10) || 0
        : selectedDays ?? 0;

    const handlePause = async () => {
        if (effectiveDays < 1) return;
        setIsSubmitting(true);
        try {
            await pauseAllReviews(effectiveDays, autoResume, activeTab);
            onChanged();
        } catch (err) {
            console.error("Failed to pause reviews:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResume = async () => {
        setIsSubmitting(true);
        try {
            await resumeAllReviews(activeTab);
            onChanged();
        } catch (err) {
            console.error("Failed to resume reviews:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleExtend = async (days: number) => {
        setIsSubmitting(true);
        try {
            await extendGlobalPause(days, activeTab);
            onChanged();
        } catch (err) {
            console.error("Failed to extend pause:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRedistribute = async () => {
        setIsSubmitting(true);
        try {
            const result = await redistributeReviews(cardsPerDay);
            alertModal({
                title: "Reviews Redistributed",
                message: `Redistributed ${result.redistributed} cards across review days (${cardsPerDay} per day).`,
                variant: "info",
            });
            onChanged();
        } catch (err) {
            console.error("Failed to redistribute reviews:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleShuffleAll = async () => {
        setIsSubmitting(true);
        try {
            const result = await shuffleAllReviews(cardsPerDay);
            const totalDays = Math.ceil(result.shuffled / cardsPerDay);
            alertModal({
                title: "All Cards Shuffled",
                message: `Randomly shuffled ${result.shuffled} cards and spread them at ${cardsPerDay}/day. You'll cycle through all of them in ~${totalDays} days.`,
                variant: "info",
            });
            onChanged();
        } catch (err) {
            console.error("Failed to shuffle all cards:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
        });
    };

    const getTabTitle = () => {
        const isPaused = tabStatus.active;
        if (activeTab === "all") return isPaused ? "All Reviews Paused" : "Pause All Reviews";
        if (activeTab === "leetcode") return isPaused ? "DSA Reviews Paused" : "Pause DSA Reviews";
        if (activeTab === "cs") return isPaused ? "CS Core Reviews Paused" : "Pause CS Core Reviews";
        if (activeTab === "sql") return isPaused ? "SQL Reviews Paused" : "Pause SQL Reviews";
        return "Pause Reviews";
    };

    const getTabSubtitle = () => {
        const isPaused = tabStatus.active;
        if (activeTab === "all") return isPaused ? "Your entire review schedule is frozen" : "Take a complete break from all reviews";
        if (activeTab === "leetcode") return isPaused ? "DSA cards are frozen" : "Temporarily pause DSA problem reviews";
        if (activeTab === "cs") return isPaused ? "CS Core cards are frozen" : "Temporarily pause CS Core concept reviews";
        if (activeTab === "sql") return isPaused ? "SQL cards are frozen" : "Temporarily pause SQL query reviews";
        return "Take a break from reviews";
    };

    const getCategoryLabel = (type: PauseType) => {
        if (type === "all") return "All";
        if (type === "leetcode") return "DSA";
        if (type === "cs") return "CS Core";
        if (type === "sql") return "SQL";
        return "";
    };

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden border border-border max-h-[90vh] flex flex-col"
            >
                {/* Header */}
                <div className="p-5 border-b border-border flex items-center justify-between bg-muted/10">
                    <div className="flex items-center gap-2.5">
                        {tabStatus.active ? (
                            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                                <Pause className="w-4 h-4 text-amber-500" />
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <Pause className="w-4 h-4 text-muted-foreground" />
                            </div>
                        )}
                        <div>
                            <h3 className="text-base font-semibold text-foreground">
                                {getTabTitle()}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {getTabSubtitle()}
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="rounded-full shrink-0 hover:bg-muted"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Category Tabs */}
                <div className="px-5 pt-4 border-b border-border bg-muted/5">
                    <div className="flex p-1 rounded-xl bg-muted/40 border border-border/50 gap-1">
                        {TABS.map((tab) => {
                            const isPaused = getTabStatus(tab.id).active;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        setShowExtend(false);
                                    }}
                                    className={`relative flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[11px] font-semibold transition-all duration-200 cursor-pointer ${
                                        isActive
                                            ? "bg-background text-foreground shadow-sm border border-border"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/10 border border-transparent"
                                    }`}
                                >
                                    <span className="text-sm mb-0.5">{tab.icon}</span>
                                    <span>{tab.label}</span>
                                    {isPaused && (
                                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col gap-5 overflow-y-auto flex-1">
                    {tabStatus.active ? (
                        /* ── Paused State ────────────────── */
                        <>
                            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <Clock className="w-4 h-4 text-amber-500" />
                                    <span className="text-sm font-semibold text-amber-500">
                                        Pause Status ({getCategoryLabel(activeTab)})
                                    </span>
                                </div>
                                <div className="space-y-1.5 text-sm text-foreground/80">
                                    {tabStatus.until && (
                                        <p>
                                            Resumes:{" "}
                                            <strong className="text-foreground">
                                                {formatDate(tabStatus.until)}
                                            </strong>
                                            {tabStatus.remainingDays != null && (
                                                <span className="text-muted-foreground ml-1">
                                                    ({tabStatus.remainingDays} day
                                                    {tabStatus.remainingDays !== 1
                                                        ? "s"
                                                        : ""}{" "}
                                                    left)
                                                </span>
                                            )}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Mode:{" "}
                                        <strong>
                                            {tabStatus.autoResume
                                                ? "Auto-resume"
                                                : "Manual resume"}
                                        </strong>
                                    </p>
                                    {tabStatus.startedAt && (
                                        <p className="text-xs text-muted-foreground">
                                            Paused since:{" "}
                                            {formatDate(tabStatus.startedAt)}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Extend */}
                            {!showExtend ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowExtend(true)}
                                    className="gap-1.5 self-center rounded-full"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Extend Pause
                                </Button>
                            ) : (
                                <div className="p-3 rounded-xl border border-border bg-muted/20">
                                    <p className="text-xs font-medium text-muted-foreground text-center mb-2">
                                        Extend by:
                                    </p>
                                    <div className="flex items-center justify-center gap-2">
                                        {EXTEND_PRESETS.map((preset) => (
                                            <Button
                                                key={preset.days}
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    handleExtend(preset.days)
                                                }
                                                disabled={isSubmitting}
                                                className="rounded-full text-xs"
                                            >
                                                {preset.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Resume button */}
                            <Button
                                onClick={handleResume}
                                disabled={isSubmitting}
                                className="w-full rounded-full font-semibold gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-5"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Play className="w-4 h-4" />
                                )}
                                {isSubmitting
                                    ? "Resuming..."
                                    : `Resume ${getCategoryLabel(activeTab)} Reviews`}
                            </Button>
                        </>
                    ) : (
                        /* ── Not Paused State ────────────── */
                        <>
                            <div>
                                <p className="text-sm font-medium text-foreground mb-3">
                                    How long do you want to pause {getCategoryLabel(activeTab)} reviews?
                                </p>

                                {/* Preset buttons */}
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {PAUSE_PRESETS.map((preset) => (
                                        <button
                                            key={preset.days}
                                            onClick={() => {
                                                setSelectedDays(preset.days);
                                                setUseCustom(false);
                                            }}
                                            className={`py-3 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                                                !useCustom &&
                                                selectedDays === preset.days
                                                    ? "border-amber-500 bg-amber-500/5 text-amber-500"
                                                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                                            }`}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Custom input */}
                                <div
                                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors ${
                                        useCustom
                                            ? "border-amber-500 bg-amber-500/5"
                                            : "border-border"
                                    }`}
                                >
                                    <input
                                        type="number"
                                        min={1}
                                        max={365}
                                        value={customDays}
                                        onChange={(e) => {
                                            setCustomDays(e.target.value);
                                            setUseCustom(true);
                                        }}
                                        onFocus={() => setUseCustom(true)}
                                        placeholder="Custom days..."
                                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                                    />
                                    <span className="text-xs text-muted-foreground">
                                        days
                                    </span>
                                </div>
                            </div>

                            {/* Auto-resume toggle */}
                            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/10">
                                <div>
                                    <p className="text-sm font-medium text-foreground">
                                        Auto-resume
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Automatically resume after pause ends
                                    </p>
                                </div>
                                <button
                                    onClick={() => setAutoResume(!autoResume)}
                                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                                        autoResume
                                            ? "bg-amber-500"
                                            : "bg-muted-foreground/30"
                                    }`}
                                >
                                    <div
                                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                                            autoResume
                                                ? "translate-x-5.5"
                                                : "translate-x-0.5"
                                        }`}
                                    />
                                </button>
                            </div>

                            {autoResume && (
                                <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
                                    📧 You&apos;ll receive an email 1 day before
                                    reviews automatically resume. You can extend the
                                    pause at any time.
                                </p>
                            )}

                            {/* Confirm button */}
                            <Button
                                onClick={handlePause}
                                disabled={
                                    isSubmitting || effectiveDays < 1
                                }
                                className="w-full rounded-full font-semibold gap-2 bg-amber-500 hover:bg-amber-600 text-white py-5"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Pause className="w-4 h-4" />
                                )}
                                {isSubmitting
                                    ? "Pausing..."
                                    : `Pause ${getCategoryLabel(activeTab)} for ${effectiveDays} day${effectiveDays !== 1 ? "s" : ""}`}
                            </Button>

                            {/* Redistribute & Shuffle (Only show under "All" tab) */}
                            {activeTab === "all" && (
                                <div className="border-t border-border pt-4 mt-1 space-y-4">
                                    <div className="p-3 rounded-xl border border-border bg-muted/10">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-foreground">
                                                Redistribution Rate
                                            </span>
                                            <span className="text-xs text-cyan-500 font-bold">
                                                {cardsPerDay} cards / day
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="range"
                                                min={1}
                                                max={50}
                                                value={cardsPerDay}
                                                onChange={(e) => setCardsPerDay(Number(e.target.value))}
                                                className="flex-1 accent-cyan-500 cursor-pointer h-1 bg-muted-foreground/20 rounded-lg appearance-none"
                                            />
                                            <input
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={cardsPerDay}
                                                onChange={(e) => {
                                                    const val = Math.max(1, Math.min(100, Number(e.target.value) || 1));
                                                    setCardsPerDay(val);
                                                }}
                                                className="w-14 p-1 text-center text-xs font-semibold rounded-lg border border-border bg-background outline-none text-foreground"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs text-muted-foreground mb-2 text-center">
                                            Too many reviews piled up? Spread them evenly.
                                        </p>
                                        <Button
                                            variant="outline"
                                            onClick={handleRedistribute}
                                            disabled={isSubmitting}
                                            className="w-full rounded-full gap-2 text-sm"
                                        >
                                            {isSubmitting ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Clock className="w-4 h-4" />
                                            )}
                                            Redistribute Reviews ({cardsPerDay}/day)
                                        </Button>

                                        <div className="mt-3 pt-3 border-t border-border/50">
                                            <p className="text-xs text-muted-foreground mb-2 text-center">
                                                Want to review everything? Shuffle all cards randomly and spread at {cardsPerDay}/day.
                                            </p>
                                            <Button
                                                variant="outline"
                                                onClick={handleShuffleAll}
                                                disabled={isSubmitting}
                                                className="w-full rounded-full gap-2 text-sm border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/10 hover:text-cyan-400"
                                            >
                                                {isSubmitting ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Shuffle className="w-4 h-4" />
                                                )}
                                                Shuffle &amp; Spread All Cards ({cardsPerDay}/day)
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </motion.div>
        </div>,
        document.body,
    );
}
