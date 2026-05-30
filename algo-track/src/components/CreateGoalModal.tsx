import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Target, Plus, Trash2, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateGoalModal({ onClose, onCreated }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  
  // Custom metrics and targets
  const [metricKey, setMetricKey] = useState("problems_solved");
  const [targetValue, setTargetValue] = useState("10");

  // Structured checklist items
  const [checklistItems, setChecklistItems] = useState<Array<{
    title: string;
    total: number;
    unit: string;
  }>>([]);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemTotal, setNewItemTotal] = useState("10");
  const [newItemUnit, setNewItemUnit] = useState("videos");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate || !endDate) {
      setError("Title, Start Date, and End Date are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      let goalType = "dsa_volume";
      let targets: any[] = [];
      let topicItems: any[] = [];

      if (metricKey === "checklist_completion") {
        if (checklistItems.length === 0) {
          setError("Please add at least one checklist item.");
          setIsSubmitting(false);
          return;
        }

        const durationDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000;
        if (durationDays < 6) {
          setError("Structured checklists must have a duration of at least 1 week.");
          setIsSubmitting(false);
          return;
        }

        goalType = "structured_checklist";
        const sumOfTotals = checklistItems.reduce((sum, item) => sum + item.total, 0);
        targets = [
          {
            metricKey: "checklist_completion",
            targetValue: sumOfTotals,
            unit: "items",
          }
        ];
        topicItems = checklistItems.map((item, idx) => ({
          topicDomain: "custom",
          topicId: `item-${Date.now()}-${idx}`,
          title: item.title,
          deadline: endDate,
          notes: JSON.stringify({
            total: item.total,
            remaining: item.total,
            unit: item.unit
          })
        }));
      } else {
        const numericTarget = Number(targetValue);
        if (isNaN(numericTarget) || numericTarget <= 0) {
          setError("Target value must be a positive number.");
          setIsSubmitting(false);
          return;
        }

        let unit = "problems";
        goalType = "dsa_volume";

        if (metricKey === "retained_pct") {
          unit = "percent";
          goalType = "dsa_retention";
          if (numericTarget > 100) {
            setError("Retention percentage cannot exceed 100%.");
            setIsSubmitting(false);
            return;
          }
        } else if (metricKey === "topics_completed") {
          unit = "topics";
          goalType = "cs_topic_completion";
        }

        targets = [
          {
            metricKey,
            targetValue: numericTarget,
            unit,
          }
        ];
      }

      const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (typeof window !== "undefined") {
        const pw = localStorage.getItem("algotrack-password");
        if (pw) authHeaders["x-app-password"] = pw;
      }

      const res = await fetch("/api/goals", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          goalType,
          status: "active",
          startDate,
          endDate,
          targets,
          topicItems,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create goal.");
      }

      onCreated();
    } catch (err: any) {
      setError(err.message || "Unknown error creating goal");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl relative z-10 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-cyan-500" />
            Create New Goal
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[70vh]">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form id="create-goal-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Master Binary Trees"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                required
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details about what you want to achieve"
                rows={2}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-sm"
              />
            </div>

            {/* Metric Type Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Goal Metric <span className="text-red-500">*</span></label>
                <select
                  value={metricKey}
                  onChange={(e) => {
                    setMetricKey(e.target.value);
                    if (e.target.value === "retained_pct") {
                      setTargetValue("80");
                    } else if (e.target.value === "topics_completed") {
                      setTargetValue("5");
                    } else if (e.target.value === "checklist_completion") {
                      setTargetValue("1"); // Dummy
                    } else {
                      setTargetValue("10");
                    }
                  }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-sm cursor-pointer"
                >
                  <option value="problems_solved">Problems Solved</option>
                  <option value="retained_pct">Retention Percentage</option>
                  <option value="topics_completed">Topics Mastered</option>
                  <option value="checklist_completion">Task Checklist</option>
                </select>
              </div>

              {metricKey !== "checklist_completion" && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    Target Value ({metricKey === "retained_pct" ? "%" : metricKey === "topics_completed" ? "topics" : "problems"}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={metricKey === "retained_pct" ? 100 : 500}
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                    required
                  />
                </div>
              )}
            </div>

            {/* Checklist items dynamic form */}
            {metricKey === "checklist_completion" && (
              <div className="space-y-3 p-3.5 bg-muted/30 border border-border rounded-xl">
                <p className="text-xs font-bold text-foreground">Add Checklist Items</p>
                
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="e.g. Watch videos of OS"
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={1}
                      placeholder="Count (e.g. 10)"
                      value={newItemTotal}
                      onChange={(e) => setNewItemTotal(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Unit (e.g. videos)"
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      if (!newItemTitle.trim()) return;
                      const total = parseInt(newItemTotal, 10);
                      if (isNaN(total) || total <= 0) return;
                      setChecklistItems(prev => [...prev, {
                        title: newItemTitle.trim(),
                        total,
                        unit: newItemUnit.trim() || "items"
                      }]);
                      setNewItemTitle("");
                      setNewItemTotal("10");
                      setNewItemUnit("videos");
                    }}
                    className="w-full bg-cyan-600/15 hover:bg-cyan-600/25 text-cyan-500 rounded-lg text-xs py-2 flex items-center justify-center gap-1 cursor-pointer font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Checklist Item
                  </Button>
                </div>

                {checklistItems.length > 0 && (
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto mt-2">
                    {checklistItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-background border border-border rounded-lg text-xs">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{item.title}</span>
                          <span className="text-[10px] text-muted-foreground">{item.total} {item.unit}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setChecklistItems(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-600 p-1 rounded hover:bg-muted cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Start Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">End Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  required
                />
              </div>
            </div>

            {/* Explanatory subtext */}
            <div className="p-3 bg-muted/40 border border-border rounded-lg flex gap-2 items-start text-xs text-muted-foreground">
              <Sparkles className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
              <span>
                {metricKey === "problems_solved" && `Solve ${targetValue} flashcard problems within the specified timeframe to build strong algorithmic memory.`}
                {metricKey === "retained_pct" && `Maintain an average of ${targetValue}% positive ratings (GOOD or EASY) on reviews to ensure optimal spaced repetition.`}
                {metricKey === "topics_completed" && `Successfully complete and mark ${targetValue} core computer science topics as finished.`}
                {metricKey === "checklist_completion" && `Create a personalized, multi-week prep checklist with custom goals and track exact remaining counts dynamically.`}
              </span>
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2 bg-muted/30">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            form="create-goal-form" 
            className="bg-cyan-600 hover:bg-cyan-700 text-white min-w-[100px] text-sm" 
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Goal"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
