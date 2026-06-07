'use client';

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sparkles, FileText, Layout, RefreshCw, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface SystemDesignAssistantProps {
  currentNotes: string;
  currentCanvas: string; // Serialized JSON string of CanvasData
  onNotesGenerated: (content: string) => void;
  onDiagramGenerated: (canvasDataStr: string) => void;
  onSelectTab: (tab: "richNotes" | "canvas") => void;
}

const TEMPLATES = [
  { label: "Rate Limiter", prompt: "Design a scalable API Rate Limiter using Token Bucket algorithm, showing Client, Rate Limiter service, Redis cache, and Backend." },
  { label: "URL Shortener", prompt: "Write high-level system spec and draw a diagram for a URL Shortener service (TinyURL) handling 10k write/sec. Include Web UI, API servers, Cache, and SQL DB replicas." },
  { label: "API Gateway microservices", prompt: "Microservices architecture with API Gateway, OAuth Auth service, User service, Orders service, Kafka message queue, and DB." },
  { label: "CDN Caching flow", prompt: "CDN flow showing Client requests hitting Edge Server, Origin Shield, and Origin Web Server, with Cache invalidation triggers." }
];

export function SystemDesignAssistant({
  currentNotes,
  currentCanvas,
  onNotesGenerated,
  onDiagramGenerated,
  onSelectTab
}: SystemDesignAssistantProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"text" | "diagram" | "optimize" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAiAction = async (action: "generate_text" | "generate_diagram" | "optimize_diagram") => {
    if (action !== "optimize_diagram" && !prompt.trim()) {
      setError("Please write a prompt or click one of the quick design templates below.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setLoadingAction(action === "generate_text" ? "text" : action === "generate_diagram" ? "diagram" : "optimize");

    try {
      const savedPassword = typeof window !== "undefined" ? localStorage.getItem("algotrack-password") : null;
      const res = await fetch("/api/evaluate/designer", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(savedPassword ? { "x-app-password": savedPassword } : {})
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          currentNotes,
          currentCanvas: currentCanvas ? JSON.parse(currentCanvas) : null,
          action
        })
      });

      const body = await res.json();
      if (res.status === 401) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("auth-required"));
        }
        throw new Error(body.error || "Unauthorized");
      }
      if (!res.ok) {
        throw new Error(body.error || "Failed to contact design assistant");
      }

      if (action === "generate_text") {
        onNotesGenerated(body.text);
        setSuccessMessage("System design specs generated successfully! Switched to Rich Notes.");
        setTimeout(() => {
          onSelectTab("richNotes");
          setSuccessMessage(null);
        }, 1500);
      } else {
        // Diagram actions
        onDiagramGenerated(JSON.stringify(body.diagram));
        setSuccessMessage(
          action === "optimize_diagram" 
            ? "Diagram optimized and updated successfully! Switched to Canvas." 
            : "Diagram canvas layout generated successfully! Switched to Canvas."
        );
        setTimeout(() => {
          onSelectTab("canvas");
          setSuccessMessage(null);
        }, 1500);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while processing LLM request.");
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 bg-muted/10 border border-border/80 rounded-2xl max-w-full text-left">
      {/* Introduction */}
      <div className="flex items-center gap-2 pb-2 border-b border-border/40 shrink-0">
        <Sparkles className="w-5 h-5 text-purple-500 shrink-0" />
        <div>
          <h4 className="text-sm font-semibold text-foreground">AI System Designer</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">Let AI generate architecture notes or visual canvas diagrams for you.</p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-hard-bg/50 border border-hard/30 text-hard text-xs rounded-xl flex items-start gap-2 animate-in slide-in-from-top-1">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-start gap-2 animate-in slide-in-from-top-1">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 animate-bounce" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Describe your architecture</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Design a URL shortener with read/write separation, caching, and database replication..."
          rows={4}
          disabled={loading}
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground resize-none"
        />
      </div>

      {/* Templates */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quick design prompts</span>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((tmpl, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loading}
              onClick={() => setPrompt(tmpl.prompt)}
              className="text-[10px] font-medium px-2.5 py-1 bg-muted/40 hover:bg-muted text-foreground/80 hover:text-foreground rounded-full border border-border/50 transition-all cursor-pointer"
            >
              {tmpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border/40">
        <Button
          size="sm"
          disabled={loading || !prompt.trim()}
          onClick={() => handleAiAction("generate_text")}
          className="gap-1.5 h-9 bg-purple-600 hover:bg-purple-600/90 text-white font-semibold rounded-full text-xs shadow-lg shadow-purple-600/15"
        >
          {loadingAction === "text" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileText className="w-3.5 h-3.5" />
          )}
          {loadingAction === "text" ? "Writing Spec..." : "Generate Specs (Text)"}
        </Button>

        <Button
          size="sm"
          disabled={loading || !prompt.trim()}
          onClick={() => handleAiAction("generate_diagram")}
          className="gap-1.5 h-9 bg-cyan-600 hover:bg-cyan-600/90 text-white font-semibold rounded-full text-xs shadow-lg shadow-cyan-600/15"
        >
          {loadingAction === "diagram" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Layout className="w-3.5 h-3.5" />
          )}
          {loadingAction === "diagram" ? "Designing..." : "Generate Diagram (Canvas)"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={loading || !currentCanvas || currentCanvas === "[]"}
          onClick={() => handleAiAction("optimize_diagram")}
          className="gap-1.5 h-9 text-xs rounded-full"
        >
          {loadingAction === "optimize" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {loadingAction === "optimize" ? "Refining..." : "Optimize Canvas"}
        </Button>
      </div>
    </div>
  );
}
