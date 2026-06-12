'use client';

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { 
  Sparkles, 
  FileText, 
  Layout, 
  RefreshCw, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  MessageSquare, 
  ShieldAlert, 
  DollarSign,
  Copy,
  Check
} from "lucide-react";
import { MarkdownContent } from "@/components/MarkdownContent";

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

function blockNoteToMarkdown(jsonStr: string): string {
  if (!jsonStr) return "";
  try {
    const blocks = JSON.parse(jsonStr);
    if (!Array.isArray(blocks)) return jsonStr;
    
    const formatContent = (contentItem: any) => {
      if (!contentItem) return "";
      let text = contentItem.text || "";
      if (contentItem.styles) {
        if (contentItem.styles.bold) text = `**${text}**`;
        if (contentItem.styles.italic) text = `*${text}*`;
        if (contentItem.styles.underline) text = `_${text}_`;
        if (contentItem.styles.strike) text = `~~${text}~~`;
        if (contentItem.styles.code) text = `\`${text}\``;
      }
      return text;
    };

    const blockToMd = (block: any, depth = 0): string => {
      const indent = "  ".repeat(depth);
      let text = "";
      if (Array.isArray(block.content)) {
        text = block.content.map(formatContent).join("");
      } else if (typeof block.content === "string") {
        text = block.content;
      }

      let line = "";
      switch (block.type) {
        case "heading":
          const level = block.props?.level || 1;
          line = `${"#".repeat(level)} ${text}`;
          break;
        case "bulletListItem":
          line = `${indent}- ${text}`;
          break;
        case "numberedListItem":
          line = `${indent}1. ${text}`;
          break;
        case "checkListItem":
          const checked = block.props?.checked ? "[x]" : "[ ]";
          line = `${indent}- ${checked} ${text}`;
          break;
        case "codeBlock":
          line = `\`\`\`\n${text}\n\`\`\``;
          break;
        default:
          line = text;
          break;
      }

      let result = line;
      if (Array.isArray(block.children) && block.children.length > 0) {
        const childrenMd = block.children.map((c: any) => blockToMd(c, depth + 1)).join("\n");
        result = `${result}\n${childrenMd}`;
      }
      return result;
    };

    return blocks.map((b: any) => blockToMd(b)).join("\n\n");
  } catch {
    return jsonStr;
  }
}

