'use client';

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { MarkdownContent } from "@/components/MarkdownContent";
import type { Flashcard } from "@/data";
import {
    Mic,
    MicOff,
    Square,
    Loader2,
    RotateCcw,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface FeynmanResult {
    overallScore: number;
    clarity: number;
    technicalAccuracy: number;
    communication: number;
    completeness: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
    suggestedRating: "AGAIN" | "HARD" | "GOOD" | "EASY";
}

interface FeynmanRecorderProps {
    card: Flashcard;
    onRate: (rating: "AGAIN" | "HARD" | "GOOD" | "EASY") => void;
    onCancel: () => void;
}

type RecordingState = "idle" | "recording" | "transcribing" | "evaluating";

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground w-28 shrink-0">
                {label}
            </span>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                    className={`h-full rounded-full ${color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${score * 10}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                />
            </div>
            <span className="text-xs font-bold text-foreground w-6 text-right">
                {score}
            </span>
        </div>
    );
}

export function FeynmanRecorder({ card, onRate, onCancel }: FeynmanRecorderProps) {
    const [state, setState] = useState<RecordingState>("idle");
    const [transcript, setTranscript] = useState("");
    const [result, setResult] = useState<FeynmanResult | null>(null);
    const [error, setError] = useState("");
    const [recordingTime, setRecordingTime] = useState(0);
    const [showTranscript, setShowTranscript] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    const startRecording = useCallback(async () => {
        setError("");
        setResult(null);
        setTranscript("");
        chunksRef.current = [];
        setRecordingTime(0);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                    ? "audio/webm;codecs=opus"
                    : "audio/webm",
            });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.start(1000);
            setState("recording");

            timerRef.current = setInterval(() => {
                setRecordingTime((t) => t + 1);
            }, 1000);
        } catch (err) {
            setError("Could not access microphone. Please allow microphone access.");
            console.error("Microphone error:", err);
        }
    }, []);

    const stopRecording = useCallback(async () => {
        // Stop timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state !== "recording") {
            setState("idle");
            return;
        }

        // Wait for the recorder to finish and collect the final chunk
        const audioBlob = await new Promise<Blob>((resolve) => {
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                resolve(blob);
            };
            recorder.stop();
            recorder.stream.getTracks().forEach((t) => t.stop());
        });

        if (audioBlob.size < 1000) {
            setError("Recording was too short. Try speaking for at least 15 seconds.");
            setState("idle");
            return;
        }

        // Step 1: Transcribe via Groq Whisper
        setState("transcribing");
        try {
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");

            const transcribeRes = await fetch("/api/transcribe", {
                method: "POST",
                body: formData,
            });

            if (!transcribeRes.ok) {
                const body = await transcribeRes.json().catch(() => ({}));
                throw new Error(body.error || "Transcription failed");
            }

            const { transcript: transcribedText } = await transcribeRes.json();

            if (!transcribedText || transcribedText.trim().length < 10) {
                setError("Could not transcribe your recording. Speak clearly and try again.");
                setState("idle");
                return;
            }

            setTranscript(transcribedText);

            // Step 2: Evaluate with AI
            setState("evaluating");

            const getSavedSolution = () => {
                if (card.solutions && card.solutions.length > 0) {
                    return card.solutions.map((s) => `## ${s.name}\n${s.content}`).join("\n\n");
                }
                return card.solution || "";
            };

            const evalRes = await fetch("/api/evaluate/feynman", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    transcript: transcribedText,
                    problemTitle: card.title,
                    problemDescription: card.description,
                    savedSolution: getSavedSolution(),
                    savedNotes: card.notes,
                    cardType: card.type,
                }),
            });

            if (!evalRes.ok) {
                const body = await evalRes.json().catch(() => ({}));
                throw new Error(body.error || "Evaluation failed");
            }

            const evalResult: FeynmanResult = await evalRes.json();
            setResult(evalResult);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to process recording");
        } finally {
            if (!result) setState("idle");
        }
    }, [card, result]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const ratingColors: Record<string, string> = {
        AGAIN: "bg-red-500 text-white",
        HARD: "bg-orange-500 text-white",
        GOOD: "bg-blue-500 text-white",
        EASY: "bg-emerald-500 text-white",
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Mic className="w-4 h-4 text-orange-500" />
                        Feynman Technique
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Explain your approach out loud. AI will grade your communication.
                    </p>
                </div>
            </div>

            {/* Recording area */}
            {!result && (
                <div className="flex flex-col items-center gap-4 py-6">
                    {state === "recording" && (
                        <motion.div
                            animate={{ scale: [1, 1.15, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                            className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/40 flex items-center justify-center"
                        >
                            <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
                                <Mic className="w-7 h-7 text-red-500" />
                            </div>
                        </motion.div>
                    )}

                    {state === "recording" && (
                        <div className="text-center">
                            <p className="text-2xl font-mono font-bold text-foreground">
                                {formatTime(recordingTime)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Recording...</p>
                        </div>
                    )}

                    {state === "transcribing" && (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            <p className="text-sm font-medium text-muted-foreground">
                                Transcribing your audio...
                            </p>
                        </div>
                    )}

                    {state === "evaluating" && (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                            <p className="text-sm font-medium text-muted-foreground">
                                Evaluating your explanation...
                            </p>
                        </div>
                    )}

                    {state === "idle" && !error && (
                        <div className="w-20 h-20 rounded-full bg-muted/30 border-2 border-dashed border-border flex items-center justify-center">
                            <MicOff className="w-7 h-7 text-muted-foreground" />
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex items-center gap-3">
                        {state === "idle" && (
                            <Button
                                onClick={startRecording}
                                className="gap-2 bg-red-500 hover:bg-red-600 text-white rounded-full px-8 py-5 font-semibold text-base"
                            >
                                <Mic className="w-5 h-5" />
                                Start Recording
                            </Button>
                        )}
                        {state === "recording" && (
                            <Button
                                onClick={stopRecording}
                                className="gap-2 bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 py-5 font-semibold text-base"
                            >
                                <Square className="w-4 h-4" />
                                Stop & Evaluate
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500 text-center">
                    {error}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setError(""); setState("idle"); }}
                        className="ml-2 text-red-500 hover:text-red-600"
                    >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Try Again
                    </Button>
                </div>
            )}

            {/* Results */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-border bg-card overflow-hidden"
                    >
                        {/* Score header */}
                        <div className={`px-4 py-3 flex items-center justify-between ${
                            result.overallScore >= 7
                                ? "bg-emerald-500/10 border-b border-emerald-500/20"
                                : result.overallScore >= 5
                                ? "bg-blue-500/10 border-b border-blue-500/20"
                                : "bg-orange-500/10 border-b border-orange-500/20"
                        }`}>
                            <div className="flex items-center gap-2">
                                <Mic className="w-4 h-4 text-orange-500" />
                                <span className="text-sm font-bold text-foreground">
                                    Feynman Score
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-foreground">
                                    {result.overallScore}
                                </span>
                                <span className="text-xs text-muted-foreground">/10</span>
                                <span className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold ${ratingColors[result.suggestedRating]}`}>
                                    {result.suggestedRating}
                                </span>
                            </div>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Score bars */}
                            <div className="space-y-2">
                                <ScoreBar label="Clarity" score={result.clarity} color="bg-blue-500" />
                                <ScoreBar label="Technical" score={result.technicalAccuracy} color="bg-emerald-500" />
                                <ScoreBar label="Communication" score={result.communication} color="bg-purple-500" />
                                <ScoreBar label="Completeness" score={result.completeness} color="bg-orange-500" />
                            </div>

                            {/* Feedback */}
                            <div className="text-sm text-foreground/90 leading-relaxed">
                                <MarkdownContent content={result.feedback} />
                            </div>

                            {/* Strengths */}
                            {result.strengths.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-1">
                                        ✓ Strengths
                                    </p>
                                    <ul className="text-xs text-foreground/80 space-y-0.5 ml-3">
                                        {result.strengths.map((s, i) => (
                                            <li key={i} className="list-disc">{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Improvements */}
                            {result.improvements.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-1">
                                        → Improve
                                    </p>
                                    <ul className="text-xs text-foreground/80 space-y-0.5 ml-3">
                                        {result.improvements.map((s, i) => (
                                            <li key={i} className="list-disc">{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Transcript toggle */}
                            {transcript && (
                                <button
                                    onClick={() => setShowTranscript(!showTranscript)}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
                                >
                                    <span>View Transcript</span>
                                    {showTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                            )}
                            {showTranscript && transcript && (
                                <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-xs text-foreground/70 leading-relaxed">
                                    {transcript}
                                </div>
                            )}

                            {/* Rating & continue */}
                            <div className="flex flex-col items-center gap-3 pt-4 border-t border-border">
                                <Button
                                    size="lg"
                                    onClick={() => onRate(result.suggestedRating)}
                                    className="w-full sm:w-64 rounded-full font-bold bg-foreground text-background hover:bg-foreground/90 py-6"
                                >
                                    Accept Rating ({result.suggestedRating})
                                </Button>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setResult(null); setTranscript(""); }}
                                        className="text-muted-foreground gap-1"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Record Again
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
                                        Skip
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cancel */}
            {!result && state === "idle" && (
                <div className="flex justify-center">
                    <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
                        Back to review
                    </Button>
                </div>
            )}
        </div>
    );
}
