'use client';

import { useEffect } from "react";

interface KeyboardShortcutHandlers {
    onAddCard: () => void;
    onReview: () => void;
    onDashboard: () => void;
    onRefresh: () => void;
    onToggleTheme: () => void;
    /** Whether a modal is currently open (shortcuts should be disabled) */
    isModalOpen: boolean;
}

/**
 * Global keyboard shortcuts:
 * - N: Open "Add Card" modal
 * - R: Open "Review" modal
 * - D: Go to Dashboard
 * - S: Sync/Refresh
 * - T: Toggle theme
 * - Esc: Close modals (handled by individual modal components)
 * - ?: Show shortcut hint (not implemented — just a tooltip)
 */
export function useKeyboardShortcuts({
    onAddCard,
    onReview,
    onDashboard,
    onRefresh,
    onToggleTheme,
    isModalOpen,
}: KeyboardShortcutHandlers) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Don't fire shortcuts when typing in inputs
            const target = e.target as HTMLElement;
            const isInput =
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.tagName === "SELECT" ||
                target.isContentEditable;

            if (isInput || isModalOpen) return;

            switch (e.key.toLowerCase()) {
                case "n":
                    e.preventDefault();
                    onAddCard();
                    break;
                case "r":
                    e.preventDefault();
                    onReview();
                    break;
                case "d":
                    e.preventDefault();
                    onDashboard();
                    break;
                case "s":
                    e.preventDefault();
                    onRefresh();
                    break;
                case "t":
                    e.preventDefault();
                    onToggleTheme();
                    break;
            }
        };

        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onAddCard, onReview, onDashboard, onRefresh, onToggleTheme, isModalOpen]);
}
