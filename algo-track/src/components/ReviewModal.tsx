import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Flashcard } from "@/data";
import { Play, Shuffle, Timer, Repeat, MoreHorizontal, MoreVertical } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ReviewModalProps {
  dueCards: Flashcard[];
  totalCards: Flashcard[];
  onClose: () => void;
  onStart: (mode: "standard" | "random-quiz" | "sprint" | "reverse") => void;
}

export function ReviewModal({
  dueCards,
  totalCards,
  onClose,
  onStart,
}: ReviewModalProps) {
  const [showOptions, setShowOptions] = useState(false);

  const queuedCards = useMemo(() => {
    const ratingPriority: Record<Flashcard["lastRating"], number> = {
      AGAIN: 0,
      HARD: 1,
      GOOD: 2,
      EASY: 3,
    };
    const difficultyPriority: Record<Flashcard["difficulty"], number> = {
      hard: 0,
      medium: 1,
      easy: 2,
    };

    return [...dueCards].sort((a, b) => {
      const ratingDiff =
        ratingPriority[a.lastRating] - ratingPriority[b.lastRating];
      if (ratingDiff !== 0) return ratingDiff;

      const difficultyDiff =
        difficultyPriority[a.difficulty] - difficultyPriority[b.difficulty];
      if (difficultyDiff !== 0) return difficultyDiff;

      return a.title.localeCompare(b.title);
    });
  }, [dueCards]);

  const displayCards = queuedCards.slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-card rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 md:p-8 flex flex-col gap-2 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">
            Ready to review?
          </h2>
          <p className="text-muted-foreground text-sm">
            {dueCards.length === 0
              ? "No cards are due right now. Check back later!"
              : `${dueCards.length} card${dueCards.length !== 1 ? "s" : ""} due today. Hard and recently failed cards are queued first.`}
          </p>
        </div>

        {dueCards.length > 0 && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Up Next</h3>
              <span className="text-xs text-muted-foreground">
                Showing {displayCards.length} of {queuedCards.length}
              </span>
            </div>

            <div className="flex flex-col gap-0 border border-border rounded-xl overflow-hidden">
              {displayCards.map((card, index) => (
                <div
                  key={card.id}
                  className={`p-4 flex flex-col gap-2 bg-card hover:bg-muted/30 transition-colors ${index !== displayCards.length - 1
                      ? "border-b border-border"
                      : ""
                    }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-medium text-foreground text-sm leading-tight">
                      {card.title}
                    </span>
                    <Badge
                      variant={card.difficulty}
                      className="capitalize bg-transparent border-current text-current shrink-0"
                    >
                      {card.difficulty}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {card.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="tag"
                        className="bg-transparent border-tag/30 text-tag font-normal text-[10px] px-2 py-0"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {queuedCards.length > 5 && (
              <div className="text-center mt-4">
                <span className="text-xs text-muted-foreground font-medium">
                  +{queuedCards.length - 5} more cards
                </span>
              </div>
            )}
          </div>
        )}

        <div className="p-4 sm:p-6 border-t border-border flex flex-wrap items-center justify-between gap-3 bg-muted/20 relative">
          <Button variant="ghost" onClick={onClose} className="font-semibold order-2 sm:order-1">
            Not now
          </Button>
          
          <div className="flex items-center gap-2 order-1 sm:order-2 ml-auto">
            {totalCards.length > 0 && (
              <div className="relative">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() => setShowOptions(!showOptions)}
                  title="More review options"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
                
                <AnimatePresence>
                  {showOptions && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute bottom-full right-0 mb-2 w-48 bg-card border border-border rounded-xl shadow-lg overflow-hidden flex flex-col py-1 z-50 origin-bottom-right"
                    >
                      {dueCards.length > 0 && (
                        <>
                          <button
                            onClick={() => { onStart("reverse"); setShowOptions(false); }}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted"
                          >
                            <Repeat className="w-4 h-4" />
                            Reverse
                          </button>
                          <button
                            onClick={() => { onStart("sprint"); setShowOptions(false); }}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted"
                          >
                            <Timer className="w-4 h-4" />
                            5-min Sprint
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => { onStart("random-quiz"); setShowOptions(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-muted"
                      >
                        <Shuffle className="w-4 h-4" />
                        Random Quiz
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {dueCards.length > 0 && (
              <Button
                onClick={() => onStart("standard")}
                className="gap-2 font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-full px-6"
              >
                <Play className="w-4 h-4 fill-current" />
                Start session
              </Button>
            )}
            
            {dueCards.length === 0 && (
               <Button
                variant="outline"
                onClick={() => { onStart("random-quiz"); setShowOptions(false); }}
                className="gap-2 font-semibold rounded-full px-6"
              >
                <Shuffle className="w-4 h-4" />
                Random Quiz
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
