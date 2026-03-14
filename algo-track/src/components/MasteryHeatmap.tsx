import { useState, useMemo } from "react";
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

function getHeatmapColor(mastery: number) {
  if (mastery >= 80)
    return "bg-emerald-500 text-white border-emerald-600 dark:border-emerald-400 dark:text-emerald-950 hover:bg-emerald-400";
  if (mastery >= 60)
    return "bg-emerald-400 text-emerald-950 border-emerald-500 dark:border-emerald-300 hover:bg-emerald-300";
  if (mastery >= 40)
    return "bg-emerald-300 text-emerald-950 border-emerald-400 dark:border-emerald-200 hover:bg-emerald-200";
  if (mastery >= 20)
    return "bg-emerald-200 text-emerald-900 border-emerald-300 dark:border-emerald-100 hover:bg-emerald-100";
  return "bg-muted text-muted-foreground border-border hover:bg-muted/80";
}

function getDifficultyBadge(mastery: number) {
  if (mastery >= 80)
    return { label: "Strong", className: "bg-easy-bg text-easy border-easy/20" };
  if (mastery >= 40)
    return {
      label: "Medium",
      className: "bg-medium-bg text-medium border-medium/20",
    };
  return { label: "Weak", className: "bg-hard-bg text-hard border-hard/20" };
}

export function MasteryHeatmap({ cards }: MasteryHeatmapProps) {
  const [hoveredTopic, setHoveredTopic] = useState<{ topic: TopicData; x: number; y: number } | null>(null);

  const { patterns, cs } = useMemo(() => {
    const patternCards = cards.filter((c) => c.type === "leetcode");
    const csCards = cards.filter((c) => c.type === "cs");

    // Group pattern cards by tag
    const patternMap = new Map<
      string,
      { totalGood: number; totalReviews: number; count: number }
    >();
    for (const card of patternCards) {
      for (const tag of card.tags) {
        // Skip complexity tags — they're not patterns
        if (/^(Time|Space):/i.test(tag)) continue;
        const existing = patternMap.get(tag) || {
          totalGood: 0,
          totalReviews: 0,
          count: 0,
        };
        existing.totalGood += card.history.good;
        existing.totalReviews += card.history.total;
        existing.count += 1;
        patternMap.set(tag, existing);
      }
    }

    const patterns: TopicData[] = Array.from(patternMap.entries())
      .map(([name, stats]) => ({
        name,
        mastery:
          stats.totalReviews > 0
            ? Math.round((stats.totalGood / stats.totalReviews) * 100)
            : 0,
        cardCount: stats.count,
        type: "pattern" as const,
      }))
      .sort((a, b) => b.mastery - a.mastery);

    // Group CS cards by tag
    const csMap = new Map<
      string,
      { totalGood: number; totalReviews: number; count: number }
    >();
    for (const card of csCards) {
      const tagsToUse = card.tags.length > 0 ? card.tags : [card.title];
      for (const tag of tagsToUse) {
        const existing = csMap.get(tag) || {
          totalGood: 0,
          totalReviews: 0,
          count: 0,
        };
        existing.totalGood += card.history.good;
        existing.totalReviews += card.history.total;
        existing.count += 1;
        csMap.set(tag, existing);
      }
    }

    const cs: TopicData[] = Array.from(csMap.entries())
      .map(([name, stats]) => ({
        name,
        mastery:
          stats.totalReviews > 0
            ? Math.round((stats.totalGood / stats.totalReviews) * 100)
            : 0,
        cardCount: stats.count,
        type: "cs" as const,
      }))
      .sort((a, b) => b.mastery - a.mastery);

    return { patterns, cs };
  }, [cards]);

  if (cards.length === 0) return null;

  const handleMouseEnter = (e: React.MouseEvent, topic: TopicData) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHoveredTopic({
      topic,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  const handleMouseLeave = () => {
    setHoveredTopic(null);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
      >
        {patterns.length > 0 && (
          <Card className="p-6 lg:col-span-2 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground">
                DSA Patterns Mastery
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Weak</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-sm bg-muted border border-border"></div>
                  <div className="w-3 h-3 rounded-sm bg-emerald-200 border border-emerald-300 dark:border-emerald-100"></div>
                  <div className="w-3 h-3 rounded-sm bg-emerald-300 border border-emerald-400 dark:border-emerald-200"></div>
                  <div className="w-3 h-3 rounded-sm bg-emerald-400 border border-emerald-500 dark:border-emerald-300"></div>
                  <div className="w-3 h-3 rounded-sm bg-emerald-500 border border-emerald-600 dark:border-emerald-400"></div>
                </div>
                <span>Strong</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {patterns.map((topic, i) => {
                const diff = getDifficultyBadge(topic.mastery);
                return (
                  <motion.div
                    key={topic.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.02 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    onMouseEnter={(e) => handleMouseEnter(e, topic)}
                    onMouseLeave={handleMouseLeave}
                    className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors cursor-default flex items-center gap-2 ${getHeatmapColor(topic.mastery)}`}
                  >
                    <span>{topic.name}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full border ${diff.className}`}
                    >
                      {diff.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        )}

        {cs.length > 0 && (
          <Card
            className={`p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow ${patterns.length === 0 ? "lg:col-span-3" : ""}`}
          >
            <h3 className="font-semibold text-foreground">CS Core Mastery</h3>
            <div className="flex flex-col gap-4 mt-2">
              {cs.map((topic, i) => (
                <motion.div
                  key={topic.name}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onMouseEnter={(e) => handleMouseEnter(e, topic)}
                  onMouseLeave={handleMouseLeave}
                  className="flex flex-col gap-1.5 group cursor-default"
                >
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-foreground group-hover:text-blue-500 transition-colors">
                      {topic.name}
                    </span>
                    <span className="text-muted-foreground font-medium">
                      {topic.mastery}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${topic.mastery}%` }}
                      transition={{
                        duration: 1,
                        delay: 0.2 + i * 0.1,
                        ease: "easeOut",
                      }}
                      className="h-full bg-blue-500 rounded-full"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        )}
      </motion.div>

      {/* Hover tooltip */}
      {hoveredTopic && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: hoveredTopic.x,
            top: hoveredTopic.y,
            transform: "translate(-50%, calc(-100% - 8px))",
          }}
        >
          <div className="bg-foreground text-background px-3 py-2 rounded-lg shadow-lg text-xs font-medium whitespace-nowrap">
            <div className="font-bold">{hoveredTopic.topic.name}</div>
            <div className="flex items-center gap-3 mt-0.5 opacity-90">
              <span>Mastery: <strong>{hoveredTopic.topic.mastery}%</strong></span>
              <span>Cards: <strong>{hoveredTopic.topic.cardCount}</strong></span>
            </div>
            {/* small arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-foreground" />
          </div>
        </div>
      )}
    </>
  );
}
