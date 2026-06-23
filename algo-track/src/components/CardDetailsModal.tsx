import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MarkdownContent } from "@/components/MarkdownContent";

import type { Flashcard } from "@/data";
import { updateCard, deleteCard, pauseCardReview, resumeCardReview, fetchAllCards, fetchCardDetails } from "@/lib/client-api";
import { canPauseCard, isCardPaused, pauseThreshold } from "@/lib/card-utils";
import { getStoredAiReview } from "@/components/CodePractice";
import type { StoredAiReview } from "@/components/CodePractice";
import { RichNotesEditor } from "@/components/RichNotesEditor";
import { CodeEvolution } from "@/components/CodeEvolution";
import { AiStudyAssistant } from "@/components/AiStudyAssistant";
import { X, ExternalLink, FileText, BookOpen, Plus, Loader2, Trash2, Link2, Brain, Check, Edit2, Pause, Play, GripVertical, Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw, Layout, Sparkles, Info, Save } from "lucide-react";
import { motion, useDragControls, AnimatePresence } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { useConfirmModal } from "@/components/ConfirmModal";
import { createPortal } from "react-dom";
import { AddCardForm, AddCardFormDefaults } from "./AddCardForm";
import { isSystemDesignCard } from "@/lib/card-utils";
import { SystemDesignCanvas } from "@/components/SystemDesignCanvas";
import { SystemDesignAssistant } from "@/components/SystemDesignAssistant";
import { highlightTextInDOM, extractTextFromRichNotes } from "@/lib/highlight";

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

interface CardDetailsModalProps {
  card: Flashcard | null;
  allCards?: Flashcard[];
  onClose: () => void;
  onSaved: () => void;
  searchQuery?: string;
}

