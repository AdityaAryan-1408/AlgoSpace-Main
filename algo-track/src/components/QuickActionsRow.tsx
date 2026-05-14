import { Zap, Shuffle, Code } from "lucide-react";
import type { CardType } from "@/data";

interface Props {
  onAction?: (mode: "standard" | "random-quiz" | "sprint" | "reverse", count?: number, typeFilter?: CardType) => void;
}

export function QuickActionsRow({ onAction }: Props) {
  if (!onAction) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-500" /> Quick Sprints
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button 
          onClick={() => onAction("sprint", 5)}
          className="p-4 rounded-xl border border-border bg-card hover:border-amber-500/50 hover:bg-amber-500/5 transition-all flex flex-col items-start gap-2 group text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform">
              <Zap className="w-4 h-4" />
            </div>
            <span className="font-semibold text-foreground">🔥 Cram Mode</span>
          </div>
          <span className="text-xs text-muted-foreground">Review your 5 most urgent due cards right now.</span>
        </button>

        <button 
          onClick={() => onAction("random-quiz", 5)}
          className="p-4 rounded-xl border border-border bg-card hover:border-purple-500/50 hover:bg-purple-500/5 transition-all flex flex-col items-start gap-2 group text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-500 group-hover:scale-110 transition-transform">
              <Shuffle className="w-4 h-4" />
            </div>
            <span className="font-semibold text-foreground">🔀 Random 5</span>
          </div>
          <span className="text-xs text-muted-foreground">A quick pop-quiz of 5 random cards.</span>
        </button>

        <button 
          onClick={() => onAction("random-quiz", 5, "leetcode")}
          className="p-4 rounded-xl border border-border bg-card hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex flex-col items-start gap-2 group text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
              <Code className="w-4 h-4" />
            </div>
            <span className="font-semibold text-foreground">💻 Code Only</span>
          </div>
          <span className="text-xs text-muted-foreground">5 random DSA coding problems.</span>
        </button>
      </div>
    </div>
  );
}
