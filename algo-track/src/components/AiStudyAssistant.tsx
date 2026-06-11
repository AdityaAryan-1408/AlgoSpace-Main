'use client';

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { SystemDesignCanvas } from "./SystemDesignCanvas";
import { 
  Sparkles, 
  MessageSquare, 
  FileCode, 
  HelpCircle, 
  Lightbulb, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  RefreshCw, 
  Loader2, 
  AlertCircle,
  Database,
  ArrowRight,
  BookOpen
} from "lucide-react";
import type { Flashcard } from "@/data";

interface AiStudyAssistantProps {
  card: Flashcard;
  currentNotes: string;
  onUpdateCard: (updates: Partial<Flashcard>) => Promise<void>;
  onNotesGenerated: (content: string) => void;
}

export function AiStudyAssistant({
  card,
  currentNotes,
  onUpdateCard,
  onNotesGenerated
}: AiStudyAssistantProps) {
  // Tabs: based on card.type
  const isDsa = card.type === "leetcode";
  const isSql = card.type === "sql";
  const isConcept = card.type === "cs" || (!isDsa && !isSql);

  const initialTab = isDsa ? "hint" : isSql ? "alternatives" : "enhancer";
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- LeetCode/DSA States ---
  const [dsaChatInput, setDsaChatInput] = useState("");
  const [dsaChatHistory, setDsaChatHistory] = useState<{ role: "user" | "tutor"; text: string }[]>([]);
  const dsaChatBottomRef = useRef<HTMLDivElement>(null);
  const [dsaEdgeCases, setDsaEdgeCases] = useState<string | null>(null);
  const [copiedEdgeCases, setCopiedEdgeCases] = useState(false);

  // --- SQL States ---
  // Accordon state for alternative solutions
  const [sqlAlternatives, setSqlAlternatives] = useState<{ title: string; code: string; explanation: string }[]>(
    (card.metadata?.aiSqlSolutions as { title: string; code: string; explanation: string }[]) || []
  );
  const [expandedSolutionIdx, setExpandedSolutionIdx] = useState<number | null>(null);
  const [copiedSqlIdx, setCopiedSqlIdx] = useState<number | null>(null);

  // SQL Optimizer query text and recommendations
  const [userQuery, setUserQuery] = useState(card.solutions?.[0]?.content || card.solution || "");
  const [optimizedReport, setOptimizedReport] = useState<string | null>(null);
  const [copiedOptimizer, setCopiedOptimizer] = useState(false);

  // --- CS Core Concept States ---
  const [analogyText, setAnalogyText] = useState<string | null>(null);
  const [copiedAnalogy, setCopiedAnalogy] = useState(false);

  // Notes Enhancer States
  const [conceptChatInput, setConceptChatInput] = useState("");
  const [conceptChatHistory, setConceptChatHistory] = useState<{ role: "user" | "assistant"; text: string; notesProposal?: string }[]>([]);
  const conceptChatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chats
  useEffect(() => {
    dsaChatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dsaChatHistory, loadingAction]);

  useEffect(() => {
    conceptChatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conceptChatHistory, loadingAction]);

  // Sync alternative solutions when card changes
  useEffect(() => {
    setSqlAlternatives((card.metadata?.aiSqlSolutions as { title: string; code: string; explanation: string }[]) || []);
    setUserQuery(card.solutions?.[0]?.content || card.solution || "");
    setDsaChatHistory([]);
    setConceptChatHistory([]);
    setDsaEdgeCases(null);
    setOptimizedReport(null);
    setAnalogyText(null);
  }, [card]);

  const handleStudyToolAction = async (actionType: string) => {
    let payload: any = {
      action: actionType,
      cardTitle: card.title,
      cardDescription: card.description,
    };

    if (actionType === "dsa_hint") {
      if (!dsaChatInput.trim()) return;
      payload.userPromptInput = dsaChatInput.trim();
      payload.chatHistory = dsaChatHistory;
      setDsaChatHistory(prev => [...prev, { role: "user", text: dsaChatInput.trim() }]);
      setDsaChatInput("");
    } else if (actionType === "sql_optimize") {
      if (!userQuery.trim()) {
        setError("Please enter or paste your SQL query in the text area.");
        return;
      }
      payload.solution = userQuery;
    } else if (actionType === "notes_enhancer") {
      if (!conceptChatInput.trim()) return;
      payload.userPromptInput = conceptChatInput.trim();
      payload.notes = currentNotes;
      setConceptChatHistory(prev => [...prev, { role: "user", text: conceptChatInput.trim() }]);
      setConceptChatInput("");
    } else if (actionType === "sql_alternatives") {
      payload.solution = card.solutions?.[0]?.content || card.solution || "";
    }

    setLoading(true);
    setError(null);
    setLoadingAction(actionType);

    try {
      const savedPassword = typeof window !== "undefined" ? localStorage.getItem("algotrack-password") : null;
      const res = await fetch("/api/evaluate/study-tools", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(savedPassword ? { "x-app-password": savedPassword } : {})
        },
        body: JSON.stringify(payload)
      });

      const body = await res.json();
      if (res.status === 401) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("auth-required"));
        }
        throw new Error(body.error || "Unauthorized");
      }
      if (!res.ok) {
        throw new Error(body.error || "Failed to process request");
      }

      // Handle response types
      if (actionType === "dsa_hint") {
        setDsaChatHistory(prev => [...prev, { role: "tutor", text: body.text }]);
      } else if (actionType === "dsa_edge_cases") {
        setDsaEdgeCases(body.text);
      } else if (actionType === "sql_optimize") {
        setOptimizedReport(body.text);
      } else if (actionType === "concept_analogy") {
        setAnalogyText(body.text);
      } else if (actionType === "sql_alternatives") {
        const solutions = Array.isArray(body) ? body : [];
        setSqlAlternatives(solutions);
        // Persist to card metadata permanently
        await onUpdateCard({
          metadata: {
            ...card.metadata,
            aiSqlSolutions: solutions
          }
        });
      } else if (actionType === "notes_enhancer") {
        setConceptChatHistory(prev => [
          ...prev, 
          { 
            role: "assistant", 
            text: body.message,
            notesProposal: body.notes || undefined
          }
        ]);
      } else if (actionType === "sql_erd") {
        // AI ERD layout generator
        const erdVal = JSON.stringify(body);
        await onUpdateCard({
          metadata: {
            ...card.metadata,
            sqlErdCanvas: erdVal
          }
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong.");
      if (actionType === "dsa_hint") {
        setDsaChatHistory(prev => [...prev, { role: "tutor", text: `Error: ${err.message || "Failed to contact tutor"}` }]);
      } else if (actionType === "notes_enhancer") {
        setConceptChatHistory(prev => [...prev, { role: "assistant", text: `Error: ${err.message || "Failed to process notes"}` }]);
      }
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  const copyText = (txt: string, callback: (v: boolean) => void) => {
    navigator.clipboard.writeText(txt);
    callback(true);
    setTimeout(() => callback(false), 2000);
  };

  const currentErdCanvasVal = (card.metadata?.sqlErdCanvas as string) || "";

  return (
    <div className="flex flex-col gap-4 text-left p-4 bg-muted/10 border border-border/80 rounded-2xl w-full">
      {/* Tab bar header */}
      <div className="flex items-center gap-2 border-b border-border/50 pb-2">
        <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse" />
        <div>
          <h4 className="text-sm font-semibold text-foreground">AI Study Assistant</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">Socratic hints, query tuning, ERDs, and notes refining</p>
        </div>
      </div>

      {/* Main Tab selector based on Card Type */}
      <div className="flex border border-border p-1 bg-muted/30 rounded-xl gap-1 shrink-0 text-[11px] font-semibold">
        {isDsa && (
          <>
            <button
              onClick={() => setActiveTab("hint")}
              className={`flex-1 py-1.5 rounded-lg cursor-pointer ${activeTab === "hint" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Socratic Hint Chat
            </button>
            <button
              onClick={() => setActiveTab("edgecases")}
              className={`flex-1 py-1.5 rounded-lg cursor-pointer ${activeTab === "edgecases" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              DSA Edge Cases
            </button>
          </>
        )}
        {isSql && (
          <>
            <button
              onClick={() => setActiveTab("alternatives")}
              className={`flex-1 py-1.5 rounded-lg cursor-pointer ${activeTab === "alternatives" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Alternative Queries
            </button>
            <button
              onClick={() => setActiveTab("erd")}
              className={`flex-1 py-1.5 rounded-lg cursor-pointer ${activeTab === "erd" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Schema ERD Canvas
            </button>
            <button
              onClick={() => setActiveTab("optimizer")}
              className={`flex-1 py-1.5 rounded-lg cursor-pointer ${activeTab === "optimizer" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              SQL Tuning
            </button>
          </>
        )}
        {isConcept && (
          <>
            <button
              onClick={() => setActiveTab("enhancer")}
              className={`flex-1 py-1.5 rounded-lg cursor-pointer ${activeTab === "enhancer" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Notes Enhancer Chat
            </button>
            <button
              onClick={() => setActiveTab("analogy")}
              className={`flex-1 py-1.5 rounded-lg cursor-pointer ${activeTab === "analogy" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Analogy Explainer
            </button>
          </>
        )}
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3 bg-hard-bg/50 border border-hard/30 text-hard text-xs rounded-xl flex items-start gap-2 animate-in slide-in-from-top-1">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* --- DSA: Socratic Hint Chat --- */}
      {isDsa && activeTab === "hint" && (
        <div className="flex flex-col gap-3">
          <div className="h-64 border border-border rounded-xl bg-background/50 overflow-y-auto p-3 flex flex-col gap-3">
            {dsaChatHistory.length === 0 && (
              <div className="my-auto text-center text-xs text-muted-foreground px-4">
                <MessageSquare className="w-6 h-6 mx-auto mb-1.5 opacity-40 text-yellow-500" />
                Ask a question about the algorithm or search approach. I will guide you with hints instead of just writing the code!
              </div>
            )}
            {dsaChatHistory.map((msg, idx) => (
              <div key={idx} className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}>
                <div className={`p-2.5 rounded-xl text-xs leading-relaxed ${msg.role === "user" ? "bg-yellow-600/90 text-white rounded-br-none" : "bg-muted text-foreground rounded-bl-none"}`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {loadingAction === "dsa_hint" && (
              <div className="flex mr-auto items-center gap-1.5 bg-muted p-2 rounded-xl text-xs text-muted-foreground rounded-bl-none animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Tutor is typing...
              </div>
            )}
            <div ref={dsaChatBottomRef} />
          </div>

          <div className="flex gap-1.5 shrink-0">
            <input
              type="text"
              value={dsaChatInput}
              onChange={(e) => setDsaChatInput(e.target.value)}
              placeholder="e.g. How can I optimize the space complexity here?"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleStudyToolAction("dsa_hint");
              }}
              className="flex-1 px-3 py-1.5 bg-background text-foreground text-xs rounded-xl border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              size="sm"
              disabled={loading || !dsaChatInput.trim()}
              onClick={() => handleStudyToolAction("dsa_hint")}
              className="h-8 rounded-xl px-3 text-xs bg-yellow-600 hover:bg-yellow-600/90 text-white font-semibold cursor-pointer"
            >
              Ask
            </Button>
          </div>
        </div>
      )}

      {/* --- DSA: Edge Cases --- */}
      {isDsa && activeTab === "edgecases" && (
        <div className="flex flex-col gap-3">
          <Button
            size="sm"
            disabled={loading}
            onClick={() => handleStudyToolAction("dsa_edge_cases")}
            className="w-full bg-yellow-600 hover:bg-yellow-600/90 text-white font-semibold h-9 rounded-xl text-xs cursor-pointer"
          >
            {loadingAction === "dsa_edge_cases" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Lightbulb className="w-4 h-4 mr-1" />}
            {dsaEdgeCases ? "Regenerate Edge Cases" : "Generate Edge Cases"}
          </Button>

          {dsaEdgeCases && (
            <div className="flex flex-col gap-2.5 border border-border rounded-xl p-3 bg-background/50 max-h-60 overflow-y-auto relative">
              <div className="flex justify-end shrink-0 border-b border-border/40 pb-1.5">
                <button
                  onClick={() => copyText(dsaEdgeCases, setCopiedEdgeCases)}
                  className="p-1 rounded bg-muted/40 hover:bg-muted text-slate-400 hover:text-foreground transition-all flex items-center gap-1 text-[9px] font-bold cursor-pointer"
                >
                  {copiedEdgeCases ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedEdgeCases ? "Copied" : "Copy Edge Cases"}
                </button>
              </div>
              <pre className="text-xs text-foreground/90 font-sans leading-relaxed whitespace-pre-wrap text-left select-text">
                {dsaEdgeCases}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* --- SQL: Alternative Solutions accordion --- */}
      {isSql && activeTab === "alternatives" && (
        <div className="flex flex-col gap-3">
          <Button
            size="sm"
            disabled={loading}
            onClick={() => handleStudyToolAction("sql_alternatives")}
            className="w-full bg-emerald-600 hover:bg-emerald-600/90 text-white font-semibold h-9 rounded-xl text-xs cursor-pointer"
          >
            {loadingAction === "sql_alternatives" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            {sqlAlternatives.length > 0 ? "Refresh Alternative Queries" : "Find Alternative Solutions"}
          </Button>

          {sqlAlternatives.length > 0 && (
            <div className="flex flex-col gap-2">
              {sqlAlternatives.map((sol, idx) => {
                const isExpanded = expandedSolutionIdx === idx;
                return (
                  <div key={idx} className="border border-border rounded-xl bg-background/40 overflow-hidden">
                    <button
                      onClick={() => setExpandedSolutionIdx(isExpanded ? null : idx)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/30 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                        {sol.title}
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>

                    {isExpanded && (
                      <div className="p-3 border-t border-border bg-background/20 space-y-3">
                        <div className="relative rounded-lg overflow-hidden border border-border bg-[#1e1e2f] p-3 text-left">
                          <button
                            onClick={() => copyText(sol.code, (v) => setCopiedSqlIdx(v ? idx : null))}
                            className="absolute top-2 right-2 p-1 rounded bg-muted/60 hover:bg-muted text-slate-400 hover:text-foreground transition-all flex items-center gap-1 text-[9px] font-bold cursor-pointer"
                          >
                            {copiedSqlIdx === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            {copiedSqlIdx === idx ? "Copied" : "1-Click Copy"}
                          </button>
                          <pre className="font-mono text-[11px] text-emerald-300 leading-relaxed overflow-x-auto pt-4 selectable">
                            {sol.code}
                          </pre>
                        </div>
                        <div className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap select-text">
                          <p>{sol.explanation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- SQL: Schema ERD Canvas --- */}
      {isSql && activeTab === "erd" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 pb-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase">Relational Schema Diagram</span>
            <Button
              size="sm"
              disabled={loading}
              onClick={() => handleStudyToolAction("sql_erd")}
              className="h-7 px-3 text-[10px] bg-emerald-600 hover:bg-emerald-600/90 text-white font-semibold rounded-lg cursor-pointer"
            >
              {loadingAction === "sql_erd" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
              Generate Table ERD from AI
            </Button>
          </div>

          <div className="h-[400px] border border-border rounded-xl overflow-hidden bg-background">
            <SystemDesignCanvas
              value={currentErdCanvasVal}
              onChange={(val) => onUpdateCard({
                metadata: {
                  ...card.metadata,
                  sqlErdCanvas: val
                }
              })}
            />
          </div>
        </div>
      )}

      {/* --- SQL: Tuning/Optimizer --- */}
      {isSql && activeTab === "optimizer" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Paste query to tune</label>
            <textarea
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="e.g. SELECT * FROM Users WHERE active = 1 GROUP BY..."
              rows={4}
              disabled={loading}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono resize-none"
            />
          </div>

          <Button
            size="sm"
            disabled={loading || !userQuery.trim()}
            onClick={() => handleStudyToolAction("sql_optimize")}
            className="w-full bg-emerald-600 hover:bg-emerald-600/90 text-white font-semibold h-9 rounded-xl text-xs cursor-pointer"
          >
            {loadingAction === "sql_optimize" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Database className="w-4 h-4 mr-1" />}
            Analyze SQL Query Performance
          </Button>

          {optimizedReport && (
            <div className="flex flex-col gap-2.5 border border-border rounded-xl p-3 bg-background/50 max-h-60 overflow-y-auto relative text-left">
              <div className="flex justify-end shrink-0 border-b border-border/40 pb-1.5">
                <button
                  onClick={() => copyText(optimizedReport, setCopiedOptimizer)}
                  className="p-1 rounded bg-muted/40 hover:bg-muted text-slate-400 hover:text-foreground transition-all flex items-center gap-1 text-[9px] font-bold cursor-pointer"
                >
                  {copiedOptimizer ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedOptimizer ? "Copied" : "Copy Tuning Report"}
                </button>
              </div>
              <pre className="text-xs text-foreground/90 font-sans leading-relaxed whitespace-pre-wrap text-left select-text">
                {optimizedReport}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* --- CS Core: Notes Enhancer Chat --- */}
      {isConcept && activeTab === "enhancer" && (
        <div className="flex flex-col gap-3">
          <div className="h-64 border border-border rounded-xl bg-background/50 overflow-y-auto p-3 flex flex-col gap-3">
            {conceptChatHistory.length === 0 && (
              <div className="my-auto text-center text-xs text-muted-foreground px-4">
                <MessageSquare className="w-6 h-6 mx-auto mb-1.5 opacity-40 text-purple-400" />
                No messages yet. Ask me to refine, clarify, structure, or inject code/diagram examples into your notes.
              </div>
            )}
            {conceptChatHistory.map((msg, idx) => (
              <div key={idx} className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}>
                <div className={`p-2.5 rounded-xl text-xs leading-relaxed ${msg.role === "user" ? "bg-purple-600 text-white rounded-br-none" : "bg-muted text-foreground rounded-bl-none"}`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
                
                {msg.notesProposal && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onNotesGenerated(msg.notesProposal!)}
                      className="h-6 px-2 text-[9px] font-bold rounded-lg border-purple-500/30 text-purple-400 hover:bg-purple-500/10 cursor-pointer"
                    >
                      Apply Suggestions to Editor
                    </Button>
                    <button
                      onClick={() => copyText(msg.notesProposal!, () => {})}
                      className="h-6 px-2 bg-muted/40 hover:bg-muted text-slate-400 hover:text-foreground transition-all flex items-center gap-1 text-[9px] font-bold rounded-lg border border-border cursor-pointer"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      1-Click Copy
                    </button>
                  </div>
                )}
              </div>
            ))}
            {loadingAction === "notes_enhancer" && (
              <div className="flex mr-auto items-center gap-1.5 bg-muted p-2 rounded-xl text-xs text-muted-foreground rounded-bl-none animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Thinking...
              </div>
            )}
            <div ref={conceptChatBottomRef} />
          </div>

          <div className="flex gap-1.5 shrink-0">
            <input
              type="text"
              value={conceptChatInput}
              onChange={(e) => setConceptChatInput(e.target.value)}
              placeholder="e.g. Make these notes presentable, add headings and a Python dictionary example..."
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleStudyToolAction("notes_enhancer");
              }}
              className="flex-1 px-3 py-1.5 bg-background text-foreground text-xs rounded-xl border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              size="sm"
              disabled={loading || !conceptChatInput.trim()}
              onClick={() => handleStudyToolAction("notes_enhancer")}
              className="h-8 rounded-xl px-3 text-xs bg-purple-600 hover:bg-purple-600/90 text-white font-semibold cursor-pointer"
            >
              Send
            </Button>
          </div>
        </div>
      )}

      {/* --- CS Core: Analogy Explainer --- */}
      {isConcept && activeTab === "analogy" && (
        <div className="flex flex-col gap-3">
          <Button
            size="sm"
            disabled={loading}
            onClick={() => handleStudyToolAction("concept_analogy")}
            className="w-full bg-purple-600 hover:bg-purple-600/90 text-white font-semibold h-9 rounded-xl text-xs cursor-pointer"
          >
            {loadingAction === "concept_analogy" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <BookOpen className="w-4 h-4 mr-1" />}
            {analogyText ? "Regenerate Analogy" : "Explain with Analogy"}
          </Button>

          {analogyText && (
            <div className="flex flex-col gap-2.5 border border-border rounded-xl p-3 bg-background/50 max-h-60 overflow-y-auto relative text-left">
              <div className="flex justify-end shrink-0 border-b border-border/40 pb-1.5">
                <button
                  onClick={() => copyText(analogyText, setCopiedAnalogy)}
                  className="p-1 rounded bg-muted/40 hover:bg-muted text-slate-400 hover:text-foreground transition-all flex items-center gap-1 text-[9px] font-bold cursor-pointer"
                >
                  {copiedAnalogy ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedAnalogy ? "Copied" : "Copy Analogy"}
                </button>
              </div>
              <pre className="text-xs text-foreground/90 font-sans leading-relaxed whitespace-pre-wrap text-left select-text">
                {analogyText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
