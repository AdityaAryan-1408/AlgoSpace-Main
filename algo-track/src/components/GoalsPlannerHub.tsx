'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Loader2, 
  Target, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Sparkles, 
  AlertCircle, 
  Trophy,
  Pencil
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/Button";

interface GoalsPlannerHubProps {
  onNavigate?: (view: string) => void;
}

interface ChecklistItem {
  id: string;
  goal_id: string;
  title: string;
  status: "not_started" | "completed";
  deadline: string;
}

interface StructuredGoal {
  id: string;
  title: string;
  description: string;
  goal_type: string;
  status: string;
  startDate: string;
  endDate: string;
  targets: Array<{
    id: string;
    metricKey: string;
    targetValue: number;
    currentValue: number;
    unit: string;
  }>;
  pacing?: {
    elapsedDays: number;
    remainingDays: number;
    totalDays: number;
    targets: Array<{
      metricKey: string;
      targetValue: number;
      currentValue: number;
      remainingWork: number;
      initialPace: number;
      actualPace: number;
      adjustedPace: number;
      status: "on_track" | "slightly_behind" | "at_risk" | "critical";
    }>;
    nudges: string[];
  } | null;
  nudges?: Array<{
    id: string;
    category: string;
    priority: "info" | "warning" | "critical";
    message: string;
  }>;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const pw = localStorage.getItem("algotrack-password");
    if (pw) headers["x-app-password"] = pw;
  }
  return headers;
}

