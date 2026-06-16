import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Pin, Sparkles, TrendingUp, TrendingDown, Compass, ArrowRight, Globe, Brain, PlaySquare, RefreshCw, Timer, Zap, Network, Loader2, CheckCircle2, AlertTriangle, Target } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import dynamic from "next/dynamic";

const TopicRadarChart = dynamic(() => import("@/components/charts/TopicRadarChart").then(m => ({ default: m.TopicRadarChart })), {
  ssr: false,
  loading: () => <div className="h-[300px] rounded-xl bg-muted/20 animate-pulse" />,
});
import type { Flashcard } from "@/data";

interface FeatureCarouselWidgetProps {
  analytics: any;
  dueCount: number;
  cards: Flashcard[];
  onNavigate: (view: string) => void;
  onOpenTopicModal: () => void;
  onShowCardsList?: (title: string, cardsList: Flashcard[]) => void;
}

// --- Interactive Mini-App Tiles ---

const SUGGESTIONS = [
  {
    title: "Try a Pattern Quiz!",
    desc: "Test if you can recognize patterns from descriptions alone without coding.",
    target: "pattern-quiz",
    icon: <Compass className="w-6 h-6 text-amber-500" />,
    bgClass: "bg-amber-500/10",
    btnClass: "bg-amber-500 hover:bg-amber-600"
  },
  {
    title: "Start a Speedrun",
    desc: "Race against the clock to type solutions flawlessly and build muscle memory.",
    target: "speedrun",
    icon: <Timer className="w-6 h-6 text-blue-500" />,
    bgClass: "bg-blue-500/10",
    btnClass: "bg-blue-500 hover:bg-blue-600"
  },
  {
    title: "Enter Stress Drill",
    desc: "Simulate interview anxiety with strict time limits and penalties.",
    target: "stress-mode",
    icon: <Zap className="w-6 h-6 text-red-500" />,
    bgClass: "bg-red-500/10",
    btnClass: "bg-red-500 hover:bg-red-600"
  },
  {
    title: "Skill Tree Progress",
    desc: "Check your mastery map to see what topics you should focus on next.",
    target: "skill-tree",
    icon: <Network className="w-6 h-6 text-cyan-500" />,
    bgClass: "bg-cyan-500/10",
    btnClass: "bg-cyan-500 hover:bg-cyan-600"
  }
];

