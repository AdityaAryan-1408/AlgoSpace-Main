import { useMemo } from "react";
import { Activity, BrainCircuit, Target, Clock } from "lucide-react";
import type { AnalyticsData } from "@/lib/client-api";

interface Props {
  analytics: AnalyticsData;
}

export function StudyMetricsWidget({ analytics }: Props) {
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayData = analytics.performance.find(p => p.date === todayStr);
    
    // Calculate last 7 days total
    const last7Days = analytics.performance.slice(-7);
    const weeklyReviews = last7Days.reduce((sum, day) => sum + day.total, 0);
    const weeklyGood = last7Days.reduce((sum, day) => sum + day.good, 0);
    const weeklyAccuracy = weeklyReviews > 0 ? Math.round((weeklyGood / weeklyReviews) * 100) : 0;

    return {
      todayReviews: todayData?.total || 0,
      todayAccuracy: todayData?.accuracy !== undefined && todayData?.accuracy !== null ? Math.round(todayData.accuracy) : 0,
      weeklyReviews,
      weeklyAccuracy
    };
  }, [analytics]);

  return (
    <div className="rounded-xl border border-border bg-background p-4 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4 text-emerald-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Study Efficiency</h3>
          <p className="text-xs text-muted-foreground">Session metrics & retention</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        <div className="bg-muted/30 rounded-lg p-3 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Target className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Today's Accuracy</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {metrics.todayAccuracy}%
          </div>
        </div>

        <div className="bg-muted/30 rounded-lg p-3 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Today's Reviews</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {metrics.todayReviews}
          </div>
        </div>

        <div className="bg-muted/30 rounded-lg p-3 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <BrainCircuit className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Weekly Accuracy</span>
          </div>
          <div className="text-xl font-bold text-foreground">
            {metrics.weeklyAccuracy}%
          </div>
        </div>

        <div className="bg-muted/30 rounded-lg p-3 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Activity className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Weekly Reviews</span>
          </div>
          <div className="text-xl font-bold text-foreground">
            {metrics.weeklyReviews}
          </div>
        </div>
      </div>
    </div>
  );
}
