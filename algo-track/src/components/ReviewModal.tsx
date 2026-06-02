import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Flashcard, CardType } from "@/data";
import { Play, Shuffle, Timer, Repeat, MoreHorizontal, Calendar, Loader2, Code, Database, BookOpen, CalendarDays, GripVertical, Tags, RefreshCw } from "lucide-react";
import { motion, AnimatePresence, useDragControls } from "motion/react";
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

const cardMatchesCoreTag = (card: Flashcard, coreTag: string): boolean => {
  if (card.type !== "cs") return false;
  const lowerTags = (card.tags || []).map(t => t.toLowerCase());
  const lowerTopicIds = (card.topicIds || []).map(id => id.toLowerCase());
  
  if (coreTag === "CN") {
    return (
      lowerTags.includes("cn") ||
      lowerTags.includes("network") ||
      lowerTags.includes("networks") ||
      lowerTags.includes("computer networks") ||
      lowerTopicIds.some(id => id.startsWith("cn."))
    );
  }
  if (coreTag === "OS") {
    return (
      lowerTags.includes("os") ||
      lowerTags.includes("operating system") ||
      lowerTags.includes("operating systems") ||
      lowerTopicIds.some(id => id.startsWith("os."))
    );
  }
  if (coreTag === "DBMS") {
    return (
      lowerTags.includes("dbms") ||
      lowerTags.includes("database") ||
      lowerTags.includes("db") ||
      lowerTags.includes("transactions") ||
      lowerTopicIds.some(id => id.startsWith("dbms."))
    );
  }
  if (coreTag === "System Design") {
    return (
      lowerTags.includes("system design") ||
      lowerTags.includes("design") ||
      lowerTopicIds.some(id => id.startsWith("sd."))
    );
  }
  return false;
};

