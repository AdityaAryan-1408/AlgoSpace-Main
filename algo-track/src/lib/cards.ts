import { Flashcard } from "@/data";
import { parseCardContent } from "@/lib/card-content";
import { daysFromToday, formatHumanDate } from "@/lib/time";
import { ReviewRating } from "@/lib/srs";

interface CardRow {
  id: string;
  type: "leetcode" | "cs";
  title: string;
  description: string;
  url: string | null;
  notes: string;
  solution: string | null;
  difficulty: "easy" | "medium" | "hard";
  last_rating: ReviewRating | null;
  last_reviewed_at: string | Date | null;
  next_review_at: string | Date;
  tags: string[] | null;
  good_count: number | string | null;
  total_count: number | string | null;
}

function asNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

export function mapCardRowToFlashcard(row: CardRow): Flashcard {
  const nextReview = row.next_review_at;
  const totalCount = asNumber(row.total_count);
  const goodCount = asNumber(row.good_count);
  const parsedContent = parseCardContent(row.solution, row.tags ?? []);

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    url: row.url ?? undefined,
    notes: row.notes,
    solution: parsedContent.primarySolution ?? undefined,
    solutions: parsedContent.solutions,
    timeComplexity: parsedContent.timeComplexity,
    spaceComplexity: parsedContent.spaceComplexity,
    relatedProblems: parsedContent.relatedProblems,
    difficulty: row.difficulty,
    tags: row.tags ?? [],
    lastReview: formatHumanDate(row.last_reviewed_at),
    lastRating: row.last_rating ?? "GOOD",
    nextReview: formatHumanDate(nextReview),
    dueInDays: Math.max(0, daysFromToday(nextReview)),
    history: {
      good: goodCount,
      total: totalCount,
    },
  };
}
