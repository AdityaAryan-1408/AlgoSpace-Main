'use client';

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Play, RotateCcw, AlertOctagon, Cpu, CheckCircle2, Terminal, Flame } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SandboxProps {
    complexity: string; // e.g. "O(1)", "O(N)", "O(N log N)", "O(N^2)"
    optimalComplexity: string; // e.g. "O(N)"
}

interface RunPoint {
    N: number;
    duration: number; // in ms
    baselineDuration: number; // in ms
    status: "pending" | "success" | "tle";
}

export function ComplexitySandbox({ complexity, optimalComplexity }: SandboxProps) {
    const userComplexityClean = complexity?.toUpperCase().replace(/\s+/g, "") || "O(N)";
    const optimalComplexityClean = optimalComplexity?.toUpperCase().replace(/\s+/g, "") || "O(N)";

    const [running, setRunning] = useState(false);
    const [crashed, setCrashed] = useState(false);
    const [points, setPoints] = useState<RunPoint[]>([
        { N: 10, duration: 0, baselineDuration: 0, status: "pending" },
        { N: 1000, duration: 0, baselineDuration: 0, status: "pending" },
        { N: 100000, duration: 0, baselineDuration: 0, status: "pending" },
    ]);
    const [logs, setLogs] = useState<string[]>([
        "[SANDBOX] Virtual Machine initialized. Ready for complexity verification.",
        `[SANDBOX] Configured user complexity: ${userComplexityClean}`,
        `[SANDBOX] Configured optimal baseline: ${optimalComplexityClean}`
    ]);

    const logsEndRef = useRef<HTMLDivElement>(null);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const addLog = (msg: string) => {
        setLogs((prev) => [...prev, msg]);
    };

    const runSimulation = async () => {
        if (running) return;
        setRunning(true);
        setCrashed(false);
        setPoints([
            { N: 10, duration: 0, baselineDuration: 0, status: "pending" },
            { N: 1000, duration: 0, baselineDuration: 0, status: "pending" },
            { N: 100000, duration: 0, baselineDuration: 0, status: "pending" },
        ]);
        setLogs([
            "[SANDBOX] Launching execution sandbox environment...",
            `[SANDBOX] CPU Core Affinity: Dynamic. Time limit per test: 1500ms.`
        ]);

        // Dynamic worker code
        const workerCode = `
            self.onmessage = function(e) {
                const { N, complexity } = e.data;
                const start = performance.now();
                
                let count = 0;
                if (complexity === 'O(1)') {
                    for (let i = 0; i < 50; i++) count += i;
                } else if (complexity === 'O(N)' || complexity === 'O(N)' || complexity === 'O(NLOGN)') {
                    // For O(N log N) inside worker, let's run N log N iterations
                    const target = complexity.includes('LOG') ? Math.floor(N * Math.log2(N || 1)) : N;
                    for (let i = 0; i < target; i++) {
                        count += Math.sin(i) * Math.cos(i);
                    }
                } else if (complexity === 'O(N^2)' || complexity === 'O(N2)') {
                    // Actual double loops to trigger TLE for N=100,000
                    for (let i = 0; i < N; i++) {
                        for (let j = 0; j < N; j++) {
                            count += i + j;
                        }
                    }
                } else {
                    // Default fallback O(N)
                    for (let i = 0; i < N; i++) {
                        count += i;
                    }
                }
                
                const end = performance.now();
                self.postMessage({ N, duration: end - start });
            };
        `;

        const blob = new Blob([workerCode], { type: "application/javascript" });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);
        workerRef.current = worker;

        const sizes = [10, 1000, 100000];

        for (let idx = 0; idx < sizes.length; idx++) {
            const N = sizes[idx];
            addLog(`[SANDBOX] Injecting workload array (N = ${N.toLocaleString()})...`);
            
            // Execute user complexity in worker
            const userDuration = await runWorkload(worker, N, userComplexityClean);
            
            if (userDuration === -1) {
                // TLE! Crash sandbox
                setCrashed(true);
                setPoints((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], duration: 1500, status: "tle" };
                    return next;
                });
                addLog(`[SANDBOX] 🚨 FATAL ERROR: Time Limit Exceeded (TLE) / Core Hang for N=${N.toLocaleString()}!`);
                addLog(`[SANDBOX] CPU core utilization spiked to 100%. Sandbox environment CRASHED.`);
                break;
            } else {
                // Optimal baseline run (simulate mathematically stable baseline values)
                const isOptimalSub = optimalComplexityClean.includes("2") || optimalComplexityClean.includes("^2");
                let baselineTime = 0;
                if (N === 10) baselineTime = 0.01;
                else if (N === 1000) baselineTime = isOptimalSub ? 20 : 0.4;
                else baselineTime = isOptimalSub ? 1500 : 8.5; // Simulate crash or optimal performance

                setPoints((prev) => {
                    const next = [...prev];
                    next[idx] = {
                        N,
                        duration: userDuration,
                        baselineDuration: baselineTime,
                        status: "success",
                    };
                    return next;
                });
                addLog(`[SANDBOX] Workload N = ${N.toLocaleString()} completed successfully in ${userDuration.toFixed(2)}ms.`);
            }

            // Small breathing delay between run points
            await new Promise((r) => setTimeout(r, 300));
        }

        worker.terminate();
        workerRef.current = null;
        setRunning(false);
        addLog("[SANDBOX] Verification task finalized.");
    };

    const runWorkload = (worker: Worker, N: number, comp: string): Promise<number> => {
        return new Promise((resolve) => {
            let completed = false;
            
            const timeout = setTimeout(() => {
                if (!completed) {
                    completed = true;
                    worker.terminate();
                    // Respawn a new worker for subsequent steps if needed
                    resolve(-1);
                }
            }, 1500); // 1.5 second threshold limit

            worker.onmessage = (e) => {
                if (e.data.N === N && !completed) {
                    completed = true;
                    clearTimeout(timeout);
                    resolve(e.data.duration);
                }
            };

            worker.onerror = () => {
                if (!completed) {
                    completed = true;
                    clearTimeout(timeout);
                    resolve(-1);
                }
            };

            worker.postMessage({ N, complexity: comp });
        });
    };

    const handleReset = () => {
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }
        setRunning(false);
        setCrashed(false);
        setPoints([
            { N: 10, duration: 0, baselineDuration: 0, status: "pending" },
            { N: 1000, duration: 0, baselineDuration: 0, status: "pending" },
            { N: 100000, duration: 0, baselineDuration: 0, status: "pending" },
        ]);
        setLogs([
            "[SANDBOX] Environment reset. Ready for compilation and verify."
        ]);
    };

    useEffect(() => {
        return () => {
            if (workerRef.current) workerRef.current.terminate();
        };
    }, []);

    // SVG coordinates calculation for high-fidelity graphing
    const width = 360;
    const height = 180;
    const padding = 20;

    const getCoordinates = (type: "user" | "baseline") => {
        // Map 3 sizes to X spacing
        const xCoords = [padding, width / 2, width - padding];
        
        // Find max Y scaling factor
        const maxTime = Math.max(...points.map(p => Math.max(p.duration, p.baselineDuration)), 10);

        return points.map((p, idx) => {
            const time = type === "user" ? p.duration : p.baselineDuration;
            // Linear inverse scale mapping for Y coordinate
            const yCoord = height - padding - ((time / maxTime) * (height - 2 * padding));
            return { x: xCoords[idx], y: yCoord };
        });
    };

    const userCoords = getCoordinates("user");
    const baselineCoords = getCoordinates("baseline");

    const userPath = userCoords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
    const baselinePath = baselineCoords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");

    return (
        <motion.div 
            animate={crashed ? { x: [-4, 4, -4, 4, 0] } : {}}
            transition={{ duration: 0.3, repeat: crashed ? 3 : 0 }}
            className={`p-4 rounded-2xl border bg-card/60 backdrop-blur-md overflow-hidden shadow-xl transition-all duration-300 ${
                crashed ? "border-red-500/50 shadow-red-950/20" : "border-border/80"
            }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl border ${crashed ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"}`}>
                        <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            Live Complexity Sandbox
                            {crashed && (
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded animate-pulse">
                                    <Flame className="w-3 h-3 text-red-500" /> VM Crash
                                </span>
                            )}
                        </h4>
                        <p className="text-[10px] text-muted-foreground">Sandbox time complexity runner with increasing N</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button
                        size="sm"
                        onClick={runSimulation}
                        disabled={running}
                        className={`h-8 rounded-full px-3 text-xs font-bold gap-1.5 ${
                            crashed 
                                ? "bg-red-500 hover:bg-red-600 text-white" 
                                : "bg-cyan-500 hover:bg-cyan-600 text-white"
                        }`}
                    >
                        <Play className="w-3 h-3" /> Run
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        className="h-8 w-8 rounded-full p-0 flex items-center justify-center border-border/80 text-muted-foreground hover:text-foreground"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* Content Body Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Curve Plotter SVG */}
                <div className="relative rounded-xl border border-border bg-background/50 flex flex-col justify-between overflow-hidden p-2">
                    <span className="absolute top-2 left-2 text-[8px] font-bold text-muted-foreground uppercase tracking-widest z-10">Time Complexity Profile</span>
                    
                    {/* SVG Line Graph */}
                    <div className="flex-1 flex items-center justify-center mt-3">
                        <svg width={width} height={height} className="overflow-visible">
                            {/* Horizontal grid lines */}
                            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="currentColor" className="text-border/40" strokeDasharray="3,3" />
                            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="currentColor" className="text-border/40" strokeDasharray="3,3" />
                            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" className="text-border/60" />

                            {/* X-axis indicators */}
                            <text x={padding} y={height - 4} className="text-[8px] font-bold text-muted-foreground fill-current" textAnchor="middle">N=10</text>
                            <text x={width / 2} y={height - 4} className="text-[8px] font-bold text-muted-foreground fill-current" textAnchor="middle">N=1,000</text>
                            <text x={width - padding} y={height - 4} className="text-[8px] font-bold text-muted-foreground fill-current" textAnchor="middle">N=100K</text>

                            {/* Baseline curve */}
                            <path d={baselinePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeDasharray="4,4" opacity="0.6" />

                            {/* User curve */}
                            <path 
                                d={userPath} 
                                fill="none" 
                                stroke={crashed ? "#ef4444" : "#06b6d4"} 
                                strokeWidth="3" 
                                className="transition-all duration-300"
                                style={{
                                    filter: crashed 
                                        ? "drop-shadow(0 0 8px rgba(239, 68, 68, 0.4))" 
                                        : "drop-shadow(0 0 8px rgba(6, 182, 212, 0.4))"
                                }}
                            />

                            {/* Coordinates interactive dots */}
                            {userCoords.map((c, i) => (
                                <g key={i}>
                                    <circle 
                                        cx={c.x} 
                                        cy={c.y} 
                                        r="5" 
                                        fill={points[i].status === "tle" ? "#ef4444" : points[i].status === "success" ? "#06b6d4" : "#64748b"}
                                    />
                                    {points[i].status === "tle" && (
                                        <circle cx={c.x} cy={c.y} r="10" fill="none" stroke="#ef4444" strokeWidth="1.5" className="animate-ping" />
                                    )}
                                </g>
                            ))}
                        </svg>

                        {/* Interactive Crash visual overlay inside SVG container */}
                        <AnimatePresence>
                            {crashed && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.8 }} 
                                    animate={{ opacity: 1, scale: 1 }} 
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-red-950/20 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-3"
                                >
                                    <AlertOctagon className="w-8 h-8 text-red-500 animate-bounce mb-1" />
                                    <span className="text-xs font-black text-red-500 uppercase tracking-widest">Time Limit Exceeded</span>
                                    <span className="text-[9px] text-red-400 mt-1 max-w-[150px] leading-tight">CPU cores terminated program to avoid system crash.</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Chart Legend */}
                    <div className="flex items-center justify-center gap-4 border-t border-border/40 pt-2 px-1 text-[9px] font-bold">
                        <div className="flex items-center gap-1 text-[#10b981]">
                            <span className="w-2.5 h-0.5 bg-[#10b981] inline-block stroke-dasharray"></span>
                            Optimal Baseline ({optimalComplexityClean})
                        </div>
                        <div className={`flex items-center gap-1 ${crashed ? "text-red-500" : "text-cyan-400"}`}>
                            <span className={`w-2.5 h-1 inline-block ${crashed ? "bg-red-500" : "bg-cyan-500"}`}></span>
                            Your Complexity ({userComplexityClean})
                        </div>
                    </div>
                </div>

                {/* 2. Interactive hacker terminal output logs */}
                <div className="rounded-xl border border-border bg-black/85 font-mono text-[10px] text-zinc-400 p-3 h-[220px] flex flex-col shadow-inner">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 mb-2 text-zinc-500 font-bold shrink-0">
                        <span className="flex items-center gap-1"><Terminal className="w-3.5 h-3.5" /> SYSTEM LOGS</span>
                        <span className="text-[9px]">CPU CORE AFFINITY [0-7]</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-800">
                        {logs.map((log, i) => (
                            <div key={i} className={`leading-relaxed whitespace-pre-wrap ${
                                log.includes("🚨") || log.includes("CRASHED") 
                                    ? "text-red-500" 
                                    : log.includes("successfully") 
                                        ? "text-emerald-400" 
                                        : "text-zinc-400"
                            }`}>
                                {log}
                            </div>
                        ))}
                        {running && (
                            <div className="flex items-center gap-1.5 text-zinc-500">
                                <span className="animate-spin duration-1000 inline-block">⚙️</span>
                                Executing logic kernels...
                            </div>
                        )}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
