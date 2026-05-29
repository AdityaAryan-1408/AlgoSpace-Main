'use client';

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Loader2, Sliders, X, HelpCircle, Keyboard, Palette, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { updateUserProfile } from "@/lib/client-api";

interface PreferencesModalProps {
    currentTheme: string;
    keyboardShortcutsEnabled: boolean;
    onClose: () => void;
    onChanged: (newPrefs: { defaultTheme: string; keyboardShortcutsEnabled: boolean }) => void;
}

const AVAILABLE_THEMES = [
    { id: "light", label: "Light", preview: "bg-white border-zinc-200 text-zinc-900" },
    { id: "dark", label: "Dark", preview: "bg-zinc-950 border-zinc-800 text-zinc-100" },
    { id: "theme-vscode", label: "VS Code", preview: "bg-[#1e1e1e] border-blue-900/30 text-[#9cdcfe]" },
    { id: "theme-ocean", label: "Deep Ocean", preview: "bg-[#0b192c] border-cyan-900/30 text-cyan-400" },
    { id: "theme-github", label: "GitHub Dark", preview: "bg-[#0d1117] border-zinc-800 text-zinc-200" },
    { id: "theme-dracula", label: "Dracula", preview: "bg-[#282a36] border-purple-900/30 text-[#ff79c6]" },
    { id: "theme-monokai", label: "Monokai", preview: "bg-[#272822] border-yellow-900/30 text-[#f92672]" },
    { id: "theme-gruvbox", label: "Gruvbox", preview: "bg-[#282828] border-orange-950/30 text-[#fabd2f]" },
];

const SHORTCUTS = [
    { key: "N", desc: "Open 'Add Card' modal" },
    { key: "R", desc: "Open 'Review' modal" },
    { key: "D", desc: "Navigate to Dashboard" },
    { key: "S", desc: "Manual Sync / Refresh data" },
    { key: "T", desc: "Toggle between Light and Dark mode" },
];

export function PreferencesModal({
    currentTheme,
    keyboardShortcutsEnabled,
    onClose,
    onChanged,
}: PreferencesModalProps) {
    const [theme, setTheme] = useState(currentTheme);
    const [shortcutsEnabled, setShortcutsEnabled] = useState(keyboardShortcutsEnabled);
    const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            await updateUserProfile({
                preferences: {
                    defaultTheme: theme,
                    keyboardShortcutsEnabled: shortcutsEnabled,
                },
            });
            onChanged({ defaultTheme: theme, keyboardShortcutsEnabled: shortcutsEnabled });
        } catch (err) {
            console.error("Failed to save user preferences:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
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
                        <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
                            <Sliders className="w-4 h-4 text-cyan-500" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-foreground">
                                Preferences &amp; Settings
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Personalize your AlgoSpace dashboard
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
                <div className="p-5 flex flex-col gap-6 max-h-[75vh] overflow-y-auto">
                    {/* Keyboard Shortcuts option */}
                    <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-muted/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Keyboard className="w-4 h-4 text-muted-foreground" />
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-semibold text-foreground">
                                            Enable Keyboard Shortcuts
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
                                            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                            title="View shortcuts details"
                                        >
                                            <HelpCircle className="w-4 h-4 text-cyan-500" />
                                        </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Use quick keys for navigation and actions
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShortcutsEnabled(!shortcutsEnabled)}
                                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                                    shortcutsEnabled ? "bg-cyan-500" : "bg-muted-foreground/30"
                                }`}
                            >
                                <div
                                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                                        shortcutsEnabled ? "translate-x-5.5" : "translate-x-0.5"
                                    }`}
                                />
                            </button>
                        </div>

                        {/* Collapsible Shortcut Guide */}
                        <AnimatePresence>
                            {showShortcutsHelp && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-3 p-3 rounded-lg border border-border bg-card space-y-2">
                                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                                            Available Shortcuts
                                        </h4>
                                        <div className="grid grid-cols-1 gap-2">
                                            {SHORTCUTS.map((shortcut) => (
                                                <div
                                                    key={shortcut.key}
                                                    className="flex items-center gap-3 text-xs"
                                                >
                                                    <kbd className="px-2 py-0.5 text-[10px] font-bold text-foreground bg-muted border border-border rounded-md shadow-sm min-w-[20px] text-center">
                                                        {shortcut.key}
                                                    </kbd>
                                                    <span className="text-muted-foreground">
                                                        {shortcut.desc}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Theme selector option */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <Palette className="w-4 h-4 text-muted-foreground" />
                            <div>
                                <span className="text-sm font-semibold text-foreground">
                                    Default App Theme
                                </span>
                                <p className="text-xs text-muted-foreground">
                                    This theme will persist on the cloud across all your devices
                                </p>
                            </div>
                        </div>

                        {/* Grid of beautiful theme cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {AVAILABLE_THEMES.map((t) => {
                                const isSelected = theme === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => setTheme(t.id)}
                                        className={`group relative text-left p-3 rounded-xl border text-xs font-bold transition-all overflow-hidden flex flex-col justify-between h-20 cursor-pointer ${
                                            isSelected
                                                ? "border-cyan-500 bg-cyan-500/5 shadow-md shadow-cyan-950/5 scale-[1.02]"
                                                : "border-border hover:border-foreground/20 hover:scale-[1.01]"
                                        }`}
                                    >
                                        {/* Color preview background block */}
                                        <div className={`w-full h-8 rounded-lg border ${t.preview} p-1 flex items-center justify-between shrink-0 mb-1.5`}>
                                            <span className="text-[9px] uppercase tracking-wider opacity-80">Aa</span>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-cyan-500" />}
                                        </div>
                                        
                                        <span className={`text-[11px] truncate leading-tight ${isSelected ? 'text-cyan-500 font-extrabold' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                            {t.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-5 border-t border-border flex items-center justify-end gap-2.5 bg-muted/10">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="rounded-full"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="rounded-full font-semibold gap-1.5 bg-cyan-500 hover:bg-cyan-600 text-white px-5 py-4 h-9"
                    >
                        {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Save Settings
                    </Button>
                </div>
            </motion.div>
        </div>,
        document.body,
    );
}
