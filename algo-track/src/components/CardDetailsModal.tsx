import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MarkdownContent } from "@/components/MarkdownContent";
import type { Flashcard } from "@/data";
import { updateCard, deleteCard } from "@/lib/client-api";
import { getStoredAiReview } from "@/components/CodePractice";
import type { StoredAiReview } from "@/components/CodePractice";
import { X, ExternalLink, FileText, BookOpen, Plus, Loader2, Trash2, Link2, Brain, Check } from "lucide-react";
import { motion } from "motion/react";
import { useState, useEffect } from "react";

interface CardDetailsModalProps {
  card: Flashcard | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CardDetailsModal({
  card,
  onClose,
  onSaved,
}: CardDetailsModalProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [aiReview, setAiReview] = useState<StoredAiReview | null>(null);

  useEffect(() => {
    if (card) {
      setTags(card.tags);
      setNotes(card.notes);
      setAiReview(getStoredAiReview(card.id));
    }
  }, [card]);

  if (!card) return null;

  const solutionBlocks =
    card.solutions && card.solutions.length > 0
      ? card.solutions
      : card.solution
        ? [{ name: "Solution", content: card.solution }]
        : [];

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTag.trim()) {
      if (!tags.includes(newTag.trim())) {
        setTags([...tags, newTag.trim()]);
      }
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCard(card.id, { notes, tags });
      onSaved();
    } catch (err) {
      console.error("Failed to save card:", err);
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!card) return;
    const confirmed = window.confirm(
      `Delete "${card.title}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteCard(card.id);
      onSaved();
    } catch (err) {
      console.error("Failed to delete card:", err);
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-card rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-border"
      >
        {/* Header */}
        <div className="p-6 border-b border-border flex flex-col gap-4 bg-muted/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={card.difficulty}
                  className="capitalize bg-transparent border-current text-current"
                >
                  {card.difficulty}
                </Badge>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  {card.type === "leetcode" ? "DSA" : "CS Core"}
                </span>
                {card.timeComplexity && (
                  <Badge variant="tag" className="bg-transparent border-tag/30 text-tag">
                    Time: {card.timeComplexity}
                  </Badge>
                )}
                {card.spaceComplexity && (
                  <Badge variant="tag" className="bg-transparent border-tag/30 text-tag">
                    Space: {card.spaceComplexity}
                  </Badge>
                )}
              </div>
              <h2 className="text-2xl font-bold text-foreground leading-tight">
                {card.title}
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full shrink-0 hover:bg-muted"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="tag"
                  className="bg-transparent border-tag/30 text-tag font-normal flex items-center gap-1 pl-2 pr-1.5 py-0.5"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:bg-tag/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <div className="flex items-center gap-1 bg-muted/30 border border-dashed border-border rounded-full px-2 py-0.5 focus-within:border-primary focus-within:bg-background transition-colors">
                <Plus className="w-3 h-3 text-muted-foreground" />
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Add tag..."
                  className="text-xs bg-transparent border-none focus:outline-none w-16 focus:w-24 transition-all text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
            {card.url && (
              <a
                href={card.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors"
              >
                View Problem <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              Description
            </h3>
            <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap bg-muted/30 p-4 rounded-xl border border-border/50 selectable">
              <MarkdownContent content={card.description} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Custom Notes
            </h3>
            <textarea
              className="w-full min-h-30 text-sm text-foreground/90 leading-relaxed p-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y transition-shadow selectable"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your personal notes, intuitions, or mnemonics here..."
            />
            {notes.trim() && (
              <div className="p-4 rounded-xl border border-border bg-muted/20">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Markdown Preview
                </h4>
                <MarkdownContent content={notes} />
              </div>
            )}
          </section>

          {solutionBlocks.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
                Solutions
              </h3>
              <div className="flex flex-col gap-3">
                {solutionBlocks.map((solution, index) => (
                  <div
                    key={`${solution.name}-${index}`}
                    className="w-full p-4 rounded-xl border border-border bg-muted/40"
                  >
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {solution.name}
                    </h4>
                    <MarkdownContent content={solution.content} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* AI Review */}
          {aiReview && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
                <Brain className="w-4 h-4 text-purple-500" />
                AI Review
                <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground ml-auto">
                  {new Date(aiReview.timestamp).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </h3>
              <div className={`rounded-xl border overflow-hidden ${aiReview.result.isCorrect
                  ? "border-emerald-500/20"
                  : "border-red-500/20"
                }`}>
                <div className={`px-4 py-2.5 flex items-center gap-2 ${aiReview.result.isCorrect
                    ? "bg-emerald-500/10"
                    : "bg-red-500/10"
                  }`}>
                  {aiReview.result.isCorrect ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <X className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-xs font-bold ${aiReview.result.isCorrect ? "text-emerald-500" : "text-red-500"
                    }`}>
                    {aiReview.result.isCorrect ? "Correct" : "Needs Improvement"}
                  </span>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${aiReview.result.suggestedRating === "EASY" ? "bg-emerald-500 text-white" :
                      aiReview.result.suggestedRating === "GOOD" ? "bg-blue-500 text-white" :
                        aiReview.result.suggestedRating === "HARD" ? "bg-orange-500 text-white" :
                          "bg-red-500 text-white"
                    }`}>
                    {aiReview.result.suggestedRating}
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="text-sm text-foreground/90 leading-relaxed">
                    <MarkdownContent content={aiReview.result.feedback} />
                  </div>

                  {aiReview.result.complexityAnalysis && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Your Complexity</p>
                        <p className="text-xs font-mono font-semibold text-foreground">Time: {aiReview.result.complexityAnalysis.userTime}</p>
                        <p className="text-xs font-mono font-semibold text-foreground">Space: {aiReview.result.complexityAnalysis.userSpace}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Optimal</p>
                        <p className="text-xs font-mono font-semibold text-foreground">Time: {aiReview.result.complexityAnalysis.optimalTime}</p>
                        <p className="text-xs font-mono font-semibold text-foreground">Space: {aiReview.result.complexityAnalysis.optimalSpace}</p>
                      </div>
                    </div>
                  )}

                  {aiReview.result.conceptCoverage && (
                    <div className="space-y-1.5">
                      {aiReview.result.conceptCoverage.coveredPoints.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-0.5">✓ Covered</p>
                          <ul className="text-xs text-foreground/80 space-y-0.5 ml-3">
                            {aiReview.result.conceptCoverage.coveredPoints.map((p, i) => (
                              <li key={i} className="list-disc">{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiReview.result.conceptCoverage.missedPoints.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-0.5">✗ Missed</p>
                          <ul className="text-xs text-foreground/80 space-y-0.5 ml-3">
                            {aiReview.result.conceptCoverage.missedPoints.map((p, i) => (
                              <li key={i} className="list-disc">{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {aiReview.userCode && (
                    <details className="text-xs">
                      <summary className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors font-medium">Your submitted code</summary>
                      <pre className="mt-2 p-3 rounded-lg bg-muted/50 border border-border/50 text-foreground/80 font-mono whitespace-pre-wrap overflow-x-auto">{aiReview.userCode}</pre>
                    </details>
                  )}
                </div>
              </div>
            </section>
          )}

          {(card.relatedProblems?.length ?? 0) > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
                <Link2 className="w-4 h-4 text-muted-foreground" />
                Related Problems
              </h3>
              <div className="flex flex-col gap-2">
                {card.relatedProblems?.map((problem, index) => (
                  <div
                    key={`${problem.title}-${index}`}
                    className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-foreground">{problem.title}</span>
                    {problem.url ? (
                      <a
                        href={problem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-600"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">No link</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/10">
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground flex items-center gap-4">
              <span>
                Last reviewed:{" "}
                <strong className="text-foreground">{card.lastReview}</strong>
              </span>
              <span>
                Next review:{" "}
                <strong className="text-foreground">{card.nextReview}</strong>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
              className="text-hard hover:text-hard hover:bg-hard-bg gap-1.5 rounded-full px-4"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || isDeleting}
              className="rounded-full px-6 font-semibold gap-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? "Saving..." : "Save & Close"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
