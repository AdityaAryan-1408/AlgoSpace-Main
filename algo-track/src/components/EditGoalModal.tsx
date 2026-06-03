'use client';

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Target, Plus, Trash2, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  goal: any;
  onClose: () => void;
  onUpdated: () => void;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const pw = localStorage.getItem("algotrack-password");
    if (pw) headers["x-app-password"] = pw;
  }
  return headers;
}

export function EditGoalModal({ goal, onClose, onUpdated }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description || "");
  const [startDate, setStartDate] = useState(
    new Date(goal.startDate || goal.start_date).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(goal.endDate || goal.end_date).toISOString().split("T")[0]
  );

  // Structured checklist items
  const [checklistItems, setChecklistItems] = useState<Array<{
    id?: string;
    title: string;
    total: number;
    remaining: number;
    unit: string;
  }>>(() => {
    return (goal.topicItems || []).map((item: any) => {
      let total = 1;
      let remaining = 0;
      let unit = "items";
      try {
        const parsed = JSON.parse(item.notes || "{}");
        total = parsed.total ?? 1;
        remaining = parsed.remaining ?? 0;
        unit = parsed.unit ?? "items";
      } catch (e) {}
      return {
        id: item.id,
        title: item.title,
        total,
        remaining,
        unit
      };
    });
  });

  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemTotal, setNewItemTotal] = useState("10");
  const [newItemUnit, setNewItemUnit] = useState("videos");

  const handleAddItem = () => {
    if (!newItemTitle.trim()) return;
    const total = Number(newItemTotal);
    if (isNaN(total) || total <= 0) {
      setError("Item target must be a positive number.");
      return;
    }

    setChecklistItems([
      ...checklistItems,
      {
        title: newItemTitle.trim(),
        total,
        remaining: total,
        unit: newItemUnit.trim() || "items",
      },
    ]);
    setNewItemTitle("");
    setNewItemTotal("10");
    setNewItemUnit("videos");
    setError(null);
  };

  const handleRemoveItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, idx) => idx !== index));
  };

  const handleItemCountChange = (index: number, field: "total" | "remaining", val: string) => {
    const num = Number(val);
    if (isNaN(num)) return;
    
    setChecklistItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      const updated = { ...item, [field]: num };
      if (field === "total") {
        // Enforce remaining is never larger than total
        updated.remaining = Math.min(updated.remaining, num);
      } else {
        // Enforce remaining is never larger than total
        updated.remaining = Math.min(num, updated.total);
      }
      return updated;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate || !endDate) {
      setError("Title, Start Date, and End Date are required.");
      return;
    }

    if (checklistItems.length === 0) {
      setError("Please add at least one task to the checklist.");
      return;
    }

    const durationDays = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000;
    if (durationDays < 6) {
      setError("Structured checklists must have a duration of at least 1 week.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title,
          description,
          startDate,
          endDate,
          topicItems: checklistItems
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update structured checklist goal.");
      }

      onUpdated();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-card/90 border border-border/80 rounded-2xl shadow-xl overflow-hidden glassmorphism"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-cyan-500 animate-pulse" />
            <h3 className="text-base font-bold text-foreground">Edit Structured Checklist Goal</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl">
              {error}
            </div>
          )}

          {/* Goal Title */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Goal Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Master Operating Systems & SD"
              className="w-full px-3.5 py-2.5 bg-card/45 border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/25 text-foreground placeholder:text-muted-foreground/50"
              required
            />
          </div>

          {/* Goal Description */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a description of your checklist milestone..."
              rows={2}
              className="w-full px-3.5 py-2.5 bg-card/45 border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/25 text-foreground placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Start and End Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-card/45 border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/25 text-foreground"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-card/45 border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/25 text-foreground"
                required
              />
            </div>
          </div>

          {/* Task Checklist Manager */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Manage Tasks & Targets
            </label>

            {/* Checklist Items list */}
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {checklistItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border/40 gap-2 text-xs"
                >
                  <span className="font-semibold text-foreground truncate max-w-[160px]">
                    {item.title}
                  </span>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Left:</span>
                      <input
                        type="number"
                        value={item.remaining}
                        onChange={(e) => handleItemCountChange(idx, "remaining", e.target.value)}
                        className="w-12 h-7 text-center bg-background/50 border border-border/60 rounded-lg text-xs font-bold text-foreground focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all no-spinner"
                        min="0"
                        max={item.total}
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Goal:</span>
                      <input
                        type="number"
                        value={item.total}
                        onChange={(e) => handleItemCountChange(idx, "total", e.target.value)}
                        className="w-12 h-7 text-center bg-background/50 border border-border/60 rounded-lg text-xs font-bold text-foreground focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all no-spinner"
                        min="1"
                      />
                    </div>
                    
                    <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[50px]">
                      {item.unit}
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(idx)}
                      className="w-6 h-6 text-red-500 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add new task controls */}
            <div className="flex flex-col gap-2 p-3 bg-muted/10 border border-dashed border-border/60 rounded-xl">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add task title, e.g. Watch videos"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-background/50 border border-border/60 rounded-lg text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                />
              </div>
              <div className="flex gap-2 items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Target:</span>
                  <input
                    type="number"
                    value={newItemTotal}
                    onChange={(e) => setNewItemTotal(e.target.value)}
                    className="w-12 h-7 text-center bg-background/50 border border-border/60 rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all no-spinner"
                    min="1"
                  />
                  <input
                    type="text"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    placeholder="unit"
                    className="w-16 h-7 text-center bg-background/50 border border-border/60 rounded-lg text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="px-3 text-xs gap-1 border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/10 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Task
                </Button>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-border/60">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting} className="rounded-xl">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
        <style>{`
          .no-spinner::-webkit-outer-spin-button,
          .no-spinner::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          .no-spinner {
            -moz-appearance: textfield;
          }
        `}</style>
      </motion.div>
    </div>,
    document.body
  );
}