export function GoalsPlannerHub({ onNavigate }: GoalsPlannerHubProps) {
  // Calendar variables
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to start on Monday
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // State
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistGoalId, setChecklistGoalId] = useState<string | null>(null);
  const [weekChecklists, setWeekChecklists] = useState<Record<string, { items: ChecklistItem[] }>>({});
  const [activeGoals, setActiveGoals] = useState<StructuredGoal[]>([]);
  
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemTitle, setEditingItemTitle] = useState("");
  
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false);
  const [isLoadingGoals, setIsLoadingGoals] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [taskError, setTaskError] = useState<string | null>(null);

  // Format date helper
  const getLocalDateString = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const selectedDateStr = useMemo(() => getLocalDateString(selectedDate), [selectedDate, getLocalDateString]);

  // Compute 7 days of the visible week
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      days.push(date);
    }
    return days;
  }, [currentWeekStart]);

  // Navigate weeks
  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(next);
  };

  // Load checklist for selected date
  const loadDailyChecklist = useCallback(async () => {
    try {
      setIsLoadingChecklist(true);
      const res = await fetch(`/api/goals/daily?date=${selectedDateStr}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load daily checklist");
      const data = await res.json();
      setChecklistItems(data.items ?? []);
      setChecklistGoalId(data.goal?.id ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingChecklist(false);
    }
  }, [selectedDateStr]);

  // Load completion states (dots) for current week
  const loadWeekChecklists = useCallback(async () => {
    try {
      const startStr = getLocalDateString(weekDays[0]);
      const endStr = getLocalDateString(weekDays[6]);
      const res = await fetch(`/api/goals/daily?startDate=${startStr}&endDate=${endStr}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load week checklists");
      const data = await res.json();
      setWeekChecklists(data.checklists ?? {});
    } catch (err) {
      console.error(err);
    }
  }, [weekDays, getLocalDateString]);

  // Load active structured goals
  const loadActiveGoals = useCallback(async () => {
    try {
      setIsLoadingGoals(true);
      const [goalsRes, nudgesRes] = await Promise.all([
        fetch("/api/goals?status=active", { headers: getAuthHeaders() }),
        fetch("/api/coach/nudges", { headers: getAuthHeaders() })
      ]);

      if (!goalsRes.ok) throw new Error("Failed to load goals");
      const goalsData = await goalsRes.json();
      const nudgesData = nudgesRes.ok ? await nudgesRes.json() : { goals: [] };

      // Map structured goals and filter out custom checklists
      const enrichedGoals = (goalsData.goals as StructuredGoal[])
        .filter(g => g.goal_type !== "custom_checklist")
        .map((goal) => {
          const nudgeReport = (nudgesData.goals ?? []).find(
            (g: { goalId: string }) => g.goalId === goal.id,
          );
          return {
            ...goal,
            pacing: nudgeReport?.pacing ?? null,
            nudges: nudgeReport?.nudges ?? [],
          };
        });

      setActiveGoals(enrichedGoals);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingGoals(false);
    }
  }, []);

  // Initialize data
  useEffect(() => {
    loadDailyChecklist();
  }, [loadDailyChecklist]);

  useEffect(() => {
    loadWeekChecklists();
  }, [loadWeekChecklists]);

  useEffect(() => {
    loadActiveGoals();
  }, [loadActiveGoals]);

  // Add a task to checklist
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      setIsSubmittingTask(true);
      setTaskError(null);
      const res = await fetch("/api/goals/daily", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          date: selectedDateStr,
          title: newTaskTitle.trim()
        })
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to add task");
      }

      setNewTaskTitle("");
      await loadDailyChecklist();
      await loadWeekChecklists();
    } catch (err: any) {
      setTaskError(err.message || "Error adding task");
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // Toggle checklist item status
  const handleToggleTask = async (itemId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "completed" ? "not_started" : "completed";
      
      // Optimistic update
      setChecklistItems(prev =>
        prev.map(item => item.id === itemId ? { ...item, status: newStatus } : item)
      );

      const res = await fetch("/api/goals/daily", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          itemId,
          status: newStatus
        })
      });

      if (!res.ok) throw new Error("Failed to toggle task");
      
      await loadDailyChecklist();
      await loadWeekChecklists();
    } catch (err) {
      console.error(err);
      loadDailyChecklist(); // Revert on failure
    }
  };

  // Delete checklist item
  const handleDeleteTask = async (itemId: string) => {
    if (!checklistGoalId) return;
    try {
      const res = await fetch("/api/goals/daily", {
        method: "DELETE",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          itemId,
          goalId: checklistGoalId
        })
      });

      if (!res.ok) throw new Error("Failed to delete task");
      
      await loadDailyChecklist();
      await loadWeekChecklists();
    } catch (err) {
      console.error(err);
    }
  };

  // Edit checklist item title
  const handleSaveEdit = async (itemId: string) => {
    if (!editingItemTitle.trim()) return;
    try {
      // Optimistic update
      setChecklistItems(prev =>
        prev.map(item => item.id === itemId ? { ...item, title: editingItemTitle.trim() } : item)
      );
      setEditingItemId(null);

      const res = await fetch("/api/goals/daily", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          itemId,
          title: editingItemTitle.trim()
        })
      });

      if (!res.ok) throw new Error("Failed to edit task");
      
      await loadDailyChecklist();
      await loadWeekChecklists();
    } catch (err) {
      console.error(err);
      loadDailyChecklist(); // Revert on failure
    }
  };

  // Calculate stats for selected date's checklist
  const checklistStats = useMemo(() => {
    const total = checklistItems.length;
    const completed = checklistItems.filter(item => item.status === "completed").length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, progress };
  }, [checklistItems]);

  // Determine dot color under date in horizontal week bar
  const getDotStyle = (dateStr: string) => {
    const dayData = weekChecklists[dateStr];
    if (!dayData || !dayData.items || dayData.items.length === 0) return null;
    
    const items = dayData.items;
    const completed = items.filter(item => item.status === "completed").length;
    
    if (completed === items.length) {
      return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"; // Completed (Green)
    }
    if (completed > 0) {
      return "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"; // In Progress (Blue)
    }
    return "bg-neutral-500"; // Not Started (Gray)
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
      {/* ── Calendar & Daily Checklist (Left Side) ──────────────────── */}
      <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between lg:h-[480px] h-auto">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-500" />
              <h2 className="text-base font-bold text-foreground">Daily Planner</h2>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={handlePrevWeek}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-muted-foreground px-2">
                {weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <button 
                onClick={handleNextWeek}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 7-day horizontal strip */}
          <div className="grid grid-cols-7 gap-2 mb-6">
            {weekDays.map((day) => {
              const dayStr = getLocalDateString(day);
              const isSelected = selectedDateStr === dayStr;
              const isToday = getLocalDateString(new Date()) === dayStr;
              const dotStyle = getDotStyle(dayStr);

              return (
                <button
                  key={dayStr}
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center py-2.5 px-1.5 rounded-xl border transition-all cursor-pointer group relative ${
                    isSelected 
                      ? "bg-cyan-500/10 border-cyan-500 text-cyan-500 font-semibold" 
                      : isToday 
                        ? "border-primary/50 text-foreground bg-muted/40"
                        : "border-border/60 hover:border-border hover:bg-muted/35 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">
                    {day.toLocaleDateString("en-US", { weekday: "short" }).substring(0, 3)}
                  </span>
                  <span className="text-sm font-bold mt-1">
                    {day.getDate()}
                  </span>
                  
                  {/* Visual Completion Dot */}
                  {dotStyle ? (
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${dotStyle}`} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 bg-transparent" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Checklist progress bar */}
          {checklistStats.total > 0 && (
            <div className="mb-5 p-3.5 bg-muted/30 border border-border/40 rounded-xl">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Progress for {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <span className="font-bold text-foreground">
                  {checklistStats.completed} / {checklistStats.total} Tasks ({checklistStats.progress}%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div 
                  className="h-full rounded-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${checklistStats.progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          )}

          {/* Checklist items list */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-2 pr-1 min-h-[140px]">
            {isLoadingChecklist ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Loading checklist...</span>
              </div>
            ) : checklistItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/60 rounded-xl text-center px-4 bg-muted/10">
                <Clock className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs font-semibold text-foreground/80">No daily goals set</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[200px]">Create subtasks for this day (e.g., 5 dsa questions, system design review).</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {checklistItems.map((item) => {
                  const isChecked = item.status === "completed";
                  const isEditing = editingItemId === item.id;

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center justify-between p-3 rounded-xl border border-border bg-background/50 hover:border-cyan-500/30 transition-all group"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleTask(item.id, item.status)}
                          className="w-4 h-4 rounded border-border text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingItemTitle}
                            onChange={(e) => setEditingItemTitle(e.target.value)}
                            onBlur={() => handleSaveEdit(item.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(item.id);
                              else if (e.key === "Escape") setEditingItemId(null);
                            }}
                            autoFocus
                            className="flex-1 max-w-[260px] px-2 py-0.5 bg-background border border-cyan-500/60 rounded text-xs text-foreground focus:outline-none"
                          />
                        ) : (
                          <span className={`text-xs font-medium transition-all ${
                            isChecked 
                              ? "line-through text-muted-foreground opacity-60" 
                              : "text-foreground"
                          }`}>
                            {item.title}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isEditing && (
                          <button
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditingItemTitle(item.title);
                            }}
                            className="p-1 hover:bg-muted text-muted-foreground hover:text-cyan-500 rounded-lg transition-all cursor-pointer"
                            title="Edit task"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteTask(item.id)}
                          className="p-1 hover:bg-muted text-red-500 hover:text-red-600 rounded-lg transition-all cursor-pointer"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Add custom checklist item input */}
        <form onSubmit={handleAddTask} className="mt-auto pt-2">
          {taskError && (
            <p className="text-[10px] text-red-500 mb-1.5 font-medium">{taskError}</p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={`+ Add daily goal for ${selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}...`}
              disabled={isSubmittingTask}
              className="flex-1 px-3.5 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 placeholder-muted-foreground/60"
            />
            <Button
              type="submit"
              disabled={isSubmittingTask || !newTaskTitle.trim()}
              className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl px-3 py-2 shrink-0"
            >
              {isSubmittingTask ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* ── Active Structured Goal Panel (Right Side) ──────────────────── */}
      <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between lg:h-[480px] h-auto">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-cyan-500" />
              <h2 className="text-base font-bold text-foreground">Active Structured Goal</h2>
            </div>
          </div>

          {isLoadingGoals ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2 flex-1">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading active goals...</span>
            </div>
          ) : activeGoals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border/60 rounded-xl text-center px-4 bg-muted/10 flex-1 min-h-[220px]">
              <Target className="w-10 h-10 text-muted-foreground/35 mb-2" />
              <p className="text-xs font-semibold text-foreground/80">No active structured goals</p>
              <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px] mb-4">Track metrics like problems solved or retention rates over multiple days.</p>
              <Button
                size="sm"
                onClick={() => onNavigate?.("goals")}
                className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs px-4"
              >
                Create Structured Goal
              </Button>
            </div>
          ) : (
            <div className="flex-grow overflow-y-auto space-y-4 pr-1 min-h-0">
              {activeGoals.slice(0, 1).map((goal) => {
                const daysLeft = Math.max(
                  0,
                  Math.ceil((new Date(goal.endDate).getTime() - Date.now()) / 86_400_000)
                );
                
                return (
                  <div key={goal.id} className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        {goal.title}
                        <span className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 text-[9px] font-bold rounded uppercase">
                          Active
                        </span>
                      </h3>
                      {goal.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {goal.description}
                        </p>
                      )}
                    </div>

                    {/* Targets progress */}
                    {goal.targets && goal.targets.map((target) => {
                      const pct = target.targetValue > 0 
                        ? Math.min(100, Math.round((target.currentValue / target.targetValue) * 100))
                        : 0;

                      const pacingTarget = goal.pacing?.targets.find(
                        (pt) => pt.metricKey === target.metricKey
                      );

                      let paceColor = "bg-cyan-500";
                      if (pacingTarget) {
                        if (pacingTarget.status === "on_track") paceColor = "bg-emerald-500";
                        else if (pacingTarget.status === "slightly_behind") paceColor = "bg-amber-500";
                        else paceColor = "bg-red-500";
                      }

                      return (
                        <div key={target.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                              {target.metricKey.replace(/_/g, " ")}
                            </span>
                            <span className="font-bold text-foreground">
                              {target.currentValue} / {target.targetValue} {target.unit} ({pct}%)
                            </span>
                          </div>
                          
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div 
                              className={`h-full rounded-full ${paceColor}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>

                          {pacingTarget && (
                            <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5">
                              <span>Pace: {pacingTarget.actualPace}/{pacingTarget.initialPace} daily</span>
                              <span className="font-semibold capitalize">
                                Status: <span className={
                                  pacingTarget.status === "on_track" 
                                    ? "text-emerald-500" 
                                    : pacingTarget.status === "slightly_behind"
                                      ? "text-amber-500"
                                      : "text-red-500"
                                }>{pacingTarget.status.replace(/_/g, " ")}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Timeline */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground p-2.5 bg-muted/30 border border-border/40 rounded-xl">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                        {new Date(goal.startDate).toLocaleDateString()} - {new Date(goal.endDate).toLocaleDateString()}
                      </span>
                      <span className="font-bold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-cyan-500" />
                        {daysLeft} days remaining
                      </span>
                    </div>

                    {/* Coach Nudges */}
                    {goal.nudges && goal.nudges.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-cyan-500" />
                          AI Coach Pacing Deficits
                        </h4>
                        {goal.nudges.slice(0, 2).map((nudge) => (
                          <div
                            key={nudge.id}
                            className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs leading-normal ${
                              nudge.priority === "critical"
                                ? "text-red-500 bg-red-500/5 border-red-500/20"
                                : nudge.priority === "warning"
                                  ? "text-amber-500 bg-amber-500/5 border-amber-500/20"
                                  : "text-cyan-500 bg-cyan-500/5 border-cyan-500/20"
                            }`}
                          >
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{nudge.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* View all structured goals shortcut */}
        {!isLoadingGoals && activeGoals.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate?.("goals")}
              className="text-xs gap-1 hover:text-cyan-500 text-muted-foreground cursor-pointer"
            >
              Manage all goals <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
