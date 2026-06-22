'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { Search, X, BookOpen, Code, Clock, CheckCircle2, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Flashcard } from "@/data";
import { isCardPaused } from "@/lib/card-utils";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
// import { searchCards } from "@/lib/client-api"; // Removed: global search disabled
import { extractTextFromRichNotes } from "@/lib/highlight";

interface GlobalSearchModalProps {
  cards: Flashcard[];
  onClose: () => void;
}

interface SearchMatch {
  card: Flashcard;
  field: "title" | "description" | "notes" | "solution" | "tags";
  snippet: { before: string; match: string; after: string } | null;
}

function getSnippet(text: string, query: string, maxLength = 120): { before: string; match: string; after: string } | null {
  if (!text || !query) return null;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return null;

  const start = Math.max(0, index - Math.floor(maxLength / 2));
  const end = Math.min(text.length, index + query.length + Math.floor(maxLength / 2));

  let before = text.substring(start, index);
  const match = text.substring(index, index + query.length);
  let after = text.substring(index + query.length, end);

  if (start > 0) before = "..." + before;
  if (end < text.length) after = after + "...";

  return { before, match, after };
}

function findMatchesInList(cards: Flashcard[], query: string): SearchMatch[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const results: SearchMatch[] = [];

  for (const card of cards) {
    if (card.title.toLowerCase().includes(q)) {
      results.push({ card, field: "title", snippet: null });
    } else if (card.tags.some(t => t.toLowerCase().includes(q))) {
      results.push({ card, field: "tags", snippet: null });
    } else if (card.description?.toLowerCase().includes(q)) {
      results.push({ card, field: "description", snippet: getSnippet(card.description, q) });
    } else if (card.notes?.toLowerCase().includes(q)) {
      results.push({ card, field: "notes", snippet: getSnippet(card.notes, q) });
    } else if (card.richNotes) {
      const plainRich = extractTextFromRichNotes(card.richNotes);
      if (plainRich.toLowerCase().includes(q)) {
        results.push({ card, field: "notes", snippet: getSnippet(plainRich, q) });
      }
    } else if (card.solution?.toLowerCase().includes(q)) {
      results.push({ card, field: "solution", snippet: getSnippet(card.solution, q) });
    } else {
      const allSolText = card.solutions?.map(s => s.content).join("\n") || "";
      if (allSolText.toLowerCase().includes(q)) {
        results.push({ card, field: "solution", snippet: getSnippet(allSolText, q) });
      }
    }
  }

  return results;
}

