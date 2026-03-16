'use client';

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Timer, AlertTriangle, CheckCircle, Video, Expand, X, Loader2, Maximize, PlayCircle, Activity } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { startStressMode, completeStressMode } from "@/lib/client-api";
import { CodePractice } from "@/components/CodePractice";
import { fetchCardDetails } from "@/lib/client-api";
import type { Flashcard } from "@/data";

interface Props {
  onExit: () => void;
}

export function StressModeSession({ onExit }: Props) {
  const [phase, setPhase] = useState<"preflight" | "loading" | "active" | "complete" | "error">("preflight");
  
  // Data state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Active session state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentCardDetails, setCurrentCardDetails] = useState<Flashcard | null>(null);
  const [results, setResults] = useState<Array<{ cardId: string; rating: string; timeSpentMs: number }>>([]);
  
  // Timers
  const DURATION_LIMIT_MS = 45 * 60 * 1000; // 45 mins
  const [timeLeft, setTimeLeft] = useState(DURATION_LIMIT_MS);
  const sessionStartTime = useRef<number>(0);
  const cardStartTime = useRef<number>(0);

  // Pre-flight toggles
  const [useWebcam, setUseWebcam] = useState(false);
  const webcamRef = useRef<HTMLVideoElement>(null);

  // Formatting timer
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (phase === "active") {
      sessionStartTime.current = Date.now();
      cardStartTime.current = Date.now();
      
      interval = setInterval(() => {
        const remaining = DURATION_LIMIT_MS - (Date.now() - sessionStartTime.current);
        if (remaining <= 0) {
          clearInterval(interval);
          handleCompleteSession("abandoned"); // Time out
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phase]);

  // Request fullscreen on active
  useEffect(() => {
    if (phase === "active") {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("Fullscreen error", err);
      });
    }
  }, [phase]);

  const requestWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
      }
      setUseWebcam(true);
    } catch (err) {
      alert("Webcam permission denied or unavailable.");
    }
  };

  const handleStart = async () => {
    setPhase("loading");
    try {
      const res = await startStressMode(3); // Pick 3 cards
      if (!res.sessionId) {
        setErrorMessage(res.message || "Failed to start.");
        setPhase("error");
        return;
      }
      setSessionId(res.sessionId);
      setCandidates(res.candidates);
      
      // Fetch details for the first card
      const cDetails = await fetchCardDetails(res.candidates[0].id);
      setCurrentCardDetails(cDetails);
      setPhase("active");
    } catch (err: any) {
      setErrorMessage(err.message || "Unknown error occurred.");
      setPhase("error");
    }
  };

  const handleCardEvaluated = async (rating: "AGAIN" | "HARD" | "GOOD" | "EASY") => {
    const timeSpent = Date.now() - cardStartTime.current;
    
    setResults(prev => [
      ...prev,
      {
        cardId: candidates[currentIndex].id,
        rating,
        timeSpentMs: timeSpent
      }
    ]);

    if (currentIndex + 1 < candidates.length) {
      // Next card
      setCurrentIndex(prev => prev + 1);
      const nextDetails = await fetchCardDetails(candidates[currentIndex + 1].id);
      setCurrentCardDetails(nextDetails);
      cardStartTime.current = Date.now();
    } else {
      // Done all 3!
      handleCompleteSession("completed");
    }
  };

  const handleCompleteSession = async (finalStatus: "completed" | "abandoned") => {
    setPhase("loading");
    document.exitFullscreen().catch(() => {}); // Exit fullscreen
    
    // Stop webcam if active
    if (webcamRef.current && webcamRef.current.srcObject) {
      const stream = webcamRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
    }

    try {
      await completeStressMode({
        sessionId: sessionId!,
        status: finalStatus,
        durationMs: Date.now() - sessionStartTime.current,
        cardsCompleted: results.length, // use current length as some may not be recorded yet
        results
      });
      setPhase("complete");
    } catch (err) {
      console.error(err);
      setPhase("complete"); // Proceed anyway since we are done
    }
  };

  const handleEarlyExit = () => {
    if (confirm("Are you sure you want to abandon this session? It will be marked as abandoned.")) {
      if (phase === "active" && sessionId) {
        handleCompleteSession("abandoned");
      } else {
        onExit();
      }
    }
  };

  if (phase === "preflight") {
    return (
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden bg-background">
        <div className="absolute inset-0 bg-red-500/5 pulse-red z-0" />
        
        <div className="w-full max-w-lg z-10 space-y-8">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl border border-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Stress Drill Mode</h1>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Simulate actual high-pressure interview settings. You will be given 3 random due LeetCode problems and a strict 45-minute timer.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <Expand className="w-4 h-4 text-muted-foreground" />
                Fullscreen Requested
              </span>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex items-center justify-between group">
              <span className="text-sm font-medium flex items-center gap-2">
                <Video className="w-4 h-4 text-muted-foreground" />
                Webcam Recording (Optional)
              </span>
              {useWebcam ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : (
                <Button variant="outline" size="sm" onClick={requestWebcam}>Enable</Button>
              )}
            </div>
            {useWebcam && (
              <div className="aspect-video bg-black rounded-lg overflow-hidden border border-border">
                <video ref={webcamRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button variant="ghost" onClick={onExit} className="w-full text-muted-foreground">
              Cancel
            </Button>
            <Button onClick={handleStart} className="w-full bg-red-500 hover:bg-red-600 text-white gap-2 border-none">
              <PlayCircle className="w-4 h-4" />
              Start 45:00 Timer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-red-500" />
        <p className="text-sm text-foreground/70 tracking-widest uppercase">Initializing Pressure Matrix</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex-1 flexitems-center justify-center p-12">
        <div className="max-w-md mx-auto text-center space-y-4 p-8 border border-red-500/20 bg-red-500/5 rounded-2xl">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <h3 className="font-bold text-lg text-foreground">Drill Initializer Failed</h3>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <Button variant="default" onClick={onExit} className="mt-4">Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div className="flex-1 flex items-center justify-center p-12 relative overflow-hidden bg-background">
        <div className="absolute inset-0 bg-emerald-500/5 z-0" />
        <div className="max-w-md w-full relative z-10 text-center space-y-6 bg-card border border-border p-8 rounded-2xl shadow-xl">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold">Session Finalized</h2>
          <p className="text-muted-foreground text-sm">
            You pushed through the pressure. Results have been recorded to your analytics engine.
          </p>
          <div className="grid grid-cols-2 gap-4 bg-muted/30 border border-border p-4 rounded-xl text-left">
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Answered</p>
              <p className="text-lg font-bold">{results.length} / 3</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Time Elapsed</p>
              <p className="text-lg font-bold">
                {Math.floor(((DURATION_LIMIT_MS - timeLeft)/1000) / 60)}m {Math.floor(((DURATION_LIMIT_MS - timeLeft)/1000) % 60)}s
              </p>
            </div>
          </div>
          <Button onClick={onExit} className="w-full uppercase tracking-wider font-bold">Acknowledge</Button>
        </div>
      </div>
    );
  }

  // ACTIVE PHASE
  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col overflow-hidden select-none">
      
      {/* Top Bar constraints */}
      <div className="h-14 border-b border-border bg-black/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Badge variant="destructive" className="animate-pulse flex items-center gap-1.5 uppercase font-bold tracking-widest text-[10px]">
            <Activity className="w-3 h-3" /> Stress Drill Active
          </Badge>
          <span className="text-sm font-semibold text-muted-foreground tracking-wider">
            Problem {currentIndex + 1} OF {candidates.length}
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-2 font-mono font-bold text-lg tabular-nums ${timeLeft < 300000 ? "text-red-500 animate-pulse" : "text-amber-500"}`}>
            <Timer className="w-5 h-5 mb-0.5" />
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
          
          <Button onClick={handleEarlyExit} variant="ghost" size="sm" className="text-muted-foreground hover:bg-red-500/20 hover:text-red-500">
            <X className="w-4 h-4 mr-2" /> Abandon Drill
          </Button>
        </div>
      </div>

      {/* Main Board */}
      <div className="flex-1 flex w-full relative overflow-hidden bg-card/50">
        {useWebcam && (
          <div className="absolute top-4 right-4 w-48 aspect-video rounded-xl overflow-hidden border-2 border-border shadow-2xl z-20 pointer-events-none opacity-80 mix-blend-luminosity">
            <video ref={webcamRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          </div>
        )}

        {currentCardDetails && (
          <div className="w-full h-full p-4 overflow-y-auto custom-scrollbar relative z-10">
            <div className="max-w-6xl mx-auto h-full space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border/50">
                <h2 className="text-2xl font-bold tracking-tight">{currentCardDetails.title}</h2>
                <Badge variant={currentCardDetails.difficulty} className="uppercase px-3 py-1 text-xs">
                  {currentCardDetails.difficulty}
                </Badge>
              </div>

              {/* Injected Practice Interface */}
              <CodePractice 
                card={currentCardDetails}
                onCancel={() => handleEarlyExit()} 
                onRate={(rating) => handleCardEvaluated(rating)}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