interface ReviewModalProps {
  dueCards: Flashcard[];
  totalCards: Flashcard[];
  maxDailyReviews?: number | null;
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
  maxDailyReviews,
  onClose,
  onStart,
  onRescheduled,
}: ReviewModalProps) {
  const dragControls = useDragControls();

  const [showOptions, setShowOptions] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customDaysInput, setCustomDaysInput] = useState("");
  const [numberSelectMode, setNumberSelectMode] = useState<"random-quiz" | "reverse" | null>(null);

  // Topic Review States
  const [topicReviewStep, setTopicReviewStep] = useState<null | "topics" | "detail">(null);
  const [activeTopicTab, setActiveTopicTab] = useState<"dsa" | "sql" | "core">("dsa");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [topicCardCount, setTopicCardCount] = useState(10);
  const [topicStrategy, setTopicStrategy] = useState<"random" | "weakest" | "manual">("random");
  const [manualSelectedIds, setManualSelectedIds] = useState<Set<string>>(new Set());

  // Topic Stats Computed value
  const topicStats = useMemo(() => {
    const tagMap = new Map<string, { count: number; totalGood: number; totalReviews: number }>();
    for (const card of totalCards) {
      if (card.type !== "leetcode") continue;
      for (const tag of card.tags) {
        // Filter out complexity-based tags
        const lowerTag = tag.toLowerCase();
        if (
          lowerTag.startsWith("time:") ||
          lowerTag.startsWith("space:") ||
          lowerTag.includes("o(") ||
          lowerTag.includes("o1)")
        ) {
          continue;
        }

        const stats = tagMap.get(tag) || { count: 0, totalGood: 0, totalReviews: 0 };
        stats.count++;
        stats.totalGood += card.history?.good || 0;
        stats.totalReviews += card.history?.total || 0;
        tagMap.set(tag, stats);
      }
    }
    return Array.from(tagMap.entries())
      .map(([tag, stats]) => {
        const mastery = stats.totalReviews > 0 ? (stats.totalGood / stats.totalReviews) * 100 : 0;
        return { tag, count: stats.count, mastery };
      })
      .sort((a, b) => b.count - a.count);
  }, [totalCards]);

  const coreStats = useMemo(() => {
    const coreTags = ["CN", "OS", "DBMS", "System Design"];
    return coreTags.map(tag => {
      const cards = totalCards.filter(c => cardMatchesCoreTag(c, tag));
      let totalGood = 0;
      let totalReviews = 0;
      for (const card of cards) {
        totalGood += card.history?.good || 0;
        totalReviews += card.history?.total || 0;
      }
      const mastery = totalReviews > 0 ? (totalGood / totalReviews) * 100 : 0;
      return {
        tag,
        count: cards.length,
        mastery
      };
    });
  }, [totalCards]);

  const topicCards = useMemo(() => {
    if (!selectedTopic) return [];
    if (activeTopicTab === "sql") {
      return totalCards.filter(c => c.type === "sql");
    }
    if (activeTopicTab === "core") {
      return totalCards.filter(c => cardMatchesCoreTag(c, selectedTopic));
    }
    return totalCards.filter(c => c.type === "leetcode" && c.tags.includes(selectedTopic));
  }, [totalCards, selectedTopic, activeTopicTab]);

  // A state that holds the current curated subset of cards for the review
  const [curatedQueue, setCuratedQueue] = useState<Flashcard[]>([]);

  // Function to shuffle/regenerate the random selection
  const regenerateRandomQueue = useCallback(() => {
    if (topicCards.length === 0) return;
    const shuffled = [...topicCards].sort(() => 0.5 - Math.random());
    setCuratedQueue(shuffled.slice(0, topicCardCount));
  }, [topicCards, topicCardCount]);

  // Sync curatedQueue based on strategy & count
  useEffect(() => {
    if (topicCards.length === 0) {
      setCuratedQueue([]);
      return;
    }
    
    if (topicStrategy === "random") {
      const shuffled = [...topicCards].sort(() => 0.5 - Math.random());
      setCuratedQueue(shuffled.slice(0, topicCardCount));
    } else if (topicStrategy === "weakest") {
      const sorted = [...topicCards].sort((a, b) => {
        const aGood = a.history?.good || 0;
        const aTotal = a.history?.total || 0;
        const bGood = b.history?.good || 0;
        const bTotal = b.history?.total || 0;
        const aM = aTotal > 0 ? aGood / aTotal : 0;
        const bM = bTotal > 0 ? bGood / bTotal : 0;
        return aM - bM;
      });
      setCuratedQueue(sorted.slice(0, topicCardCount));
    } else {
      // manual
      const selected = topicCards.filter(c => manualSelectedIds.has(c.id));
      setCuratedQueue(selected);
    }
  }, [topicCards, topicCardCount, topicStrategy, manualSelectedIds]);

  const handleTopicStart = () => {
    if (curatedQueue.length === 0) return;
    onStart("standard", undefined, undefined, curatedQueue);
  };

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

  const handleCustomDaysReschedule = () => {
    const days = parseInt(customDaysInput);
    if (isNaN(days) || days < 1) return;
    setShowReschedule(false);
    setShowCustomDatePicker(false);
    setCustomDaysInput("");
    handleReschedule(days);
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

    const sorted = [...filtered].sort((a, b) => {
      const ratingDiff =
        ratingPriority[a.lastRating] - ratingPriority[b.lastRating];
      if (ratingDiff !== 0) return ratingDiff;

      const difficultyDiff =
        difficultyPriority[a.difficulty] - difficultyPriority[b.difficulty];
      if (difficultyDiff !== 0) return difficultyDiff;

      return a.title.localeCompare(b.title);
    });

    if (maxDailyReviews !== null && maxDailyReviews !== undefined && maxDailyReviews > 0) {
      return sorted.slice(0, maxDailyReviews);
    }
    return sorted;
  }, [dueCards, activeTab, maxDailyReviews]);

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

  const backdropRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={backdropRef} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={backdropRef}
        dragElastic={0}
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-card rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] border border-border"
      >
        <div className="p-6 md:p-8 flex flex-col gap-2 border-b border-border relative select-none">
          <div className="absolute top-6 right-6 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full shrink-0 hover:bg-muted cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
              title="Drag to move"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <GripVertical className="w-5 h-5" />
            </Button>
          </div>
          <h2 className="text-2xl font-bold text-foreground pr-10">
            {topicReviewStep === "topics"
              ? `Review by Topic — ${activeTopicTab === "core" ? "Core CS" : "DSA"}`
              : topicReviewStep === "detail"
                ? `${activeTopicTab === "sql" ? "SQL Settings" : "Topic Settings"}`
                : numberSelectMode === "random-quiz"
                  ? "Random Quiz"
                  : numberSelectMode === "reverse"
                    ? "Reverse Review"
                    : "Ready to review?"}
          </h2>
          <p className="text-muted-foreground text-sm pr-10">
            {topicReviewStep === "topics"
              ? activeTopicTab === "core"
                ? "Select a Core CS topic tag below to practice specific core fundamentals."
                : "Select a core DSA topic tag below to practice specific algorithmic concepts."
              : topicReviewStep === "detail"
                ? "Tailor your review size, selection strategy, and choose specific questions."
                : numberSelectMode
                  ? "Select the number of questions you want to review."
                  : dueCards.length === 0
                    ? "No cards are due right now. Check back later!"
                    : maxDailyReviews && dueCards.length > maxDailyReviews
                      ? `${maxDailyReviews} card${maxDailyReviews !== 1 ? "s" : ""} due today (capped from ${dueCards.length} total backlog cards).`
                      : `${dueCards.length} card${dueCards.length !== 1 ? "s" : ""} due today. Hard and recently failed cards are queued first.`}
          </p>
        </div>

        {/* Tabs — show only when there are due cards and multiple types, and not in number select or topic mode */}
        {!numberSelectMode && !topicReviewStep && dueCards.length > 0 && availableTypes.length > 0 && (
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

        {/* Topic Review Tabs (DSA, SQL, Core) */}
        {topicReviewStep && (
          <div className="px-6 md:px-8 pt-4">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border w-fit">
              {[
                { key: "dsa", label: "DSA" },
                { key: "sql", label: "SQL" },
                { key: "core", label: "Core" }
              ].map(tab => {
                const isActive = activeTopicTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTopicTab(tab.key as any);
                      if (tab.key === "sql") {
                        setSelectedTopic("SQL");
                        setTopicReviewStep("detail");
                        const sqlCards = totalCards.filter(c => c.type === "sql");
                        setTopicCardCount(Math.min(10, sqlCards.length));
                        setTopicStrategy("random");
                        setManualSelectedIds(new Set(sqlCards.map(c => c.id)));
                      } else {
                        setSelectedTopic(null);
                        setTopicReviewStep("topics");
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "bg-background text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {topicReviewStep === "topics" ? (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-4 flex flex-col gap-4 bg-muted/5">
            {activeTopicTab === "dsa" ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground">DSA Topics</h3>
                  <span className="text-xs text-muted-foreground">Select a tag to customize practice</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {topicStats.map(({ tag, count, mastery }) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setSelectedTopic(tag);
                        setTopicReviewStep("detail");
                        const cardsForTag = totalCards.filter(c => c.type === "leetcode" && c.tags.includes(tag));
                        setTopicCardCount(Math.min(10, cardsForTag.length));
                        setTopicStrategy("random");
                        setManualSelectedIds(new Set(cardsForTag.map(c => c.id)));
                      }}
                      className="p-4 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-cyan-500/30 transition-all flex flex-col gap-2.5 text-left group cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-foreground text-sm group-hover:text-cyan-500 transition-colors">{tag}</span>
                        <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-muted/60 text-muted-foreground">
                          {count} {count === 1 ? "card" : "cards"}
                        </Badge>
                      </div>
                      {/* Mastery Bar */}
                      <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[9px] text-muted-foreground font-bold">
                          <span>AVERAGE MASTERY</span>
                          <span className="text-foreground">{Math.round(mastery)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all" 
                            style={{ width: `${mastery}%` }} 
                          />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground">Core CS Topics</h3>
                  <span className="text-xs text-muted-foreground">Select a category to customize practice</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {coreStats.map(({ tag, count, mastery }) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setSelectedTopic(tag);
                        setTopicReviewStep("detail");
                        const cardsForTag = totalCards.filter(c => cardMatchesCoreTag(c, tag));
                        setTopicCardCount(Math.min(10, cardsForTag.length));
                        setTopicStrategy("random");
                        setManualSelectedIds(new Set(cardsForTag.map(c => c.id)));
                      }}
                      className="p-4 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-cyan-500/30 transition-all flex flex-col gap-2.5 text-left group cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-foreground text-sm group-hover:text-cyan-500 transition-colors">{tag}</span>
                        <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-muted/60 text-muted-foreground">
                          {count} {count === 1 ? "card" : "cards"}
                        </Badge>
                      </div>
                      {/* Mastery Bar */}
                      <div className="w-full flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[9px] text-muted-foreground font-bold">
                          <span>AVERAGE MASTERY</span>
                          <span className="text-foreground">{Math.round(mastery)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all" 
                            style={{ width: `${mastery}%` }} 
                          />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : topicReviewStep === "detail" && selectedTopic ? (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-4 flex flex-col gap-6 bg-muted/5">
            {/* Header / Topic banner */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest text-left block">
                  {activeTopicTab === "sql" ? "DATABASE" : activeTopicTab === "core" ? "CORE CONCEPT" : "SELECTED TOPIC"}
                </span>
                <h3 className="text-xl font-bold text-foreground mt-0.5 text-left">
                  {activeTopicTab === "sql" ? "SQL / Database" : selectedTopic}
                </h3>
              </div>
               <Badge variant="secondary" className="text-xs bg-cyan-500/5 text-cyan-500 border-cyan-500/20 px-3 py-1 font-semibold rounded-full shrink-0">
                {topicCards.length} {topicCards.length === 1 ? "Question" : "Questions"}
              </Badge>
            </div>

            {/* Config: Number of cards */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-left">Number of questions</label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border w-fit">
                  {[5, 10, topicCards.length].map((val) => {
                    const label = val === topicCards.length ? "All" : val.toString();
                    if (val > topicCards.length) return null;
                    const isSelected = topicCardCount === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setTopicCardCount(val)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                          isSelected
                            ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/10"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {/* Manual number input */}
                <input
                  type="number"
                  min={1}
                  max={topicCards.length}
                  value={topicCardCount}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value);
                    if (!isNaN(parsed)) {
                      setTopicCardCount(Math.min(topicCards.length, Math.max(1, parsed)));
                    }
                  }}
                  className="w-16 px-2.5 py-1.5 rounded-xl border border-border bg-background text-sm font-semibold text-center focus:outline-none focus:border-cyan-500 transition-colors shrink-0"
                />
              </div>
            </div>

            {/* Config: Strategy */}
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-left">Review Strategy</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: "random", label: "🎲 Random", desc: "Shuffle & select" },
                  { id: "weakest", label: "📉 Weakest", desc: "Least mastered first" },
                  { id: "manual", label: "✋ Manual", desc: "Select specific cards" }
                ].map((strat) => {
                  const isSelected = topicStrategy === strat.id;
                  return (
                    <button
                      key={strat.id}
                      type="button"
                      onClick={() => setTopicStrategy(strat.id as any)}
                      className={`p-3.5 rounded-xl border transition-all text-left flex flex-col gap-1 cursor-pointer ${
                        isSelected
                          ? "border-cyan-500 bg-cyan-500/5 shadow-sm"
                          : "border-border hover:border-cyan-500/30 bg-muted/10 hover:bg-muted/20"
                      }`}
                    >
                      <span className="text-xs font-bold text-foreground">{strat.label}</span>
                      <span className="text-[10px] text-muted-foreground leading-relaxed">{strat.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Manual Checkbox List */}
            {topicStrategy === "manual" && (
              <div className="flex flex-col gap-3 border border-border rounded-xl p-4 bg-muted/10">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-bold text-foreground">Select Questions</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (manualSelectedIds.size === topicCards.length) {
                        setManualSelectedIds(new Set());
                      } else {
                        setManualSelectedIds(new Set(topicCards.map(c => c.id)));
                      }
                    }}
                    className="text-xs font-bold text-cyan-500 hover:text-cyan-600 transition-colors cursor-pointer"
                  >
                    {manualSelectedIds.size === topicCards.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div className="max-h-[220px] overflow-y-auto flex flex-col divide-y divide-border pr-2">
                  {topicCards.map((card) => {
                    const isChecked = manualSelectedIds.has(card.id);
                    const good = card.history?.good || 0;
                    const total = card.history?.total || 0;
                    const mastery = total > 0 ? Math.round((good / total) * 100) : 0;
                    return (
                      <label
                        key={card.id}
                        className="py-2.5 flex items-center justify-between gap-3 cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const newSet = new Set(manualSelectedIds);
                              if (newSet.has(card.id)) {
                                newSet.delete(card.id);
                              } else {
                                newSet.add(card.id);
                              }
                              setManualSelectedIds(newSet);
                            }}
                            className="rounded border-border text-cyan-500 focus:ring-cyan-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="text-xs font-semibold text-foreground truncate group-hover:text-cyan-500 transition-colors">
                            {card.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={card.difficulty} className="text-[9px] uppercase tracking-wider bg-transparent border-current text-current">
                            {card.difficulty}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {mastery}% mastery
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selected cards preview (Random & Weakest) */}
            {(topicStrategy === "random" || topicStrategy === "weakest") && (
              <div className="flex flex-col gap-3 border border-border rounded-xl p-4 bg-muted/10 text-left">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-bold text-foreground">
                    Selected Questions ({curatedQueue.length})
                  </span>
                  {topicStrategy === "random" && (
                    <button
                      type="button"
                      onClick={regenerateRandomQueue}
                      className="text-xs font-bold text-cyan-500 hover:text-cyan-600 transition-all cursor-pointer flex items-center gap-1.5 duration-200"
                      title="Load a new random set"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Shuffle New
                    </button>
                  )}
                  {topicStrategy === "weakest" && (
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      Least mastered questions prioritized
                    </span>
                  )}
                </div>
                <div className="max-h-[220px] overflow-y-auto flex flex-col divide-y divide-border pr-2">
                  {curatedQueue.map((card, idx) => {
                    const good = card.history?.good || 0;
                    const total = card.history?.total || 0;
                    const mastery = total > 0 ? Math.round((good / total) * 100) : 0;
                    return (
                      <div
                        key={card.id}
                        className="py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[10px] font-bold text-muted-foreground w-4 text-right">
                            {idx + 1}.
                          </span>
                          <span className="text-xs font-semibold text-foreground truncate">
                            {card.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={card.difficulty} className="text-[9px] uppercase tracking-wider bg-transparent border-current text-current">
                            {card.difficulty}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {mastery}% mastery
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : numberSelectMode ? (
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
        ) : dueCards.length > 0 ? (
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
        ) : (
          <div className="flex-1 p-6 md:p-8 flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-muted-foreground text-sm">No cards due today. Try a Random Quiz or choose a Topic above!</p>
          </div>
        )}

        <div className="p-4 sm:p-6 border-t border-border flex flex-wrap items-center justify-between gap-3 bg-muted/20 relative">
          <div className="flex items-center gap-2 order-2 sm:order-1">
            {topicReviewStep ? (
              <Button variant="ghost" onClick={() => {
                if (topicReviewStep === "detail") {
                  if (activeTopicTab === "sql") {
                    setTopicReviewStep(null);
                    setSelectedTopic(null);
                  } else {
                    setTopicReviewStep("topics");
                    setSelectedTopic(null);
                  }
                } else {
                  setTopicReviewStep(null);
                }
              }} className="font-semibold gap-1.5">
                ← Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => {
                if (numberSelectMode) {
                  setNumberSelectMode(null);
                } else {
                  onClose();
                }
              }} className="font-semibold">
                {numberSelectMode ? "Back" : "Not now"}
              </Button>
            )}

            {!numberSelectMode && !topicReviewStep && dueCards.length > 0 && (
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
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="1"
                                value={customDaysInput}
                                onChange={(e) => setCustomDaysInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleCustomDaysReschedule(); }}
                                autoFocus
                                placeholder="e.g. 5"
                                className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
                              />
                              <button
                                onClick={handleCustomDaysReschedule}
                                disabled={!customDaysInput || parseInt(customDaysInput) < 1}
                                className="px-2.5 py-1.5 rounded-lg bg-cyan-500 text-white text-xs font-semibold hover:bg-cyan-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                              >
                                Go
                              </button>
                            </div>
                            <span className="text-[10px] text-muted-foreground text-center">Enter number of days</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowCustomDatePicker(true)}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted text-cyan-500"
                          >
                            <CalendarDays className="w-3.5 h-3.5" />
                            Custom days…
                          </button>
                        )}
                     </motion.div>
                   )}
                 </AnimatePresence>
              </div>
            )}

            {!numberSelectMode && !topicReviewStep && totalCards.length > 0 && (
              <Button
                variant="ghost"
                className="font-semibold text-muted-foreground hover:text-cyan-500 gap-2 hover:bg-cyan-500/5 transition-all rounded-lg"
                onClick={() => {
                  setTopicReviewStep("topics");
                  setSelectedTopic(null);
                  setActiveTopicTab("dsa");
                }}
              >
                <Tags className="w-4 h-4" />
                Review by Topic
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2 order-1 sm:order-2 ml-auto">
            {topicReviewStep === "detail" ? (
              <Button
                onClick={handleTopicStart}
                disabled={topicStrategy === "manual" && manualSelectedIds.size === 0}
                className="gap-2 font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-full px-6 shadow-md shadow-cyan-500/20"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Review ({topicStrategy === "manual" ? manualSelectedIds.size : topicCardCount})
              </Button>
            ) : !topicReviewStep && (
              <>
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
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
