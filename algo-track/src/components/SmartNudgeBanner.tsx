'use client';

import { Sparkles, X } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import type { AnalyticsData } from "@/lib/client-api";

interface Props {
  analytics: AnalyticsData | null;
}

export function SmartNudgeBanner({ analytics }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [checklistNudge, setChecklistNudge] = useState<string | null>(null);
  const [goalNudge, setGoalNudge] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch today's checklist items
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    fetch(`/api/goals/daily?date=${todayStr}`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data && data.items && data.items.length > 0) {
          const incomplete = data.items.filter((item: any) => item.status !== "completed");
          if (incomplete.length > 0) {
            setChecklistNudge(
              `You have ${incomplete.length} of ${data.items.length} planner tasks remaining for today. Focus on '${incomplete[0].title}' next!`
            );
          }
        }
      })
      .catch((err) => console.error("Error fetching daily checklist for nudge:", err));

    // 2. Fetch coach nudges for active structured goals
    fetch("/api/coach/nudges")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data && data.goals && data.goals.length > 0) {
          // Find first goal that has critical or warning nudges
          const firstGoalWithNudges = data.goals.find(
            (g: any) => g.nudges && g.nudges.length > 0
          );
          if (firstGoalWithNudges) {
            const urgentNudge =
              firstGoalWithNudges.nudges.find(
                (n: any) => n.priority === "critical" || n.priority === "warning"
              ) || firstGoalWithNudges.nudges[0];
            
            if (urgentNudge) {
              setGoalNudge(`Goal Pacing: ${urgentNudge.message}`);
            }
          }
        }
      })
      .catch((err) => console.error("Error fetching coach nudges for banner:", err));
  }, []);

  const nudge = useMemo(() => {
    // Priority 1: Incomplete custom daily checklists for today
    if (checklistNudge) {
      return `📋 ${checklistNudge}`;
    }

    // Priority 2: Active structured goal deficits/nudges
    if (goalNudge) {
      return `🎯 ${goalNudge}`;
    }

    // Priority 3: Analytics streak and topic-based nudges
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
  }, [analytics, checklistNudge, goalNudge]);

  if (dismissed) return null;

  return (
    <div className="mb-6 p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 backdrop-blur-sm relative pr-10 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-cyan-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-cyan-500">AI Coach Advice</p>
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
