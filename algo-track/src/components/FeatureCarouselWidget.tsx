import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Pin, Sparkles, Calendar, TrendingUp, Compass, ArrowRight, Globe, Brain, PlaySquare, RefreshCw, Timer, Zap, Network } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { TopicRadarChart } from "@/components/charts/TopicRadarChart";

interface FeatureCarouselWidgetProps {
  analytics: any; // Topic Mastery data
  dueCount: number; // For mini calendar
  onNavigate: (view: string) => void;
  onOpenTopicModal: () => void;
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
  const [selected, setSelected] = useState<string | null>(null);
  const options = ["Hash Map", "Trie", "Min-Heap"];
  const correct = "Trie";

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <Globe className="w-8 h-8 text-blue-500 mb-4" />
      <h4 className="text-lg font-bold mb-2">Real-World Architecture</h4>
      <p className="text-sm text-muted-foreground mb-6">You need to build a fast 'autocomplete' feature for a search engine. What data structure do you use?</p>
      <div className="flex gap-2">
        {options.map(opt => (
          <button 
            key={opt}
            onClick={() => setSelected(opt)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selected === opt 
                ? opt === correct ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500' : 'bg-red-500/20 text-red-500 border border-red-500'
                : 'bg-muted hover:bg-muted/80 text-foreground border border-transparent'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {selected === correct && <div className="text-emerald-500 text-xs mt-4 animate-in fade-in">Correct! Tries provide O(L) prefix lookups.</div>}
    </div>
  );
}

function GuessOutputTile() {
  const [guess, setGuess] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "incorrect">("idle");
  const code = `function foo(n) {
  if (n < 2) return n;
  return foo(n-1) + foo(n-2);
}
console.log(foo(4));`;

  const check = () => {
    if (guess.trim() === "3") setStatus("correct");
    else setStatus("incorrect");
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <Brain className="w-8 h-8 text-violet-500 mb-3" />
      <h4 className="text-lg font-bold mb-2">Mental Tracing</h4>
      <div className="bg-muted/50 p-3 rounded-lg text-left w-full max-w-[250px] mb-4">
        <pre className="text-xs text-foreground font-mono"><code>{code}</code></pre>
      </div>
      <div className="flex gap-2 w-full max-w-[250px]">
        <input 
          type="text" 
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder="Output?"
          className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm"
        />
        <button onClick={check} className="bg-violet-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-violet-600 transition-colors">
          Check
        </button>
      </div>
      {status === "correct" && <div className="text-emerald-500 text-xs mt-2 animate-in fade-in">Correct! Excellent tracing.</div>}
      {status === "incorrect" && <div className="text-red-500 text-xs mt-2 animate-in fade-in">Try again! Remember it's Fibonacci.</div>}
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

export function FeatureCarouselWidget({ analytics, dueCount, onNavigate, onOpenTopicModal }: FeatureCarouselWidgetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);

  useEffect(() => {
    const savedPin = localStorage.getItem("algotrack-carousel-pin");
    if (savedPin !== null) {
      const idx = parseInt(savedPin, 10);
      setPinnedIndex(idx);
      setCurrentIndex(idx);
    }
  }, []);

  const handlePin = (index: number) => {
    if (pinnedIndex === index) {
      setPinnedIndex(null);
      localStorage.removeItem("algotrack-carousel-pin");
    } else {
      setPinnedIndex(index);
      localStorage.setItem("algotrack-carousel-pin", index.toString());
    }
  };

  const TILES = [
    {
      id: "calendar",
      title: "Mini Calendar",
      icon: <Calendar className="w-4 h-4 text-emerald-500" />,
      content: (
        <div 
          onClick={() => onNavigate("calendar")}
          className="flex-1 flex flex-col items-center justify-center cursor-pointer group p-4"
        >
          <div className="text-4xl font-black text-foreground group-hover:text-emerald-500 transition-colors">
            {new Date().toLocaleString('default', { month: 'short' }).toUpperCase()}
          </div>
          <div className="mt-2 text-sm text-muted-foreground font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {dueCount} cards due today
          </div>
          <div className="mt-4 text-xs font-semibold text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            Open Time Travel <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      )
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
          className="w-6 h-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors ml-2"
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
    },
    {
      id: "algo-vis",
      title: "Algorithm Vis",
      icon: <PlaySquare className="w-4 h-4 text-pink-500" />,
      content: <AlgoVisTile />
    }
  ];

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
          {currentTile.icon}
          <h3 className="text-sm font-semibold text-foreground">
            {currentTile.title}
          </h3>
          {currentTile.action && currentTile.action}
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handlePin(currentIndex)}
            className={`p-1.5 rounded-md transition-colors ${pinnedIndex === currentIndex ? 'bg-cyan-500/20 text-cyan-500' : 'text-muted-foreground hover:bg-muted'}`}
            title={pinnedIndex === currentIndex ? "Unpin widget" : "Pin this widget"}
          >
            <Pin className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            <button onClick={prevTile} className="p-1 rounded-md hover:bg-background text-muted-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium w-8 text-center text-muted-foreground">
              {currentIndex + 1}/{TILES.length}
            </span>
            <button onClick={nextTile} className="p-1 rounded-md hover:bg-background text-muted-foreground transition-colors">
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
            {currentTile.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
