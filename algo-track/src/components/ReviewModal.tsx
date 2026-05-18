import { useMemo, useRef, useState, useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Flashcard, CardType } from "@/data";
import { Play, Shuffle, Timer, Repeat, MoreHorizontal, Calendar, Loader2, Code, Database, BookOpen, CalendarDays, GripVertical } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { rescheduleReviews } from "@/lib/client-api";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ReviewModalProps {
  dueCards: Flashcard[];
  totalCards: Flashcard[];
  onClose: () => void;
  onStart: (mode: "standard" | "random-quiz" | "sprint" | "reverse", count?: number, typeFilter?: CardType, orderedCards?: Flashcard[]) => void;
  onRescheduled?: () => void;
}

type TabKey = "all" | CardType;

const TAB_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  leetcode: { label: "DSA", icon: <Code className="w-3.5 h-3.5" />, color: "text-blue-500" },
  sql: { label: "SQL", icon: <Database className="w-3.5 h-3.5" />, color: "text-orange-500" },
  cs: { label: "Concepts", icon: <BookOpen className="w-3.5 h-3.5" />, color: "text-emerald-500" },
};


function SortableCard({ card, isLast }: { card: Flashcard; isLast: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    position: "relative" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 flex items-start gap-3 bg-card hover:bg-muted/30 transition-colors ${
        !isLast ? "border-b border-border" : ""
      } ${isDragging ? "shadow-lg border-y border-primary/50 opacity-95 bg-muted/20" : ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="mt-0.5 p-1 -ml-1 text-muted-foreground/40 hover:text-foreground cursor-grab active:cursor-grabbing rounded transition-colors"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-medium text-foreground text-sm leading-tight truncate">
              {card.title}
            </span>
            <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider ${
              card.type === "leetcode" ? "text-blue-500" : card.type === "sql" ? "text-orange-500" : "text-emerald-500"
            }`}>
              {card.type === "leetcode" ? "DSA" : card.type === "sql" ? "SQL" : "CS"}
            </span>
          </div>
          <Badge
            variant={card.difficulty}
            className="capitalize bg-transparent border-current text-current shrink-0"
          >
            {card.difficulty}
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {card.tags.map((tag) => (
            <Badge
              key={tag}
              variant="tag"
              className="bg-transparent border-tag/30 text-tag font-normal text-[10px] px-2 py-0"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReviewModal({
  dueCards,
  totalCards,
  onClose,
  onStart,
  onRescheduled,
}: ReviewModalProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const customDateRef = useRef<HTMLInputElement>(null);
  const [numberSelectMode, setNumberSelectMode] = useState<"random-quiz" | "reverse" | null>(null);

  // Compute counts per type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { leetcode: 0, sql: 0, cs: 0 };
    for (const card of dueCards) {
      if (counts[card.type] !== undefined) counts[card.type]++;
    }
    return counts;
  }, [dueCards]);

  // Determine which types have due cards to show tabs
  const availableTypes = useMemo(() => {
    return (["leetcode", "sql", "cs"] as CardType[]).filter(t => typeCounts[t] > 0);
  }, [typeCounts]);

  // Active tab — default to the type with the most due cards, or first available
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (availableTypes.length === 0) return "all";
    // Default to the type with the most due cards
    return availableTypes.reduce((best, t) =>
      typeCounts[t] > typeCounts[best] ? t : best
    , availableTypes[0]);
  });

  // Tomorrow's date for date picker min
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }, []);

  const handleReschedule = async (days: number) => {
    setIsRescheduling(true);
    try {
      await rescheduleReviews(days);
      onRescheduled?.();
    } catch (e) {
      console.error("Failed to reschedule", e);
      setIsRescheduling(false);
    }
  };

  const handleCustomDateReschedule = (dateStr: string) => {
    if (!dateStr) return;
    const picked = new Date(dateStr + "T00:00:00");
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.max(1, Math.round((picked.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    setShowReschedule(false);
    setShowCustomDatePicker(false);
    handleReschedule(diffDays);
  };

  // Filter and sort cards for the active tab
  const queuedCards = useMemo(() => {
    const ratingPriority: Record<Flashcard["lastRating"], number> = {
      AGAIN: 0,
      HARD: 1,
      GOOD: 2,
      EASY: 3,
    };
    const difficultyPriority: Record<Flashcard["difficulty"], number> = {
      hard: 0,
      medium: 1,
      easy: 2,
    };

    const filtered = activeTab === "all"
      ? dueCards
      : dueCards.filter(c => c.type === activeTab);

    return [...filtered].sort((a, b) => {
      const ratingDiff =
        ratingPriority[a.lastRating] - ratingPriority[b.lastRating];
      if (ratingDiff !== 0) return ratingDiff;

      const difficultyDiff =
        difficultyPriority[a.difficulty] - difficultyPriority[b.difficulty];
      if (difficultyDiff !== 0) return difficultyDiff;

      return a.title.localeCompare(b.title);
    });
  }, [dueCards, activeTab]);

  const [orderedCards, setOrderedCards] = useState<Flashcard[]>([]);

  useEffect(() => {
    setOrderedCards(queuedCards);
  }, [queuedCards]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedCards((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // When starting, pass the type filter if a specific tab is active
  const handleStart = (mode: "standard" | "random-quiz" | "sprint" | "reverse", count?: number) => {
    const typeFilter = activeTab !== "all" ? (activeTab as CardType) : undefined;
    onStart(mode, count, typeFilter, orderedCards);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-card rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 md:p-8 flex flex-col gap-2 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">
            {numberSelectMode === "random-quiz" ? "Random Quiz" : numberSelectMode === "reverse" ? "Reverse Review" : "Ready to review?"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {numberSelectMode 
              ? "Select the number of questions you want to review."
              : dueCards.length === 0
                ? "No cards are due right now. Check back later!"
                : `${dueCards.length} card${dueCards.length !== 1 ? "s" : ""} due today. Hard and recently failed cards are queued first.`}
          </p>
        </div>

        {/* Tabs — show only when there are due cards and multiple types, and not in number select mode */}
        {!numberSelectMode && dueCards.length > 0 && availableTypes.length > 0 && (
          <div className="px-6 md:px-8 pt-4">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border w-fit">
              {availableTypes.length > 1 && (
                <button
                  onClick={() => setActiveTab("all")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeTab === "all"
                      ? "bg-background text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === "all" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {dueCards.length}
                  </span>
                </button>
              )}
              {availableTypes.map(type => {
                const config = TAB_CONFIG[type];
                return (
                  <button
                    key={type}
                    onClick={() => setActiveTab(type)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      activeTab === type
                        ? "bg-background text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {config.icon}
                    {config.label}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeTab === type ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {typeCounts[type]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {numberSelectMode ? (
          <div className="flex-1 p-6 md:p-8 flex flex-col items-center justify-center gap-4">
            <div className="flex gap-4">
              <Button 
                variant="outline" 
                className="w-24 h-24 text-2xl rounded-2xl flex flex-col gap-2 hover:border-foreground hover:bg-muted/50"
                onClick={() => { handleStart(numberSelectMode, 5); setNumberSelectMode(null); }}
              >
                <span>5</span>
              </Button>
              <Button 
                variant="outline" 
                className="w-24 h-24 text-2xl rounded-2xl flex flex-col gap-2 hover:border-foreground hover:bg-muted/50"
                onClick={() => { handleStart(numberSelectMode, 10); setNumberSelectMode(null); }}
              >
                <span>10</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Maximum 10 questions recommended.</p>
          </div>
        ) : dueCards.length > 0 && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Up Next</h3>
              <span className="text-xs text-muted-foreground">
                {orderedCards.length} cards (Drag to reorder)
              </span>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedCards.map(c => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-0 border border-border rounded-xl overflow-hidden bg-card">
                  {orderedCards.map((card, index) => (
                    <SortableCard 
                      key={card.id} 
                      card={card} 
                      isLast={index === orderedCards.length - 1} 
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>


          </div>
        )}

        <div className="p-4 sm:p-6 border-t border-border flex flex-wrap items-center justify-between gap-3 bg-muted/20 relative">
          <div className="flex items-center gap-2 order-2 sm:order-1">
            <Button variant="ghost" onClick={() => {
              if (numberSelectMode) {
                setNumberSelectMode(null);
              } else {
                onClose();
              }
            }} className="font-semibold">
              {numberSelectMode ? "Back" : "Not now"}
            </Button>
            {!numberSelectMode && dueCards.length > 0 && (
              <div className="relative">
                 <Button
                    variant="ghost"
                    className="font-semibold text-muted-foreground hover:text-foreground gap-2"
                    onClick={() => setShowReschedule(!showReschedule)}
                    disabled={isRescheduling}
                 >
                    {isRescheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                    Reschedule
                 </Button>
                 <AnimatePresence>
                   {showReschedule && (
                     <motion.div
                       initial={{ opacity: 0, scale: 0.95, y: 10 }}
                       animate={{ opacity: 1, scale: 1, y: 0 }}
                       exit={{ opacity: 0, scale: 0.95, y: 10 }}
                       className="absolute bottom-full left-0 mb-2 w-48 bg-card border border-border rounded-xl shadow-lg overflow-hidden flex flex-col py-1 z-50 origin-bottom-left"
                     >
                       <button
                          onClick={() => { setShowReschedule(false); setShowCustomDatePicker(false); handleReschedule(1); }}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted"
                        >
                          Tomorrow (1 day)
                        </button>
                        <button
                          onClick={() => { setShowReschedule(false); setShowCustomDatePicker(false); handleReschedule(3); }}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted"
                        >
                          In 3 days
                        </button>
                        <button
                          onClick={() => { setShowReschedule(false); setShowCustomDatePicker(false); handleReschedule(7); }}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted"
                        >
                          In a week
                        </button>
                        <div className="border-t border-border my-0.5" />
                        {showCustomDatePicker ? (
                          <div className="px-3 py-2 flex flex-col gap-1.5">
                            <input
                              ref={customDateRef}
                              type="date"
                              min={tomorrowStr}
                              autoFocus
                              className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
                              onChange={(e) => handleCustomDateReschedule(e.target.value)}
                            />
                            <span className="text-[10px] text-muted-foreground text-center">Pick any future date</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowCustomDatePicker(true)}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted text-cyan-500"
                          >
                            <CalendarDays className="w-3.5 h-3.5" />
                            Custom date…
                          </button>
                        )}
                     </motion.div>
                   )}
                 </AnimatePresence>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 order-1 sm:order-2 ml-auto">
            {!numberSelectMode && totalCards.length > 0 && (
              <div className="relative">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() => setShowOptions(!showOptions)}
                  title="More review options"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
                
                <AnimatePresence>
                  {showOptions && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute bottom-full right-0 mb-2 w-48 bg-card border border-border rounded-xl shadow-lg overflow-hidden flex flex-col py-1 z-50 origin-bottom-right"
                    >
                      <button
                        onClick={() => { setNumberSelectMode("reverse"); setShowOptions(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted"
                      >
                        <Repeat className="w-4 h-4" />
                        Reverse
                      </button>
                      <button
                        onClick={() => { handleStart("sprint"); setShowOptions(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted"
                      >
                        <Timer className="w-4 h-4" />
                        5-min Sprint
                      </button>
                      
                      <button
                        onClick={() => { setNumberSelectMode("random-quiz"); setShowOptions(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted"
                      >
                        <Shuffle className="w-4 h-4" />
                        Random Quiz
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {!numberSelectMode && queuedCards.length > 0 && (
              <Button
                onClick={() => handleStart("standard")}
                className="gap-2 font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-full px-6"
              >
                <Play className="w-4 h-4 fill-current" />
                Start session{activeTab !== "all" ? ` (${queuedCards.length})` : ""}
              </Button>
            )}

            {!numberSelectMode && dueCards.length === 0 && (
               <Button
                variant="outline"
                onClick={() => { setNumberSelectMode("random-quiz"); setShowOptions(false); }}
                className="gap-2 font-semibold rounded-full px-6"
              >
                <Shuffle className="w-4 h-4" />
                Random Quiz
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
