'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import Editor from "@monaco-editor/react";
import { Timer, Keyboard, RotateCcw, Trophy, Zap, ArrowRight, Delete } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SpeedrunProps {
    onExit: () => void;
}

interface Challenge {
    name: string;
    description: string;
    template: string;
    language: string;
    timeLimit: number; // seconds
}

const CHALLENGES: Challenge[] = [
    {
        name: "Binary Search",
        description: "Implement standard binary search that returns the index of target, or -1.",
        template: `def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1`,
        language: "python",
        timeLimit: 45,
    },
    {
        name: "BFS (Graph)",
        description: "Implement BFS traversal on an adjacency list graph from a start node.",
        template: `from collections import deque\n\ndef bfs(graph, start):\n    visited = set([start])\n    queue = deque([start])\n    result = []\n    while queue:\n        node = queue.popleft()\n        result.append(node)\n        for neighbor in graph[node]:\n            if neighbor not in visited:\n                visited.add(neighbor)\n                queue.append(neighbor)\n    return result`,
        language: "python",
        timeLimit: 60,
    },
    {
        name: "Merge Sort",
        description: "Implement merge sort returning a new sorted array.",
        template: `def merge_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    mid = len(arr) // 2\n    left = merge_sort(arr[:mid])\n    right = merge_sort(arr[mid:])\n    return merge(left, right)\n\ndef merge(left, right):\n    result = []\n    i = j = 0\n    while i < len(left) and j < len(right):\n        if left[i] <= right[j]:\n            result.append(left[i])\n            i += 1\n        else:\n            result.append(right[j])\n            j += 1\n    result.extend(left[i:])\n    result.extend(right[j:])\n    return result`,
        language: "python",
        timeLimit: 90,
    },
    {
        name: "DFS (Graph)",
        description: "Implement iterative DFS traversal on an adjacency list graph.",
        template: `def dfs(graph, start):\n    visited = set()\n    stack = [start]\n    result = []\n    while stack:\n        node = stack.pop()\n        if node in visited:\n            continue\n        visited.add(node)\n        result.append(node)\n        for neighbor in reversed(graph[node]):\n            if neighbor not in visited:\n                stack.append(neighbor)\n    return result`,
        language: "python",
        timeLimit: 50,
    },
    {
        name: "Trie Insert & Search",
        description: "Implement a Trie with insert and search methods.",
        template: `class TrieNode:\n    def __init__(self):\n        self.children = {}\n        self.is_end = False\n\nclass Trie:\n    def __init__(self):\n        self.root = TrieNode()\n\n    def insert(self, word):\n        node = self.root\n        for char in word:\n            if char not in node.children:\n                node.children[char] = TrieNode()\n            node = node.children[char]\n        node.is_end = True\n\n    def search(self, word):\n        node = self.root\n        for char in word:\n            if char not in node.children:\n                return False\n            node = node.children[char]\n        return node.is_end`,
        language: "python",
        timeLimit: 75,
    },
    {
        name: "Two Pointer (Two Sum Sorted)",
        description: "Find two numbers in a sorted array that add up to target. Return their 1-indexed positions.",
        template: `def two_sum(numbers, target):\n    left, right = 0, len(numbers) - 1\n    while left < right:\n        total = numbers[left] + numbers[right]\n        if total == target:\n            return [left + 1, right + 1]\n        elif total < target:\n            left += 1\n        else:\n            right -= 1\n    return []`,
        language: "python",
        timeLimit: 40,
    },
];

interface SpeedrunResult {
    challenge: string;
    wpm: number;
    backspaces: number;
    accuracy: number;
    timeUsed: number;
    timeLimit: number;
    completed: boolean;
}

