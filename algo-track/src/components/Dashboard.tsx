import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Flashcard, CardType } from "@/data";
import { CheckCircle2, AlertCircle, Clock, BarChart3, Loader2, Download, Trash2, ChevronRight, X, Pause, Play, Timer, Code, BookOpen, LayoutGrid, List } from "lucide-react";
import { isCardPaused } from "@/lib/card-utils";
import { fetchGlobalPauseStatus, resumeAllReviews, resumeCardReview } from "@/lib/client-api";
import type { GlobalPauseStatus } from "@/lib/client-api";
import { MasteryHeatmap } from "./MasteryHeatmap";
import { CardDetailsModal } from "./CardDetailsModal";
import { StreakTracker } from "./StreakTracker";
import { PerformanceChart } from "./charts/PerformanceChart";
import { TopicRadarChart } from "./charts/TopicRadarChart";
import { DailyGoal } from "./DailyGoal";
import { ProblemCountWidget } from "./ProblemCountWidget";
import { SearchFilter } from "./SearchFilter";
import { ReviewForecastWidget } from "./ReviewForecastWidget";
import { StudyMetricsWidget } from "./StudyMetricsWidget";
import { SmartNudgeBanner } from "./SmartNudgeBanner";
import { QuickActionsRow } from "./QuickActionsRow";
import { GoalsPlannerHub } from "./GoalsPlannerHub";
import { NeedsAttentionWidget } from "./NeedsAttentionWidget";
import { FeatureCarouselWidget } from "./FeatureCarouselWidget";
import { motion, AnimatePresence } from "motion/react";
import { fetchAnalytics, deleteCard } from "@/lib/client-api";
import type { AnalyticsData } from "@/lib/client-api";
import { exportAsJSON, exportAsCSV } from "@/lib/export";
import { CommandPalette } from "./CommandPalette";
import { useConfirmModal } from "@/components/ConfirmModal";

const getIntervalDays = (card: Flashcard) => {
  let intervalDays = 0;
  if (card.lastReview && card.nextReview) {
    const last = new Date(card.lastReview).getTime();
    const next = new Date(card.nextReview).getTime();
    if (!isNaN(last) && !isNaN(next)) {
      intervalDays = Math.max(0, (next - last) / (1000 * 3600 * 24));
    }
  } else if (card.history.good > 0) {
    intervalDays = card.history.good * 2;
  }
  return intervalDays;
};

