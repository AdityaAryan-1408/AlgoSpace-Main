'use client';

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { AddCardForm } from "@/components/AddCardForm";
import type { AddCardFormDefaults } from "@/components/AddCardForm";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Zap, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import type { CardType, Difficulty } from "@/data";

function AddCardPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [saved, setSaved] = useState(false);

    // Read URL params
    const title = searchParams.get("title") || "";
    const url = searchParams.get("url") || "";
    const difficulty = (searchParams.get("difficulty") || "medium").toLowerCase() as Difficulty;
    const tagsParam = searchParams.get("tags") || "";
    const description = searchParams.get("description") || "";
    const isFromExtension = !!(title || url);

    const defaults: AddCardFormDefaults = {
        type: "leetcode",
        title,
        url,
        difficulty: ["easy", "medium", "hard"].includes(difficulty)
            ? difficulty
            : "medium",
        tags: tagsParam,
        description,
    };

    useEffect(() => {
        const saved = localStorage.getItem("algotrack-dark-mode");
        if (
            saved === "true" ||
            (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)
        ) {
            setIsDarkMode(true);
            document.documentElement.classList.add("dark");
        }
    }, []);

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        localStorage.setItem("algotrack-dark-mode", String(isDarkMode));
    }, [isDarkMode]);

    const handleSubmitted = () => {
        setSaved(true);
        setTimeout(() => router.push("/"), 1500);
    };

    if (saved) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center flex flex-col items-center gap-4"
                >
                    <div className="w-16 h-16 rounded-full bg-easy/20 flex items-center justify-center">
                        <Zap className="w-8 h-8 text-easy" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Card Saved!</h2>
                    <p className="text-muted-foreground">
                        Redirecting to dashboard…
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-200">
            {/* Nav */}
            <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
                <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push("/")}
                            className="gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Dashboard
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-foreground rounded-lg flex items-center justify-center">
                                <span className="text-background font-bold text-sm leading-none">A</span>
                            </div>
                            <span className="font-bold text-sm tracking-tight hidden sm:inline-block">
                                AlgoTrack
                            </span>
                        </div>
                        <div className="w-px h-6 bg-border mx-2" />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className="rounded-full"
                        >
                            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </Button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-3xl mx-auto px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col gap-6"
                >
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">
                            New DSA Problem
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Fill in the details below
                        </p>
                    </div>

                    {isFromExtension && (
                        <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 rounded-xl bg-easy/10 border border-easy/20 flex items-center gap-2"
                        >
                            <Zap className="w-4 h-4 text-easy shrink-0" />
                            <span className="text-sm font-medium text-easy">
                                Problem auto-detected from LeetCode — review the details and save.
                            </span>
                        </motion.div>
                    )}

                    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                        <AddCardForm
                            cardType="leetcode"
                            defaults={defaults}
                            onSubmitted={handleSubmitted}
                            submitLabel="Save Card"
                        />
                    </div>
                </motion.div>
            </main>
        </div>
    );
}

export default function AddCardPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-background flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                </div>
            }
        >
            <AddCardPageContent />
        </Suspense>
    );
}
