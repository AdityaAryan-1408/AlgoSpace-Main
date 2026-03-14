'use client';

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { X, Code, BookOpen } from "lucide-react";
import { motion } from "motion/react";
import { AddCardForm } from "@/components/AddCardForm";
import type { CardType } from "@/data";

interface AddCardModalProps {
    onClose: () => void;
    onAdded: () => void;
}

export function AddCardModal({ onClose, onAdded }: AddCardModalProps) {
    const [step, setStep] = useState<"choose" | "form">("choose");
    const [cardType, setCardType] = useState<CardType>("leetcode");

    const handleTypeSelect = (type: CardType) => {
        setCardType(type);
        setStep("form");
    };

    const handleSubmitted = () => {
        onAdded();
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl bg-card rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] border border-border"
            >
                {/* Header */}
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">
                            {step === "choose"
                                ? "Add New Card"
                                : cardType === "leetcode"
                                    ? "New DSA Problem"
                                    : "New Core Concept"}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {step === "choose"
                                ? "Choose the type of card to add"
                                : "Fill in the details below"}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="rounded-full shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === "choose" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleTypeSelect("leetcode")}
                                className="p-6 rounded-xl border-2 border-border hover:border-blue-500 bg-card transition-all flex flex-col items-center gap-3 cursor-pointer group"
                            >
                                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                    <Code className="w-6 h-6 text-blue-500" />
                                </div>
                                <span className="font-semibold text-foreground text-lg">
                                    DSA Problem
                                </span>
                                <span className="text-sm text-muted-foreground text-center">
                                    LeetCode, HackerRank, or any coding problem
                                </span>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleTypeSelect("cs")}
                                className="p-6 rounded-xl border-2 border-border hover:border-emerald-500 bg-card transition-all flex flex-col items-center gap-3 cursor-pointer group"
                            >
                                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                                    <BookOpen className="w-6 h-6 text-emerald-500" />
                                </div>
                                <span className="font-semibold text-foreground text-lg">
                                    Core Concept
                                </span>
                                <span className="text-sm text-muted-foreground text-center">
                                    OS, DBMS, Networks, System Design, etc.
                                </span>
                            </motion.button>
                        </div>
                    ) : (
                        <AddCardForm
                            cardType={cardType}
                            onSubmitted={handleSubmitted}
                        />
                    )}
                </div>

                {/* Back button (only shown when in form step, before the form's own submit) */}
                {step === "form" && (
                    <div className="px-6 pb-4">
                        <Button
                            variant="ghost"
                            onClick={() => setStep("choose")}
                            className="font-semibold"
                        >
                            ← Back
                        </Button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