export function Speedrun({ onExit }: SpeedrunProps) {
    const [phase, setPhase] = useState<"select" | "countdown" | "typing" | "result" | "summary">("select");
    const [selected, setSelected] = useState<Challenge | null>(null);
    const [code, setCode] = useState("");
    const [timeLeft, setTimeLeft] = useState(0);
    const [countdownNum, setCountdownNum] = useState(3);
    const [backspaceCount, setBackspaceCount] = useState(0);
    const [keystrokeCount, setKeystrokeCount] = useState(0);
    const [results, setResults] = useState<SpeedrunResult[]>([]);
    const startTime = useRef(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const handleSelect = (ch: Challenge) => {
        setSelected(ch);
        setCode("");
        setBackspaceCount(0);
        setKeystrokeCount(0);
        setCountdownNum(3);
        setPhase("countdown");
    };

    // Countdown
    useEffect(() => {
        if (phase !== "countdown") return;
        if (countdownNum <= 0) {
            setPhase("typing");
            setTimeLeft(selected!.timeLimit);
            startTime.current = Date.now();
            return;
        }
        const t = setTimeout(() => setCountdownNum(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [phase, countdownNum, selected]);

    // Timer
    useEffect(() => {
        if (phase !== "typing") return;
        timerRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime.current) / 1000);
            const remaining = selected!.timeLimit - elapsed;
            if (remaining <= 0) {
                clearInterval(timerRef.current!);
                finishRun(false);
            } else {
                setTimeLeft(remaining);
            }
        }, 200);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [phase]);

    const finishRun = useCallback((completed: boolean) => {
        if (timerRef.current) clearInterval(timerRef.current);
        const elapsed = (Date.now() - startTime.current) / 1000;
        const words = code.trim().split(/\s+/).length;
        const wpm = elapsed > 0 ? Math.round((words / elapsed) * 60) : 0;

        // Compute accuracy (simple character matching)
        const target = selected!.template;
        let matches = 0;
        const minLen = Math.min(code.length, target.length);
        for (let i = 0; i < minLen; i++) {
            if (code[i] === target[i]) matches++;
        }
        const accuracy = target.length > 0 ? Math.round((matches / target.length) * 100) : 0;

        const result: SpeedrunResult = {
            challenge: selected!.name,
            wpm,
            backspaces: backspaceCount,
            accuracy,
            timeUsed: Math.round(elapsed),
            timeLimit: selected!.timeLimit,
            completed,
        };
        setResults(prev => [...prev, result]);
        setPhase("result");
    }, [code, selected, backspaceCount]);

    // Check if code matches template
    useEffect(() => {
        if (phase !== "typing" || !selected) return;
        const normalized = code.replace(/\r\n/g, "\n").trimEnd();
        const target = selected.template.replace(/\r\n/g, "\n").trimEnd();
        if (normalized === target) {
            finishRun(true);
        }
    }, [code, phase, selected, finishRun]);

    const lastResult = results[results.length - 1];

    if (phase === "select") {
        return (
            <div className="w-full max-w-3xl mx-auto p-4 md:p-8 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
                            <Keyboard className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground">Speedruns</h2>
                            <p className="text-[10px] text-muted-foreground">Type boilerplate algorithms from memory</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onExit}>Exit</Button>
                </div>

                {results.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
                        <span className="text-xs text-amber-500 font-medium">{results.length} run(s) completed this session</span>
                        <Button variant="ghost" size="sm" onClick={() => setPhase("summary")} className="text-xs text-amber-500">
                            View Summary
                        </Button>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CHALLENGES.map(ch => (
                        <button
                            key={ch.name}
                            onClick={() => handleSelect(ch)}
                            className="text-left p-4 rounded-xl border border-border hover:border-amber-500/40 bg-card hover:bg-amber-500/5 transition-all cursor-pointer group"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-sm text-foreground group-hover:text-amber-500 transition-colors">{ch.name}</span>
                                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{ch.timeLimit}s</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{ch.description}</p>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (phase === "countdown") {
        return (
            <div className="flex-1 flex items-center justify-center">
                <motion.div
                    key={countdownNum}
                    initial={{ scale: 2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="text-8xl font-black text-amber-500"
                >
                    {countdownNum > 0 ? countdownNum : "GO!"}
                </motion.div>
            </div>
        );
    }

    if (phase === "typing") {
        return (
            <div className="flex-1 flex flex-col">
                {/* Top bar */}
                <div className="h-12 border-b border-border bg-muted/30 flex items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-foreground">{selected!.name}</span>
                        <span className="text-[10px] text-muted-foreground">Keystrokes: {keystrokeCount} | Backspaces: {backspaceCount}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-mono font-bold text-lg ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-amber-500"}`}>
                        <Timer className="w-4 h-4" />
                        {timeLeft}s
                    </div>
                </div>

                {/* Reference (blurred after 5s) */}
                <div className="px-6 py-2 border-b border-border bg-muted/10">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">Reference (type this from memory)</p>
                    <pre className="text-xs font-mono text-foreground/40 whitespace-pre-wrap max-h-24 overflow-hidden">{selected!.template}</pre>
                </div>

                {/* Editor */}
                <div className="flex-1">
                    <Editor
                        height="100%"
                        language={selected!.language}
                        value={code}
                        onChange={(val) => {
                            setCode(val || "");
                            setKeystrokeCount(c => c + 1);
                        }}
                        theme="vs-dark"
                        options={{
                            fontSize: 14,
                            minimap: { enabled: false },
                            lineNumbers: "on",
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            tabSize: 4,
                            wordWrap: "on",
                            padding: { top: 12 },
                        }}
                        onMount={(editor) => {
                            editor.onKeyDown((e) => {
                                if (e.code === "Backspace") {
                                    setBackspaceCount(c => c + 1);
                                }
                            });
                            editor.focus();
                        }}
                    />
                </div>
            </div>
        );
    }

    if (phase === "result" && lastResult) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md space-y-6 text-center">
                    <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${lastResult.completed ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                        {lastResult.completed ? <Trophy className="w-8 h-8" /> : <Timer className="w-8 h-8" />}
                    </div>
                    <h3 className="text-xl font-bold">{lastResult.completed ? "Completed!" : "Time's Up!"}</h3>

                    <div className="grid grid-cols-2 gap-3 text-left">
                        {[
                            { label: "WPM", value: lastResult.wpm },
                            { label: "Accuracy", value: `${lastResult.accuracy}%` },
                            { label: "Backspaces", value: lastResult.backspaces },
                            { label: "Time Used", value: `${lastResult.timeUsed}/${lastResult.timeLimit}s` },
                        ].map(s => (
                            <div key={s.label} className="p-3 rounded-xl bg-muted/30 border border-border">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                                <p className="text-lg font-bold text-foreground">{s.value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3 justify-center">
                        <Button variant="outline" onClick={() => { setPhase("select"); }} className="rounded-full gap-1">
                            <ArrowRight className="w-4 h-4" /> Next
                        </Button>
                        <Button onClick={() => handleSelect(selected!)} className="rounded-full gap-1 bg-amber-500 hover:bg-amber-600 text-white">
                            <RotateCcw className="w-4 h-4" /> Retry
                        </Button>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (phase === "summary") {
        const avgWpm = results.length ? Math.round(results.reduce((a, r) => a + r.wpm, 0) / results.length) : 0;
        const avgAcc = results.length ? Math.round(results.reduce((a, r) => a + r.accuracy, 0) / results.length) : 0;
        return (
            <div className="w-full max-w-2xl mx-auto p-8 space-y-6">
                <h2 className="text-xl font-bold text-center">Session Summary</h2>
                <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
                        <p className="text-3xl font-black text-amber-500">{results.length}</p>
                        <p className="text-xs text-muted-foreground">Runs</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
                        <p className="text-3xl font-black text-foreground">{avgWpm}</p>
                        <p className="text-xs text-muted-foreground">Avg WPM</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
                        <p className="text-3xl font-black text-foreground">{avgAcc}%</p>
                        <p className="text-xs text-muted-foreground">Avg Accuracy</p>
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    {results.map((r, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
                            <span className="text-sm font-medium">{r.challenge}</span>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{r.wpm} WPM</span>
                                <span>{r.accuracy}%</span>
                                <span className={r.completed ? "text-emerald-500" : "text-red-500"}>{r.completed ? "✓" : "✗"}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-center gap-3">
                    <Button variant="outline" onClick={onExit} className="rounded-full">Exit</Button>
                    <Button onClick={() => setPhase("select")} className="rounded-full bg-amber-500 hover:bg-amber-600 text-white">Continue</Button>
                </div>
            </div>
        );
    }

    return null;
}
