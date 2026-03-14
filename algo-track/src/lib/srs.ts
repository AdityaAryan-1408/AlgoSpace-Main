export type ReviewRating = "AGAIN" | "HARD" | "GOOD" | "EASY";

export interface SrsState {
  easinessFactor: number;
  intervalDays: number;
  repetitionCount: number;
}

export interface SrsResult extends SrsState {
  nextReviewAt: Date;
}

const MIN_EASINESS = 1.3;
const DEFAULT_EASINESS = 2.5;

const ratingToQuality: Record<ReviewRating, number> = {
  AGAIN: 1,
  HARD: 3,
  GOOD: 4,
  EASY: 5,
};

function clampEasiness(value: number) {
  return Math.max(MIN_EASINESS, Number(value.toFixed(2)));
}

export function computeSrs(
  previous: Partial<SrsState> | null | undefined,
  rating: ReviewRating,
  reviewedAt: Date = new Date(),
): SrsResult {
  const prevEf = previous?.easinessFactor ?? DEFAULT_EASINESS;
  const prevInterval = previous?.intervalDays ?? 0;
  const prevRepetition = previous?.repetitionCount ?? 0;
  const quality = ratingToQuality[rating];

  let repetitionCount = prevRepetition;
  let intervalDays = prevInterval;
  let easinessFactor = prevEf;

  if (quality < 3) {
    repetitionCount = 0;
    intervalDays = 1;
  } else {
    repetitionCount += 1;
    if (repetitionCount === 1) {
      intervalDays = 1;
    } else if (repetitionCount === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.max(1, Math.round(prevInterval * prevEf));
    }

    const delta =
      0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    easinessFactor = clampEasiness(prevEf + delta);
  }

  const nextReviewAt = new Date(reviewedAt);
  nextReviewAt.setUTCDate(nextReviewAt.getUTCDate() + intervalDays);

  return {
    easinessFactor,
    intervalDays,
    repetitionCount,
    nextReviewAt,
  };
}
