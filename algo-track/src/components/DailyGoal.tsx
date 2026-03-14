'use client';

import { useState, useEffect } from "react";
import { Target, Settings2, Check } from "lucide-react";
import { motion } from "motion/react";

const GOAL_KEY = "algotrack-daily-goal";
const GOAL_DEFAULT = 5;

interface Props {
    reviewedToday: number;
}

export function DailyGoal({ reviewedToday }: Props) {
    const [goal, setGoal] = useState(GOAL_DEFAULT);
    const [editing, setEditing] = useState(false);
    const [inputVal, setInputVal] = useState("");

    useEffect(() => {
        const saved = localStorage.getItem(GOAL_KEY);
        if (saved) setGoal(Number(saved) || GOAL_DEFAULT);
    }, []);

    const progress = Math.min(100, Math.round((reviewedToday / goal) * 100));
    const isComplete = reviewedToday >= goal;

    const handleSave = () => {
        const val = Math.max(1, Math.min(50, Number(inputVal) || GOAL_DEFAULT));
        setGoal(val);
        localStorage.setItem(GOAL_KEY, String(val));
        setEditing(false);
    };

    return (
        <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Target className={`w-4 h-4 ${isComplete ? "text-emerald-500" : "text-blue-500"}`} />
                    <h3 className="text-sm font-semibold text-foreground">Daily Goal</h3>
                </div>

                {editing ? (
                    <div className="flex items-center gap-1.5">
                        <input
                            type="number"
                            min={1}
                            max={50}
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSave()}
                            className="w-14 text-center text-sm border border-border rounded-lg bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                        />
                        <button onClick={handleSave} className="text-emerald-500 hover:text-emerald-600">
                            <Check className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => { setInputVal(String(goal)); setEditing(true); }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit daily goal"
                    >
                        <Settings2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Progress bar */}
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden mb-2">
                <motion.div
                    className={`h-full rounded-full ${isComplete ? "bg-emerald-500" : "bg-blue-500"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                />
            </div>

            <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                    <span className={`font-bold ${isComplete ? "text-emerald-500" : "text-foreground"}`}>
                        {reviewedToday}
                    </span>
                    {" / "}{goal} reviews
                </span>
                {isComplete ? (
                    <span className="text-emerald-500 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Goal reached! 🎉
                    </span>
                ) : (
                    <span className="text-muted-foreground">
                        {goal - reviewedToday} more to go
                    </span>
                )}
            </div>
        </div>
    );
}
