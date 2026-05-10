import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { motion } from "motion/react";
import type { Flashcard } from "@/data";

interface MasteryHeatmapProps {
  cards: Flashcard[];
}

interface TopicData {
  name: string;
  mastery: number;
  cardCount: number;
  type: "pattern" | "cs";
}

const TARGET_INTERVAL_DAYS = 21;
const MIN_MASTERY_THRESHOLD = 5;

function getDifficultyWeight(diff: "easy" | "medium" | "hard") {
  if (diff === "hard") return 3;
  if (diff === "medium") return 2;
  return 1; // easy
}

export function MasteryHeatmap({ cards }: MasteryHeatmapProps) {
  const { patterns, cs } = useMemo(() => {
    const patternCards = cards.filter((c) => c.type === "leetcode");
    const csCards = cards.filter((c) => c.type === "cs");

    const calculateTopics = (topicCards: Flashcard[], isPattern: boolean) => {
      const map = new Map<
        string,
        { earned: number; maxPoints: number; count: number }
      >();

      for (const card of topicCards) {
        const tagsToUse = isPattern
          ? card.tags.filter((t) => !/^(Time|Space):/i.test(t))
          : card.tags.length > 0
            ? card.tags
            : [card.title];

        for (const tag of tagsToUse) {
          const existing = map.get(tag) || {
            earned: 0,
            maxPoints: 0,
            count: 0,
          };

          const weight = getDifficultyWeight(card.difficulty);

          let intervalDays = 0;
          if (card.lastReview && card.nextReview) {
            const last = new Date(card.lastReview).getTime();
            const next = new Date(card.nextReview).getTime();
            if (!isNaN(last) && !isNaN(next)) {
              intervalDays = Math.max(0, (next - last) / (1000 * 3600 * 24));
            }
          } else if (card.history.good > 0) {
            intervalDays = card.history.good * 2;
          }

          const retentionRatio = Math.min(
            1.0,
            intervalDays / TARGET_INTERVAL_DAYS
          );

          existing.earned += weight * retentionRatio;
          existing.maxPoints += weight;
          existing.count += 1;

          map.set(tag, existing);
        }
      }

      return Array.from(map.entries())
        .map(([name, stats]) => {
          const denominator = Math.max(MIN_MASTERY_THRESHOLD, stats.maxPoints);
          const mastery = Math.round((stats.earned / denominator) * 100);
          return {
            name,
            mastery: Math.min(100, mastery),
            cardCount: stats.count,
            type: (isPattern ? "pattern" : "cs") as "pattern" | "cs",
          };
        })
        .sort((a, b) => a.mastery - b.mastery);
    };

    return {
      patterns: calculateTopics(patternCards, true),
      cs: calculateTopics(csCards, false),
    };
  }, [cards]);

  if (cards.length === 0) return null;

  const targetAreas = patterns.filter((p) => p.mastery < 40);
  const inProgress = patterns.filter((p) => p.mastery >= 40 && p.mastery < 80);
  const mastered = patterns.filter((p) => p.mastery >= 80);

  const ProgressPill = ({
    topic,
    colorTheme,
  }: {
    topic: TopicData;
    colorTheme: "red" | "amber" | "emerald" | "blue";
  }) => {
    const themes = {
      red: {
        text: "text-red-900 dark:text-red-200",
        border: "border-red-500/20 dark:border-red-500/30",
        bg: "bg-red-500/10 dark:bg-red-500/10",
        fill: "bg-red-500/20 dark:bg-red-500/30",
      },
      amber: {
        text: "text-amber-900 dark:text-amber-200",
        border: "border-amber-500/20 dark:border-amber-500/30",
        bg: "bg-amber-500/10 dark:bg-amber-500/10",
        fill: "bg-amber-500/20 dark:bg-amber-500/30",
      },
      emerald: {
        text: "text-emerald-900 dark:text-emerald-200",
        border: "border-emerald-500/20 dark:border-emerald-500/30",
        bg: "bg-emerald-500/10 dark:bg-emerald-500/10",
        fill: "bg-emerald-500/20 dark:bg-emerald-500/30",
      },
      blue: {
        text: "text-blue-900 dark:text-blue-200",
        border: "border-blue-500/20 dark:border-blue-500/30",
        bg: "bg-blue-500/10 dark:bg-blue-500/10",
        fill: "bg-blue-500/20 dark:bg-blue-500/30",
      },
    };

    const theme = themes[colorTheme];

    return (
      <div
        className={`relative overflow-hidden inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium ${theme.bg} ${theme.border} ${theme.text}`}
      >
        {/* Background Progress Bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${topic.mastery}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`absolute left-0 top-0 bottom-0 ${theme.fill} z-0`}
        />
        {/* Content */}
        <span className="relative z-10">{topic.name}</span>
        <span className="relative z-10 opacity-50">|</span>
        <span className="relative z-10 font-mono opacity-90">
          {topic.mastery}%
        </span>
      </div>
    );
  };

  const TopicSection = ({
    title,
    icon,
    topics,
    colorTheme,
  }: {
    title: string;
    icon: string;
    topics: TopicData[];
    colorTheme: "red" | "amber" | "emerald";
  }) => {
    if (topics.length === 0) return null;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span>{icon}</span>
          <span className="font-medium text-foreground">{title}</span>
          <span className="text-muted-foreground text-xs">
            ({topics.length})
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <ProgressPill key={topic.name} topic={topic} colorTheme={colorTheme} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col lg:flex-row gap-6 mb-8"
    >
      {patterns.length > 0 && (
        <Card className="p-6 shadow-sm flex-1">
          <div className="flex flex-col gap-1 mb-4">
            <h3 className="font-semibold text-foreground text-lg">
              DSA Patterns Focus
            </h3>
            <p className="text-xs text-muted-foreground">
              Prioritized by repetition interval & difficulty.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <TopicSection
              title="Target Areas"
              icon="🎯"
              topics={targetAreas}
              colorTheme="red"
            />
            <TopicSection
              title="In Progress"
              icon="📈"
              topics={inProgress}
              colorTheme="amber"
            />
            <TopicSection
              title="Mastered"
              icon="🏆"
              topics={mastered}
              colorTheme="emerald"
            />
          </div>
        </Card>
      )}

      {cs.length > 0 && (
        <Card className="p-6 shadow-sm lg:w-1/3 shrink-0">
          <div className="flex flex-col gap-1 mb-4">
            <h3 className="font-semibold text-foreground text-lg">
              CS Core Focus
            </h3>
            <p className="text-xs text-muted-foreground">
              Fundamentals mastery.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {cs.map((topic) => (
              <ProgressPill
                key={topic.name}
                topic={topic}
                colorTheme={
                  topic.mastery >= 80
                    ? "emerald"
                    : topic.mastery >= 40
                    ? "amber"
                    : "blue"
                }
              />
            ))}
          </div>
        </Card>
      )}
    </motion.div>
  );
}

