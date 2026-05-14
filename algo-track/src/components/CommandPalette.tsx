import { useState, useEffect, useMemo } from "react";
import { Command } from "cmdk";
import { Search, Terminal, Moon, ArrowRight, X, Play, LayoutGrid, Zap, Timer, Bug, ShuffleIcon, Network, Languages, FileJson, GraduationCap, Compass, Calendar } from "lucide-react";
import type { Flashcard } from "@/data";

export function CommandPalette({ cards }: { cards?: Flashcard[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const filteredCards = useMemo(() => {
    if (!cards) return [];
    if (query.trim() === "") return cards.slice(0, 5); // Show 5 default when empty
    const lower = query.toLowerCase();
    return cards.filter(c => 
      c.title.toLowerCase().includes(lower) || 
      c.tags?.some(t => t.toLowerCase().includes(lower))
    ).slice(0, 10);
  }, [cards, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/50 backdrop-blur-sm flex items-start justify-center pt-[15vh]">
      <div className="w-full max-w-2xl mx-4 bg-card/90 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <Command
          className="w-full flex flex-col"
          loop
          shouldFilter={false} // We handle filtering manually
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="flex items-center border-b border-border/50 px-4">
            <Search className="w-5 h-5 text-muted-foreground mr-2 shrink-0" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              className="w-full bg-transparent text-foreground h-14 outline-none placeholder:text-muted-foreground/60 text-lg"
              placeholder="Search problems, features, or commands..."
            />
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-full hover:bg-muted/50 text-muted-foreground transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-muted">
            {filteredCards.length === 0 && query.length > 0 && (
              <Command.Empty className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center">
                <Search className="w-8 h-8 opacity-20 mb-2" />
                No problems or features found for "{query}".
              </Command.Empty>
            )}

            {filteredCards.length > 0 && (
              <Command.Group heading="Jump to Problem" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {filteredCards.map((card) => (
                  <Command.Item
                    key={card.id}
                    value={`card-${card.id}`}
                    onSelect={() => {
                      setOpen(false);
                      const evt = new CustomEvent("select-card", { detail: card.id });
                      window.dispatchEvent(evt);
                    }}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/50 cursor-pointer text-sm font-medium transition-colors group mb-1"
                  >
                    <div className="flex flex-col gap-0.5 max-w-[70%]">
                      <span className="truncate text-foreground/90">{card.title}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-bold ${card.difficulty === 'easy' ? 'text-green-500' : card.difficulty === 'medium' ? 'text-yellow-500' : 'text-red-500'}`}>
                          {card.difficulty}
                        </span>
                        {card.tags && card.tags.length > 0 && (
                          <span className="text-[10px] text-muted-foreground truncate">{card.tags[0]}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          const evt = new CustomEvent("quick-review-card", { detail: card.id });
                          window.dispatchEvent(evt);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Quick Review
                      </button>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Navigate Features" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">
              <Command.Item
                onSelect={() => { setOpen(false); window.dispatchEvent(new CustomEvent("navigate", { detail: "training-hub" })); }}
                className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-cyan-500/10 hover:text-cyan-500 cursor-pointer text-sm font-medium transition-colors group mb-1"
              >
                <div className="flex items-center gap-3"><Compass className="w-4 h-4" /> Training Hub</div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Command.Item>
              <Command.Item
                onSelect={() => { setOpen(false); window.dispatchEvent(new CustomEvent("navigate", { detail: "calendar" })); }}
                className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-500 cursor-pointer text-sm font-medium transition-colors group mb-1"
              >
                <div className="flex items-center gap-3"><Calendar className="w-4 h-4" /> Time Travel Calendar</div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Command.Item>
              <Command.Item
                onSelect={() => { setOpen(false); window.dispatchEvent(new CustomEvent("navigate", { detail: "stress-mode" })); }}
                className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-red-500/10 hover:text-red-500 cursor-pointer text-sm font-medium transition-colors group mb-1"
              >
                <div className="flex items-center gap-3"><Zap className="w-4 h-4" /> Stress Drill</div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Command.Item>
              <Command.Item
                onSelect={() => { setOpen(false); window.dispatchEvent(new CustomEvent("navigate", { detail: "cram-mode" })); }}
                className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer text-sm font-medium transition-colors group mb-1"
              >
                <div className="flex items-center gap-3"><LayoutGrid className="w-4 h-4" /> Cram Mode</div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Quick Actions" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2 border-t border-border/50 pt-3">
              <Command.Item
                onSelect={() => { setOpen(false); window.dispatchEvent(new CustomEvent("start-sprint")); }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-primary/10 hover:text-primary cursor-pointer text-sm font-medium transition-colors"
              >
                <Terminal className="w-4 h-4" /> Start Sprint Review
              </Command.Item>
              <Command.Item
                onSelect={() => { setOpen(false); document.documentElement.classList.toggle('dark'); }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-primary/10 hover:text-primary cursor-pointer text-sm font-medium transition-colors"
              >
                <Moon className="w-4 h-4" /> Toggle Dark/Light Mode
              </Command.Item>
            </Command.Group>

          </Command.List>
        </Command>
      </div>
    </div>
  );
}
