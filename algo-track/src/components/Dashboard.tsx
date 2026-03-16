import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Flashcard } from "@/data";
import { CheckCircle2, AlertCircle, Clock, BarChart3, Loader2, Download, Trash2 } from "lucide-react";
import { MasteryHeatmap } from "./MasteryHeatmap";
import { CardDetailsModal } from "./CardDetailsModal";
import { StreakTracker } from "./StreakTracker";
import { PerformanceChart } from "./charts/PerformanceChart";
import { TopicRadarChart } from "./charts/TopicRadarChart";
import { DailyGoal } from "./DailyGoal";
import { ProblemCountWidget } from "./ProblemCountWidget";
import { SearchFilter } from "./SearchFilter";
import { ContestTracker } from "./ContestTracker";
import { motion, AnimatePresence } from "motion/react";
import { fetchAnalytics, deleteCard } from "@/lib/client-api";
import type { AnalyticsData } from "@/lib/client-api";
import { exportAsJSON, exportAsCSV } from "@/lib/export";

interface DashboardProps {
  cards: Flashcard[];
  dueCount: number;
  onRefresh: () => void;
}

export function Dashboard({ cards, dueCount, onRefresh }: DashboardProps) {
  const [selectedCard, setSelectedCard] = useState<Flashcard | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [filteredCards, setFilteredCards] = useState<Flashcard[]>(cards);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleFiltered = useCallback((filtered: Flashcard[]) => {
    setFilteredCards(filtered);
  }, []);

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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} card(s)? This cannot be undone.`)) return;
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

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8">
      <MasteryHeatmap cards={cards} />

      {/* Analytics Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Analytics & Insights</h2>
        </div>

        {analyticsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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

              {/* Topic Mastery */}
              <div className="rounded-xl border border-border bg-background p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Topic Mastery
                  <span className="text-xs text-muted-foreground font-normal ml-2">By tag</span>
                </h3>
                <TopicRadarChart data={analytics.topics} />
              </div>
            </div>


            {/* Contest History */}
            <ContestTracker />
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

      {/* Search, Filter & Export */}
      {cards.length > 0 && (
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex-1">
            <SearchFilter cards={cards} onFiltered={handleFiltered} />
          </div>
          <div className="relative shrink-0 pt-0.5">
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
                  CSV
                </button>
              </div>
            )}
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
          className="text-center py-16"
        >
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No cards yet
          </h3>
          <p className="text-muted-foreground text-sm">
            Click &quot;Add Card&quot; in the navigation to create your first flashcard.
          </p>
        </motion.div>
      ) : (
        <div className="overflow-x-auto">
          {filteredCards.length === 0 && cards.length > 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No cards match your filters.
            </div>
          ) : (
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
                  <th className="px-4 py-4 font-semibold">Review History</th>
                  <th className="px-4 py-4 font-semibold">Next Review</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredCards.map((card, index) => (
                    <motion.tr
                      key={card.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03, duration: 0.3 }}
                      className="border-b border-border hover:bg-muted/40 transition-all duration-200 group cursor-pointer relative"
                      onClick={() => setSelectedCard(card)}
                    >
                      <td className="px-2 py-5 align-top" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(card.id)}
                          onChange={() => toggleSelect(card.id)}
                          className="rounded border-border cursor-pointer"
                        />
                      </td>
                      <td className="px-2 py-5 text-muted-foreground align-top transition-colors group-hover:text-foreground">
                        {index + 1}
                      </td>
                      <td className="px-4 py-5 align-top">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground text-base group-hover:text-blue-500 transition-colors">
                              {card.title}
                            </span>
                            {card.dueInDays === 0 && (
                              <span className="w-2 h-2 rounded-full bg-medium animate-pulse" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                              {card.type === "leetcode" ? "DSA" : "CS Core"}
                            </span>
                            {card.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="tag"
                                className="bg-transparent border-tag/30 text-tag font-normal group-hover:bg-tag/5 transition-colors"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5 align-top">
                        <Badge
                          variant={card.difficulty}
                          className="capitalize bg-transparent border-current text-current group-hover:bg-current/5 transition-colors"
                        >
                          {card.difficulty}
                        </Badge>
                      </td>
                      <td className="px-4 py-5 align-top">
                        <div className="flex flex-col gap-1.5">
                          {card.history.total > 0 ? (
                            <>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">
                                  Last: {card.lastReview}
                                </span>
                                <span
                                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${card.lastRating === "EASY"
                                    ? "text-easy bg-easy/10"
                                    : card.lastRating === "HARD"
                                      ? "text-hard bg-hard/10"
                                      : card.lastRating === "AGAIN"
                                        ? "text-red-500 bg-red-500/10"
                                        : "text-blue-500 bg-blue-500/10"
                                    }`}
                                >
                                  {card.lastRating}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                  {card.history.good} good • {card.history.total}{" "}
                                  total
                                </span>
                                <span className="font-semibold text-foreground">
                                  {Math.round(
                                    (card.history.good / card.history.total) * 100,
                                  )}
                                  %
                                </span>
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Not reviewed yet
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-5 align-top">
                        <div className="flex flex-col gap-1">
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
                                : `Due in ${card.dueInDays} day${card.dueInDays !== 1 ? "s" : ""}`}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {card.nextReview}
                          </span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
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
    </div>
  );
}