const HealthRing = ({ interval }: { interval: number }) => {
  const target = 21;
  const ratio = Math.min(1, Math.max(0, interval / target));
  const percentage = Math.round(ratio * 100);
  
  let color = "text-red-500";
  if (percentage >= 80) color = "text-emerald-500";
  else if (percentage >= 40) color = "text-amber-500";

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-muted/30"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className={color}
            strokeDasharray={`${percentage}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="flex flex-col justify-center">
        <span className="text-sm font-semibold text-foreground leading-none">{percentage}%</span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider leading-none mt-1">Mastery</span>
      </div>
    </div>
  );
};

const getDifficultyColor = (diff: string) => {
  if (diff === "easy") return "bg-[#00b8a3]/10 text-[#00b8a3] border-[#00b8a3]/20";
  if (diff === "medium") return "bg-[#ffc01e]/10 text-[#ffc01e] border-[#ffc01e]/20";
  if (diff === "hard") return "bg-[#ff375f]/10 text-[#ff375f] border-[#ff375f]/20";
  return "bg-muted text-muted-foreground border-border";
};

interface DashboardProps {
  cards: Flashcard[];
  dueCount: number;
  onRefresh: () => void;
  onStartReview: (mode: "standard" | "random-quiz" | "sprint" | "reverse", count?: number, type?: "leetcode" | "cs") => void;
  onNavigate?: (view: string) => void;
}

export function Dashboard({ cards, dueCount, onRefresh, onStartReview, onNavigate }: DashboardProps) {
  const [selectedCard, setSelectedCard] = useState<Flashcard | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [cardsModal, setCardsModal] = useState<{
    isOpen: boolean;
    title: string;
    cardsList: Flashcard[];
  }>({
    isOpen: false,
    title: "",
    cardsList: [],
  });

  const handleShowCardsList = useCallback((title: string, filteredCards: Flashcard[]) => {
    setCardsModal({
      isOpen: true,
      title,
      cardsList: filteredCards,
    });
  }, []);
  const [filteredCards, setFilteredCards] = useState<Flashcard[]>(cards);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [pauseStatus, setPauseStatus] = useState<GlobalPauseStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [typeTab, setTypeTab] = useState<"all" | CardType>("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [showPausedModal, setShowPausedModal] = useState(false);
  const [resumingCardIds, setResumingCardIds] = useState<Set<string>>(new Set());
  const [isResumingAllPaused, setIsResumingAllPaused] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const handleSelectCard = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const card = cards.find(c => c.id === customEvent.detail);
      if (card) {
        setSelectedCard(card);
      }
    };
    window.addEventListener("select-card", handleSelectCard);
    return () => window.removeEventListener("select-card", handleSelectCard);
  }, [cards]);

  const pausedCount = cards.filter(c => isCardPaused(c)).length;

  // Pre-filter by type tab before passing to SearchFilter
  const typeFilteredCards = useMemo(() => {
    if (typeTab === "all") return cards;
    return cards.filter(c => c.type === typeTab);
  }, [cards, typeTab]);

  const dsaCount = useMemo(() => cards.filter(c => c.type === "leetcode").length, [cards]);
  const sqlCount = useMemo(() => cards.filter(c => c.type === "sql").length, [cards]);
  const csCount = useMemo(() => cards.filter(c => c.type === "cs").length, [cards]);

  const handleFiltered = useCallback((filtered: Flashcard[]) => {
    setFilteredCards(filtered);
    setCurrentPage(1);
  }, []);

  const totalPages = Math.ceil(filteredCards.length / ITEMS_PER_PAGE);
  const paginatedCards = filteredCards.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCards.map((c) => c.id)));
    }
  };

  const { confirm: confirmModal } = useConfirmModal();

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = await confirmModal({
      title: "Delete Cards",
      message: `Delete ${selectedIds.size} card(s)? This cannot be undone.`,
      confirmLabel: "Delete All",
      variant: "danger",
    });
    if (!confirmed) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteCard(id)));
      setSelectedIds(new Set());
      onRefresh();
    } catch (err) {
      console.error("Bulk delete failed:", err);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  useEffect(() => {
    fetchAnalytics()
      .then(setAnalytics)
      .catch((err) => console.error("Failed to fetch analytics:", err))
      .finally(() => setAnalyticsLoading(false));
  }, []);

  useEffect(() => {
    fetchGlobalPauseStatus()
      .then(setPauseStatus)
      .catch((err) => console.error("Failed to fetch pause status:", err));
  }, []);

  const handleQuickResume = async () => {
    setIsResuming(true);
    try {
      await resumeAllReviews();
      setPauseStatus({ active: false, startedAt: null, until: null, autoResume: false, remainingDays: null });
      onRefresh();
    } catch (err) {
      console.error("Failed to resume:", err);
    } finally {
      setIsResuming(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8">
      <SmartNudgeBanner analytics={analytics} />

      {/* Global Pause Banner */}
      {pauseStatus?.active && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <Pause className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-500">
                  Reviews Paused
                </p>
                <p className="text-xs text-muted-foreground">
                  {pauseStatus.remainingDays != null && pauseStatus.remainingDays > 0
                    ? `${pauseStatus.remainingDays} day${pauseStatus.remainingDays !== 1 ? "s" : ""} remaining`
                    : "Paused indefinitely"}
                  {pauseStatus.autoResume && " · Auto-resume enabled"}
                  {pauseStatus.until && (
                    <> · Resumes {new Date(pauseStatus.until).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>
                  )}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleQuickResume}
              disabled={isResuming}
              className="rounded-full shrink-0 gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isResuming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              Resume
            </Button>
          </div>
        </motion.div>
      )}

      <MasteryHeatmap cards={cards} />

      <QuickActionsRow onAction={onStartReview} />

      <GoalsPlannerHub onNavigate={onNavigate} />

      {/* Analytics Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Analytics & Insights</h2>
        </div>

        {analyticsLoading ? (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-24 bg-muted/60 rounded-xl border border-border/50"></div>
              <div className="h-24 bg-muted/60 rounded-xl border border-border/50"></div>
              <div className="h-24 bg-muted/60 rounded-xl border border-border/50"></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-muted/60 rounded-xl border border-border/50"></div>
              <div className="h-64 bg-muted/60 rounded-xl border border-border/50"></div>
            </div>
          </div>
        ) : analytics ? (
          <div className="space-y-6">
            {/* Top row: Streak + Daily Goal + Problem Count */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StreakTracker streak={analytics.streak} />
              <DailyGoal
                reviewedToday={
                  analytics.performance[analytics.performance.length - 1]?.total ?? 0
                }
              />
              <ProblemCountWidget cards={cards} />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Performance Trends */}
              <div className="rounded-xl border border-border bg-background p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Performance Trends
                  <span className="text-xs text-muted-foreground font-normal ml-2">Last 30 days</span>
                </h3>
                <PerformanceChart data={analytics.performance} />
              </div>

              {/* Feature Carousel (replaces Topic Mastery) */}
              <div className="rounded-xl border border-border bg-background p-0 overflow-hidden">
                <FeatureCarouselWidget 
                  analytics={analytics} 
                  dueCount={dueCount} 
                  cards={cards}
                  onNavigate={onNavigate || (() => {})}
                  onOpenTopicModal={() => setShowTopicModal(true)}
                  onShowCardsList={handleShowCardsList}
                />
              </div>
            </div>


            {/* Forecast, Needs Attention, and Study Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <ReviewForecastWidget cards={cards} onNavigate={onNavigate} />
              <NeedsAttentionWidget cards={cards} onSelectCard={setSelectedCard} />
              <StudyMetricsWidget analytics={analytics} />
            </div>
          </div>
        ) : null}
      </div>

      {/* Due today banner */}
      {dueCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl bg-medium-bg border border-medium/20 flex items-center gap-3"
        >
          <Clock className="w-5 h-5 text-medium shrink-0" />
          <span className="text-sm font-medium text-medium">
            You have <strong>{dueCount}</strong> card{dueCount !== 1 ? "s" : ""} due for review today.
          </span>
        </motion.div>
      )}

      {/* Paused cards banner — clickable to manage */}
      {pausedCount > 0 && (
        <button
          onClick={() => setShowPausedModal(true)}
          className="mb-4 p-3 rounded-xl bg-muted/40 border border-border flex items-center gap-2 w-full text-left hover:bg-muted/60 hover:border-primary/30 transition-all group cursor-pointer"
        >
          <Pause className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground flex-1">
            <strong className="text-foreground">{pausedCount}</strong> card{pausedCount !== 1 ? "s" : ""} paused — click to manage
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      )}

      {/* Type Tabs (CS / DSA) */}
      {cards.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border w-fit">
            {([
              { key: "all" as const, label: "All Cards", icon: null, count: cards.length },
              { key: "leetcode" as const, label: "DSA", icon: <Code className="w-3.5 h-3.5" />, count: dsaCount },
              { key: "sql" as const, label: "SQL", icon: <Code className="w-3.5 h-3.5" />, count: sqlCount },
              { key: "cs" as const, label: "CS Core", icon: <BookOpen className="w-3.5 h-3.5" />, count: csCount },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setTypeTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  typeTab === tab.key
                    ? "bg-background text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
                <span className={`text-[10px] font-bold ml-0.5 px-1.5 py-0.5 rounded-full ${
                  typeTab === tab.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search, Filter & Export */}
      {cards.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-4">
          <div className="flex-1 w-full">
            <SearchFilter cards={typeFilteredCards} onFiltered={handleFiltered} />
          </div>
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto pt-0.5">
            <div className="flex items-center bg-muted/50 p-1 rounded-lg border">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition-all duration-200 ${
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-all duration-200 ${
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline-block">Export</span>
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                <button
                  onClick={() => { exportAsJSON(cards); setShowExportMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-muted/50 cursor-pointer"
                >
                  JSON
                </button>
                <button
                  onClick={() => { exportAsCSV(cards); setShowExportMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-muted/50 cursor-pointer"
                >
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-500">
            {selectedIds.size} card{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/10"
            >
              {isBulkDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {cards.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20 px-4 rounded-3xl bg-gradient-to-b from-muted/50 to-background border border-border/50 relative overflow-hidden flex flex-col items-center"
        >
          <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full" />
          <div className="w-16 h-16 rounded-2xl bg-card border border-border/50 shadow-sm flex items-center justify-center mb-6 relative z-10 transform rotate-3">
            <BookOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2 relative z-10">
            Your knowledge base is empty
          </h3>
          <p className="text-muted-foreground text-sm max-w-sm relative z-10">
            Start building your mastery. Click &quot;Add Card&quot; in the navigation to create your first flashcard.
          </p>
        </motion.div>
      ) : (
        <div className="w-full">
          {filteredCards.length === 0 && cards.length > 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No cards match your filters.
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
              <AnimatePresence>
                {paginatedCards.map((card, index) => (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => setSelectedCard(card)}
                    className="bg-card p-4 rounded-xl border border-border cursor-pointer hover:border-primary/50 hover:shadow-md transition-all flex flex-col gap-3 relative group"
                  >
                    <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
                       <input type="checkbox" checked={selectedIds.has(card.id)} onChange={() => toggleSelect(card.id)} className="rounded border-border cursor-pointer" />
                    </div>
                    
                    <div className="pr-6">
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">{card.title}</h4>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 mt-auto">
                       <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border ${getDifficultyColor(card.difficulty)}`}>{card.difficulty}</span>
                       {card.tags.slice(0, 2).map(t => <span key={t} className="px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground truncate max-w-[80px]">{t}</span>)}
                       {card.tags.length > 2 && <span className="text-[10px] text-muted-foreground">+{card.tags.length - 2}</span>}
                    </div>
                    
                    <div className="text-[10px] text-muted-foreground flex items-center justify-between mt-1">
                      {card.history.total > 0 ? (
                        <span>{card.history.total} review{card.history.total !== 1 ? 's' : ''} • Last: {card.lastReview}</span>
                      ) : (
                        <span className="italic opacity-70">Not reviewed yet</span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between pt-3 border-t mt-1">
                      <HealthRing interval={getIntervalDays(card)} />
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                         {isCardPaused(card) ? (
                           <Pause className="w-3.5 h-3.5" />
                         ) : card.dueInDays <= 0 ? (
                           <Clock className="w-3.5 h-3.5 text-medium" />
                         ) : (
                           <CheckCircle2 className="w-3.5 h-3.5 text-easy" />
                         )}
                         {isCardPaused(card) ? "Paused" : card.dueInDays <= 0 ? "Due Now" : `${card.dueInDays}d`}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="overflow-x-auto pb-8">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs text-muted-foreground uppercase tracking-wider bg-background border-b border-border">
                  <tr>
                    <th className="px-2 py-4 w-8">
                      <input
                        type="checkbox"
                        checked={filteredCards.length > 0 && selectedIds.size === filteredCards.length}
                        onChange={toggleSelectAll}
                        className="rounded border-border cursor-pointer"
                      />
                    </th>
                    <th className="px-2 py-4 font-semibold w-8">#</th>
                    <th className="px-4 py-4 font-semibold">Card</th>
                    <th className="px-4 py-4 font-semibold">Difficulty</th>
                    <th className="px-4 py-4 font-semibold">Card Mastery</th>
                    <th className="px-4 py-4 font-semibold">Next Review</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {paginatedCards.map((card, index) => (
                      <motion.tr
                        key={card.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02, duration: 0.2 }}
                        className="border-b border-border hover:bg-muted/40 transition-all duration-200 group cursor-pointer relative"
                        onClick={() => setSelectedCard(card)}
                      >
                        <td className="px-2 py-4 align-middle" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(card.id)}
                            onChange={() => toggleSelect(card.id)}
                            className="rounded border-border cursor-pointer"
                          />
                        </td>
                        <td className="px-2 py-4 text-muted-foreground align-middle transition-colors group-hover:text-foreground">
                          {index + 1}
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground text-sm group-hover:text-primary transition-colors line-clamp-1">
                                {card.title}
                              </span>
                              {card.dueInDays === 0 && (
                                <span className="w-2 h-2 rounded-full bg-medium animate-pulse shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {card.tags.slice(0, 3).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="tag"
                                  className="bg-muted text-muted-foreground border-transparent font-normal group-hover:bg-muted/80 transition-colors text-[10px] px-1.5 py-0"
                                >
                                  {tag}
                                </Badge>
                              ))}
                              {card.tags.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{card.tags.length - 3}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getDifficultyColor(card.difficulty)}`}>
                            {card.difficulty}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <div className="flex flex-col gap-2">
                            <HealthRing interval={getIntervalDays(card)} />
                            {card.history.total > 0 ? (
                              <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {card.history.total} review{card.history.total !== 1 ? 's' : ''} • Last: {card.lastReview}
                              </div>
                            ) : (
                              <div className="text-[10px] text-muted-foreground italic opacity-70 whitespace-nowrap">
                                Not reviewed yet
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <div className="flex flex-col gap-1">
                            {isCardPaused(card) ? (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Pause className="w-4 h-4" />
                                <span className="font-medium text-sm">Paused</span>
                              </div>
                            ) : (
                              <>
                                <div
                                  className={`flex items-center gap-1.5 ${card.dueInDays <= 0 ? "text-medium" : "text-easy"
                                    }`}
                                >
                                  {card.dueInDays <= 0 ? (
                                    <Clock className="w-4 h-4" />
                                  ) : (
                                    <CheckCircle2 className="w-4 h-4" />
                                  )}
                                  <span className="font-medium text-sm">
                                    {card.dueInDays <= 0
                                      ? "Due now"
                                      : `Due in ${card.dueInDays}d`}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {card.nextReview}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between py-4 border-t border-border mt-4">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, filteredCards.length)}</span> of <span className="font-medium text-foreground">{filteredCards.length}</span> cards
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="text-sm font-medium px-2">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {selectedCard && (
          <CardDetailsModal
            card={selectedCard}
            onClose={() => setSelectedCard(null)}
            onSaved={() => {
              setSelectedCard(null);
              onRefresh();
            }}
          />
        )}
      </AnimatePresence>

      {createPortal(
        <AnimatePresence>
          {showPausedModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm" onClick={() => setShowPausedModal(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-border"
              >
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/10">
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Pause className="w-4 h-4 text-amber-500" />
                    Paused Cards ({pausedCount})
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={isResumingAllPaused || pausedCount === 0}
                      onClick={async () => {
                        setIsResumingAllPaused(true);
                        try {
                          const pausedCards = cards.filter(c => isCardPaused(c));
                          await Promise.all(pausedCards.map(c => resumeCardReview(c.id, 0)));
                          onRefresh();
                          setShowPausedModal(false);
                        } catch (err) {
                          console.error("Failed to resume all:", err);
                        } finally {
                          setIsResumingAllPaused(false);
                        }
                      }}
                      className="rounded-full gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs"
                    >
                      {isResumingAllPaused ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      Resume All
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={() => setShowPausedModal(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                  {cards.filter(c => isCardPaused(c)).map(card => (
                    <div key={card.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:border-primary/30 transition-colors gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground block truncate">{card.title}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${card.difficulty === 'easy' ? 'bg-[#00b8a3]/10 text-[#00b8a3] border-[#00b8a3]/20' : card.difficulty === 'medium' ? 'bg-[#ffc01e]/10 text-[#ffc01e] border-[#ffc01e]/20' : 'bg-[#ff375f]/10 text-[#ff375f] border-[#ff375f]/20'}`}>
                            {card.difficulty}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {card.history.total} review{card.history.total !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resumingCardIds.has(card.id)}
                        onClick={async () => {
                          setResumingCardIds(prev => new Set(prev).add(card.id));
                          try {
                            await resumeCardReview(card.id, 0);
                            onRefresh();
                          } catch (err) {
                            console.error("Failed to resume card:", err);
                          } finally {
                            setResumingCardIds(prev => {
                              const next = new Set(prev);
                              next.delete(card.id);
                              return next;
                            });
                          }
                        }}
                        className="rounded-full gap-1.5 text-xs shrink-0 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/30"
                      >
                        {resumingCardIds.has(card.id) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                        Resume
                      </Button>
                    </div>
                  ))}
                  {pausedCount === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No paused cards.
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>
          {showTopicModal && analytics && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm" onClick={() => setShowTopicModal(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm bg-card rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-border"
              >
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/10">
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    All Topics
                  </h3>
                  <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={() => setShowTopicModal(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                  {analytics.topics.map(t => (
                    <div key={t.topic} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:border-primary/50 transition-colors">
                      <span className="text-sm font-medium text-foreground">{t.topic}</span>
                      <Badge variant="secondary" className="bg-muted">
                          {t.cardCount} {t.cardCount === 1 ? "question" : "questions"}
                      </Badge>
                    </div>
                  ))}
                  {analytics.topics.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No topics found.
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>
          {cardsModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm" onClick={() => setCardsModal(prev => ({ ...prev, isOpen: false }))}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-border"
              >
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/10">
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    {cardsModal.title === "Mastered Cards" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    )}
                    {cardsModal.title} ({cardsModal.cardsList.length})
                  </h3>
                  <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={() => setCardsModal(prev => ({ ...prev, isOpen: false }))}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                  {cardsModal.cardsList.map(card => (
                    <div 
                      key={card.id} 
                      onClick={() => {
                        setSelectedCard(card);
                        setCardsModal(prev => ({ ...prev, isOpen: false }));
                      }}
                      className="flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:border-primary/30 transition-colors gap-3 cursor-pointer group"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground block truncate group-hover:text-primary transition-colors">{card.title}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getDifficultyColor(card.difficulty)}`}>
                            {card.difficulty}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {card.history.total} review{card.history.total !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  ))}
                  {cardsModal.cardsList.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No cards found in this category.
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      <CommandPalette cards={cards} />
    </div>
  );
}

