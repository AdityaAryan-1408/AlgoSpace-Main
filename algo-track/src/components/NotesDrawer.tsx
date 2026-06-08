'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, FileText, Check, Loader2, PenLine, Layout, Sparkles } from "lucide-react";
import { RichNotesEditor } from "./RichNotesEditor";
import { WhiteboardCanvas } from "./WhiteboardCanvas";
import { updateCard } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { isSystemDesignCard } from "@/lib/card-utils";
import { SystemDesignCanvas } from "@/components/SystemDesignCanvas";
import { SystemDesignAssistant } from "@/components/SystemDesignAssistant";
import type { Flashcard } from "@/data";

interface NotesPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  card: Flashcard;
  onSaved?: () => void;
}

const MIN_WIDTH = 340;
const MAX_WIDTH = 700;
const DEFAULT_WIDTH = 420;

export function NotesPanel({
  isOpen,
  onToggle,
  card,
  onSaved,
}: NotesPanelProps) {
  const cardId = card.id;
  const cardTitle = card.title;
  const fallbackMarkdown = card.notes;
  const hasNotes = !!(card.richNotes || card.notes?.trim());
  const [richNotes, setRichNotes] = useState<string | undefined>(card.richNotes);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [systemDesignTab, setSystemDesignTab] = useState<"richNotes" | "canvas" | "assistant">("richNotes");
  const [canvasData, setCanvasData] = useState<string>("");
  const [editorKey, setEditorKey] = useState("editor-drawer-notes");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentCardId = useRef(cardId);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Reset when card changes
  useEffect(() => {
    currentCardId.current = cardId;
    setSaveStatus("idle");
    setCanvasData((card.metadata?.systemDesignCanvas as string) || "");
    setRichNotes(card.richNotes);
    setEditorKey(`editor-drawer-${cardId}-${Date.now()}`);
  }, [cardId, card]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onToggle();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onToggle]);

  // Drag resize handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
  }, [panelWidth]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = dragStartX.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth.current + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleChange = useCallback((content: string) => {
    setRichNotes(content);
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    setSaveStatus("saving");
    saveTimeout.current = setTimeout(async () => {
      try {
        await updateCard(currentCardId.current, { richNotes: content });
        setSaveStatus("saved");
        if (onSaved) onSaved();
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Failed to save notes:", err);
        setSaveStatus("idle");
      }
    }, 1500);
  }, [onSaved]);

  const handleCanvasChange = useCallback((newCanvasData: string) => {
    setCanvasData(newCanvasData);
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    setSaveStatus("saving");
    saveTimeout.current = setTimeout(async () => {
      try {
        await updateCard(currentCardId.current, {
          metadata: {
            ...card.metadata,
            systemDesignCanvas: newCanvasData
          }
        });
        setSaveStatus("saved");
        if (onSaved) onSaved();
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Failed to save canvas:", err);
        setSaveStatus("idle");
      }
    }, 1500);
  }, [card, onSaved]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* ── Side Tab Handle ── Always visible on the right edge */}
      <button
        onClick={onToggle}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-0.5 px-1 py-3 rounded-l-lg border border-r-0 border-border shadow-md transition-all duration-200 cursor-pointer group ${
          isOpen
            ? "bg-card hover:bg-muted/50"
            : hasNotes
              ? "bg-primary/10 border-primary/30 hover:bg-primary/20"
              : "bg-card hover:bg-muted/50"
        }`}
        style={{ right: isOpen ? `${panelWidth}px` : "0px", transition: isDragging ? "none" : "right 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}
        title="Toggle Notes (N)"
      >
        <div className="flex flex-col items-center gap-1.5">
          {isOpen ? (
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          )}
          {/* Notes indicator dot */}
          {!isOpen && hasNotes && (
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse-slow" />
          )}
        </div>
      </button>

      {/* ── Side Panel ── */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 z-40 flex flex-col bg-card border-l border-border shadow-2xl"
        style={{
          width: `${panelWidth}px`,
          transform: isOpen ? "translateX(0)" : `translateX(100%)`,
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Drag handle (left edge) */}
        <div
          onMouseDown={handleDragStart}
          className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 transition-colors z-10 ${isDragging ? "bg-primary/40" : ""}`}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-foreground truncate">{cardTitle}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] shrink-0">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-emerald-500">
                <Check className="w-3 h-3" />
                Saved
              </span>
            )}
          </div>
        </div>

        {/* Scrollable content: notes + whiteboard */}
        <div className="flex-1 overflow-y-auto">
          {/* Notes / Diagram switcher */}
          <div className="p-3">
            {isSystemDesignCard(card.type, card.tags) ? (
              <div className="flex flex-col gap-3">
                {/* Tab switcher headers */}
                <div className="flex border-b border-border gap-1 shrink-0 pb-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={systemDesignTab === "richNotes" ? "secondary" : "ghost"}
                    onClick={() => setSystemDesignTab("richNotes")}
                    className="h-8 px-2.5 text-[11px] gap-1 rounded-lg cursor-pointer"
                  >
                    <FileText className="w-3 h-3" />
                    Notes
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={systemDesignTab === "canvas" ? "secondary" : "ghost"}
                    onClick={() => setSystemDesignTab("canvas")}
                    className="h-8 px-2.5 text-[11px] gap-1 rounded-lg cursor-pointer"
                  >
                    <Layout className="w-3 h-3" />
                    Canvas
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={systemDesignTab === "assistant" ? "secondary" : "ghost"}
                    onClick={() => setSystemDesignTab("assistant")}
                    className="h-8 px-2.5 text-[11px] gap-1 rounded-lg text-purple-400 hover:text-purple-300 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    AI Assistant
                  </Button>
                </div>

                {/* Tab Content */}
                {systemDesignTab === "richNotes" && (
                  <RichNotesEditor
                    key={`rich-notes-${editorKey}`}
                    initialContent={richNotes}
                    fallbackMarkdown={fallbackMarkdown}
                    onChange={handleChange}
                    placeholder="Add architectural design specifications here..."
                  />
                )}

                {systemDesignTab === "canvas" && (
                  <div className="h-[500px]">
                    <SystemDesignCanvas
                      value={canvasData}
                      onChange={handleCanvasChange}
                    />
                  </div>
                )}

                {systemDesignTab === "assistant" && (
                  <SystemDesignAssistant
                    currentNotes={richNotes || ""}
                    currentCanvas={canvasData}
                    onNotesGenerated={(txt) => {
                      setRichNotes(txt);
                      setEditorKey(`editor-drawer-notes-${Date.now()}`);
                      handleChange(txt);
                    }}
                    onDiagramGenerated={(diag) => {
                      setCanvasData(diag);
                      handleCanvasChange(diag);
                    }}
                    onSelectTab={(tab) => setSystemDesignTab(tab)}
                  />
                )}
              </div>
            ) : (
              <RichNotesEditor
                key={cardId}
                initialContent={richNotes}
                fallbackMarkdown={fallbackMarkdown}
                onChange={handleChange}
              />
            )}
          </div>

          {/* Whiteboard toggle */}
          <div className="border-t border-border">
            <button
              onClick={() => setWhiteboardOpen(!whiteboardOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <PenLine className="w-3.5 h-3.5" />
                Whiteboard
              </div>
              {whiteboardOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Whiteboard canvas */}
            {whiteboardOpen && (
              <div className="px-2 pb-3">
                <WhiteboardCanvas
                  cardId={cardId}
                  defaultExpanded
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/5 shrink-0">
          <p className="text-[10px] text-muted-foreground text-center">
            <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[9px] font-mono">N</kbd> toggle
            · <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[9px] font-mono">/</kbd> commands
            · Drag left edge to resize
          </p>
        </div>
      </div>
    </>,
    document.body
  );
}
