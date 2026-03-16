import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Target, Plus, Trash2, Calendar } from "lucide-react";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate || !endDate) {
      setError("Title, Start Date, and End Date are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Simple implementation focusing solely on volume for demonstration
      const targets = [
        {
          metricKey: "problems_solved",
          targetValue: 30, // Default to a static 30 problems goal
          unit: "problems",
        }
      ];

      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          goalType: "dsa_volume",
          status: "active",
          startDate,
          endDate,
          targets,
          topicItems: [], // Skip topic items for now
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
            <Target className="w-5 h-5 text-blue-500" />
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
                placeholder="e.g. Master Array Manipulation"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Start Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">End Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
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
            className="bg-blue-500 hover:bg-blue-600 text-white min-w-[100px]" 
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Save Goal"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
