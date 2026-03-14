import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { ReviewResult } from "@/components/ReviewSession";
import { CheckCircle2, Clock, Heart, Zap, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
} as const;

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
} as const;

interface ReviewCompleteProps {
  results: ReviewResult[];
  durationMs: number;
  remainingDue: number;
  onBackToDashboard: () => void;
}

export function ReviewComplete({
  results,
  durationMs,
  remainingDue,
  onBackToDashboard,
}: ReviewCompleteProps) {
  const totalReviewed = results.length;
  const durationMin = Math.max(1, Math.round(durationMs / 60000));

  const ratingCounts = { AGAIN: 0, HARD: 0, GOOD: 0, EASY: 0 };
  for (const r of results) {
    ratingCounts[r.rating] += 1;
  }

  const goodPct =
    totalReviewed > 0
      ? Math.round(
        ((ratingCounts.GOOD + ratingCounts.EASY) / totalReviewed) * 100,
      )
      : 0;

  const motivationalMessage =
    goodPct >= 80
      ? "Outstanding session — your recall is rock-solid!"
      : goodPct >= 50
        ? "Solid review. Keep the consistency going!"
        : "Tough session, but showing up is what matters. You'll nail it next time.";

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-8 flex flex-col gap-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col gap-4"
      >
        <h1 className="text-3xl font-bold text-foreground">
          Review Session Complete
        </h1>
        <p className="text-muted-foreground">
          You reviewed {totalReviewed} card{totalReviewed !== 1 ? "s" : ""} in
          about {durationMin} min.{" "}
          {remainingDue === 0
            ? "Deck cleared for now — enjoy the win!"
            : `${remainingDue} card${remainingDue !== 1 ? "s" : ""} still due.`}
        </p>
      </motion.div>

      {/* Stats cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div
          variants={item}
          whileHover={{ y: -4, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Card className="p-6 flex flex-col items-center justify-center gap-2 text-center h-full shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Reviewed
            </div>
            <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {totalReviewed}
            </span>
          </Card>
        </motion.div>

        <motion.div
          variants={item}
          whileHover={{ y: -4, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Card className="p-6 flex flex-col items-center justify-center gap-2 text-center h-full shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              <Zap className="w-5 h-5 text-blue-500" />
              Success Rate
            </div>
            <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {goodPct}%
            </span>
          </Card>
        </motion.div>

        <motion.div
          variants={item}
          whileHover={{ y: -4, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Card className="p-6 flex flex-col items-center justify-center gap-2 text-center h-full shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              <Heart className="w-5 h-5 text-medium" />
              Remaining
            </div>
            <span className="text-3xl font-bold text-medium">
              {remainingDue}
            </span>
          </Card>
        </motion.div>

        <motion.div
          variants={item}
          whileHover={{ y: -4, scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Card className="p-6 flex flex-col items-center justify-center gap-2 text-center h-full shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              <Clock className="w-5 h-5 text-foreground" />
              Duration
            </div>
            <span className="text-3xl font-bold text-foreground">
              {durationMin} min
            </span>
          </Card>
        </motion.div>
      </motion.div>

      {/* Motivational message */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-4 text-emerald-800 dark:text-emerald-400 font-medium text-sm shadow-sm"
      >
        {motivationalMessage}
      </motion.div>

      {/* Rating distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <Card className="p-6 flex flex-col gap-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <span className="text-emerald-500">✨</span> Rating Distribution
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(
              [
                { key: "AGAIN", desc: "Needs revisit soon." },
                { key: "HARD", desc: "Worth another follow-up." },
                { key: "GOOD", desc: "Solid recall." },
                { key: "EASY", desc: "Nailed it." },
              ] as const
            ).map((r) => (
              <div
                key={r.key}
                className={`flex flex-col gap-1 p-4 rounded-lg border transition-colors ${ratingCounts[r.key] > 0
                    ? "border-border bg-background shadow-sm"
                    : "border-border bg-muted/20"
                  }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-bold text-muted-foreground text-sm">
                    {r.key}
                  </span>
                  <span className="font-bold text-foreground">
                    {ratingCounts[r.key]}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{r.desc}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Card breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Card breakdown</h3>
          <span className="text-xs text-muted-foreground">
            {totalReviewed} cards
          </span>
        </div>

        <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-card shadow-sm">
          {results.map((result, index) => (
            <div
              key={`${result.card.id}-${index}`}
              className={`p-4 flex items-center justify-between gap-4 transition-colors group ${index !== results.length - 1 ? "border-b border-border" : ""
                }`}
            >
              <div className="flex flex-col gap-2">
                <span className="font-medium text-foreground text-sm">
                  {result.card.title}
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={result.card.difficulty}
                    className="capitalize bg-transparent border-current text-current font-normal text-[10px] px-2 py-0"
                  >
                    {result.card.difficulty}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`text-xs font-bold ${result.rating === "EASY"
                      ? "text-easy"
                      : result.rating === "GOOD"
                        ? "text-blue-500"
                        : result.rating === "HARD"
                          ? "text-medium"
                          : "text-hard"
                    }`}
                >
                  {result.rating}
                </span>
                <span className="text-muted-foreground text-xs">
                  {Math.round(result.responseMs / 1000)}s
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Back to dashboard */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex justify-center pb-8"
      >
        <Button
          onClick={onBackToDashboard}
          variant="outline"
          className="gap-2 font-semibold rounded-full px-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>
      </motion.div>
    </div>
  );
}
