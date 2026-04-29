'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import {
    Pencil,
    Eraser,
    Undo2,
    Redo2,
    Trash2,
    Download,
    Minus,
    Plus,
    Palette,
    ChevronDown,
    ChevronUp,
    Save,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const WHITEBOARD_KEY = "algotrack-whiteboard-";

interface WhiteboardData {
    strokes: Stroke[];
    timestamp: string;
}

interface Point {
    x: number;
    y: number;
}

interface Stroke {
    points: Point[];
    color: string;
    width: number;
    tool: "pen" | "eraser";
}

const COLORS = [
    "#ffffff",
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#3b82f6",
    "#a855f7",
    "#ec4899",
    "#06b6d4",
];

const SIZES = [2, 4, 6, 8, 12];

interface WhiteboardCanvasProps {
    cardId: string;
    /** Whether to start expanded or collapsed */
    defaultExpanded?: boolean;
    /** Compact mode shows just a toggle button */
    compact?: boolean;
    className?: string;
}

export function getWhiteboardData(cardId: string): WhiteboardData | null {
    try {
        const raw = localStorage.getItem(WHITEBOARD_KEY + cardId);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function hasWhiteboardData(cardId: string): boolean {
    return getWhiteboardData(cardId) !== null;
}

export function WhiteboardCanvas({
    cardId,
    defaultExpanded = false,
    compact = false,
    className = "",
}: WhiteboardCanvasProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [tool, setTool] = useState<"pen" | "eraser">("pen");
    const [color, setColor] = useState("#ffffff");
    const [strokeWidth, setStrokeWidth] = useState(4);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
    const [undoStack, setUndoStack] = useState<Stroke[][]>([]);
    const [redoStack, setRedoStack] = useState<Stroke[][]>([]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDrawing = useRef(false);
    const hasExistingData = useRef(false);

    // Load saved data
    useEffect(() => {
        const saved = getWhiteboardData(cardId);
        if (saved && saved.strokes.length > 0) {
            setStrokes(saved.strokes);
            hasExistingData.current = true;
        }
    }, [cardId]);

    // Save to localStorage whenever strokes change
    const saveData = useCallback(
        (strokesToSave: Stroke[]) => {
            try {
                const data: WhiteboardData = {
                    strokes: strokesToSave,
                    timestamp: new Date().toISOString(),
                };
                localStorage.setItem(WHITEBOARD_KEY + cardId, JSON.stringify(data));
            } catch {
                // Storage full
            }
        },
        [cardId],
    );

    // Redraw canvas whenever strokes or currentStroke change
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Set canvas size to match display size
        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width * 2 || canvas.height !== rect.height * 2) {
            canvas.width = rect.width * 2;
            canvas.height = rect.height * 2;
            ctx.scale(2, 2);
        }

        // Clear
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Fill background
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, rect.width, rect.height);

        // Draw grid
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.lineWidth = 1;
        for (let x = 0; x < rect.width; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, rect.height);
            ctx.stroke();
        }
        for (let y = 0; y < rect.height; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(rect.width, y);
            ctx.stroke();
        }

        // Draw all strokes
        const allStrokes = [...strokes, ...(currentStroke ? [currentStroke] : [])];
        for (const stroke of allStrokes) {
            if (stroke.points.length < 2) continue;

            ctx.beginPath();
            ctx.strokeStyle = stroke.tool === "eraser" ? "#1a1a2e" : stroke.color;
            ctx.lineWidth = stroke.tool === "eraser" ? stroke.width * 3 : stroke.width;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
        }
    }, [strokes, currentStroke]);

    const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();

        let clientX: number, clientY: number;
        if ("touches" in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    };

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        isDrawing.current = true;
        const point = getCanvasPoint(e);
        setCurrentStroke({
            points: [point],
            color,
            width: strokeWidth,
            tool,
        });
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing.current || !currentStroke) return;
        e.preventDefault();
        const point = getCanvasPoint(e);
        setCurrentStroke({
            ...currentStroke,
            points: [...currentStroke.points, point],
        });
    };

    const handlePointerUp = () => {
        if (!isDrawing.current || !currentStroke) return;
        isDrawing.current = false;

        if (currentStroke.points.length >= 2) {
            const newStrokes = [...strokes, currentStroke];
            setUndoStack((prev) => [...prev, strokes]);
            setRedoStack([]);
            setStrokes(newStrokes);
            saveData(newStrokes);
        }
        setCurrentStroke(null);
    };

    const handleUndo = () => {
        if (undoStack.length === 0) return;
        const prev = undoStack[undoStack.length - 1];
        setRedoStack((r) => [...r, strokes]);
        setUndoStack((u) => u.slice(0, -1));
        setStrokes(prev);
        saveData(prev);
    };

    const handleRedo = () => {
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        setUndoStack((u) => [...u, strokes]);
        setRedoStack((r) => r.slice(0, -1));
        setStrokes(next);
        saveData(next);
    };

    const handleClear = () => {
        if (strokes.length === 0) return;
        setUndoStack((u) => [...u, strokes]);
        setRedoStack([]);
        setStrokes([]);
        saveData([]);
    };

    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement("a");
        link.download = `whiteboard-${cardId}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    };

    const toggleButton = (
        <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer ${
                hasExistingData.current
                    ? "text-teal-500 hover:text-teal-600"
                    : "text-muted-foreground hover:text-foreground"
            }`}
        >
            <Pencil className="w-4 h-4" />
            {compact
                ? isExpanded
                    ? "Hide Whiteboard"
                    : hasExistingData.current
                    ? "Open Whiteboard"
                    : "Whiteboard"
                : isExpanded
                ? "Hide Whiteboard"
                : "Access Whiteboard"}
            {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
            ) : (
                <ChevronDown className="w-3.5 h-3.5" />
            )}
        </button>
    );

    return (
        <div className={className}>
            {toggleButton}

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div
                            ref={containerRef}
                            className="mt-3 rounded-xl border border-border overflow-hidden bg-[#1a1a2e]"
                        >
                            {/* Toolbar */}
                            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/5 border-b border-border flex-wrap">
                                <div className="flex items-center gap-1.5">
                                    {/* Tool buttons */}
                                    <button
                                        onClick={() => setTool("pen")}
                                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                            tool === "pen"
                                                ? "bg-teal-500/20 text-teal-400"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                        }`}
                                        title="Pen"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setTool("eraser")}
                                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                            tool === "eraser"
                                                ? "bg-teal-500/20 text-teal-400"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                        }`}
                                        title="Eraser"
                                    >
                                        <Eraser className="w-4 h-4" />
                                    </button>

                                    <div className="w-px h-5 bg-border mx-1" />

                                    {/* Color picker */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowColorPicker(!showColorPicker)}
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer flex items-center gap-1"
                                            title="Color"
                                        >
                                            <div
                                                className="w-4 h-4 rounded-full border border-white/30"
                                                style={{ backgroundColor: color }}
                                            />
                                            <Palette className="w-3.5 h-3.5" />
                                        </button>
                                        {showColorPicker && (
                                            <div className="absolute top-full left-0 mt-1 p-2 bg-card border border-border rounded-lg shadow-lg z-20 flex gap-1.5 flex-wrap w-32">
                                                {COLORS.map((c) => (
                                                    <button
                                                        key={c}
                                                        onClick={() => {
                                                            setColor(c);
                                                            setShowColorPicker(false);
                                                            setTool("pen");
                                                        }}
                                                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                                                            color === c
                                                                ? "border-teal-400 scale-110"
                                                                : "border-transparent hover:scale-110"
                                                        }`}
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Size */}
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => {
                                                const idx = SIZES.indexOf(strokeWidth);
                                                if (idx > 0) setStrokeWidth(SIZES[idx - 1]);
                                            }}
                                            className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                                        >
                                            <Minus className="w-3 h-3" />
                                        </button>
                                        <span className="text-[10px] font-mono text-muted-foreground w-4 text-center">
                                            {strokeWidth}
                                        </span>
                                        <button
                                            onClick={() => {
                                                const idx = SIZES.indexOf(strokeWidth);
                                                if (idx < SIZES.length - 1) setStrokeWidth(SIZES[idx + 1]);
                                            }}
                                            className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                                        >
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={handleUndo}
                                        disabled={undoStack.length === 0}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer disabled:opacity-30"
                                        title="Undo"
                                    >
                                        <Undo2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleRedo}
                                        disabled={redoStack.length === 0}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer disabled:opacity-30"
                                        title="Redo"
                                    >
                                        <Redo2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleClear}
                                        disabled={strokes.length === 0}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-30"
                                        title="Clear All"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleDownload}
                                        disabled={strokes.length === 0}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer disabled:opacity-30"
                                        title="Download as PNG"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Canvas */}
                            <canvas
                                ref={canvasRef}
                                className="w-full touch-none"
                                style={{ height: "320px", cursor: tool === "eraser" ? "cell" : "crosshair" }}
                                onMouseDown={handlePointerDown}
                                onMouseMove={handlePointerMove}
                                onMouseUp={handlePointerUp}
                                onMouseLeave={handlePointerUp}
                                onTouchStart={handlePointerDown}
                                onTouchMove={handlePointerMove}
                                onTouchEnd={handlePointerUp}
                            />

                            {/* Status */}
                            <div className="px-3 py-1.5 bg-muted/5 border-t border-border flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">
                                    {strokes.length} stroke{strokes.length !== 1 ? "s" : ""}
                                </span>
                                <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                                    <Save className="w-3 h-3" />
                                    Auto-saved
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
