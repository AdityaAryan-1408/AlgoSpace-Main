'use client';

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Target,
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  TrendingUp,
  Pause,
  CheckCircle2,
  Trash2,
  Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Goal } from "@/types";
import type { SmartNudge } from "@/lib/nudge-engine";
import { CreateGoalModal } from "@/components/CreateGoalModal";

// ── Types ───────────────────────────────────────────────────────

interface GoalPacingTarget {
  metricKey: string;
  targetValue: number;
  currentValue: number;
  remainingWork: number;
  initialPace: number;
  actualPace: number;
  adjustedPace: number;
  status: "on_track" | "slightly_behind" | "at_risk" | "critical";
}

interface GoalWithNudges extends Goal {
  pacing?: {
    elapsedDays: number;
    remainingDays: number;
    totalDays: number;
    targets: GoalPacingTarget[];
    nudges: string[];
  } | null;
  nudges?: SmartNudge[];
}

function getStatusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    case "paused":
      return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    case "completed":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "abandoned":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getPaceStatusColor(status: string) {
  switch (status) {
    case "on_track":
      return "bg-emerald-500";
    case "slightly_behind":
      return "bg-amber-500";
    case "at_risk":
      return "bg-orange-500";
    case "critical":
      return "bg-red-500";
    default:
      return "bg-muted-foreground";
  }
}

// ── Goal Card ───────────────────────────────────────────────────

function GoalCard({
  goal,
  onStatusChange,
  onDelete,
}: {
  goal: GoalWithNudges;
  onStatusChange: (goalId: string, newStatus: string) => void;
  onDelete: (goalId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(goal.endDate).getTime() - Date.now()) / 86_400_000,
    ),
  );

  const totalDays = Math.max(
    1,
    Math.ceil(
      (new Date(goal.endDate).getTime() - new Date(goal.startDate).getTime()) /
        86_400_000,
    ),
  );
  const elapsed = totalDays - daysLeft;
  const timeProgress = Math.min(100, Math.round((elapsed / totalDays) * 100));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{goal.title}</CardTitle>
                <Badge className={`text-[10px] ${getStatusColor(goal.status)}`}>
                  {goal.status}
                </Badge>
              </div>
              {goal.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {goal.description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(!expanded)}
              className="flex-shrink-0"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Time progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(goal.startDate).toLocaleDateString()} -{" "}
                {new Date(goal.endDate).toLocaleDateString()}
              </span>
              <span className="font-medium">
                {daysLeft}d left
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500/50 transition-all duration-500"
                style={{ width: `${timeProgress}%` }}
              />
            </div>
          </div>

          {/* Target progress */}
          {goal.targets && goal.targets.length > 0 && (
            <div className="space-y-3">
              {goal.targets.map((target) => {
                const pct =
                  target.targetValue > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (target.currentValue / target.targetValue) * 100,
                        ),
                      )
                    : 0;

                // Find pacing info if available
                const pacingTarget = goal.pacing?.targets.find(
                  (pt) => pt.metricKey === target.metricKey,
                );

                return (
                  <div key={target.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {target.metricKey.replace(/_/g, " ")}
                      </span>
                      <span className="font-medium">
                        {target.currentValue} / {target.targetValue}{" "}
                        {target.unit} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          pacingTarget
                            ? getPaceStatusColor(pacingTarget.status)
                            : "bg-blue-500"
                        }`}
                        initial={{ width: "0%" }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                    {pacingTarget && (
                      <p className="text-[11px] text-muted-foreground">
                        Pace:{" "}
                        {pacingTarget.actualPace}/{pacingTarget.initialPace}{" "}
                        {target.unit}/day &middot; Adjusted:{" "}
                        {pacingTarget.adjustedPace}/day
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Expanded: topic items, nudges, actions */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4 overflow-hidden"
              >
                {/* Topic items */}
                {goal.topicItems && goal.topicItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Topics
                    </p>
                    {goal.topicItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                      >
                        <span className="text-sm">{item.title}</span>
                        <Badge
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {item.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Nudges */}
                {goal.nudges && goal.nudges.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Nudges
                    </p>
                    {goal.nudges.map((nudge) => (
                      <div
                        key={nudge.id}
                        className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${
                          nudge.priority === "critical"
                            ? "text-red-500 bg-red-500/5 border-red-500/20"
                            : nudge.priority === "warning"
                              ? "text-amber-500 bg-amber-500/5 border-amber-500/20"
                              : "text-blue-500 bg-blue-500/5 border-blue-500/20"
                        }`}
                      >
                        <TrendingUp className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span>{nudge.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  {goal.status === "active" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onStatusChange(goal.id, "paused")}
                      className="gap-1.5 text-xs"
                    >
                      <Pause className="w-3 h-3" />
                      Pause
                    </Button>
                  )}
                  {goal.status === "paused" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onStatusChange(goal.id, "active")}
                      className="gap-1.5 text-xs"
                    >
                      <Play className="w-3 h-3" />
                      Resume
                    </Button>
                  )}
                  {goal.status === "active" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onStatusChange(goal.id, "completed")}
                      className="gap-1.5 text-xs text-emerald-500"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Complete
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(goal.id)}
                    className="gap-1.5 text-xs text-red-500 ml-auto"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Main Component ──────────────────────────────────────────────

export function GoalsScreen() {
  const [goals, setGoals] = useState<GoalWithNudges[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("active");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadGoals = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch goals and nudges in parallel
      const [goalsRes, nudgesRes] = await Promise.all([
        fetch(`/api/goals${filter ? `?status=${filter}` : ""}`),
        fetch("/api/coach/nudges"),
      ]);

      if (!goalsRes.ok) throw new Error("Failed to load goals");

      const goalsData = await goalsRes.json();
      const nudgesData = nudgesRes.ok ? await nudgesRes.json() : { goals: [] };

      // Merge nudges into goals
      const enrichedGoals = (goalsData.goals as Goal[]).map((goal) => {
        const nudgeReport = (nudgesData.goals ?? []).find(
          (g: { goalId: string }) => g.goalId === goal.id,
        );
        return {
          ...goal,
          pacing: nudgeReport?.pacing ?? null,
          nudges: nudgeReport?.nudges ?? [],
        } as GoalWithNudges;
      });

      setGoals(enrichedGoals);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleStatusChange = async (goalId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update goal");
      await loadGoals();
    } catch (err) {
      console.error("Failed to update goal status:", err);
    }
  };

  const handleDelete = async (goalId: string) => {
    if (!confirm("Are you sure you want to delete this goal?")) return;
    try {
      const res = await fetch(`/api/goals/${goalId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete goal");
      await loadGoals();
    } catch (err) {
      console.error("Failed to delete goal:", err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Track your DSA and CS theory progress.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Goal</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {["active", "paused", "completed", ""].map((f) => (
          <Button
            key={f || "all"}
            variant={filter === f ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter(f)}
            className="text-xs capitalize"
          >
            {f || "All"}
          </Button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">{error}</p>
        </div>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <Target className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {filter
                ? `No ${filter} goals found.`
                : "No goals yet. Create one to start tracking your progress!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {showCreateModal && (
        <CreateGoalModal 
          onClose={() => setShowCreateModal(false)}
          onCreated={async () => {
            setShowCreateModal(false);
            await loadGoals();
          }}
        />
      )}
    </div>
  );
}
