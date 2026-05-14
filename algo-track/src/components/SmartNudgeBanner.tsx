import { Sparkles, X } from "lucide-react";
import { useState, useMemo } from "react";
import type { AnalyticsData } from "@/lib/client-api";

interface Props {
  analytics: AnalyticsData | null;
}

export function SmartNudgeBanner({ analytics }: Props) {
  const [dismissed, setDismissed] = useState(false);

  const nudge = useMemo(() => {
    if (!analytics) return "Ready to level up? Start a review session to build your streak!";
    
    if (analytics.streak.currentStreak > 3 && analytics.streak.currentStreak % 5 === 0) {
      return `🔥 You're on a ${analytics.streak.currentStreak}-day streak! Keep the momentum going.`;
    }
    
    if (analytics.topics.length > 0) {
      const weakest = [...analytics.topics].sort((a, b) => a.mastery - b.mastery)[0];
      if (weakest && weakest.mastery < 60) {
        return `💡 Your ${weakest.topic} mastery is at ${weakest.mastery}%. A quick focused session could boost it!`;
      }
    }

    return "Consistency is key. 10 minutes of review today saves hours of cramming later.";
  }, [analytics]);

  if (dismissed) return null;

  return (
    <div className="mb-6 p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 backdrop-blur-sm relative pr-10 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-blue-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-blue-500">AI Coach Nudge</p>
          <p className="text-sm text-foreground/80 mt-0.5">{nudge}</p>
        </div>
      </div>
      <button 
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
