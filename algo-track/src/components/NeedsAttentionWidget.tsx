import { useMemo, useState } from "react";
import { AlertTriangle, Clock, ChevronRight } from "lucide-react";
import type { Flashcard } from "@/data";

interface Props {
  cards: Flashcard[];
  onSelectCard: (card: Flashcard) => void;
}

export function NeedsAttentionWidget({ cards, onSelectCard }: Props) {
  const [tab, setTab] = useState<"hitlist" | "mistakes">("hitlist");

  // The Hit List: Highest ratio of 'again' / 'total'
  const hitList = useMemo(() => {
    return [...cards]
      .filter(c => c.history.total > 0 && (c.history.total - c.history.good) > 0)
      .sort((a, b) => {
        const aAgain = a.history.total - a.history.good;
        const bAgain = b.history.total - b.history.good;
        const aRatio = aAgain / a.history.total;
        const bRatio = bAgain / b.history.total;
        return bRatio - aRatio;
      })
      .slice(0, 5);
  }, [cards]);

  // Recent Mistakes: lastRating === AGAIN or HARD, sorted by lastReview desc
  const recentMistakes = useMemo(() => {
    return [...cards]
      .filter(c => c.lastRating === "AGAIN" || c.lastRating === "HARD")
      .sort((a, b) => {
        if (!a.lastReview) return 1;
        if (!b.lastReview) return -1;
        return new Date(b.lastReview).getTime() - new Date(a.lastReview).getTime();
      })
      .slice(0, 5);
  }, [cards]);

  const displayCards = tab === "hitlist" ? hitList : recentMistakes;

  if (hitList.length === 0 && recentMistakes.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-background p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tab === 'hitlist' ? 'bg-red-500/10' : 'bg-orange-500/10'}`}>
            {tab === "hitlist" ? (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            ) : (
              <Clock className="w-4 h-4 text-orange-500" />
            )}
          </div>
          <h3 className="text-sm font-semibold text-foreground">Needs Attention</h3>
        </div>
        <div className="flex bg-muted/50 p-1 rounded-lg">
          <button 
            onClick={() => setTab("hitlist")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${tab === "hitlist" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Hit List
          </button>
          <button 
            onClick={() => setTab("mistakes")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${tab === "mistakes" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Mistakes
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-2">
        {displayCards.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground italic">
            No cards found.
          </div>
        ) : (
          displayCards.map(card => (
            <button
              key={card.id}
              onClick={() => onSelectCard(card)}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/50 hover:border-primary/30 transition-all text-left group cursor-pointer"
            >
              <div className="flex flex-col gap-1 pr-4">
                <span className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                  {card.title}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {tab === "hitlist" 
                    ? `Failed ${card.history.total - card.history.good} of ${card.history.total} times`
                    : `Last rating: ${card.lastRating}`
                  }
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