function DailySuggestionTile({ onNavigate }: { onNavigate: (v: string) => void }) {
  const [index, setIndex] = useState(() => new Date().getDate() % SUGGESTIONS.length);

  const current = SUGGESTIONS[index];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative group">
      <button 
        onClick={() => setIndex((i) => (i + 1) % SUGGESTIONS.length)}
        className="absolute top-2 right-2 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:rotate-180 opacity-0 group-hover:opacity-100"
        title="Cycle Suggestion"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      <AnimatePresence mode="wait">
        <motion.div 
          key={current.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center justify-center w-full"
        >
          <div className={`w-12 h-12 rounded-full ${current.bgClass} flex items-center justify-center mb-4`}>
            {current.icon}
          </div>
          <h4 className="text-lg font-bold text-foreground mb-2">{current.title}</h4>
          <p className="text-sm text-muted-foreground mb-4 h-10 flex items-center justify-center">
            {current.desc}
          </p>
          <button 
            onClick={() => onNavigate(current.target)}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-full text-sm font-semibold transition-colors ${current.btnClass}`}
          >
            Launch <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function RealWorldTile() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const fetchQuestion = async (forceRefresh = false) => {
    setLoading(true);
    setSelected(null);
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `algotrack_architecture_${today}`;

    if (!forceRefresh) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setData(JSON.parse(cached));
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/dashboard/architecture-drill");
      if (res.ok) {
        const json = await res.json();
        localStorage.setItem(cacheKey, JSON.stringify(json));
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestion();
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative group">
      <button 
        onClick={() => fetchQuestion(true)}
        className="absolute top-2 right-2 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:rotate-180 opacity-0 group-hover:opacity-100"
        title="Generate New Question"
      >
        <RefreshCw className="w-4 h-4" />
      </button>
      
      <Globe className="w-8 h-8 text-blue-500 mb-4" />
      <h4 className="text-lg font-bold mb-2">Architecture Drill</h4>
      
      {loading || !data ? (
        <div className="flex flex-col items-center justify-center gap-2 mt-4 flex-1">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          <p className="text-xs text-muted-foreground">Generating scenario...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div 
            key={data.scenario}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center w-full"
          >
            <p className="text-sm text-muted-foreground mb-6 line-clamp-3 h-14 overflow-hidden">{data.scenario}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {data.options.map((opt: string) => (
                <button 
                  key={opt}
                  onClick={() => setSelected(opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selected === opt 
                      ? opt === data.correctAnswer ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500' : 'bg-red-500/20 text-red-500 border border-red-500'
                      : 'bg-muted hover:bg-muted/80 text-foreground border border-transparent'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {selected && (
              <div className={`text-xs mt-4 animate-in fade-in ${selected === data.correctAnswer ? 'text-emerald-500' : 'text-red-500'}`}>
                {selected === data.correctAnswer ? "Correct!" : "Incorrect."} {data.explanation}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function GuessOutputTile() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [guess, setGuess] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "incorrect">("idle");

  const fetchQuestion = async (forceRefresh = false) => {
    setLoading(true);
    setGuess("");
    setStatus("idle");
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `algotrack_mental_${today}`;

    if (!forceRefresh) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setData(JSON.parse(cached));
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/dashboard/mental-tracing");
      if (res.ok) {
        const json = await res.json();
        localStorage.setItem(cacheKey, JSON.stringify(json));
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestion();
  }, []);

  const check = () => {
    if (!data) return;
    if (guess.trim() === data.correctOutput) setStatus("correct");
    else setStatus("incorrect");
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative group">
      <button 
        onClick={() => fetchQuestion(true)}
        className="absolute top-2 right-2 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:rotate-180 opacity-0 group-hover:opacity-100"
        title="Generate New Code"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      <Brain className="w-8 h-8 text-violet-500 mb-3" />
      <h4 className="text-lg font-bold mb-2">Mental Tracing</h4>
      
      {loading || !data ? (
        <div className="flex flex-col items-center justify-center gap-2 mt-4 flex-1">
          <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
          <p className="text-xs text-muted-foreground">Generating code snippet...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div 
            key={data.code}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center w-full"
          >
            <div className="bg-muted/50 p-3 rounded-lg text-left w-full max-w-[250px] mb-4 overflow-x-auto max-h-[100px] overflow-y-auto">
              <pre className="text-xs text-foreground font-mono"><code>{data.code}</code></pre>
            </div>
            <div className="flex gap-2 w-full max-w-[250px]">
              <input 
                type="text" 
                value={guess}
                onChange={(e) => { setGuess(e.target.value); setStatus("idle"); }}
                onKeyDown={(e) => e.key === 'Enter' && check()}
                placeholder="Output?"
                className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/50"
              />
              <button onClick={check} className="bg-violet-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-violet-600 transition-colors">
                Check
              </button>
            </div>
            {status === "correct" && <div className="text-emerald-500 text-xs mt-2 animate-in fade-in">Correct! {data.explanation}</div>}
            {status === "incorrect" && <div className="text-red-500 text-xs mt-2 animate-in fade-in">Incorrect. Try tracing again.</div>}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function AlgoVisTile() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <PlaySquare className="w-8 h-8 text-pink-500 mb-4" />
      <h4 className="text-lg font-bold mb-2">Algorithm Visualization</h4>
      <div className="h-16 w-full max-w-[200px] flex items-end justify-center gap-1">
         {[40, 60, 20, 80, 30].map((h, i) => (
           <motion.div 
             key={i}
             animate={{ height: [h, Math.max(20, h-20), h+10, h] }}
             transition={{ repeat: Infinity, duration: 2, delay: i * 0.2 }}
             className="w-6 bg-pink-500 rounded-t-sm"
             style={{ height: h }}
           />
         ))}
      </div>
    </div>
  );
}

function QuickStatsTile({ cards, analytics, onShowCardsList }: { cards: Flashcard[]; analytics: any; onShowCardsList?: (title: string, cardsList: Flashcard[]) => void }) {
  const { masteredCards, strugglingCards } = useMemo(() => {
    const active = cards.filter(c => !c.metadata?.review_paused && !c.metadata?.globally_paused && !c.metadata?.reference_only);
    const mCards = active.filter(c => c.dueInDays >= 14);
    const sCards = active.filter(c => c.lastRating === 'AGAIN' || c.lastRating === 'HARD');
    return { masteredCards: mCards, strugglingCards: sCards };
  }, [cards]);

  const stats = useMemo(() => {
    const mastered = masteredCards.length;
    const struggling = strugglingCards.length;

    const recent = (analytics?.performance || []).slice(-7);
    const accVals = recent.filter((d: any) => d.accuracy != null).map((d: any) => d.accuracy as number);
    const avgAccuracy = accVals.length > 0
      ? Math.round(accVals.reduce((a: number, b: number) => a + b, 0) / accVals.length)
      : null;

    const prev = (analytics?.performance || []).slice(-14, -7);
    const prevAccVals = prev.filter((d: any) => d.accuracy != null).map((d: any) => d.accuracy as number);
    const prevAvg = prevAccVals.length > 0
      ? Math.round(prevAccVals.reduce((a: number, b: number) => a + b, 0) / prevAccVals.length)
      : null;

    let accuracyTrend: 'up' | 'down' | 'flat' = 'flat';
    if (avgAccuracy != null && prevAvg != null) {
      if (avgAccuracy > prevAvg + 2) accuracyTrend = 'up';
      else if (avgAccuracy < prevAvg - 2) accuracyTrend = 'down';
    }

    return { mastered, struggling, avgAccuracy, accuracyTrend, total: cards.length };
  }, [cards.length, masteredCards.length, strugglingCards.length, analytics]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">
      <div className="grid grid-cols-3 gap-3 w-full max-w-[340px]">
        {/* Mastered */}
        <button
          onClick={() => onShowCardsList?.("Mastered Cards", masteredCards)}
          disabled={masteredCards.length === 0}
          className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:scale-105 active:scale-95 transition-all duration-200 text-center disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-emerald-500/5 disabled:hover:border-emerald-500/15"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <span className="text-2xl font-bold text-emerald-500">{stats.mastered}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Mastered</span>
        </button>
        {/* Struggling */}
        <button
          onClick={() => onShowCardsList?.("Struggling Cards", strugglingCards)}
          disabled={strugglingCards.length === 0}
          className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 cursor-pointer hover:bg-amber-500/10 hover:border-amber-500/30 hover:scale-105 active:scale-95 transition-all duration-200 text-center disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-amber-500/5 disabled:hover:border-amber-500/15"
        >
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <span className="text-2xl font-bold text-amber-500">{stats.struggling}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Struggling</span>
        </button>
        {/* Accuracy */}
        <div className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 text-center">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Target className="w-5 h-5 text-blue-500" />
          </div>
          <span className="text-2xl font-bold text-blue-500">{stats.avgAccuracy != null ? `${stats.avgAccuracy}%` : '—'}</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Accuracy</span>
            {stats.accuracyTrend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-500" />}
            {stats.accuracyTrend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {stats.total > 0
          ? `${Math.round((stats.mastered / stats.total) * 100)}% of your ${stats.total} cards fully mastered`
          : "Add cards to start building mastery"}
      </p>
    </div>
  );
}

export function FeatureCarouselWidget({ analytics, dueCount, cards, onNavigate, onOpenTopicModal, onShowCardsList }: FeatureCarouselWidgetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);

  const TILES = useMemo(() => [
    {
      id: "quick-stats",
      title: "Quick Stats",
      icon: <TrendingUp className="w-4 h-4 text-blue-500" />,
      content: <QuickStatsTile cards={cards} analytics={analytics} onShowCardsList={onShowCardsList} />
    },
    {
      id: "topic-mastery",
      title: "Topic Mastery",
      icon: <TrendingUp className="w-4 h-4 text-cyan-500" />,
      content: (
        <div className="flex-1 w-full h-[300px] pt-4">
          <TopicRadarChart data={analytics.topics.slice(0, 7)} />
        </div>
      ),
      action: (
        <button 
          onClick={onOpenTopicModal}
          className="w-6 h-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors ml-2 cursor-pointer"
          title="View all topics"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )
    },
    {
      id: "daily-suggestion",
      title: "Daily Suggestion",
      icon: <Sparkles className="w-4 h-4 text-amber-500" />,
      content: <DailySuggestionTile onNavigate={onNavigate} />
    },
    {
      id: "real-world",
      title: "Architecture Drill",
      icon: <Globe className="w-4 h-4 text-blue-500" />,
      content: <RealWorldTile />
    },
    {
      id: "guess-output",
      title: "Mental Tracing",
      icon: <Brain className="w-4 h-4 text-violet-500" />,
      content: <GuessOutputTile />
    }
  ], [cards, analytics, onShowCardsList, onOpenTopicModal, onNavigate]);

  useEffect(() => {
    const savedPin = localStorage.getItem("algotrack-carousel-pin");
    if (savedPin !== null) {
      const idx = parseInt(savedPin, 10);
      if (idx >= 0 && idx < TILES.length) {
        setPinnedIndex(idx);
        setCurrentIndex(idx);
      }
    }
  }, [TILES.length]);

  const handlePin = (index: number) => {
    if (pinnedIndex === index) {
      setPinnedIndex(null);
      localStorage.removeItem("algotrack-carousel-pin");
    } else {
      setPinnedIndex(index);
      localStorage.setItem("algotrack-carousel-pin", index.toString());
    }
  };

  const nextTile = () => {
    setCurrentIndex((prev) => (prev + 1) % TILES.length);
  };

  const prevTile = () => {
    setCurrentIndex((prev) => (prev - 1 + TILES.length) % TILES.length);
  };

  const currentTile = TILES[currentIndex];

  return (
    <div className="rounded-xl border border-border bg-background flex flex-col overflow-hidden relative min-h-[350px]">
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20 z-10">
        <div className="flex items-center gap-2">
          {currentTile?.icon}
          <h3 className="text-sm font-semibold text-foreground">
            {currentTile?.title}
          </h3>
          {currentTile?.action && currentTile.action}
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handlePin(currentIndex)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${pinnedIndex === currentIndex ? 'bg-cyan-500/20 text-cyan-500' : 'text-muted-foreground hover:bg-muted'}`}
            title={pinnedIndex === currentIndex ? "Unpin widget" : "Pin this widget"}
          >
            <Pin className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            <button onClick={prevTile} className="p-1 rounded-md hover:bg-background text-muted-foreground transition-colors cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium w-8 text-center text-muted-foreground">
              {currentIndex + 1}/{TILES.length}
            </span>
            <button onClick={nextTile} className="p-1 rounded-md hover:bg-background text-muted-foreground transition-colors cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex flex-col"
          >
            {currentTile?.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
