'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { Dashboard } from "@/components/Dashboard";
import { ReviewModal } from "@/components/ReviewModal";
import type { ReviewResult } from "@/components/ReviewSession";
import { CommandPalette } from "@/components/CommandPalette";
import { Button } from "@/components/ui/Button";
import { LayoutDashboard, PlayCircle, Plus, Sun, Moon, Loader2, RefreshCw, FileDown, Compass, Target, Award, MessageSquare, Network, Zap, ChevronDown, Pause, Play, Timer, Crosshair, Building2, Keyboard, Bug, ShuffleIcon, Languages, Palette, Calendar, LayoutGrid, Lock, Sliders } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { fetchAllCards, fetchDueCards, fetchGlobalPauseStatus, fetchUserProfile, fetchDashboardStats } from "@/lib/client-api";
import type { GlobalPauseStatus } from "@/lib/client-api";
import type { Flashcard, CardType } from "@/data";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useConfirmModal } from "@/components/ConfirmModal";

// ── Dynamically imported components (code-split) ────────────
// These are only loaded when the user navigates to the corresponding view,
// reducing the initial JS bundle by ~60-70%.
const ViewLoader = () => (
  <div className="flex-1 flex items-center justify-center">
    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
  </div>
);

const ReviewSession = dynamic(() => import("@/components/ReviewSession").then(m => ({ default: m.ReviewSession })), { ssr: false, loading: ViewLoader });
const ReviewComplete = dynamic(() => import("@/components/ReviewComplete").then(m => ({ default: m.ReviewComplete })), { ssr: false, loading: ViewLoader });
const AddCardModal = dynamic(() => import("@/components/AddCardModal").then(m => ({ default: m.AddCardModal })), { ssr: false });
const GuideScreen = dynamic(() => import("@/components/GuideScreen").then(m => ({ default: m.GuideScreen })), { ssr: false, loading: ViewLoader });
const GoalsScreen = dynamic(() => import("@/components/GoalsScreen").then(m => ({ default: m.GoalsScreen })), { ssr: false, loading: ViewLoader });
const AchievementsScreen = dynamic(() => import("@/components/AchievementsScreen").then(m => ({ default: m.AchievementsScreen })), { ssr: false, loading: ViewLoader });
const CoachChat = dynamic(() => import("@/components/CoachChat").then(m => ({ default: m.CoachChat })), { ssr: false, loading: ViewLoader });
const SkillTreeView = dynamic(() => import("@/components/SkillTreeView").then(m => ({ default: m.SkillTreeView })), { ssr: false, loading: ViewLoader });
const StressModeSession = dynamic(() => import("@/components/StressModeSession").then(m => ({ default: m.StressModeSession })), { ssr: false, loading: ViewLoader });
const GlobalPauseModal = dynamic(() => import("@/components/GlobalPauseModal").then(m => ({ default: m.GlobalPauseModal })), { ssr: false });
const BigODrill = dynamic(() => import("@/components/BigODrill").then(m => ({ default: m.BigODrill })), { ssr: false, loading: ViewLoader });
const PatternQuiz = dynamic(() => import("@/components/PatternQuiz").then(m => ({ default: m.PatternQuiz })), { ssr: false, loading: ViewLoader });
const CramMode = dynamic(() => import("@/components/CramMode").then(m => ({ default: m.CramMode })), { ssr: false, loading: ViewLoader });
const Speedrun = dynamic(() => import("@/components/Speedrun").then(m => ({ default: m.Speedrun })), { ssr: false, loading: ViewLoader });
const AntiPatterns = dynamic(() => import("@/components/AntiPatterns").then(m => ({ default: m.AntiPatterns })), { ssr: false, loading: ViewLoader });
const ObfuscationChallenge = dynamic(() => import("@/components/ObfuscationChallenge").then(m => ({ default: m.ObfuscationChallenge })), { ssr: false, loading: ViewLoader });
const CrossLanguage = dynamic(() => import("@/components/CrossLanguage").then(m => ({ default: m.CrossLanguage })), { ssr: false, loading: ViewLoader });
const CalendarView = dynamic(() => import("@/components/CalendarView").then(m => ({ default: m.CalendarView })), { ssr: false, loading: ViewLoader });
const TrainingHub = dynamic(() => import("@/components/TrainingHub").then(m => ({ default: m.TrainingHub })), { ssr: false, loading: ViewLoader });
const VagueInterviewer = dynamic(() => import("@/components/VagueInterviewer").then(m => ({ default: m.VagueInterviewer })), { ssr: false, loading: ViewLoader });
const ImportListModal = dynamic(() => import("@/components/ImportListModal").then(m => ({ default: m.ImportListModal })), { ssr: false });
const PreferencesModal = dynamic(() => import("@/components/PreferencesModal").then(m => ({ default: m.PreferencesModal })), { ssr: false });
const RecoveryModeModal = dynamic(() => import("@/components/RecoveryModeModal").then(m => ({ default: m.RecoveryModeModal })), { ssr: false });

