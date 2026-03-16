'use client';

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Shield,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Target,
  Zap,
  Brain,
  Flame,
  Activity,
  Loader2,
  ChevronRight,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Plus,
  Lightbulb,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { SmartNudge } from "@/lib/nudge-engine";
import type { RecommendationResult } from "@/lib/recommendation-engine";

// ── Types ───────────────────────────────────────────────────────

interface GuideOverviewData {
  profileSummary: {
    totalCards: number;
    totalDue: number;
    totalOverdue: number;
    currentStreak: number;
    recentAccuracy: number;
    difficultyDistribution: { easy: number; medium: number; hard: number };
  };
  strengths: Array<{ topic: string; mastery: number; cardCount: number }>;
  weakSpots: Array<{
    key: string;
    keyType: string;
    score: number;
    cardCount: number;
    recentFailRate: number;
    overdueCount: number;
  }>;
  goalStatus: {
    activeGoalCount: number;
    goals: Array<{
      goalId: string;
      goalTitle: string;
      pacing: {
        elapsedDays: number;
        remainingDays: number;
        totalDays: number;
        targets: Array<{
          metricKey: string;
          targetValue: number;
          currentValue: number;
          adjustedPace: number;
          status: string;
        }>;
      } | null;
      nudges: SmartNudge[];
    }>;
  };
  dailyPlan: {
    totalNudges: number;
    generalNudges: SmartNudge[];
  };
  recoveryMode: {
    isRecoveryNeeded: boolean;
    totalOverdue: number;
    daysSinceLastReview: number;
    recommendedDailyCap: number;
  };
}

interface GuideScreenProps {
  onNavigateToGoals: () => void;
  onStartRecovery: () => void;
}

// ── Nudge Icon Helper ───────────────────────────────────────────

function getNudgeIcon(category: string) {
  switch (category) {
    case "solve_pace":
      return <TrendingUp className="w-4 h-4" />;
    case "review_pace":
      return <Activity className="w-4 h-4" />;
    case "retention":
      return <Brain className="w-4 h-4" />;
    case "topic_overdue":
      return <AlertTriangle className="w-4 h-4" />;
    case "topic_neglected":
      return <Target className="w-4 h-4" />;
    case "celebration":
      return <CheckCircle2 className="w-4 h-4" />;
    case "recovery":
      return <Shield className="w-4 h-4" />;
    default:
      return <Zap className="w-4 h-4" />;
  }
}

function getNudgePriorityColor(priority: string) {
  switch (priority) {
    case "critical":
      return "text-red-500 bg-red-500/10 border-red-500/20";
    case "warning":
      return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    default:
      return "text-blue-500 bg-blue-500/10 border-blue-500/20";
  }
}

// ── Sub-components ──────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color = "text-foreground",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
      <div className={`p-2.5 rounded-lg bg-muted ${color}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function NudgeItem({ nudge }: { nudge: SmartNudge }) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border ${getNudgePriorityColor(nudge.priority)}`}
    >
      <div className="mt-0.5 flex-shrink-0">
        {getNudgeIcon(nudge.category)}
      </div>
      <p className="text-sm leading-relaxed">{nudge.message}</p>
    </div>
  );
}