export function GlobalSearchModal({ cards, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);

  // Debounced API search when query changes
  // Client-side search using already-loaded cards
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const handler = setTimeout(() => {
      setSearchResults(cards);
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(handler);
  }, [query, cards]);

  // Extract snippets for the matching cards using client logic
  const matches = useMemo(() => {
    return findMatchesInList(searchResults, query);
  }, [searchResults, query]);

  // Handle keyboard navigation: arrows to select, enter to open, escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (matches.length > 0 ? (prev + 1) % matches.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (matches.length > 0 ? (prev - 1 + matches.length) % matches.length : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (matches.length > 0 && matches[selectedIndex]) {
          handleSelectCard(matches[selectedIndex].card);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [matches, selectedIndex, onClose]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelectCard = (card: Flashcard) => {
    onClose();
    // Dispatch custom select-card event with search query detail to trigger highlighted display in CardDetailsModal
    window.dispatchEvent(
      new CustomEvent("select-card", {
        detail: { id: card.id, searchQuery: query.trim() },
      })
    );
  };

  const getDifficultyColor = (diff: string) => {
    if (diff === "easy") return "text-[#00b8a3] bg-[#00b8a3]/10 border-[#00b8a3]/20";
    if (diff === "medium") return "text-[#ffc01e] bg-[#ffc01e]/10 border-[#ffc01e]/20";
    if (diff === "hard") return "text-[#ff375f] bg-[#ff375f]/10 border-[#ff375f]/20";
    return "text-muted-foreground bg-muted border-border";
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 pb-4 bg-black/60 backdrop-blur-md">
      <div 
        className="fixed inset-0 -z-10" 
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.98 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        ref={modalRef}
        className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Search Input Box */}
        <div className="flex items-center border-b border-border px-4 py-3 shrink-0 bg-muted/10">
          <Search className="w-5 h-5 text-muted-foreground mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards, notes, content, or solutions..."
            className="flex-1 bg-transparent border-none text-foreground outline-none text-base placeholder:text-muted-foreground/60 py-2"
          />
          {isLoading && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2 shrink-0" />
          )}
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-2 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[10px] bg-muted border border-border text-muted-foreground font-mono px-2 py-1 rounded shadow-sm hidden sm:inline-block shrink-0">
            ESC to close
          </span>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 select-none">
          {query.trim() === "" ? (
            <div className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
              <Search className="w-8 h-8 opacity-30 stroke-[1.5]" />
              <p className="font-medium">Type to search across titles, descriptions, notes, and solutions</p>
              <p className="text-xs opacity-60">Try searching for concepts like &quot;page fault&quot; or &quot;atomic&quot;</p>
            </div>
          ) : !isLoading && matches.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
              <X className="w-8 h-8 opacity-30 stroke-[1.5]" />
              <p className="font-medium">No cards or content found matching &quot;{query}&quot;</p>
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/40 mb-1 flex justify-between shrink-0">
                <span>Matching Cards ({matches.length})</span>
                <span className="hidden sm:inline">Use ↑↓ keys to navigate, ↵ to open</span>
              </div>
              {matches.map((match, idx) => {
                const isSelected = idx === selectedIndex;
                const { card, field, snippet } = match;

                // Determine Card Icon
                let StatusIcon = CheckCircle2;
                let statusColor = "text-emerald-500";
                if (card.metadata?.reference_only === true) {
                  StatusIcon = BookOpen;
                  statusColor = "text-cyan-500";
                } else if (isCardPaused(card)) {
                  StatusIcon = Pause;
                  statusColor = "text-muted-foreground";
                } else if (card.dueInDays <= 0) {
                  StatusIcon = Clock;
                  statusColor = "text-[#ffc01e]";
                }

                return (
                  <div
                    key={card.id}
                    onClick={() => handleSelectCard(card)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? "border-cyan-500 bg-cyan-500/5 shadow-md shadow-cyan-950/5 scale-[1.01]"
                        : "border-border/60 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 max-w-[75%]">
                        <StatusIcon className={`w-4 h-4 shrink-0 ${statusColor}`} />
                        <span className="font-semibold text-foreground text-sm truncate select-text">
                          {card.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-1.5 py-0.5 text-[9px] uppercase font-bold border rounded ${getDifficultyColor(card.difficulty)}`}>
                          {card.difficulty}
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                          {card.type === "leetcode" ? "DSA" : card.type === "sql" ? "SQL" : "CS Core"}
                        </span>
                      </div>
                    </div>

                    {/* Snippet Preview */}
                    {snippet ? (
                      <div className="text-xs text-muted-foreground bg-muted/20 border border-border/40 p-2.5 rounded-lg leading-relaxed select-text font-sans mt-0.5">
                        <span className="text-[9px] uppercase font-bold text-cyan-500/80 mr-1.5 block tracking-wide select-none">
                          Found in {field}
                        </span>
                        <span>{snippet.before}</span>
                        <mark className="bg-yellow-500/30 text-yellow-950 dark:bg-yellow-500/40 dark:text-yellow-100 font-semibold px-0.5 rounded border border-yellow-500/40">
                          {snippet.match}
                        </mark>
                        <span>{snippet.after}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground flex gap-1.5 items-center mt-0.5 select-text">
                        <span className="text-[9px] uppercase font-bold text-cyan-500/80 tracking-wide select-none">
                          Matched in {field === "title" ? "Title" : "Tags"}
                        </span>
                        {field === "tags" && (
                          <div className="flex gap-1 flex-wrap">
                            {card.tags.map(t => (
                              <span key={t} className="px-1 py-0.5 bg-muted rounded text-[10px] font-medium border border-border/40 select-none">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
