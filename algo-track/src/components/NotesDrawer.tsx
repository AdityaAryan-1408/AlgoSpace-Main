'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { X, FileText, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RichNotesEditor } from "./RichNotesEditor";
import { updateCard } from "@/lib/client-api";

interface NotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  cardTitle: string;
  richNotes?: string;
  fallbackMarkdown?: string;
}

export function NotesDrawer({
  isOpen,
  onClose,
  cardId,
  cardTitle,
  richNotes,
  fallbackMarkdown,
}: NotesDrawerProps) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentCardId = useRef(cardId);

  // Reset when card changes
  useEffect(() => {
    currentCardId.current = cardId;
    setSaveStatus("idle");
  }, [cardId]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const handleChange = useCallback((content: string) => {
    // Debounced auto-save
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    setSaveStatus("saving");

    saveTimeout.current = setTimeout(async () => {
      try {
        await updateCard(currentCardId.current, { richNotes: content });
        setSaveStatus("saved");
        // Reset to idle after 2 seconds
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Failed to save notes:", err);
        setSaveStatus("idle");
      }
    }, 1500);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[420px] md:w-[480px] bg-card border-l border-border shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">Notes</h3>
                  <p className="text-[11px] text-muted-foreground truncate">{cardTitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Save Status */}
                <div className="flex items-center gap-1.5 text-[11px]">
                  {saveStatus === "saving" && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving...
                    </span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="flex items-center gap-1 text-emerald-500">
                      <Check className="w-3 h-3" />
                      Saved
                    </span>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-y-auto p-4">
              <RichNotesEditor
                key={cardId}
                initialContent={richNotes}
                fallbackMarkdown={fallbackMarkdown}
                onChange={handleChange}
              />
            </div>

            {/* Footer hint */}
            <div className="px-5 py-2.5 border-t border-border bg-muted/5">
              <p className="text-[10px] text-muted-foreground text-center">
                Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[9px] font-mono">N</kbd> to toggle
                 · Type <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[9px] font-mono">/</kbd> for commands
                 · Auto-saves after 1.5s
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