function ProgressBar({
  value,
  max,
  color = "bg-emerald-500",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: "0%" }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────

export function GuideScreen({ onNavigateToGoals, onStartRecovery }: GuideScreenProps) {
  const [data, setData] = useState<GuideOverviewData | null>(null);
  const [recs, setRecs] = useState<RecommendationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [overviewRes, recsRes] = await Promise.all([
          fetch("/api/coach/overview"),
          fetch("/api/coach/recommendations?limit=6")
        ]);
        
        if (!overviewRes.ok) throw new Error("Failed to load guide data");
        const json = await overviewRes.ok ? await overviewRes.json() : null;
        const recsJson = await recsRes.ok ? await recsRes.json() : null;
        
        setData(json);
        setRecs(recsJson);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">{error || "No data available"}</p>
      </div>
    );
  }

  const { profileSummary, strengths, weakSpots, goalStatus, dailyPlan, recoveryMode } = data;

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your Guide</h1>
        <p className="text-muted-foreground mt-1">
          Here is your personalized study overview and recommendations.
        </p>
      </div>

      {/* Recovery Warning Banner */}
      {recoveryMode.isRecoveryNeeded && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Shield className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold text-amber-500">Recovery Mode Recommended</p>
                <p className="text-sm text-muted-foreground">
                  {recoveryMode.totalOverdue} overdue cards
                  {recoveryMode.daysSinceLastReview > 1 &&
                    ` and ${recoveryMode.daysSinceLastReview} days since your last review`}
                  . We recommend capping daily reviews at {recoveryMode.recommendedDailyCap}.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={onStartRecovery}
              className="flex-shrink-0 gap-1.5"
            >
              <Shield className="w-4 h-4" />
              Start Recovery
            </Button>
          </div>
        </motion.div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Cards"
          value={profileSummary.totalCards}
          icon={<Target className="w-5 h-5" />}
          color="text-blue-500"
        />
        <StatCard
          label="Due Today"
          value={profileSummary.totalDue}
          icon={<Zap className="w-5 h-5" />}
          color={profileSummary.totalDue > 0 ? "text-amber-500" : "text-emerald-500"}
        />
        <StatCard
          label="Recent Accuracy"
          value={`${profileSummary.recentAccuracy}%`}
          icon={<Activity className="w-5 h-5" />}
          color={profileSummary.recentAccuracy >= 70 ? "text-emerald-500" : "text-red-500"}
        />
        <StatCard
          label="Streak"
          value={`${profileSummary.currentStreak}d`}
          icon={<Flame className="w-5 h-5" />}
          color="text-orange-500"
        />
      </div>

      {/* Two-column layout: Strengths + Weak Spots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            {strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keep reviewing to build your strength profile!
              </p>
            ) : (
              <div className="space-y-3">
                {strengths.map((s) => (
                  <div key={s.topic} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{s.topic}</span>
                      <span className="text-muted-foreground">
                        {s.mastery}% mastery
                      </span>
                    </div>
                    <ProgressBar
                      value={s.mastery}
                      max={100}
                      color="bg-emerald-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weak Spots */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Weak Spots
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weakSpots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No major weak spots detected. Nice work!
              </p>
            ) : (
              <div className="space-y-3">
                {weakSpots.slice(0, 5).map((w) => (
                  <div
                    key={w.key}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-medium">{w.key}</p>
                      <p className="text-xs text-muted-foreground">
                        {w.cardCount} cards &middot; {w.recentFailRate}% fail rate
                        {w.overdueCount > 0 && ` \u00b7 ${w.overdueCount} overdue`}
                      </p>
                    </div>
                    <Badge
                      variant={w.score >= 60 ? "destructive" : "secondary"}
                    >
                      {w.score}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Goal Pacing */}
      {goalStatus.activeGoalCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="w-4 h-4 text-blue-500" />
                Active Goals
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateToGoals}
                className="gap-1 text-xs text-muted-foreground"
              >
                View All
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {goalStatus.goals.map((goal) => (
                <div
                  key={goal.goalId}
                  className="p-4 rounded-xl border border-border space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">{goal.goalTitle}</h4>
                    {goal.pacing && (
                      <span className="text-xs text-muted-foreground">
                        {goal.pacing.remainingDays}d remaining
                      </span>
                    )}
                  </div>

                  {goal.pacing?.targets.map((target) => (
                    <div key={target.metricKey} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {target.metricKey.replace(/_/g, " ")}
                        </span>
                        <span className="font-medium">
                          {target.currentValue} / {target.targetValue}
                        </span>
                      </div>
                      <ProgressBar
                        value={target.currentValue}
                        max={target.targetValue}
                        color={
                          target.status === "on_track"
                            ? "bg-emerald-500"
                            : target.status === "slightly_behind"
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Adjusted pace: {target.adjustedPace}/day
                      </p>
                    </div>
                  ))}

                  {goal.nudges.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {goal.nudges.slice(0, 2).map((nudge) => (
                        <NudgeItem key={nudge.id} nudge={nudge} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations / Nudges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nudges */}
        {(dailyPlan.generalNudges.length > 0 || goalStatus.goals.some((g) => g.nudges.length > 0)) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="w-4 h-4 text-purple-500" />
                Urgent Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dailyPlan.generalNudges.map((nudge) => (
                  <NudgeItem key={nudge.id} nudge={nudge} />
                ))}
                {dailyPlan.generalNudges.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No urgent recommendations right now. Keep up the good work!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Priority Actions */}
        {recs?.priorityActions && recs.priorityActions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                Recommended Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recs.priorityActions.map((action) => (
                  <div
                    key={action.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      action.priority === "high"
                        ? "text-red-500 bg-red-500/10 border-red-500/20"
                        : action.priority === "medium"
                        ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
                        : "text-blue-500 bg-blue-500/10 border-blue-500/20"
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {action.type === "review" && <Activity className="w-4 h-4" />}
                      {action.type === "solve" && <Target className="w-4 h-4" />}
                      {action.type === "study" && <BookOpen className="w-4 h-4" />}
                      {action.type === "create_cards" && <Plus className="w-4 h-4" />}
                    </div>
                    <p className="text-sm leading-relaxed">{action.message}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Suggested Study Material */}
      {recs && (recs.suggestedProblems.length > 0 || recs.suggestedTopics.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* DSA Recommendations */}
          {recs.suggestedProblems.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="w-4 h-4 text-blue-500" />
                  Suggested Problems
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recs.suggestedProblems.map((p, idx) => (
                  <div key={idx} className="p-3 rounded-lg border bg-card space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium hover:underline flex items-center gap-1.5"
                      >
                        {p.title}
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </a>
                      <Badge variant={p.difficulty}>{p.difficulty}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {p.tags.slice(0, 3).map((t) => (
                        <Badge key={t} variant="tag" className="px-1.5 py-0">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground pt-1 border-t border-border mt-2">
                      <span className="font-semibold text-foreground/80 border-r border-border pr-2 mr-2">
                        {p.category.toUpperCase()}
                      </span>
                      {p.reason}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Theory Recommendations */}
          {recs.suggestedTopics.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="w-4 h-4 text-purple-500" />
                  Suggested Topics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recs.suggestedTopics.map((t, idx) => (
                  <div key={idx} className="p-3 rounded-lg border bg-card space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-medium text-sm">{t.label}</span>
                      <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">
                        {t.domain}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                    <p className="text-xs text-muted-foreground pt-1 border-t border-border mt-2">
                      {t.reason} &mdash; Consider creating {t.suggestedCardCount} cards.
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Difficulty Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Card Difficulty Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {[
              { label: "Easy", count: profileSummary.difficultyDistribution.easy, color: "bg-emerald-500" },
              { label: "Medium", count: profileSummary.difficultyDistribution.medium, color: "bg-amber-500" },
              { label: "Hard", count: profileSummary.difficultyDistribution.hard, color: "bg-red-500" },
            ].map(({ label, count, color }) => {
              const total =
                profileSummary.difficultyDistribution.easy +
                profileSummary.difficultyDistribution.medium +
                profileSummary.difficultyDistribution.hard;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={label} className="flex-1 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
