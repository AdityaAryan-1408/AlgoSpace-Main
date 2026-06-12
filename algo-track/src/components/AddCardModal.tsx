'use client';

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { X, Code, BookOpen, Database, GripVertical, RotateCcw, ChevronLeft } from "lucide-react";
import { motion } from "motion/react";
import { AddCardForm } from "@/components/AddCardForm";
import type { CardType, Flashcard } from "@/data";

interface AddCardModalProps {
    onClose: () => void;
    onAdded: () => void;
    cards?: Flashcard[];
}

const WindowsMaximizeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
        <rect x="3" y="3" width="10" height="10" />
    </svg>
);

const WindowsRestoreIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
        <path d="M5.5 5.5V3.5h7v7h-2" />
        <rect x="3.5" y="5.5" width="7" height="7" />
    </svg>
);

export function AddCardModal({ onClose, onAdded, cards }: AddCardModalProps) {
    const backdropRef = useRef<HTMLDivElement>(null);
    const [step, setStep] = useState<"choose" | "form">("choose");
    const [cardType, setCardType] = useState<CardType>("leetcode");
    const [isMaximized, setIsMaximized] = useState(false);
    const [dimensions, setDimensions] = useState<{
        width: number;
        height: number;
        left: number;
        top: number;
    } | null>(null);

    // Initialize dimensions on mount to center the modal
    const resetToDefault = (targetStep?: "choose" | "form") => {
        setIsMaximized(false);
        const activeStep = (targetStep === "choose" || targetStep === "form") ? targetStep : step;
        const defaultWidth = Math.min(window.innerWidth - 32, 672); // max-w-2xl equivalent (672px)
        const defaultHeight = activeStep === "choose"
            ? Math.min(window.innerHeight - 32, 380)
            : Math.min(window.innerHeight - 32, window.innerHeight * 0.85);
        const left = (window.innerWidth - defaultWidth) / 2;
        const top = (window.innerHeight - defaultHeight) / 2;

        setDimensions({
            width: defaultWidth,
            height: defaultHeight,
            left,
            top,
        });
    };

    useEffect(() => {
        resetToDefault("choose");
    }, []);

    const startDragOrResize = (
        e: React.PointerEvent,
        action: "drag" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se"
    ) => {
        if (isMaximized) return;
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = dimensions?.left ?? 0;
        const startTop = dimensions?.top ?? 0;
        const startWidth = dimensions?.width ?? 0;
        const startHeight = dimensions?.height ?? 0;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            let nextLeft = startLeft;
            let nextTop = startTop;
            let nextWidth = startWidth;
            let nextHeight = startHeight;

            const minW = 400;
            const minH = 300;

            if (action === "drag") {
                nextLeft = Math.max(-nextWidth + 100, Math.min(window.innerWidth - 100, startLeft + dx));
                nextTop = Math.max(0, Math.min(window.innerHeight - 60, startTop + dy));
            } else {
                // Resize calculations
                if (action.includes("n")) {
                    const newHeight = startHeight - dy;
                    if (newHeight >= minH) {
                        nextHeight = newHeight;
                        nextTop = startTop + dy;
                    }
                }
                if (action.includes("s")) {
                    const newHeight = startHeight + dy;
                    if (newHeight >= minH) {
                        nextHeight = newHeight;
                    }
                }
                if (action.includes("e")) {
                    const newWidth = startWidth + dx;
                    if (newWidth >= minW) {
                        nextWidth = newWidth;
                    }
                }
                if (action.includes("w")) {
                    const newWidth = startWidth - dx;
                    if (newWidth >= minW) {
                        nextWidth = newWidth;
                        nextLeft = startLeft + dx;
                    }
                }
            }

            setDimensions({
                width: nextWidth,
                height: nextHeight,
                left: nextLeft,
                top: nextTop,
            });
        };

        const handlePointerUp = () => {
            document.removeEventListener("pointermove", handlePointerMove);
            document.removeEventListener("pointerup", handlePointerUp);
        };

        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", handlePointerUp);
    };

    const handleTypeSelect = (type: CardType) => {
        setCardType(type);
        setStep("form");
        resetToDefault("form");
    };

    const handleSubmitted = () => {
        onAdded();
        onClose();
    };

    const modalClass = isMaximized
        ? "fixed inset-0 z-50 bg-card flex flex-col w-screen h-screen max-w-none max-h-none rounded-none border-none relative"
        : dimensions
            ? "bg-card rounded-2xl shadow-xl flex flex-col border border-border relative"
            : "w-full max-w-2xl bg-card rounded-2xl shadow-xl flex flex-col max-h-[90vh] border border-border relative";

    const modalStyle = isMaximized
        ? { transform: "none" }
        : dimensions
            ? {
                width: `${dimensions.width}px`,
                height: `${dimensions.height}px`,
                left: `${dimensions.left}px`,
                top: `${dimensions.top}px`,
                position: "absolute" as const,
                transform: "none",
            }
            : undefined;

    return (
        <div
            ref={backdropRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className={modalClass}
                style={modalStyle}
            >
                {/* 8 Resize Handles */}
                {!isMaximized && dimensions && (
                    <>
                        {/* N */}
                        <div
                            onPointerDown={(e) => startDragOrResize(e, "n")}
                            className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-50"
                        />
                        {/* S */}
                        <div
                            onPointerDown={(e) => startDragOrResize(e, "s")}
                            className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize z-50"
                        />
                        {/* E */}
                        <div
                            onPointerDown={(e) => startDragOrResize(e, "e")}
                            className="absolute top-0 bottom-0 right-0 w-1.5 cursor-ew-resize z-50"
                        />
                        {/* W */}
                        <div
                            onPointerDown={(e) => startDragOrResize(e, "w")}
                            className="absolute top-0 bottom-0 left-0 w-1.5 cursor-ew-resize z-50"
                        />
                        {/* NW */}
                        <div
                            onPointerDown={(e) => startDragOrResize(e, "nw")}
                            className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize z-50"
                        />
                        {/* NE */}
                        <div
                            onPointerDown={(e) => startDragOrResize(e, "ne")}
                            className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize z-50"
                        />
                        {/* SW */}
                        <div
                            onPointerDown={(e) => startDragOrResize(e, "sw")}
                            className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize z-50"
                        />
                        {/* SE */}
                        <div
                            onPointerDown={(e) => startDragOrResize(e, "se")}
                            className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize z-50"
                        />
                    </>
                )}
                
                {/* Inner Content Wrapper */}
                <div className={isMaximized ? "flex flex-col flex-1 overflow-hidden" : "flex flex-col flex-1 overflow-hidden rounded-2xl"}>
                    {/* Header - Entire bar is draggable */}
                    <div
                    onPointerDown={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest("button") || target.closest("input") || target.closest("select") || target.closest("textarea")) {
                            return;
                        }
                        startDragOrResize(e, "drag");
                    }}
                    className="p-6 border-b border-border flex items-center justify-between select-none shrink-0 cursor-move"
                >
                    <div className="flex items-center gap-3">
                        {!isMaximized && (
                            <div
                                className="text-muted-foreground hover:text-foreground shrink-0 cursor-grab active:cursor-grabbing"
                                title="Drag to move"
                            >
                                <GripVertical className="w-5 h-5" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-foreground">
                                {step === "choose"
                                    ? "Add New Card"
                                    : cardType === "leetcode"
                                        ? "New DSA Problem"
                                        : cardType === "sql"
                                            ? "New SQL Query"
                                            : "New Core Concept"}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                {step === "choose"
                                    ? "Choose the type of card to add"
                                    : "Fill in the details below"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => resetToDefault()}
                            className="rounded-full shrink-0 hover:bg-muted"
                            title="Reset to default size"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMaximized(!isMaximized)}
                            className="rounded-full shrink-0 hover:bg-muted"
                            title={isMaximized ? "Restore size" : "Maximize window"}
                        >
                            {isMaximized ? <WindowsRestoreIcon /> : <WindowsMaximizeIcon />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="rounded-full shrink-0 hover:bg-muted"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === "choose" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                                onClick={() => handleTypeSelect("sql")}
                                className="p-6 rounded-xl border-2 border-border hover:border-orange-500 bg-card transition-all flex flex-col items-center gap-3 cursor-pointer group"
                            >
                                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                                    <Database className="w-6 h-6 text-orange-500" />
                                </div>
                                <span className="font-semibold text-foreground text-lg">
                                    SQL Query
                                </span>
                                <span className="text-sm text-muted-foreground text-center">
                                    SQL problems from LeetCode, HackerRank, etc.
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
                            cards={cards}
                        />
                    )}
                </div>
                </div>

                {/* Floating Pill Back Button */}
                {step === "form" && (() => {
                    const isPillsOnLeft = dimensions
                        ? (dimensions.left + dimensions.width + 80 > window.innerWidth)
                        : false;

                    const pillContainerClass = isMaximized
                        ? "absolute bottom-6 right-6 flex flex-row gap-3 z-[60] bg-card p-2 rounded-full border border-border shadow-lg"
                        : isPillsOnLeft
                            ? "absolute top-24 -left-14 flex flex-col gap-3 z-[60]"
                            : "absolute top-24 -right-14 flex flex-col gap-3 z-[60]";

                    const pillBaseClass = "w-11 h-11 rounded-full flex items-center justify-center bg-card border border-border shadow-md transition-all duration-200 hover:scale-105 select-none cursor-pointer relative group";

                    return (
                        <div className={pillContainerClass}>
                            <button
                                type="button"
                                onClick={() => {
                                    setStep("choose");
                                    resetToDefault("choose");
                                }}
                                className={`${pillBaseClass} text-muted-foreground hover:border-foreground/30 hover:bg-muted`}
                            >
                                <ChevronLeft className="w-5 h-5" />
                                {/* Tooltip */}
                                <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap bg-card text-foreground text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-md shadow-md border border-border z-[100] ${
                                    isMaximized 
                                        ? "bottom-full top-auto left-1/2 -translate-x-1/2 -translate-y-0 mb-2" 
                                        : isPillsOnLeft 
                                            ? "left-full ml-3" 
                                            : "right-full mr-3"
                                }`}>
                                    Go Back
                                </div>
                            </button>
                        </div>
                    );
                })()}
            </motion.div>
        </div>
    );
}
