'use client';

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageSquare,
  Send,
  Loader2,
  Trash2,
  Plus,
  Bot,
  User as UserIcon,
  ChevronLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { ChatThread, ChatMessage, ChatMode } from "@/types";
import {
  fetchChatThreads,
  fetchChatMessages,
  createChatThread,
  sendChatMessage,
  deleteChatThread,
} from "@/lib/client-api";

const MODES: { value: ChatMode; label: string; description: string }[] = [
  {
    value: "debug_logic",
    label: "Debug Logic",
    description: "Help me debug an algorithm without giving me the code.",
  },
  {
    value: "system_design_review",
    label: "System Design Review",
    description: "Challenge my architecture blocks and tradeoffs.",
  },
  {
    value: "theory_cross_question",
    label: "Theory Cross-Questioning",
    description: "Rapid-fire questions to test my core CS knowledge.",
  },
  {
    value: "interviewer_mode",
    label: "Strict Interviewer",
    description: "Mock technical interview with complexity tracking.",
  },
];

export function CoachChat() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load threads
  useEffect(() => {
    loadThreads();
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isSending]);

  const loadThreads = async () => {
    try {
      setIsLoadingThreads(true);
      const res = await fetchChatThreads();
      setThreads(res.threads);
    } catch (err) {
      console.error("Failed to load threads", err);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  const loadThreadMessages = async (thread: ChatThread) => {
    try {
      setIsLoadingMessages(true);
      setActiveThread(thread);
      const res = await fetchChatMessages(thread.id);
      setMessages(res.messages);
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleStartThread = async (mode: ChatMode) => {
    try {
      setIsSending(true);
      const title = `Session: ${MODES.find(m => m.value === mode)?.label || mode}`;
      const res = await createChatThread(mode, title);
      
      setThreads(prev => [res.thread, ...prev]);
      setActiveThread(res.thread);
      setMessages(res.messages);
    } catch (err) {
      console.error("Failed to start thread", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !activeThread || isSending) return;

    const content = inputValue.trim();
    setInputValue("");
    
    // Optimistic UI update for user message
    const tempUserMsg: ChatMessage = {
      id: "temp-" + Date.now(),
      threadId: activeThread.id,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setIsSending(true);

    try {
      const res = await sendChatMessage(activeThread.id, content, activeThread.mode);
      // Replace temp message with real ones
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMsg.id),
        res.userMessage,
        res.assistantMessage,
      ]);
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    if (!confirm("Are you sure you want to delete this chat session?")) return;
    try {
      await deleteChatThread(threadId);
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (activeThread?.id === threadId) {
        setActiveThread(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to delete thread", err);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 h-[calc(100vh-4rem)]">
      <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Socratic Coach</h2>
              <p className="text-xs text-muted-foreground">
                AI mentor that questions and guides — but won't do the work for you.
              </p>
            </div>
          </div>
          {activeThread && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveThread(null)}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Threads</span>
            </Button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden relative">
          
          <AnimatePresence mode="wait">
            {!activeThread ? (
              // ── THREAD LIST & MODE SELECTOR ──
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full h-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border"
              >
                {/* Mode Selector (Left Pane) */}
                <div className="w-full md:w-1/2 p-6 flex flex-col gap-4 overflow-y-auto">
                  <h3 className="font-semibold text-foreground">Start New Session</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {MODES.map((mode) => (
                      <button
                        key={mode.value}
                        onClick={() => handleStartThread(mode.value)}
                        disabled={isSending}
                        className="text-left p-4 rounded-xl border border-border bg-muted/10 hover:bg-muted/30 hover:border-blue-500/30 transition-all flex flex-col gap-1 group"
                      >
                        <span className="font-medium text-blue-500 group-hover:text-blue-400">
                          {mode.label}
                        </span>
                        <span className="text-xs text-muted-foreground leading-relaxed">
                          {mode.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* History (Right Pane) */}
                <div className="w-full md:w-1/2 p-6 flex flex-col gap-4 overflow-y-auto">
                  <h3 className="font-semibold text-foreground">Previous Sessions</h3>
                  {isLoadingThreads ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : threads.length === 0 ? (
                    <div className="text-center p-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                      No past chat sessions found.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {threads.map((thread) => (
                        <div
                          key={thread.id}
                          className="group flex gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/20 cursor-pointer transition-all"
                          onClick={() => loadThreadMessages(thread)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium text-sm truncate pr-2">
                                {thread.title}
                              </p>
                              <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                                {thread.mode.replace(/_/g, " ")}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(thread.updatedAt).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-500/10 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteThread(thread.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              // ── CHAT INTERFACE ──
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="w-full h-full flex flex-col pt-2"
              >
                {/* Active Mode Banner */}
                <div className="px-6 pb-2">
                  <div className="py-2 px-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs font-medium text-blue-500 flex items-center gap-2">
                    <Bot className="w-3.5 h-3.5" />
                    Mode: {MODES.find(m => m.value === activeThread.mode)?.label || activeThread.mode}
                  </div>
                </div>

                {/* Messages list */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                  {isLoadingMessages ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      // Do not render system messages
                      if (msg.role === "system") return null;
                      
                      const isUser = msg.role === "user";
                      return (
                        <div
                          key={msg.id || idx}
                          className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}
                        >
                          <div
                            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border
                              ${isUser 
                                ? "bg-blue-500/10 border-blue-500/20 text-blue-500" 
                                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                              }`}
                          >
                            {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                          </div>
                          <div
                            className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap
                              ${isUser
                                ? "bg-blue-500/10 text-foreground border border-blue-500/10 rounded-tr-sm"
                                : "bg-muted/40 text-foreground border border-border rounded-tl-sm"
                              }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {isSending && (
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                      <div className="max-w-[80%] rounded-2xl p-4 rounded-tl-sm bg-muted/40 border border-border flex items-center max-h-[52px]">
                        <span className="flex gap-1.5 opacity-50">
                          <span className="w-1.5 h-1.5 bg-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 bg-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 bg-foreground rounded-full animate-bounce" />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="p-4 bg-background border-t border-border">
                  <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto flex items-end gap-2">
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type your message... (Shift+Enter for new line)"
                      className="flex-1 max-h-48 min-h-[56px] w-full resize-none rounded-xl border border-input bg-background px-4 py-4 pr-12 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 custom-scrollbar"
                      rows={1}
                      disabled={isSending}
                    />
                    <Button
                      type="submit"
                      disabled={!inputValue.trim() || isSending}
                      size="icon"
                      className="absolute right-3 bottom-2.5 h-9 w-9 bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
