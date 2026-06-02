'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Loader2, Shield, X, AlertTriangle, CheckCircle2, Info, ArrowRight, Sliders, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import {
    fetchRecoveryPreview,
    applyRecoveryPlanApi,
    type RecoveryPlanPreview,
    type RecoveryApplyResult,
} from "@/lib/client-api";
import { useConfirmModal } from "@/components/ConfirmModal";

interface RecoveryModeModalProps {
    onClose: () => void;
    onChanged: () => void;
}

export function RecoveryModeModal({ onClose, onChanged }: RecoveryModeModalProps) {
    const [preview, setPreview] = useState<RecoveryPlanPreview | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form inputs initialized from the preview
    const [flattenOverDays, setFlattenOverDays] = useState<number>(5);
    const [deferByDays, setDeferByDays] = useState<number>(7);

    const { alert: alertModal } = useConfirmModal();

    useEffect(() => {
        let isMounted = true;
        async function loadPreview() {
            try {
                const data = await fetchRecoveryPreview();
                if (isMounted) {
                    setPreview(data);
                    setFlattenOverDays(data.actions.flattenOverDays || 5);
                    setDeferByDays(data.actions.deferByDays || 7);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : "Failed to load recovery plan preview");
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }
        loadPreview();
        return () => {
            isMounted = false;
        };
    }, []);

    const handleApply = async () => {
        setIsApplying(true);
        try {
            const result = await applyRecoveryPlanApi({
                deferByDays,
                flattenOverDays,
            });
            alertModal({
                title: "Recovery Plan Applied",
                message: `Successfully recovery-adjusted ${result.totalAffected} cards. ${result.keptDue} critical cards are ready for review today, ${result.flattened} are staggered over the next ${flattenOverDays} days, and ${result.deferred} stable cards were safely deferred by ${deferByDays} days.`,
                variant: "info",
            });
            onChanged();
            onClose();
        } catch (err) {
            console.error("Failed to apply recovery plan:", err);
            alertModal({
                title: "Error",
                message: err instanceof Error ? err.message : "Failed to apply recovery plan",
                variant: "danger",
            });
        } finally {
            setIsApplying(false);
        }
    };

    const redCount = preview?.plan.redCards.length ?? 0;
    const amberCount = preview?.plan.amberCards.length ?? 0;
    const greenCount = preview?.plan.greenCards.length ?? 0;
    const totalOverdue = preview?.plan.totalOverdue ?? 0;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-card rounded-2xl shadow-2xl overflow-hidden border border-border"
            >
                {/* Header */}
                <div className="p-5 border-b border-border flex items-center justify-between bg-muted/10">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center animate-pulse">
                            <Shield className="w-4 h-4 text-cyan-500" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-foreground">
                                Recovery Mode Planner
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Systematic backlog queue management
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
                <div className="p-5 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                            <p className="text-sm text-muted-foreground">Analyzing card metadata &amp; backlog history...</p>
                        </div>
                    ) : error ? (
                        <div className="py-6 text-center space-y-3">
                            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
                            <p className="text-sm text-foreground font-semibold">{error}</p>
                            <Button variant="outline" onClick={onClose} className="rounded-full">Close</Button>
                        </div>
                    ) : (
                        <>
                            {/* Warning Banner */}
                            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-500 flex gap-3 text-xs leading-relaxed">
                                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold">Avoid Review Burnout:</span> Capping reviews and deferring stable cards prevents cognitive fatigue. This plan reorganizes <strong className="text-foreground">{totalOverdue} overdue reviews</strong>.
                                </div>
                            </div>

                            {/* Backlog Classification Breakdown */}
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                                    Queue Classification
                                </h4>
                                <div className="grid grid-cols-1 gap-2.5">
                                    {/* Red Bucket */}
                                    <div className="p-3 rounded-xl border border-rose-500/10 bg-rose-500/[0.02] flex items-start justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full bg-rose-500" />
                                                <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">Red Bucket (Critical)</span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Kept due immediately. High risk of memory decay (recent failures or very high intervals).
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="text-lg font-extrabold text-foreground">{redCount}</span>
                                            <span className="text-[10px] text-muted-foreground block">cards</span>
                                        </div>
                                    </div>

                                    {/* Amber Bucket */}
                                    <div className="p-3 rounded-xl border border-amber-500/10 bg-amber-500/[0.02] flex items-start justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                                <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Amber Bucket (Moderate)</span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Staggered evenly over custom timeframe. Medium retention risk.
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="text-lg font-extrabold text-foreground">{amberCount}</span>
                                            <span className="text-[10px] text-muted-foreground block">cards</span>
                                        </div>
                                    </div>

                                    {/* Green Bucket */}
                                    <div className="p-3 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02] flex items-start justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Green Bucket (Stable)</span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Postponed safely. Strong history and high stability cards that won't decay quickly.
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="text-lg font-extrabold text-foreground">{greenCount}</span>
                                            <span className="text-[10px] text-muted-foreground block">cards</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Settings Parameters */}
                            <div className="border-t border-border pt-4 mt-1 space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Recovery Parameters
                                </h4>

                                {/* Flatten Slider */}
                                <div className="p-3.5 rounded-xl border border-border bg-muted/10 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-amber-500" />
                                            Flatten Amber Cards Over
                                        </label>
                                        <span className="text-xs text-amber-500 font-bold">
                                            {flattenOverDays} days
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min={1}
                                            max={14}
                                            value={flattenOverDays}
                                            onChange={(e) => setFlattenOverDays(Number(e.target.value))}
                                            className="flex-1 accent-amber-500 cursor-pointer h-1 bg-muted-foreground/20 rounded-lg appearance-none"
                                        />
                                        <input
                                            type="number"
                                            min={1}
                                            max={30}
                                            value={flattenOverDays}
                                            onChange={(e) => {
                                                const val = Math.max(1, Math.min(30, Number(e.target.value) || 1));
                                                setFlattenOverDays(val);
                                            }}
                                            className="w-14 p-1 text-center text-xs font-semibold rounded-lg border border-border bg-background outline-none text-foreground"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        Distributes the {amberCount} Amber cards at approximately {Math.ceil(amberCount / flattenOverDays)} cards/day.
                                    </p>
                                </div>

                                {/* Defer Slider */}
                                <div className="p-3.5 rounded-xl border border-border bg-muted/10 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                            <Sliders className="w-3.5 h-3.5 text-emerald-500" />
                                            Postpone Green Cards By
                                        </label>
                                        <span className="text-xs text-emerald-500 font-bold">
                                            {deferByDays} days
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min={1}
                                            max={21}
                                            value={deferByDays}
                                            onChange={(e) => setDeferByDays(Number(e.target.value))}
                                            className="flex-1 accent-emerald-500 cursor-pointer h-1 bg-muted-foreground/20 rounded-lg appearance-none"
                                        />
                                        <input
                                            type="number"
                                            min={1}
                                            max={60}
                                            value={deferByDays}
                                            onChange={(e) => {
                                                const val = Math.max(1, Math.min(60, Number(e.target.value) || 1));
                                                setDeferByDays(val);
                                            }}
                                            className="w-14 p-1 text-center text-xs font-semibold rounded-lg border border-border bg-background outline-none text-foreground"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        Pushes all {greenCount} Green cards {deferByDays} days into the future.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-5 border-t border-border flex items-center justify-end gap-2.5 bg-muted/10">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        disabled={isApplying}
                        className="rounded-full"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleApply}
                        disabled={isLoading || isApplying || totalOverdue === 0}
                        className="rounded-full font-semibold gap-1.5 bg-cyan-500 hover:bg-cyan-600 text-white px-5 py-4 h-9"
                    >
                        {isApplying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Apply Recovery Plan
                    </Button>
                </div>
            </motion.div>
        </div>,
        document.body,
    );
}