export function SystemDesignAssistant({
  currentNotes,
  currentCanvas,
  onNotesGenerated,
  onDiagramGenerated,
  onSelectTab
}: SystemDesignAssistantProps) {
  const [activeMode, setActiveMode] = useState<"generators" | "copilot" | "analysis">("generators");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"text" | "diagram" | "optimize" | "chat" | "spof" | "cost" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Co-pilot Chat States
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; text: string; notesProposal?: string; diagramProposal?: string }[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Analysis Reports States
  const [analysisReport, setAnalysisReport] = useState<string | null>(null);
  const [reportType, setReportType] = useState<"spof" | "cost" | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loadingAction]);

  const handleAiAction = async (action: "generate_text" | "generate_diagram" | "optimize_diagram" | "chat" | "analyze_spof" | "estimate_cost") => {
    let requestPrompt = "";
    
    if (action === "chat") {
      if (!chatInput.trim()) return;
      requestPrompt = chatInput.trim();
      setChatHistory(prev => [...prev, { role: "user", text: requestPrompt }]);
      setChatInput("");
    } else if (action === "generate_text" || action === "generate_diagram") {
      if (!prompt.trim()) {
        setError("Please write a prompt or click one of the quick design templates below.");
        return;
      }
      requestPrompt = prompt.trim();
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const mapActionToState = {
      generate_text: "text",
      generate_diagram: "diagram",
      optimize_diagram: "optimize",
      chat: "chat",
      analyze_spof: "spof",
      estimate_cost: "cost"
    } as const;

    setLoadingAction(mapActionToState[action]);

    try {
      const savedPassword = typeof window !== "undefined" ? localStorage.getItem("algotrack-password") : null;
      const res = await fetch("/api/evaluate/designer", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(savedPassword ? { "x-app-password": savedPassword } : {})
        },
        body: JSON.stringify({
          prompt: requestPrompt,
          currentNotes: blockNoteToMarkdown(currentNotes),
          currentCanvas: currentCanvas ? JSON.parse(currentCanvas) : null,
          action,
          chatHistory: action === "chat" ? chatHistory : undefined
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
      } else if (action === "generate_diagram") {
        onDiagramGenerated(JSON.stringify(body.diagram));
        setSuccessMessage("Diagram canvas layout generated successfully! Switched to Canvas.");
        setTimeout(() => {
          onSelectTab("canvas");
          setSuccessMessage(null);
        }, 1500);
      } else if (action === "optimize_diagram") {
        onDiagramGenerated(JSON.stringify(body.diagram));
        setSuccessMessage("Diagram optimized and updated successfully! Switched to Canvas.");
        setTimeout(() => {
          onSelectTab("canvas");
          setSuccessMessage(null);
        }, 1500);
      } else if (action === "chat") {
        setChatHistory(prev => [
          ...prev, 
          { 
            role: "assistant", 
            text: body.message,
            notesProposal: body.notes || undefined,
            diagramProposal: body.diagram ? JSON.stringify(body.diagram) : undefined
          }
        ]);
      } else if (action === "analyze_spof" || action === "estimate_cost") {
        setAnalysisReport(body.text);
        setReportType(action === "analyze_spof" ? "spof" : "cost");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while processing LLM request.");
      if (action === "chat") {
        setChatHistory(prev => [...prev, { role: "assistant", text: `Error: ${err.message || "Failed to contact co-pilot"}` }]);
      }
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  const copyToClipboard = (txt: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-muted/10 border border-border/80 rounded-2xl max-w-full text-left">
      {/* Introduction */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-foreground">AI System Designer</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">Design and refine your software architectures</p>
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex border border-border p-1 bg-muted/30 rounded-xl gap-1 shrink-0">
        <button
          onClick={() => setActiveMode("generators")}
          className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-all cursor-pointer ${activeMode === "generators" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Generator
        </button>
        <button
          onClick={() => setActiveMode("copilot")}
          className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-all cursor-pointer ${activeMode === "copilot" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Co-Pilot Chat
        </button>
        <button
          onClick={() => setActiveMode("analysis")}
          className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-all cursor-pointer ${activeMode === "analysis" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Analysis
        </button>
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

      {/* Subsystem Mode Views */}
      {activeMode === "generators" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Describe your architecture</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Design a URL shortener with read/write separation, caching, and database replication..."
              rows={3}
              disabled={loading}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none font-medium"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Quick design prompts</span>
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

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
            <Button
              size="sm"
              disabled={loading || !prompt.trim()}
              onClick={() => handleAiAction("generate_text")}
              className="gap-1 bg-purple-600 hover:bg-purple-600/90 text-white font-semibold rounded-lg text-[10px] h-8"
            >
              {loadingAction === "text" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              Specs (Text)
            </Button>
            <Button
              size="sm"
              disabled={loading || !prompt.trim()}
              onClick={() => handleAiAction("generate_diagram")}
              className="gap-1 bg-cyan-600 hover:bg-cyan-600/90 text-white font-semibold rounded-lg text-[10px] h-8"
            >
              {loadingAction === "diagram" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Layout className="w-3 h-3" />}
              Diagram (Canvas)
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading || !currentCanvas || currentCanvas === "[]" || currentCanvas === "{\"nodes\":[],\"edges\":[]}"}
              onClick={() => handleAiAction("optimize_diagram")}
              className="gap-1 text-[10px] h-8 rounded-lg"
            >
              {loadingAction === "optimize" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Optimize
            </Button>
          </div>
        </div>
      )}

      {activeMode === "copilot" && (
        <div className="flex flex-col gap-3">
          {/* Chat bubbles container */}
          <div className="h-64 border border-border rounded-xl bg-background/50 overflow-y-auto p-3 flex flex-col gap-3">
            {chatHistory.length === 0 && (
              <div className="my-auto text-center text-xs text-muted-foreground px-4">
                <MessageSquare className="w-6 h-6 mx-auto mb-1.5 opacity-40 text-purple-400" />
                No messages yet. Ask me to make adjustments to your specs or nodes layout (e.g. <i>"Add redis cache replica node"</i>).
              </div>
            )}
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start w-full"}`}>
                <div className={`p-2.5 rounded-xl text-xs leading-relaxed ${msg.role === "user" ? "bg-purple-600 text-white rounded-br-none" : "bg-muted text-foreground rounded-bl-none w-full"}`}>
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    <MarkdownContent content={msg.text} />
                  )}
                </div>
                
                {/* Proposed application actions */}
                {(msg.notesProposal || msg.diagramProposal) && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {msg.notesProposal && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onNotesGenerated(msg.notesProposal!);
                          onSelectTab("richNotes");
                        }}
                        className="h-6 px-2 text-[9px] font-bold rounded-lg border-purple-500/30 text-purple-400 hover:bg-purple-500/10 cursor-pointer"
                      >
                        Apply AI Notes
                      </Button>
                    )}
                    {msg.diagramProposal && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onDiagramGenerated(msg.diagramProposal!);
                          onSelectTab("canvas");
                        }}
                        className="h-6 px-2 text-[9px] font-bold rounded-lg border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 cursor-pointer"
                      >
                        Apply AI Canvas
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loadingAction === "chat" && (
              <div className="flex mr-auto items-center gap-1.5 bg-muted p-2 rounded-xl text-xs text-muted-foreground rounded-bl-none animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Thinking...
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat input block */}
          <div className="flex gap-1.5 shrink-0">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="e.g. Place a queue before the database node..."
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAiAction("chat");
              }}
              className="flex-1 px-3 py-1.5 bg-background text-foreground text-xs rounded-xl border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              size="sm"
              disabled={loading || !chatInput.trim()}
              onClick={() => handleAiAction("chat")}
              className="h-8 rounded-xl px-3 text-xs bg-purple-600 hover:bg-purple-600/90 text-white font-semibold cursor-pointer"
            >
              Send
            </Button>
          </div>
        </div>
      )}

      {activeMode === "analysis" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => handleAiAction("analyze_spof")}
              className="gap-1.5 h-9 rounded-xl text-xs font-semibold text-red-400 border-red-500/20 hover:bg-red-500/5 cursor-pointer"
            >
              {loadingAction === "spof" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
              Analyze SPOF
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => handleAiAction("estimate_cost")}
              className="gap-1.5 h-9 rounded-xl text-xs font-semibold text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/5 cursor-pointer"
            >
              {loadingAction === "cost" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              Estimate Cost
            </Button>
          </div>

          {/* Analysis Report rendering */}
          {analysisReport && (
            <div className="flex flex-col gap-2.5 border border-border rounded-xl p-3 bg-background/50 max-h-60 overflow-y-auto">
              <div className="flex items-center justify-between shrink-0 pb-1.5 border-b border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {reportType === "spof" ? "Reliability Report (SPOFs)" : "Latency & Cost Estimate"}
                </span>
                <button
                  onClick={() => copyToClipboard(analysisReport)}
                  className="p-1 rounded bg-muted/40 hover:bg-muted text-slate-400 hover:text-foreground transition-all flex items-center gap-1 text-[9px] font-bold cursor-pointer"
                  title="Copy report markdown"
                >
                  {copiedReport ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedReport ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="text-[10.5px] text-foreground/90 leading-relaxed text-left select-text w-full">
                <MarkdownContent content={analysisReport} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
