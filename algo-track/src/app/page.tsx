'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { Dashboard } from "@/components/Dashboard";
import { ReviewModal } from "@/components/ReviewModal";
import { ReviewSession } from "@/components/ReviewSession";
import type { ReviewResult } from "@/components/ReviewSession";
import { ReviewComplete } from "@/components/ReviewComplete";
import { AddCardModal } from "@/components/AddCardModal";
import { Button } from "@/components/ui/Button";
import { LayoutDashboard, PlayCircle, Plus, Sun, Moon, Loader2, RefreshCw, FileDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { fetchAllCards, fetchDueCards } from "@/lib/client-api";
import type { Flashcard } from "@/data";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { ImportListModal } from "@/components/ImportListModal";

type View = "dashboard" | "review-session" | "review-complete";
type ReviewMode = "standard" | "random-quiz" | "sprint" | "reverse";

interface SessionStats {
  results: ReviewResult[];
  durationMs: number;
  remainingDue: number;
}

interface ReviewSessionConfig {
  mode: ReviewMode;
  timeLimitSeconds?: number;
}

// ── Cache helpers ────────────────────────────────────────────
const CACHE_KEY = "algotrack-cards-cache";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedData {
  cards: Flashcard[];
  dueCards: Flashcard[];
  timestamp: number;
}

function readCache(): CachedData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedData;
    if (!parsed.cards || !parsed.dueCards || !parsed.timestamp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(cards: Flashcard[], dueCards: Flashcard[]) {
  const data: CachedData = { cards, dueCards, timestamp: Date.now() };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Storage full — silently fail
  }
}

function isCacheStale(cached: CachedData): boolean {
  return Date.now() - cached.timestamp > CACHE_TTL_MS;
}

function formatLastSync(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

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

function prioritizeDueCards(cards: Flashcard[]) {
  return [...cards].sort((a, b) => {
    const ratingDiff = ratingPriority[a.lastRating] - ratingPriority[b.lastRating];
    if (ratingDiff !== 0) return ratingDiff;

    const difficultyDiff =
      difficultyPriority[a.difficulty] - difficultyPriority[b.difficulty];
    if (difficultyDiff !== 0) return difficultyDiff;

    return a.title.localeCompare(b.title);
  });
}

// ── Main component ───────────────────────────────────────────
export default function HomePage() {
  const [view, setView] = useState<View>("dashboard");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [reviewSessionCards, setReviewSessionCards] = useState<Flashcard[]>([]);
  const [reviewSessionConfig, setReviewSessionConfig] = useState<ReviewSessionConfig>({
    mode: "standard",
  });
  const [showImportModal, setShowImportModal] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setTick] = useState(0); // Force re-render for "last synced" label

  // Fetch fresh data from API and update cache
  const syncFromApi = useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsSyncing(true);
    try {
      const [all, due] = await Promise.all([
        fetchAllCards(),
        fetchDueCards(),
      ]);
      setCards(all);
      setDueCards(due);
      writeCache(all, due);
      setLastSyncTime(Date.now());
    } catch (err) {
      console.error("Failed to sync cards:", err);
    } finally {
      if (showSpinner) setIsSyncing(false);
    }
  }, []);

  // Initialize: load from cache instantly, then sync if stale
  useEffect(() => {
    const cached = readCache();

    if (cached) {
      // Show cached data immediately — no loading spinner
      setCards(cached.cards);
      setDueCards(cached.dueCards);
      setLastSyncTime(cached.timestamp);
      setIsLoading(false);

      // Background refresh if cache is stale
      if (isCacheStale(cached)) {
        syncFromApi(false);
      }
    } else {
      // No cache — must fetch (show spinner)
      syncFromApi(true).finally(() => setIsLoading(false));
    }

    // Auto-sync every hour (while tab is active)
    syncTimerRef.current = setInterval(() => {
      syncFromApi(false);
    }, CACHE_TTL_MS);

    // Sync when user returns to the tab after being away
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const cached = readCache();
        if (!cached || isCacheStale(cached)) {
          syncFromApi(false);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncFromApi]);

  // Update "last synced" label every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Dark mode setup
  useEffect(() => {
    const saved = localStorage.getItem("algotrack-dark-mode");
    if (
      saved === "true" ||
      (!saved &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
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

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Manual refresh — syncs immediately and resets the auto-sync timer
  const handleManualRefresh = async () => {
    await syncFromApi(true);
    // Reset auto-sync timer
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = setInterval(() => {
      syncFromApi(false);
    }, CACHE_TTL_MS);
  };

  const handleStartReview = async (mode: ReviewMode = "standard") => {
    setShowReviewModal(false);
    try {
      if (mode === "random-quiz") {
        if (cards.length === 0) return;
        const randomIndex = Math.floor(Math.random() * cards.length);
        setReviewSessionCards([cards[randomIndex]]);
        setReviewSessionConfig({ mode: "random-quiz" });
        setView("review-session");
        return;
      }

      const due = await fetchDueCards();
      if (due.length === 0) return;

      const prioritized = prioritizeDueCards(due);
      setReviewSessionCards(prioritized);
      setReviewSessionConfig({
        mode,
        timeLimitSeconds: mode === "sprint" ? 300 : undefined,
      });
      setView("review-session");
    } catch (err) {
      console.error("Failed to start review:", err);
    }
  };

  const handleReviewComplete = async (
    results: ReviewResult[],
    durationMs: number,
  ) => {
    const remaining = await fetchDueCards().catch(() => []);
    await syncFromApi(false);
    setSessionStats({
      results,
      durationMs,
      remainingDue: remaining.length,
    });
    setView("review-complete");
  };

  const handleReviewCancel = async () => {
    await syncFromApi(false);
    setView("dashboard");
  };

  useKeyboardShortcuts({
    onAddCard: () => setShowAddCardModal(true),
    onReview: () => setShowReviewModal(true),
    onDashboard: () => setView("dashboard"),
    onRefresh: () => handleManualRefresh(),
    onToggleTheme: toggleTheme,
    isModalOpen: showAddCardModal || showReviewModal,
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              setView("dashboard");
            }}
          >
            <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-background font-bold text-lg leading-none">
                A
              </span>
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:inline-block">
              AlgoTrack
            </span>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2">
            <Button
              variant={view === "dashboard" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setView("dashboard");
              }}
              className="gap-2 transition-all"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline-block">Dashboard</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReviewModal(true)}
              className="gap-2 transition-all hover:text-emerald-500 hover:bg-emerald-500/10 relative"
            >
              <PlayCircle className="w-4 h-4" />
              <span className="hidden sm:inline-block">Review</span>
              {dueCards.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {dueCards.length}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddCardModal(true)}
              className="gap-2 transition-all hover:text-blue-500 hover:bg-blue-500/10"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline-block">Add Card</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowImportModal(true)}
              className="gap-2 transition-all hover:text-purple-500 hover:bg-purple-500/10"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline-block">Import</span>
            </Button>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Sync / Refresh button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isSyncing}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              title={lastSyncTime ? `Last synced: ${formatLastSync(lastSyncTime)}` : "Sync now"}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
              {lastSyncTime && (
                <span className="hidden sm:inline-block text-xs">
                  {formatLastSync(lastSyncTime)}
                </span>
              )}
            </Button>

            <PushNotificationToggle />

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full transition-transform hover:rotate-12"
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {view === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <Dashboard
                  cards={cards}
                  dueCount={dueCards.length}
                  onRefresh={() => syncFromApi(false)}
                />
              </motion.div>
            )}
            {view === "review-session" && (
              <motion.div
                key="review-session"
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <ReviewSession
                  cards={reviewSessionCards}
                  onComplete={handleReviewComplete}
                  onCancel={handleReviewCancel}
                  mode={reviewSessionConfig.mode}
                  timeLimitSeconds={reviewSessionConfig.timeLimitSeconds}
                />
              </motion.div>
            )}
            {view === "review-complete" && sessionStats && (
              <motion.div
                key="review-complete"
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <ReviewComplete
                  results={sessionStats.results}
                  durationMs={sessionStats.durationMs}
                  remainingDue={sessionStats.remainingDue}
                  onBackToDashboard={() => {
                    setView("dashboard");
                    syncFromApi(false);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <AnimatePresence>
          {showReviewModal && (
            <ReviewModal
              dueCards={dueCards}
              totalCards={cards}
              onClose={() => setShowReviewModal(false)}
              onStart={handleStartReview}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showAddCardModal && (
            <AddCardModal
              onClose={() => setShowAddCardModal(false)}
              onAdded={() => syncFromApi(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showImportModal && (
            <ImportListModal
              onClose={() => setShowImportModal(false)}
              onImported={() => syncFromApi(false)}
              existingCards={cards}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
