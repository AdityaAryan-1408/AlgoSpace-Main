'use client';

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Loader2, Pause, Play, Clock, Plus, X } from "lucide-react";
import { motion } from "motion/react";
import { createPortal } from "react-dom";
import {
    pauseAllReviews,
    resumeAllReviews,
    extendGlobalPause,
    type GlobalPauseStatus,
} from "@/lib/client-api";

interface GlobalPauseModalProps {
    pauseStatus: GlobalPauseStatus;
    onClose: () => void;
    onChanged: () => void;
}

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
    const [selectedDays, setSelectedDays] = useState<number | null>(7);
    const [customDays, setCustomDays] = useState("");
    const [useCustom, setUseCustom] = useState(false);
    const [autoResume, setAutoResume] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showExtend, setShowExtend] = useState(false);

    const effectiveDays = useCustom
        ? parseInt(customDays, 10) || 0
        : selectedDays ?? 0;

    const handlePause = async () => {
        if (effectiveDays < 1) return;
        setIsSubmitting(true);
        try {
            await pauseAllReviews(effectiveDays, autoResume);
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
            await resumeAllReviews();
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
            await extendGlobalPause(days);
            onChanged();
        } catch (err) {
            console.error("Failed to extend pause:", err);
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
                className="w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden border border-border"
            >
                {/* Header */}
                <div className="p-5 border-b border-border flex items-center justify-between bg-muted/10">
                    <div className="flex items-center gap-2.5">
                        {pauseStatus.active ? (
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
                                {pauseStatus.active
                                    ? "Reviews Paused"
                                    : "Pause All Reviews"}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {pauseStatus.active
                                    ? "Your review schedule is frozen"
                                    : "Take a break from reviews"}
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

                {/* Body */}
                <div className="p-5 flex flex-col gap-5">
                    {pauseStatus.active ? (
                        /* ── Paused State ────────────────── */
                        <>
                            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <Clock className="w-4 h-4 text-amber-500" />
                                    <span className="text-sm font-semibold text-amber-500">
                                        Pause Status
                                    </span>
                                </div>
                                <div className="space-y-1.5 text-sm text-foreground/80">
                                    {pauseStatus.until && (
                                        <p>
                                            Resumes:{" "}
                                            <strong className="text-foreground">
                                                {formatDate(pauseStatus.until)}
                                            </strong>
                                            {pauseStatus.remainingDays != null && (
                                                <span className="text-muted-foreground ml-1">
                                                    ({pauseStatus.remainingDays} day
                                                    {pauseStatus.remainingDays !== 1
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
                                            {pauseStatus.autoResume
                                                ? "Auto-resume"
                                                : "Manual resume"}
                                        </strong>
                                    </p>
                                    {pauseStatus.startedAt && (
                                        <p className="text-xs text-muted-foreground">
                                            Paused since:{" "}
                                            {formatDate(pauseStatus.startedAt)}
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
                                    : "Resume Reviews Now"}
                            </Button>
                        </>
                    ) : (
                        /* ── Not Paused State ────────────── */
                        <>
                            <div>
                                <p className="text-sm font-medium text-foreground mb-3">
                                    How long do you want to pause?
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
                                    : `Pause for ${effectiveDays} day${effectiveDays !== 1 ? "s" : ""}`}
                            </Button>
                        </>
                    )}
                </div>
            </motion.div>
        </div>,
        document.body,
    );
}