export function CardDetailsModal({
  card: propCard,
  allCards: propAllCards,
  onClose,
  onSaved,
  searchQuery,
}: CardDetailsModalProps) {
  const [card, setCard] = useState<Flashcard | null>(propCard);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const dragControls = useDragControls();
  const backdropRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [aiReview, setAiReview] = useState<StoredAiReview | null>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
    left: number;
    top: number;
  } | null>(null);

  // Initialize dimensions on mount to center the modal
  const resetToDefault = () => {
    setIsMaximized(false);
    const defaultWidth = Math.min(window.innerWidth - 32, 768); // max-w-3xl equivalent (768px)
    const defaultHeight = Math.min(window.innerHeight - 32, window.innerHeight * 0.85);
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
    resetToDefault();
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
  const [isPausing, setIsPausing] = useState(false);
  const [richNotes, setRichNotes] = useState<string | undefined>(undefined);
  const [systemDesignTab, setSystemDesignTab] = useState<"richNotes" | "canvas" | "assistant">("richNotes");
  const [cardStudyTab, setCardStudyTab] = useState<"richNotes" | "aiTools">("richNotes");
  const [canvasData, setCanvasData] = useState<string>("");
  const [editorKey, setEditorKey] = useState("editor-details-desc");
  const [isResuming, setIsResuming] = useState(false);
  const [showResumeOptions, setShowResumeOptions] = useState(false);
  const [modalCalendarMonth, setModalCalendarMonth] = useState(() => new Date());
  const [showModalCalendar, setShowModalCalendar] = useState(false);
  const modalCalendarBtnRef = useRef<HTMLButtonElement>(null);
  const [modalCalendarRect, setModalCalendarRect] = useState<DOMRect | null>(null);
  const [showDetailsPopover, setShowDetailsPopover] = useState(false);
  const detailsPopoverRef = useRef<HTMLDivElement>(null);
  const [fetchedCards, setFetchedCards] = useState<Flashcard[]>([]);

  useEffect(() => {
    if (!propAllCards || propAllCards.length === 0) {
      fetchAllCards().then(setFetchedCards).catch(console.error);
    }
  }, [propAllCards]);

  useEffect(() => {
    if (contentRef.current) {
      const query = searchQuery || "";
      const timer = setTimeout(() => {
        if (contentRef.current) {
          highlightTextInDOM(contentRef.current, query);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, card, richNotes, cardStudyTab, systemDesignTab, isEditing, loadingDetails]);

  const allCards = propAllCards && propAllCards.length > 0 ? propAllCards : fetchedCards;

  const isReference = card?.metadata?.reference_only === true;

  const handleAddToQueue = async (days: number) => {
    if (!card) return;
    setIsResuming(true);
    try {
      const { reference_only, ...restMetadata } = card.metadata || {};
      const nextDate = new Date();
      nextDate.setHours(0, 0, 0, 0);
      nextDate.setDate(nextDate.getDate() + days);

      await updateCard(card.id, {
        metadata: restMetadata,
        nextReview: nextDate.toISOString(),
        dueInDays: days
      });
      onSaved();
    } catch (err) {
      console.error("Failed to add card to review queue:", err);
    } finally {
      setIsResuming(false);
      setShowResumeOptions(false);
    }
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const nextModalCalendarMonth = () => setModalCalendarMonth(new Date(modalCalendarMonth.getFullYear(), modalCalendarMonth.getMonth() + 1, 1));
  const prevModalCalendarMonth = () => setModalCalendarMonth(new Date(modalCalendarMonth.getFullYear(), modalCalendarMonth.getMonth() - 1, 1));

  const renderModalCalendarDays = () => {
    const year = modalCalendarMonth.getFullYear();
    const month = modalCalendarMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cardsByDate = new Map<string, number>();
    allCards.forEach(c => {
      let d: Date;
      if (c.nextReview) {
        d = new Date(c.nextReview);
      } else {
        d = new Date();
        d.setDate(d.getDate() + (c.dueInDays || 0));
      }
      if (isNaN(d.getTime())) return;
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      cardsByDate.set(dStr, (cardsByDate.get(dStr) || 0) + 1);
    });

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-8 h-8" />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dueCount = cardsByDate.get(dateStr) || 0;
      const dayDate = new Date(year, month, d);
      dayDate.setHours(0, 0, 0, 0);

      const isPast = dayDate < today;
      const isToday = dayDate.getTime() === today.getTime();

      let workloadClass = "text-foreground hover:bg-muted";
      if (isPast) {
        workloadClass = "text-muted-foreground/30 cursor-not-allowed";
      } else if (dueCount > 0) {
        if (dueCount > 20) workloadClass = "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/30";
        else if (dueCount > 10) workloadClass = "bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 hover:bg-orange-500/30";
        else if (dueCount > 5) workloadClass = "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-500/30";
        else workloadClass = "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30";
      }

      if (isToday) {
        workloadClass += " ring-1 ring-primary ring-offset-1 ring-offset-background";
      }

      days.push(
        <button
          key={`day-${d}`}
          type="button"
          disabled={isPast}
          onClick={async () => {
            setShowModalCalendar(false);
            const diffTime = dayDate.getTime() - today.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            if (isReference) {
              await handleAddToQueue(diffDays);
            } else {
              await handleResume(diffDays);
            }
          }}
          className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center p-0 text-[10px] font-semibold transition-all relative cursor-pointer ${workloadClass}`}
        >
          <span>{d}</span>
          {!isPast && dueCount > 0 && (
            <span className="text-[7px] font-extrabold leading-none mt-[-1px] opacity-90">{dueCount}</span>
          )}
        </button>
      );
    }
    return days;
  };

  useEffect(() => {
    if (propCard) {
      setCard(propCard);
      setTags(propCard.tags);
      setNotes(propCard.notes || "");
      setRichNotes(propCard.richNotes);
      setReviewNote((propCard.metadata?.reviewNote as string) || "");
      setCanvasData((propCard.metadata?.systemDesignCanvas as string) || "");

      // If we already have the detailed fields, load instantly without network request or spinner
      const hasDetails = !!(propCard.description || propCard.notes || propCard.richNotes || propCard.solution || (propCard.solutions && propCard.solutions.length > 0));

      if (hasDetails) {
        setLoadingDetails(false);
      } else {
        setLoadingDetails(true);
        fetchCardDetails(propCard.id)
          .then((fullCard) => {
            setCard(fullCard);
            setTags(fullCard.tags);
            setNotes(fullCard.notes);
            setRichNotes(fullCard.richNotes);
            setReviewNote((fullCard.metadata?.reviewNote as string) || "");
            setCanvasData((fullCard.metadata?.systemDesignCanvas as string) || "");
          })
          .catch((err) => {
            console.error("Failed to fetch card details:", err);
          })
          .finally(() => {
            setLoadingDetails(false);
          });
      }
      setAiReview(getStoredAiReview(propCard.id));
    }
  }, [propCard]);

  if (!card) return null;

  const solutionBlocks =
    card.solutions && card.solutions.length > 0
      ? card.solutions
      : card.solution
        ? [{ name: "Solution", content: card.solution }]
        : [];

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTag.trim()) {
      if (!tags.includes(newTag.trim())) {
        setTags([...tags, newTag.trim()]);
      }
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showDetailsPopover && detailsPopoverRef.current && !detailsPopoverRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (target.closest(".z-\\[9999\\]") || target.closest(".z-\\[9998\\]")) {
          return;
        }
        setShowDetailsPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDetailsPopover]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const isSys = isSystemDesignCard(card.type, tags);
      const plainNotes = richNotes ? extractTextFromRichNotes(richNotes) : notes;
      await updateCard(card.id, { 
        notes: plainNotes, 
        richNotes,
        tags,
        metadata: { 
          ...card.metadata, 
          reviewNote,
          ...(isSys ? { systemDesignCanvas: canvasData } : {})
        }
      });
      onSaved();
    } catch (err) {
      console.error("Failed to save card:", err);
      setIsSaving(false);
    }
  };

  const { confirm } = useConfirmModal();

  const handleDelete = async () => {
    if (!card) return;
    const confirmed = await confirm({
      title: "Delete Card",
      message: `Delete "${card.title}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteCard(card.id);
      onSaved();
    } catch (err) {
      console.error("Failed to delete card:", err);
      setIsDeleting(false);
    }
  };

  const handlePause = async () => {
    if (!card) return;
    setIsPausing(true);
    try {
      await pauseCardReview(card.id);
      onSaved();
    } catch (err) {
      console.error("Failed to pause card:", err);
      setIsPausing(false);
    }
  };

  const handleResume = async (days: number) => {
    if (!card) return;
    setIsResuming(true);
    try {
      await resumeCardReview(card.id, days);
      onSaved();
    } catch (err) {
      console.error("Failed to resume card:", err);
      setIsResuming(false);
      setShowResumeOptions(false);
    }
  };

  const handleMarkAsReference = async () => {
    if (!card) return;
    setIsResuming(true);
    try {
      await updateCard(card.id, {
        metadata: { ...card.metadata, reference_only: true },
        nextReview: "9999-12-31T23:59:59.999Z"
      });
      onSaved();
    } catch (err) {
      console.error("Failed to mark card as reference:", err);
    } finally {
      setIsResuming(false);
    }
  };

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className={isMaximized
          ? "fixed inset-0 z-50 bg-card flex flex-col w-screen h-screen max-w-none max-h-none rounded-none border-none relative"
          : !dimensions
            ? "w-full max-w-3xl bg-card rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-border relative"
            : "bg-card rounded-2xl shadow-2xl flex flex-col border border-border relative"
        }
        style={isMaximized
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
            : undefined
        }
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
        <div ref={contentRef} className={isMaximized ? "flex flex-col flex-1 overflow-hidden" : "flex flex-col flex-1 overflow-hidden rounded-2xl"}>
          {/* Header - Entire bar is draggable */}
          <div 
          onPointerDown={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest("button") || target.closest("input") || target.closest("select") || target.closest("textarea")) {
              return;
            }
            startDragOrResize(e, "drag");
          }}
          className="p-6 border-b border-border flex flex-col gap-4 bg-muted/10 cursor-move select-none shrink-0"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {!isMaximized && (
                <div
                  className="text-muted-foreground hover:text-foreground shrink-0 cursor-grab active:cursor-grabbing mt-1.5"
                  title="Drag to move"
                >
                  <GripVertical className="w-5 h-5" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={card.difficulty}
                    className="capitalize bg-transparent border-current text-current"
                  >
                    {card.difficulty}
                  </Badge>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    {card.type === "leetcode" ? "DSA" : card.type === "sql" ? "SQL" : "CS Core"}
                  </span>
                  {card.timeComplexity && (
                    <Badge variant="tag" className="bg-transparent border-tag/30 text-tag">
                      Time: {card.timeComplexity}
                    </Badge>
                  )}
                  {card.spaceComplexity && (
                    <Badge variant="tag" className="bg-transparent border-tag/30 text-tag">
                      Space: {card.spaceComplexity}
                    </Badge>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-foreground leading-tight">
                  {card.title}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={isEditing ? "secondary" : "outline"}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="hidden sm:flex"
              >
                {isEditing ? (
                  "Cancel Edit"
                ) : (
                  <>
                    <Edit2 className="w-4 h-4 mr-2" /> Edit
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(!isEditing)}
                className="sm:hidden rounded-full hover:bg-muted"
              >
                {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetToDefault}
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

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="tag"
                  className="bg-transparent border-tag/30 text-tag font-normal flex items-center gap-1 pl-2 pr-1.5 py-0.5"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:bg-tag/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <div className="flex items-center gap-1 bg-muted/30 border border-dashed border-border rounded-full px-2 py-0.5 focus-within:border-primary focus-within:bg-background transition-colors">
                <Plus className="w-3 h-3 text-muted-foreground" />
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Add tag..."
                  className="text-xs bg-transparent border-none focus:outline-none w-16 focus:w-24 transition-all text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
            {card.url && (
              <a
                href={card.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors"
              >
                View Problem <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Body */}
        {isEditing ? (
          <div className="flex-1 overflow-y-auto p-6">
            <AddCardForm
              cardType={card.type as any}
              mode="edit"
              cardId={card.id}
              submitLabel="Save Changes"
              onSubmitted={() => {
                setIsEditing(false);
                onSaved();
              }}
              defaults={{
                title: card.title,
                description: card.description,
                difficulty: card.difficulty,
                tags: card.tags?.join(", "),
                notes: card.notes,
                richNotes: card.richNotes,
                solutions: card.solutions || (card.solution ? [{ name: "Solution", content: card.solution }] : undefined),
                timeComplexity: card.timeComplexity || undefined,
                spaceComplexity: card.spaceComplexity || undefined,
                relatedProblems: card.relatedProblems?.map(p => p.url ? `${p.title} | ${p.url}` : p.title).join("\n"),
                url: card.url || undefined,
                metadata: card.metadata,
              }}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                Description
              </h3>
              {loadingDetails ? (
                <div className="h-24 flex items-center justify-center border border-border border-dashed rounded-xl bg-muted/5 animate-pulse">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground ml-2">Loading description...</span>
                </div>
              ) : (
                <RichNotesEditor
                  readOnly
                  initialContent={card.description}
                  fallbackMarkdown={card.description}
                />
              )}
            </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Rich Notes
            </h3>
            {loadingDetails ? (
              <div className="h-32 flex items-center justify-center border border-border border-dashed rounded-xl bg-muted/5 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground ml-2">Loading rich notes...</span>
              </div>
            ) : isSystemDesignCard(card.type, tags) ? (
              <div className="flex flex-col gap-3">
                {/* Tab switcher headers */}
                <div className="flex border-b border-border gap-1 shrink-0 pb-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={systemDesignTab === "richNotes" ? "secondary" : "ghost"}
                    onClick={() => setSystemDesignTab("richNotes")}
                    className="h-8 px-3 text-xs gap-1.5 rounded-lg cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Rich Notes
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={systemDesignTab === "canvas" ? "secondary" : "ghost"}
                    onClick={() => setSystemDesignTab("canvas")}
                    className="h-8 px-3 text-xs gap-1.5 rounded-lg cursor-pointer"
                  >
                    <Layout className="w-3.5 h-3.5" />
                    Canvas Diagram
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={systemDesignTab === "assistant" ? "secondary" : "ghost"}
                    onClick={() => setSystemDesignTab("assistant")}
                    className="h-8 px-3 text-xs gap-1.5 rounded-lg text-purple-400 hover:text-purple-300 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Assistant
                  </Button>
                </div>

                {/* Tab Content */}
                {systemDesignTab === "richNotes" && (
                  <RichNotesEditor
                    key={`rich-notes-${editorKey}`}
                    initialContent={richNotes}
                    fallbackMarkdown={notes}
                    onChange={(content) => {
                      setRichNotes(content);
                    }}
                    placeholder="Add architectural design specifications here..."
                  />
                )}

                {systemDesignTab === "canvas" && (
                  <div className="h-[600px]">
                    <SystemDesignCanvas
                      value={canvasData}
                      onChange={(val) => setCanvasData(val)}
                    />
                  </div>
                )}

                {systemDesignTab === "assistant" && (
                  <SystemDesignAssistant
                    currentNotes={richNotes || ""}
                    currentCanvas={canvasData}
                    onNotesGenerated={(txt) => {
                      setRichNotes(txt);
                      setEditorKey(`editor-notes-${Date.now()}`);
                    }}
                    onDiagramGenerated={(diag) => {
                      setCanvasData(diag);
                    }}
                    onSelectTab={(tab) => setSystemDesignTab(tab)}
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Tab switcher headers */}
                <div className="flex border-b border-border gap-1 shrink-0 pb-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={cardStudyTab === "richNotes" ? "secondary" : "ghost"}
                    onClick={() => setCardStudyTab("richNotes")}
                    className="h-8 px-3 text-xs gap-1.5 rounded-lg cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Rich Notes
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={cardStudyTab === "aiTools" ? "secondary" : "ghost"}
                    onClick={() => setCardStudyTab("aiTools")}
                    className="h-8 px-3 text-xs gap-1.5 rounded-lg text-purple-400 hover:text-purple-300 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Study Tools
                  </Button>
                </div>

                {/* Tab Content */}
                {cardStudyTab === "richNotes" && (
                  <RichNotesEditor
                    initialContent={richNotes}
                    fallbackMarkdown={card.notes}
                    onChange={(content) => {
                      setRichNotes(content);
                    }}
                  />
                )}

                {cardStudyTab === "aiTools" && (
                  <AiStudyAssistant
                    card={card}
                    currentNotes={richNotes || ""}
                    onNotesGenerated={(txt) => {
                      setRichNotes(txt);
                      setNotes(txt);
                      setEditorKey(`editor-notes-${Date.now()}`);
                    }}
                    onUpdateCard={async (updates) => {
                      try {
                        const newCard = await updateCard(card.id, updates);
                        if (updates.metadata) {
                          card.metadata = updates.metadata;
                        }
                        onSaved();
                      } catch (err) {
                        console.error("Failed to update card in study tools:", err);
                      }
                    }}
                  />
                )}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-emerald-500" />
              Next Review Note
            </h3>
            <textarea
              className="w-full min-h-15 text-sm text-foreground/90 leading-relaxed p-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y transition-shadow selectable"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Add a small note to remember during the next review..."
            />
          </section>

          {loadingDetails ? (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
                Solutions
              </h3>
              <div className="h-20 flex items-center justify-center border border-border border-dashed rounded-xl bg-muted/5 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground ml-2">Loading solutions...</span>
              </div>
            </section>
          ) : solutionBlocks.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
                Solutions
              </h3>
              <div className="flex flex-col gap-3">
                {solutionBlocks.map((solution, index) => {
                  const hasCodeFences = /```[\w+-]*\n/.test(solution.content);
                  return (
                    <div
                      key={`${solution.name}-${index}`}
                      className="w-full p-4 rounded-xl border border-border bg-muted/40"
                    >
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {solution.name}
                      </h4>
                      {hasCodeFences ? (
                        <MarkdownContent content={solution.content} />
                      ) : (
                        <pre className="text-sm font-mono text-foreground/90 leading-relaxed whitespace-pre-wrap overflow-x-auto selectable">
                          {solution.content}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}


          {/* AI Review */}
          {aiReview && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
                <Brain className="w-4 h-4 text-purple-500" />
                AI Review
                <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground ml-auto">
                  {new Date(aiReview.timestamp).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </h3>
              <div className={`rounded-xl border overflow-hidden ${aiReview.result.isCorrect
                  ? "border-emerald-500/20"
                  : "border-red-500/20"
                }`}>
                <div className={`px-4 py-2.5 flex items-center gap-2 ${aiReview.result.isCorrect
                    ? "bg-emerald-500/10"
                    : "bg-red-500/10"
                  }`}>
                  {aiReview.result.isCorrect ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <X className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-xs font-bold ${aiReview.result.isCorrect ? "text-emerald-500" : "text-red-500"
                    }`}>
                    {aiReview.result.isCorrect ? "Correct" : "Needs Improvement"}
                  </span>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${aiReview.result.suggestedRating === "EASY" ? "bg-emerald-500 text-white" :
                      aiReview.result.suggestedRating === "GOOD" ? "bg-blue-500 text-white" :
                        aiReview.result.suggestedRating === "HARD" ? "bg-orange-500 text-white" :
                          "bg-red-500 text-white"
                    }`}>
                    {aiReview.result.suggestedRating}
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="text-sm text-foreground/90 leading-relaxed">
                    <MarkdownContent content={aiReview.result.feedback} />
                  </div>

                  {aiReview.result.complexityAnalysis && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Your Complexity</p>
                        <p className="text-xs font-mono font-semibold text-foreground">Time: {aiReview.result.complexityAnalysis.userTime}</p>
                        <p className="text-xs font-mono font-semibold text-foreground">Space: {aiReview.result.complexityAnalysis.userSpace}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Optimal</p>
                        <p className="text-xs font-mono font-semibold text-foreground">Time: {aiReview.result.complexityAnalysis.optimalTime}</p>
                        <p className="text-xs font-mono font-semibold text-foreground">Space: {aiReview.result.complexityAnalysis.optimalSpace}</p>
                      </div>
                    </div>
                  )}

                  {aiReview.result.conceptCoverage && (
                    <div className="space-y-1.5">
                      {aiReview.result.conceptCoverage.coveredPoints.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-0.5">✓ Covered</p>
                          <ul className="text-xs text-foreground/80 space-y-0.5 ml-3">
                            {aiReview.result.conceptCoverage.coveredPoints.map((p, i) => (
                              <li key={i} className="list-disc">{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiReview.result.conceptCoverage.missedPoints.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-0.5">✗ Missed</p>
                          <ul className="text-xs text-foreground/80 space-y-0.5 ml-3">
                            {aiReview.result.conceptCoverage.missedPoints.map((p, i) => (
                              <li key={i} className="list-disc">{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {aiReview.userCode && (
                    <details className="text-xs">
                      <summary className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors font-medium">Your submitted code</summary>
                      <pre className="mt-2 p-3 rounded-lg bg-muted/50 border border-border/50 text-foreground/80 font-mono whitespace-pre-wrap overflow-x-auto">{aiReview.userCode}</pre>
                    </details>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Code Evolution */}
          {(card.type === "leetcode" || card.type === "sql") && (
            <CodeEvolution cardId={card.id} cardTitle={card.title} />
          )}

          {(card.relatedProblems?.length ?? 0) > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
                <Link2 className="w-4 h-4 text-muted-foreground" />
                Related Problems
              </h3>
              <div className="flex flex-col gap-2">
                {card.relatedProblems?.map((problem, index) => (
                  <div
                    key={`${problem.title}-${index}`}
                    className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-foreground">{problem.title}</span>
                    {problem.url ? (
                      <a
                        href={problem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-600"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">No link</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        )}
        </div>

        {/* Floating Side Action Pills */}
        {!isEditing && (() => {
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
              {/* Save & Close Pill */}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isDeleting}
                className={`${pillBaseClass} text-primary hover:border-primary/50 hover:bg-primary/10 hover:shadow-primary/10`}
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {/* Tooltip */}
                <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap bg-card text-foreground text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-md shadow-md border border-border z-[100] ${
                  isMaximized 
                    ? "bottom-full top-auto left-1/2 -translate-x-1/2 -translate-y-0 mb-2" 
                    : isPillsOnLeft 
                      ? "left-full ml-3" 
                      : "right-full mr-3"
                }`}>
                  Save & Close
                </div>
              </button>

              {/* Details & Review Pill */}
              <div className="relative" ref={detailsPopoverRef}>
                <button
                  type="button"
                  onClick={() => setShowDetailsPopover(!showDetailsPopover)}
                  className={`${pillBaseClass} ${
                    showDetailsPopover 
                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-500 shadow-cyan-500/10" 
                      : "text-cyan-500 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:shadow-cyan-500/10"
                  }`}
                >
                  <CalendarIcon className="w-5 h-5" />
                  {/* Tooltip */}
                  <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap bg-card text-foreground text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-md shadow-md border border-border z-[100] ${
                    isMaximized 
                      ? "bottom-full top-auto left-1/2 -translate-x-1/2 -translate-y-0 mb-2" 
                      : isPillsOnLeft 
                        ? "left-full ml-3" 
                        : "right-full mr-3"
                  }`}>
                    Review Details
                  </div>
                </button>

                {/* Details Popover */}
                <AnimatePresence>
                  {showDetailsPopover && (
                    <motion.div
                      initial={{ 
                        opacity: 0, 
                        scale: 0.95, 
                        y: isMaximized ? 10 : 0, 
                        x: isMaximized ? 0 : (isPillsOnLeft ? 10 : -10) 
                      }}
                      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                      exit={{ 
                        opacity: 0, 
                        scale: 0.95, 
                        y: isMaximized ? 10 : 0, 
                        x: isMaximized ? 0 : (isPillsOnLeft ? 10 : -10) 
                      }}
                      className={`absolute z-[70] w-72 p-4 bg-card border border-border rounded-2xl shadow-2xl flex flex-col gap-3 text-sm text-left ${
                        isMaximized
                          ? "bottom-full mb-3 right-0"
                          : isPillsOnLeft
                            ? "right-full mr-3 top-0"
                            : "left-full ml-3 top-0"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <Brain className="w-4 h-4 text-purple-500" />
                          Review Statistics
                        </span>
                        <span className="text-[10px] text-muted-foreground bg-muted border border-border/30 px-2 py-0.5 rounded-full font-bold">
                          {card.history?.total ?? 0} reviews
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Last Reviewed:</span>
                          <span className="font-semibold text-foreground">{card.lastReview || "Never"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Next Review:</span>
                          {isReference ? (
                            <span className="font-semibold text-cyan-500 flex items-center gap-1">
                              <BookOpen className="w-3.5 h-3.5" /> Reference
                            </span>
                          ) : isCardPaused(card) ? (
                            <span className="font-semibold text-amber-500 flex items-center gap-1">
                              <Pause className="w-3.5 h-3.5" /> Paused
                            </span>
                          ) : (
                            <span className="font-semibold text-foreground">{card.nextReview || "Now"}</span>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-border/60 pt-2 flex flex-col gap-2">
                        {isReference ? (
                          <Button
                            variant="ghost"
                            onClick={() => setShowResumeOptions(!showResumeOptions)}
                            disabled={isResuming}
                            className="w-full text-cyan-500 hover:text-cyan-600 hover:bg-cyan-500/10 gap-1.5 rounded-xl h-9"
                          >
                            {isResuming ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                            {isResuming ? "Processing..." : "Add to Review Queue"}
                          </Button>
                        ) : isCardPaused(card) ? (
                          <Button
                            variant="ghost"
                            onClick={() => setShowResumeOptions(!showResumeOptions)}
                            disabled={isResuming}
                            className="w-full text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 gap-1.5 rounded-xl h-9"
                          >
                            {isResuming ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                            {isResuming ? "Resuming..." : "Resume Reviews"}
                          </Button>
                        ) : canPauseCard(card) ? (
                          <Button
                            variant="ghost"
                            onClick={handlePause}
                            disabled={isPausing || isSaving || isDeleting}
                            className="w-full text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 gap-1.5 rounded-xl h-9"
                          >
                            {isPausing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Pause className="w-3.5 h-3.5" />
                            )}
                            {isPausing ? "Pausing..." : "Pause Reviews"}
                          </Button>
                        ) : (
                          <div className="text-[10px] text-muted-foreground leading-normal text-center p-1.5 bg-muted/20 border border-dashed border-border rounded-xl">
                            Pause available after {pauseThreshold(card)} reviews ({card.history?.total ?? 0}/{pauseThreshold(card)})
                          </div>
                        )}

                        {!isReference && (
                          <Button
                            variant="ghost"
                            onClick={handleMarkAsReference}
                            disabled={isResuming || isSaving || isDeleting}
                            className="w-full text-cyan-500 hover:text-cyan-600 hover:bg-cyan-500/10 gap-1.5 rounded-xl h-9"
                          >
                            {isResuming ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <BookOpen className="w-3.5 h-3.5" />
                            )}
                            {isResuming ? "Resuming..." : "Mark as Reference"}
                          </Button>
                        )}
                      </div>

                      {/* Resume / Add to Queue options picker inside popover */}
                      {showResumeOptions && (
                        <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-muted/30 border border-border mt-1 relative">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider text-center">
                            {isReference ? "Add in:" : "Resume in:"}
                          </span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { label: "Now", value: 0 },
                              { label: "1 Day", value: 1 },
                              { label: "3 Days", value: 3 },
                              { label: "7 Days", value: 7 },
                            ].map((opt) => (
                              <Button
                                key={opt.value}
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  if (isReference) {
                                    await handleAddToQueue(opt.value);
                                  } else {
                                    await handleResume(opt.value);
                                  }
                                }}
                                disabled={isResuming || isSaving}
                                className="rounded-lg text-xs py-1 h-7 border-border/80 hover:bg-background"
                              >
                                {opt.label}
                              </Button>
                            ))}
                          </div>

                          {/* Custom Date Picker Trigger */}
                          <div className="relative w-full">
                            <Button
                              size="sm"
                              variant="outline"
                              ref={modalCalendarBtnRef}
                              onClick={() => {
                                if (modalCalendarBtnRef.current) {
                                  setModalCalendarRect(modalCalendarBtnRef.current.getBoundingClientRect());
                                }
                                setShowModalCalendar(!showModalCalendar);
                              }}
                              disabled={isResuming || isSaving}
                              className="w-full rounded-lg text-xs gap-1.5 h-7 border-border/80 hover:bg-background"
                            >
                              <CalendarIcon className="w-3.5 h-3.5" />
                              Custom Date
                            </Button>
                            
                            {/* Render calendar using portal if active */}
                            {showModalCalendar && createPortal(
                              <>
                                <div 
                                  className="fixed inset-0 z-[9998] cursor-default" 
                                  onClick={() => setShowModalCalendar(false)} 
                                />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="fixed z-[9999] w-64 bg-card border border-border rounded-2xl shadow-2xl p-3 flex flex-col gap-2 cursor-default text-left"
                                  style={modalCalendarRect ? (() => {
                                    const CALENDAR_H = 340;
                                    const spaceAbove = modalCalendarRect.top;
                                    const placeAbove = spaceAbove >= CALENDAR_H + 8;
                                    return {
                                      top: placeAbove ? undefined : `${modalCalendarRect.bottom + 8}px`,
                                      bottom: placeAbove ? `${window.innerHeight - modalCalendarRect.top + 8}px` : undefined,
                                      left: `${Math.max(8, modalCalendarRect.left + modalCalendarRect.width / 2 - 128)}px`,
                                    };
                                  })() : undefined}
                                >
                                  <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                                    <button
                                      type="button"
                                      onClick={prevModalCalendarMonth}
                                      className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                      <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-xs font-bold text-foreground">
                                      {monthNames[modalCalendarMonth.getMonth()]} {modalCalendarMonth.getFullYear()}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={nextModalCalendarMonth}
                                      className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-muted-foreground uppercase">
                                    {dayNames.map((dName, idx) => (
                                      <div key={`dayname-${idx}`}>{dName}</div>
                                    ))}
                                  </div>

                                  <div className="grid grid-cols-7 gap-1">
                                    {renderModalCalendarDays()}
                                  </div>
                                </motion.div>
                              </>,
                              document.body
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Delete Pill */}
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className={`${pillBaseClass} text-hard hover:border-hard/50 hover:bg-hard-bg/50 hover:shadow-hard/10`}
              >
                {isDeleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
                {/* Tooltip */}
                <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap bg-card text-foreground text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-md shadow-md border border-border z-[100] ${
                  isMaximized 
                    ? "bottom-full top-auto left-1/2 -translate-x-1/2 -translate-y-0 mb-2" 
                    : isPillsOnLeft 
                      ? "left-full ml-3" 
                      : "right-full mr-3"
                }`}>
                  Delete Card
                </div>
              </button>
            </div>
          );
        })()}

        {/* Floating Cancel Edit Pill (Edit Mode) */}
        {isEditing && (() => {
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
                onClick={() => setIsEditing(false)}
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
                  Cancel Edit
                </div>
              </button>
            </div>
          );
        })()}
      </motion.div>
    </div>,
    document.body
  );
}