type View = "dashboard" | "guide" | "goals" | "achievements" | "coach" | "skill-tree" | "stress-mode" | "review-session" | "review-complete" | "bigo-drill" | "pattern-quiz" | "cram-mode" | "speedrun" | "anti-patterns" | "obfuscation" | "cross-language" | "calendar" | "training-hub" | "vague-interviewer";
type ReviewMode = "standard" | "random-quiz" | "sprint" | "reverse";

interface SessionStats {
  results: ReviewResult[];
  durationMs: number;
  remainingDue: number;
}

interface ReviewSessionConfig {
  mode: ReviewMode;
  timeLimitSeconds?: number;
  count?: number;
  typeFilter?: "leetcode" | "cs";
}

// ── Cache helpers ────────────────────────────────────────────
import { readCacheDB, writeCacheDB, isCacheStale } from "@/lib/db-cache";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [reviewsToday, setReviewsToday] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [theme, setTheme] = useState<string>("light");
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [reviewSessionCards, setReviewSessionCards] = useState<Flashcard[]>([]);
  const [reviewSessionConfig, setReviewSessionConfig] = useState<ReviewSessionConfig>({
    mode: "standard",
  });
  const [showImportModal, setShowImportModal] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setTick] = useState(0); // Force re-render for "last synced" label
  const [isExtraFeaturesOpen, setIsExtraFeaturesOpen] = useState(false);
  const extraFeaturesRef = useRef<HTMLDivElement>(null);
  const [globalPauseStatus, setGlobalPauseStatus] = useState<GlobalPauseStatus>({ active: false, startedAt: null, until: null, autoResume: false, remainingDays: null });
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [keyboardShortcutsEnabled, setKeyboardShortcutsEnabled] = useState(false);
  const [maxDailyReviews, setMaxDailyReviews] = useState<number | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const { confirm, alert: alertModal } = useConfirmModal();

  // Load preferences from backend on mount
  useEffect(() => {
    fetchUserProfile().then(({ user }) => {
      const prefs = user?.metadata?.preferences;
      if (prefs) {
        if (prefs.keyboardShortcutsEnabled !== undefined) {
          setKeyboardShortcutsEnabled(prefs.keyboardShortcutsEnabled);
        }
        if (prefs.defaultTheme) {
          setTheme(prefs.defaultTheme);
        }
        if (prefs.maxDailyReviews !== undefined) {
          setMaxDailyReviews(prefs.maxDailyReviews);
        }
      }
    }).catch(err => {
      console.error("Failed to load user preferences on mount:", err);
    });
  }, []);

  const handleLockApp = async () => {
    const confirmed = await confirm({
      title: "Lock AlgoTrack?",
      message: "Are you sure you want to lock the application? You will need to enter your passcode to gain access again.",
      confirmLabel: "Lock Now",
      cancelLabel: "Keep Unlocked",
      variant: "warning",
    });

    if (confirmed) {
      window.dispatchEvent(new Event("manual-lock"));
    }
  };

  // Fetch global pause status
  const refreshPauseStatus = useCallback(async () => {
    try {
      const status = await fetchGlobalPauseStatus();
      setGlobalPauseStatus(status);
    } catch (err) {
      console.error("Failed to fetch pause status:", err);
    }
  }, []);

  const syncFromApi = useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsSyncing(true);
    try {
      const [all, due, stats] = await Promise.all([
        fetchAllCards(),
        fetchDueCards(),
        fetchDashboardStats(),
      ]);
      setCards(all);
      setDueCards(due);
      setReviewsToday(stats.reviewsToday ?? 0);
      writeCacheDB(all, due, stats.reviewsToday ?? 0);
      setLastSyncTime(Date.now());
      refreshPauseStatus();
    } catch (err) {
      console.error("Failed to sync cards:", err);
    } finally {
      if (showSpinner) setIsSyncing(false);
    }
  }, [refreshPauseStatus]);

  const isAnyPauseActive = !!(
    globalPauseStatus.active ||
    globalPauseStatus.types?.leetcode?.active ||
    globalPauseStatus.types?.cs?.active ||
    globalPauseStatus.types?.sql?.active
  );

  const prioritizedAndCappedDueCards = useMemo(() => {
    const sorted = prioritizeDueCards(dueCards);
    if (maxDailyReviews !== null && maxDailyReviews > 0) {
      const remainingReviews = Math.max(0, maxDailyReviews - reviewsToday);
      return sorted.slice(0, remainingReviews);
    }
    return sorted;
  }, [dueCards, maxDailyReviews, reviewsToday]);

  const pauseButtonTitle = useMemo(() => {
    if (globalPauseStatus.active) {
      return `Reviews paused (${globalPauseStatus.remainingDays ?? '?'} days left)`;
    }
    const pausedLabels = [];
    if (globalPauseStatus.types?.leetcode?.active) pausedLabels.push("DSA");
    if (globalPauseStatus.types?.cs?.active) pausedLabels.push("CS Core");
    if (globalPauseStatus.types?.sql?.active) pausedLabels.push("SQL");
    
    if (pausedLabels.length > 0) {
      return `${pausedLabels.join(", ")} reviews paused`;
    }
    return "Pause reviews";
  }, [globalPauseStatus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (extraFeaturesRef.current && !extraFeaturesRef.current.contains(event.target as Node)) {
        setIsExtraFeaturesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initialize: load from cache instantly, then sync if stale
  useEffect(() => {
    // Always fetch pause status on mount (not dependent on cache)
    refreshPauseStatus();

    // Read cache from IndexedDB (async)
    readCacheDB().then((cached) => {
      if (cached) {
        // Show cached data immediately — no loading spinner
        setCards(cached.cards);
        setDueCards(cached.dueCards);
        setReviewsToday(cached.reviewsToday ?? 0);
        setLastSyncTime(cached.timestamp);
        setIsLoading(false);

        // Background refresh if cache is stale
        if (isCacheStale(cached, CACHE_TTL_MS)) {
          syncFromApi(false);
        }
      } else {
        // No cache — must fetch (show spinner)
        syncFromApi(true).finally(() => setIsLoading(false));
      }
    });

    // Auto-sync every hour (while tab is active)
    syncTimerRef.current = setInterval(() => {
      syncFromApi(false);
    }, CACHE_TTL_MS);

    // Sync when user returns to the tab after being away
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        readCacheDB().then((cached) => {
          if (!cached || isCacheStale(cached, CACHE_TTL_MS)) {
            syncFromApi(false);
          }
        });
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

  // Theme setup
  useEffect(() => {
    const saved = localStorage.getItem("algotrack-theme");
    if (saved) {
      setTheme(saved);
      document.documentElement.className = saved === "light" ? "" : saved;
    } else {
      const savedDark = localStorage.getItem("algotrack-dark-mode");
      if (savedDark === "true" || window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
        document.documentElement.className = "dark";
      }
    }
  }, []);

  useEffect(() => {
    document.documentElement.className = theme === "light" ? "" : theme;
    localStorage.setItem("algotrack-theme", theme);
  }, [theme]);

  // Dynamically update favicon based on the selected theme
  useEffect(() => {
    const isDarkTheme = theme !== "light";
    const logoUrl = isDarkTheme ? "/BLACKLOGO.png" : "/WHITELOGO.png";
    
    // Find or create favicon link
    let favIcon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (favIcon) {
      favIcon.href = logoUrl;
    } else {
      favIcon = document.createElement("link");
      favIcon.rel = "icon";
      favIcon.href = logoUrl;
      document.head.appendChild(favIcon);
    }
    
    // Find or create apple-touch-icon link
    let appleIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
    if (appleIcon) {
      appleIcon.href = logoUrl;
    } else {
      appleIcon = document.createElement("link");
      appleIcon.rel = "apple-touch-icon";
      appleIcon.href = logoUrl;
      document.head.appendChild(appleIcon);
    }
  }, [theme]);

  // Manual refresh — syncs immediately and resets the auto-sync timer
  // Global Event Listeners for Command Palette
  useEffect(() => {
    const handleQuickReview = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const card = cards.find(c => c.id === customEvent.detail);
      if (card) {
        setReviewSessionCards([card]);
        setReviewSessionConfig({ mode: "standard" });
        setView("review-session");
      }
    };
    
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setView(customEvent.detail as View);
    };

    const handleSelectCardEvent = (e: Event) => {
      // Switch to dashboard so Dashboard component can handle opening the modal
      setView("dashboard");
    };

    window.addEventListener("quick-review-card", handleQuickReview);
    window.addEventListener("navigate", handleNavigate);
    window.addEventListener("select-card", handleSelectCardEvent);
    
    return () => {
      window.removeEventListener("quick-review-card", handleQuickReview);
      window.removeEventListener("navigate", handleNavigate);
      window.removeEventListener("select-card", handleSelectCardEvent);
    };
  }, [cards]);

  const handleManualRefresh = async () => {
    await syncFromApi(true);
    // Reset auto-sync timer
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = setInterval(() => {
      syncFromApi(false);
    }, CACHE_TTL_MS);
  };

  const handleStartReview = async (mode: ReviewMode = "standard", count?: number, typeFilter?: CardType, orderedCards?: Flashcard[]) => {
    setShowReviewModal(false);
    try {
      const modeCount = count || 5;

      if (mode === "random-quiz") {
        let pool = cards;
        if (typeFilter) pool = pool.filter(c => c.type === typeFilter);
        if (pool.length === 0) return;
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        setReviewSessionCards(shuffled.slice(0, modeCount));
        setReviewSessionConfig({ mode: "random-quiz" });
        setView("review-session");
        return;
      }

      if (mode === "sprint") {
        let pool = cards;
        if (typeFilter) pool = pool.filter(c => c.type === typeFilter);
        if (pool.length === 0) return;
        let sprintCards = [];
        let due = await fetchDueCards();
        if (typeFilter) due = due.filter(c => c.type === typeFilter);
        if (due.length === 0) {
          const shuffled = [...pool].sort(() => 0.5 - Math.random());
          sprintCards = shuffled.slice(0, 5); // 5 random questions for a empty sprint
        } else {
          sprintCards = prioritizeDueCards(due);
        }
        setReviewSessionCards(sprintCards);
        setReviewSessionConfig({ mode: "sprint", timeLimitSeconds: 300 });
        setView("review-session");
        return;
      }

      if (mode === "reverse") {
        let pool = cards;
        if (typeFilter) pool = pool.filter(c => c.type === typeFilter);
        if (pool.length === 0) return;
        let reverseCards = [];
        let due = await fetchDueCards();
        if (typeFilter) due = due.filter(c => c.type === typeFilter);
        if (due.length === 0) {
          const shuffled = [...pool].sort(() => 0.5 - Math.random());
          reverseCards = shuffled.slice(0, modeCount);
        } else {
          reverseCards = prioritizeDueCards(due).slice(0, Math.min(modeCount, due.length));
        }
        setReviewSessionCards(reverseCards);
        setReviewSessionConfig({ mode: "reverse" });
        setView("review-session");
        return;
      }

      if (mode === "standard" && orderedCards && orderedCards.length > 0) {
        setReviewSessionCards(orderedCards);
        setReviewSessionConfig({
          mode,
        });
        setView("review-session");
        return;
      }

      let due = await fetchDueCards();
      if (typeFilter) due = due.filter(c => c.type === typeFilter);
      if (due.length === 0) return;

      const prioritized = prioritizeDueCards(due);
      let capped = prioritized;
      if (maxDailyReviews !== null && maxDailyReviews > 0) {
        const remainingReviews = Math.max(0, maxDailyReviews - reviewsToday);
        capped = prioritized.slice(0, remainingReviews);
      }
      setReviewSessionCards(capped);
      setReviewSessionConfig({
        mode,
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

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light");
  };

  useKeyboardShortcuts({
    onAddCard: () => setShowAddCardModal(true),
    onReview: () => setShowReviewModal(true),
    onDashboard: () => setView("dashboard"),
    onRefresh: () => handleManualRefresh(),
    onToggleTheme: toggleTheme,
    isModalOpen: showAddCardModal || showReviewModal,
    disabled: !keyboardShortcutsEnabled,
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => {
              setView("dashboard");
            }}
          >
            <img 
              src={theme === "light" ? "/logo-icon-light.png" : "/logo-icon-dark.png"} 
              alt="AlgoSpace" 
              className="h-9 w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
            />
            <span className="font-bold text-xl tracking-tight flex items-center">
              <span className="text-foreground">Algo</span>
              <span className="text-cyan-500 font-extrabold">Space</span>
            </span>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2">
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setView("dashboard");
                }}
                className={`gap-2 transition-all relative z-10 ${view === "dashboard" ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline-block">Dashboard</span>
              </Button>
              {view === "dashboard" && (
                <motion.div
                  layoutId="active-nav-pill"
                  className="absolute inset-0 bg-muted/80 rounded-lg -z-10 shadow-sm border border-border/40"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </div>
            <div className="relative z-50" ref={extraFeaturesRef}>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExtraFeaturesOpen(!isExtraFeaturesOpen)}
                  className={`gap-2 transition-all relative z-10 ${["guide", "goals", "achievements", "coach", "skill-tree", "stress-mode", "bigo-drill", "pattern-quiz", "cram-mode", "speedrun", "anti-patterns", "obfuscation", "cross-language", "calendar", "training-hub"].includes(view) ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Compass className="w-4 h-4" />
                  <span className="hidden sm:inline-block">Extra Features</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExtraFeaturesOpen ? 'rotate-180' : ''}`} />
                </Button>
                {["guide", "goals", "achievements", "coach", "skill-tree", "stress-mode", "bigo-drill", "pattern-quiz", "cram-mode", "speedrun", "anti-patterns", "obfuscation", "cross-language", "calendar", "training-hub"].includes(view) && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className="absolute inset-0 bg-muted/80 rounded-lg -z-10 shadow-sm border border-border/40"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </div>
              
              <AnimatePresence>
                {isExtraFeaturesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-lg overflow-hidden flex flex-col py-1"
                  >
                    <button
                      onClick={() => { setView("guide"); setIsExtraFeaturesOpen(false); }}
                      className={`flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted ${view === "guide" ? 'bg-muted/50 font-medium' : ''}`}
                    >
                      <Compass className="w-4 h-4" />
                      Guide
                    </button>
                    <button
                      onClick={() => { setView("goals"); setIsExtraFeaturesOpen(false); }}
                      className={`flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted ${view === "goals" ? 'bg-muted/50 font-medium' : ''}`}
                    >
                      <Target className="w-4 h-4" />
                      Goals
                    </button>
                    <button
                      onClick={() => { setView("achievements"); setIsExtraFeaturesOpen(false); }}
                      className={`flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:text-amber-500 hover:bg-amber-500/10 ${view === "achievements" ? 'text-amber-500 bg-amber-500/5 font-medium' : ''}`}
                    >
                      <Award className="w-4 h-4" />
                      Achievements
                    </button>
                    <button
                      onClick={() => { setView("coach"); setIsExtraFeaturesOpen(false); }}
                      className={`flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:text-blue-500 hover:bg-blue-500/10 ${view === "coach" ? 'text-blue-500 bg-blue-500/5 font-medium' : ''}`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Coach Chat
                    </button>
                    <button
                      onClick={() => { setView("skill-tree"); setIsExtraFeaturesOpen(false); }}
                      className={`flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:text-cyan-500 hover:bg-cyan-500/10 ${view === "skill-tree" ? 'text-cyan-500 bg-cyan-500/5 font-medium' : ''}`}
                    >
                      <Network className="w-4 h-4 text-cyan-500" />
                      Skill Tree
                    </button>
                    <div className="my-1 border-b border-border/50"></div>
                    <button
                      onClick={() => { setView("training-hub"); setIsExtraFeaturesOpen(false); }}
                      className={`flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:text-cyan-500 hover:bg-cyan-500/10 ${view === "training-hub" ? 'text-cyan-500 bg-cyan-500/5 font-medium' : ''}`}
                    >
                      <LayoutGrid className="w-4 h-4 text-cyan-500" />
                      Training Hub
                    </button>
                    <div className="my-1 border-b border-border/50"></div>
                    <button
                      onClick={() => { setShowPreferencesModal(true); setIsExtraFeaturesOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:text-cyan-500 hover:bg-cyan-500/10 text-muted-foreground hover:text-foreground font-medium"
                    >
                      <Sliders className="w-4 h-4 text-cyan-500" />
                      Preferences
                    </button>

                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Pause/Resume indicator */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPauseModal(true)}
              className={`gap-1.5 transition-all relative ${
                isAnyPauseActive
                  ? "text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={pauseButtonTitle}
            >
              {isAnyPauseActive ? (
                <>
                  <span className="relative flex items-center justify-center">
                    <Pause className="w-4 h-4" />
                    <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  </span>
                  <span className="hidden sm:inline-block text-xs font-semibold">Paused</span>
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReviewModal(true)}
              disabled={globalPauseStatus.active}
              className={`gap-2 transition-all relative ${
                globalPauseStatus.active
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:text-emerald-500 hover:bg-emerald-500/10"
              }`}
            >
              <PlayCircle className="w-4 h-4" />
              <span className="hidden sm:inline-block">Review</span>
              {!globalPauseStatus.active && prioritizedAndCappedDueCards.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {prioritizedAndCappedDueCards.length}
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
            {/* Import button — hidden, remove className="hidden" to restore */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowImportModal(true)}
              className="hidden"
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
              title={mounted && lastSyncTime ? `Last synced: ${formatLastSync(lastSyncTime)}` : "Sync now"}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
              {mounted && lastSyncTime && (
                <span className="hidden sm:inline-block text-xs">
                  {formatLastSync(lastSyncTime)}
                </span>
              )}
            </Button>

            <PushNotificationToggle />

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLockApp}
              className="rounded-full text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
              title="Lock Application"
            >
              <Lock className="w-4 h-4" />
            </Button>

            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="rounded-full transition-transform hover:rotate-12"
              >
                <Palette className="w-5 h-5" />
              </Button>
              {showThemeMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowThemeMenu(false)} 
                  />
                  <div className="absolute right-0 top-full mt-2 w-36 bg-card border border-border rounded-xl shadow-lg overflow-hidden py-1 z-50 animate-in slide-in-from-top-2">
                    {[
                      { id: "light", label: "Light" },
                      { id: "dark", label: "Dark" },
                      { id: "theme-vscode", label: "VS Code" },
                      { id: "theme-ocean", label: "Deep Ocean" },
                      { id: "theme-github", label: "GitHub Dark" },
                      { id: "theme-dracula", label: "Dracula" },
                      { id: "theme-monokai", label: "Monokai" },
                      { id: "theme-gruvbox", label: "Gruvbox" },
                    ].map(t => (
                      <button 
                        key={t.id}
                        onClick={() => { setTheme(t.id); setShowThemeMenu(false); }} 
                        className={`block w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors ${theme === t.id ? 'font-bold text-cyan-500 bg-cyan-500/5' : 'text-foreground'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <CommandPalette cards={cards} />
      
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <Dashboard 
                  cards={cards} 
                  dueCount={prioritizedAndCappedDueCards.length} 
                  totalDueCount={dueCards.length}
                  onRefresh={() => syncFromApi(false)}
                  onNavigate={(v) => setView(v as View)}
                  onStartReview={(mode, count, type) => {
                    setReviewSessionConfig({ mode, count, typeFilter: type });
                    setShowReviewModal(true);
                  }}
                />
              </motion.div>
            )}
            {view === "training-hub" && (
              <motion.div
                key="training-hub"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col overflow-y-auto"
              >
                <TrainingHub onNavigate={(v) => setView(v as View)} />
              </motion.div>
            )}
            {view === "calendar" && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <CalendarView cards={cards} onRefresh={() => syncFromApi(false)} />
              </motion.div>
            )}
            {view === "guide" && (
              <motion.div
                key="guide"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <GuideScreen
                  onNavigateToGoals={() => setView("goals")}
                  onStartRecovery={() => setShowRecoveryModal(true)}
                />
              </motion.div>
            )}
            {view === "goals" && (
              <motion.div
                key="goals"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <GoalsScreen />
              </motion.div>
            )}
            {view === "achievements" && (
              <motion.div
                key="achievements"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <AchievementsScreen />
              </motion.div>
            )}
            {view === "coach" && (
              <motion.div
                key="coach"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <CoachChat />
              </motion.div>
            )}
            {view === "skill-tree" && (
              <motion.div
                key="skill-tree"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <SkillTreeView />
              </motion.div>
            )}
            {view === "stress-mode" && (
              <motion.div
                key="stress-mode"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[100] bg-background flex flex-col"
              >
                <StressModeSession onExit={() => setView("dashboard")} />
              </motion.div>
            )}
            {view === "bigo-drill" && (
              <motion.div
                key="bigo-drill"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <BigODrill cards={cards} onExit={() => setView("dashboard")} />
              </motion.div>
            )}
            {view === "pattern-quiz" && (
              <motion.div
                key="pattern-quiz"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <PatternQuiz cards={cards} onExit={() => setView("dashboard")} />
              </motion.div>
            )}
            {view === "cram-mode" && (
              <motion.div
                key="cram-mode"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <CramMode
                  cards={cards}
                  onStartReview={(cardIds) => {
                    // Filter cards to prioritized set and start review
                    const prioritized = cards.filter(c => cardIds.includes(c.id));
                    if (prioritized.length > 0) {
                      setDueCards(prioritized);
                      setView("review-session");
                    }
                  }}
                  onExit={() => setView("dashboard")}
                />
              </motion.div>
            )}
            {view === "speedrun" && (
              <motion.div
                key="speedrun"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <Speedrun onExit={() => setView("dashboard")} />
              </motion.div>
            )}
            {view === "anti-patterns" && (
              <motion.div
                key="anti-patterns"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <AntiPatterns cards={cards} onExit={() => setView("dashboard")} />
              </motion.div>
            )}
            {view === "obfuscation" && (
              <motion.div
                key="obfuscation"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <ObfuscationChallenge cards={cards} onExit={() => setView("dashboard")} />
              </motion.div>
            )}
            {view === "cross-language" && (
              <motion.div
                key="cross-language"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <CrossLanguage cards={cards} onExit={() => setView("dashboard")} />
              </motion.div>
            )}
            {view === "review-session" && (
              <motion.div
                key="review-session"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <ReviewSession
                  cards={reviewSessionCards}
                  allCards={cards}
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
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
            {view === "vague-interviewer" && (
              <motion.div
                key="vague-interviewer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col overflow-y-auto"
              >
                <VagueInterviewer cards={cards} onExit={() => setView("training-hub")} />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <AnimatePresence>
          {showReviewModal && (
            <ReviewModal
              dueCards={dueCards}
              totalCards={cards}
              maxDailyReviews={maxDailyReviews}
              reviewsToday={reviewsToday}
              onClose={() => setShowReviewModal(false)}
              onStart={handleStartReview}
              onRescheduled={() => {
                setShowReviewModal(false);
                syncFromApi(false);
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showAddCardModal && (
            <AddCardModal
              onClose={() => setShowAddCardModal(false)}
              onAdded={() => syncFromApi(false)}
              cards={cards}
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

        <AnimatePresence>
          {showPauseModal && (
            <GlobalPauseModal
              pauseStatus={globalPauseStatus}
              onClose={() => setShowPauseModal(false)}
              onChanged={() => {
                setShowPauseModal(false);
                syncFromApi(false);
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPreferencesModal && (
            <PreferencesModal
              currentTheme={theme}
              keyboardShortcutsEnabled={keyboardShortcutsEnabled}
              maxDailyReviews={maxDailyReviews}
              onClose={() => setShowPreferencesModal(false)}
              onChanged={(newPrefs) => {
                setShowPreferencesModal(false);
                setKeyboardShortcutsEnabled(newPrefs.keyboardShortcutsEnabled);
                setTheme(newPrefs.defaultTheme);
                setMaxDailyReviews(newPrefs.maxDailyReviews);
                syncFromApi(false);
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showRecoveryModal && (
            <RecoveryModeModal
              onClose={() => setShowRecoveryModal(false)}
              onChanged={() => {
                syncFromApi(false);
              }}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
