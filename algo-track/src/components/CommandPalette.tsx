import { useState, useEffect } from "react";
import { Command } from "cmdk";
import { Search, Terminal, Moon, Sun, ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Flashcard } from "@/data";

export function CommandPalette({ cards }: { cards?: Flashcard[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/50 backdrop-blur-sm flex items-start justify-center pt-[15vh]">
      <div className="w-full max-w-xl mx-4 bg-card/90 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <Command
          className="w-full flex flex-col"
          loop
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="flex items-center border-b border-border/50 px-4">
            <Search className="w-5 h-5 text-muted-foreground mr-2 shrink-0" />
            <Command.Input
              autoFocus
              className="w-full bg-transparent text-foreground h-14 outline-none placeholder:text-muted-foreground/60 text-lg"
              placeholder="Search cards, features, or commands..."
            />
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-full hover:bg-muted/50 text-muted-foreground transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-muted">
            <Command.Empty className="p-4 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group heading="Quick Actions" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Command.Item
                onSelect={() => {
                  setOpen(false);
                  const evt = new CustomEvent("start-sprint");
                  window.dispatchEvent(evt);
                }}
                className="flex items-center gap-2 px-3 py-3 rounded-xl hover:bg-primary/10 hover:text-primary cursor-pointer text-sm font-medium transition-colors"
              >
                <Terminal className="w-4 h-4" /> Start Sprint Review
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setOpen(false);
                  document.documentElement.classList.toggle('dark');
                }}
                className="flex items-center gap-2 px-3 py-3 rounded-xl hover:bg-primary/10 hover:text-primary cursor-pointer text-sm font-medium transition-colors"
              >
                <Moon className="w-4 h-4" /> Toggle Dark/Light Mode
              </Command.Item>
            </Command.Group>

            {cards && cards.length > 0 && (
              <Command.Group heading="Jump to Card" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">
                {cards.slice(0, 10).map((card) => (
                  <Command.Item
                    key={card.id}
                    value={card.title}
                    onSelect={() => {
                      setOpen(false);
                      // Dispatch event to select card in dashboard
                      const evt = new CustomEvent("select-card", { detail: card.id });
                      window.dispatchEvent(evt);
                    }}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/50 cursor-pointer text-sm font-medium transition-colors group"
                  >
                    <span className="truncate mr-4 text-foreground/90">{card.title}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
