import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MarkdownContent } from "@/components/MarkdownContent";

import type { Flashcard } from "@/data";
import { updateCard, deleteCard, pauseCardReview, resumeCardReview, fetchAllCards } from "@/lib/client-api";
import { canPauseCard, isCardPaused, pauseThreshold } from "@/lib/card-utils";
import { getStoredAiReview } from "@/components/CodePractice";
import type { StoredAiReview } from "@/components/CodePractice";
import { WhiteboardCanvas } from "@/components/WhiteboardCanvas";
import { RichNotesEditor } from "@/components/RichNotesEditor";
import { CodeEvolution } from "@/components/CodeEvolution";
import { X, ExternalLink, FileText, BookOpen, Plus, Loader2, Trash2, Link2, Brain, Check, Edit2, Pause, Play, Pencil, GripVertical, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useDragControls } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { useConfirmModal } from "@/components/ConfirmModal";
import { createPortal } from "react-dom";
import { AddCardForm, AddCardFormDefaults } from "./AddCardForm";

interface CardDetailsModalProps {
  card: Flashcard | null;
  allCards?: Flashcard[];
  onClose: () => void;
  onSaved: () => void;
}

export function CardDetailsModal({
  card,
  allCards: propAllCards,
  onClose,
  onSaved,
}: CardDetailsModalProps) {
  const dragControls = useDragControls();
  const backdropRef = useRef<HTMLDivElement>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [aiReview, setAiReview] = useState<StoredAiReview | null>(null);
  const [isPausing, setIsPausing] = useState(false);
  const [richNotes, setRichNotes] = useState<string | undefined>(undefined);
  const [isResuming, setIsResuming] = useState(false);
  const [showResumeOptions, setShowResumeOptions] = useState(false);
  const [modalCalendarMonth, setModalCalendarMonth] = useState(() => new Date());
  const [showModalCalendar, setShowModalCalendar] = useState(false);
  const modalCalendarBtnRef = useRef<HTMLButtonElement>(null);
  const [modalCalendarRect, setModalCalendarRect] = useState<DOMRect | null>(null);
  const [fetchedCards, setFetchedCards] = useState<Flashcard[]>([]);

  useEffect(() => {
    if (!propAllCards || propAllCards.length === 0) {
      fetchAllCards().then(setFetchedCards).catch(console.error);
    }
  }, [propAllCards]);

  const allCards = propAllCards && propAllCards.length > 0 ? propAllCards : fetchedCards;

  const isReference = card?.metadata?.reference_only === true;

  const handleAddToQueue = async (days: number) => {
    if (!card) return;
    setIsResuming(true);
    try {
      const { reference_only, ...restMetadata } = card.metadata || {};
      const nextDate = new Date();
      nextDate.setHours(0, 0, 0, 0);
      nextDate.setDate(nextDate.getDate() + days);

      await updateCard(card.id, {
        metadata: restMetadata,
        nextReview: nextDate.toISOString(),
        dueInDays: days
      });
      onSaved();
    } catch (err) {
      console.error("Failed to add card to review queue:", err);
    } finally {
      setIsResuming(false);
      setShowResumeOptions(false);
    }
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const nextModalCalendarMonth = () => setModalCalendarMonth(new Date(modalCalendarMonth.getFullYear(), modalCalendarMonth.getMonth() + 1, 1));
  const prevModalCalendarMonth = () => setModalCalendarMonth(new Date(modalCalendarMonth.getFullYear(), modalCalendarMonth.getMonth() - 1, 1));

  const renderModalCalendarDays = () => {
    const year = modalCalendarMonth.getFullYear();
    const month = modalCalendarMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cardsByDate = new Map<string, number>();
    allCards.forEach(c => {
      let d: Date;
      if (c.nextReview) {
        d = new Date(c.nextReview);
      } else {
        d = new Date();
        d.setDate(d.getDate() + (c.dueInDays || 0));
      }
      if (isNaN(d.getTime())) return;
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      cardsByDate.set(dStr, (cardsByDate.get(dStr) || 0) + 1);
    });

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-8 h-8" />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dueCount = cardsByDate.get(dateStr) || 0;
      const dayDate = new Date(year, month, d);
      dayDate.setHours(0, 0, 0, 0);

      const isPast = dayDate < today;
      const isToday = dayDate.getTime() === today.getTime();

      let workloadClass = "text-foreground hover:bg-muted";
      if (isPast) {
        workloadClass = "text-muted-foreground/30 cursor-not-allowed";
      } else if (dueCount > 0) {
        if (dueCount > 20) workloadClass = "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/30";
        else if (dueCount > 10) workloadClass = "bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 hover:bg-orange-500/30";
        else if (dueCount > 5) workloadClass = "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-500/30";
        else workloadClass = "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30";
      }

      if (isToday) {
        workloadClass += " ring-1 ring-primary ring-offset-1 ring-offset-background";
      }

      days.push(
        <button
          key={`day-${d}`}
          type="button"
          disabled={isPast}
          onClick={async () => {
            setShowModalCalendar(false);
            const diffTime = dayDate.getTime() - today.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            if (isReference) {
              await handleAddToQueue(diffDays);
            } else {
              await handleResume(diffDays);
            }
          }}
          className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center p-0 text-[10px] font-semibold transition-all relative cursor-pointer ${workloadClass}`}
        >
          <span>{d}</span>
          {!isPast && dueCount > 0 && (
            <span className="text-[7px] font-extrabold leading-none mt-[-1px] opacity-90">{dueCount}</span>
          )}
        </button>
      );
    }
    return days;
  };

  useEffect(() => {
    if (card) {
      setTags(card.tags);
      setNotes(card.notes);
      setRichNotes(card.richNotes);
      setReviewNote((card.metadata?.reviewNote as string) || "");
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
      await updateCard(card.id, { 
        notes, 
        richNotes,
        tags,
        metadata: { ...card.metadata, reviewNote }
      });
      onSaved();
    } catch (err) {
      console.error("Failed to save card:", err);
      setIsSaving(false);
    }
  };

  const { confirm } = useConfirmModal();

  const handleDelete = async () => {
    if (!card) return;
    const confirmed = await confirm({
      title: "Delete Card",
      message: `Delete "${card.title}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
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

  const handlePause = async () => {
    if (!card) return;
    setIsPausing(true);
    try {
      await pauseCardReview(card.id);
      onSaved();
    } catch (err) {
      console.error("Failed to pause card:", err);
      setIsPausing(false);
    }
  };

  const handleResume = async (days: number) => {
    if (!card) return;
    setIsResuming(true);
    try {
      await resumeCardReview(card.id, days);
      onSaved();
    } catch (err) {
      console.error("Failed to resume card:", err);
      setIsResuming(false);
      setShowResumeOptions(false);
    }
  };

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={backdropRef}
        dragElastic={0}
        dragMomentum={false}
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
                  {card.type === "leetcode" ? "DSA" : card.type === "sql" ? "SQL" : "CS Core"}
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
            <div className="flex items-center gap-2">
              <Button
                variant={isEditing ? "secondary" : "outline"}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="hidden sm:flex"
              >
                {isEditing ? (
                  "Cancel Edit"
                ) : (
                  <>
                    <Edit2 className="w-4 h-4 mr-2" /> Edit
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(!isEditing)}
                className="sm:hidden rounded-full hover:bg-muted"
              >
                {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full shrink-0 hover:bg-muted cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
                title="Drag to move"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <GripVertical className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full shrink-0 hover:bg-muted"
                title="Close"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
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
        {isEditing ? (
          <div className="flex-1 overflow-y-auto p-6">
            <AddCardForm
              cardType={card.type as any}
              mode="edit"
              cardId={card.id}
              submitLabel="Save Changes"
              onSubmitted={() => {
                setIsEditing(false);
                onSaved();
              }}
              defaults={{
                title: card.title,
                description: card.description,
                difficulty: card.difficulty,
                tags: card.tags?.join(", "),
                notes: card.notes,
                solutions: card.solutions || (card.solution ? [{ name: "Solution", content: card.solution }] : undefined),
                timeComplexity: card.timeComplexity || undefined,
                spaceComplexity: card.spaceComplexity || undefined,
                relatedProblems: card.relatedProblems?.map(p => p.url ? `${p.title} | ${p.url}` : p.title).join("\n"),
                url: card.url || undefined,
                metadata: card.metadata,
              }}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
            <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              Description
            </h3>
            <RichNotesEditor
              readOnly
              initialContent={card.description}
              fallbackMarkdown={card.description}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Rich Notes
            </h3>
            <RichNotesEditor
              initialContent={card.richNotes}
              fallbackMarkdown={card.notes}
              onChange={(content) => {
                setRichNotes(content);
              }}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-emerald-500" />
              Next Review Note
            </h3>
            <textarea
              className="w-full min-h-15 text-sm text-foreground/90 leading-relaxed p-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y transition-shadow selectable"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Add a small note to remember during the next review..."
            />
          </section>

          {solutionBlocks.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
                Solutions
              </h3>
              <div className="flex flex-col gap-3">
                {solutionBlocks.map((solution, index) => {
                  const hasCodeFences = /```[\w+-]*\n/.test(solution.content);
                  return (
                    <div
                      key={`${solution.name}-${index}`}
                      className="w-full p-4 rounded-xl border border-border bg-muted/40"
                    >
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {solution.name}
                      </h4>
                      {hasCodeFences ? (
                        <MarkdownContent content={solution.content} />
                      ) : (
                        <pre className="text-sm font-mono text-foreground/90 leading-relaxed whitespace-pre-wrap overflow-x-auto selectable">
                          {solution.content}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Whiteboard */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
              <Pencil className="w-4 h-4 text-teal-500" />
              Whiteboard
            </h3>
            <WhiteboardCanvas
              cardId={card.id}
              compact={false}
              className="w-full"
            />
          </section>

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

          {/* Code Evolution */}
          {(card.type === "leetcode" || card.type === "sql") && (
            <CodeEvolution cardId={card.id} cardTitle={card.title} />
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
        )}

        {/* Footer */}
        {!isEditing && (
        <div className="p-4 border-t border-border flex flex-col gap-3 bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground flex items-center gap-4">
                <span>
                  Last reviewed:{" "}
                  <strong className="text-foreground">{card.lastReview}</strong>
                </span>
                {isReference ? (
                  <span className="flex items-center gap-1 text-cyan-500">
                    <BookOpen className="w-3 h-3" />
                    <strong>Reference Card</strong>
                  </span>
                ) : isCardPaused(card) ? (
                  <span className="flex items-center gap-1 text-amber-500">
                    <Pause className="w-3 h-3" />
                    <strong>Reviews paused</strong>
                  </span>
                ) : (
                  <span>
                    Next review:{" "}
                    <strong className="text-foreground">{card.nextReview}</strong>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isReference ? (
                <Button
                  variant="ghost"
                  onClick={() => setShowResumeOptions(!showResumeOptions)}
                  disabled={isResuming}
                  className="text-cyan-500 hover:text-cyan-600 hover:bg-cyan-500/10 gap-1.5 rounded-full px-4"
                >
                  {isResuming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {isResuming ? "Processing..." : "Add to Review Queue"}
                </Button>
              ) : isCardPaused(card) ? (
                <Button
                  variant="ghost"
                  onClick={() => setShowResumeOptions(!showResumeOptions)}
                  disabled={isResuming}
                  className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 gap-1.5 rounded-full px-4"
                >
                  {isResuming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {isResuming ? "Resuming..." : "Resume Reviews"}
                </Button>
              ) : canPauseCard(card) ? (
                <Button
                  variant="ghost"
                  onClick={handlePause}
                  disabled={isPausing || isSaving || isDeleting}
                  className="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 gap-1.5 rounded-full px-4"
                >
                  {isPausing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                  {isPausing ? "Pausing..." : "Pause Reviews"}
                </Button>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  Pause available after {pauseThreshold(card)} reviews ({card.history.total}/{pauseThreshold(card)})
                </span>
              )}
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

          {/* Resume / Add to Queue options picker */}
          {showResumeOptions && (
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-muted/30 border border-border mt-3 select-none flex-wrap relative">
              <span className="text-xs font-semibold text-muted-foreground mr-2">
                {isReference ? "Add to review queue in:" : "Resume in:"}
              </span>
              {[
                { label: "Now", value: 0 },
                { label: "1 Day", value: 1 },
                { label: "3 Days", value: 3 },
                { label: "7 Days", value: 7 },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (isReference) {
                      await handleAddToQueue(opt.value);
                    } else {
                      await handleResume(opt.value);
                    }
                  }}
                  disabled={isResuming || isSaving}
                  className="rounded-full text-xs"
                >
                  {opt.label}
                </Button>
              ))}

              {/* Custom Date Picker */}
              <div className="relative inline-block">
                <Button
                  size="sm"
                  variant="outline"
                  ref={modalCalendarBtnRef}
                  onClick={() => {
                    if (modalCalendarBtnRef.current) {
                      setModalCalendarRect(modalCalendarBtnRef.current.getBoundingClientRect());
                    }
                    setShowModalCalendar(!showModalCalendar);
                  }}
                  disabled={isResuming || isSaving}
                  className="rounded-full text-xs gap-1"
                >
                  <CalendarIcon className="w-3 h-3" />
                  Custom Date
                </Button>
                {showModalCalendar && createPortal(
                  <>
                    <div 
                      className="fixed inset-0 z-[9998] cursor-default" 
                      onClick={() => setShowModalCalendar(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="fixed z-[9999] w-64 bg-card border border-border rounded-2xl shadow-2xl p-3 flex flex-col gap-2 cursor-default text-left"
                      style={modalCalendarRect ? (() => {
                        const CALENDAR_H = 340;
                        const spaceAbove = modalCalendarRect.top;
                        const placeAbove = spaceAbove >= CALENDAR_H + 8;
                        return {
                          top: placeAbove ? undefined : `${modalCalendarRect.bottom + 8}px`,
                          bottom: placeAbove ? `${window.innerHeight - modalCalendarRect.top + 8}px` : undefined,
                          left: `${Math.max(8, modalCalendarRect.left + modalCalendarRect.width / 2 - 128)}px`,
                        };
                      })() : undefined}
                    >
                      <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                        <button
                          type="button"
                          onClick={prevModalCalendarMonth}
                          className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold text-foreground">
                          {monthNames[modalCalendarMonth.getMonth()]} {modalCalendarMonth.getFullYear()}
                        </span>
                        <button
                          type="button"
                          onClick={nextModalCalendarMonth}
                          className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-muted-foreground uppercase">
                        {dayNames.map((dName, idx) => (
                          <div key={`dayname-${idx}`}>{dName}</div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-1">
                        {renderModalCalendarDays()}
                      </div>
                    </motion.div>
                  </>,
                  document.body
                )}
              </div>
            </div>
          )}
        </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}
