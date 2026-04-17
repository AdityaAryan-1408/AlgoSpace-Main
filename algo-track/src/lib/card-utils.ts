import type { Flashcard } from "@/data";

/**
 * Determines whether a card is eligible to be paused based on review count thresholds.
 * - DSA Easy: 3 reviews
 * - DSA Medium: 5 reviews
 * - DSA Hard: 7 reviews
 * - CS Core (all): 3 reviews
 */
export function canPauseCard(card: Flashcard): boolean {
    const totalReviews = card.history.total;
    if (card.type === "cs") return totalReviews >= 3;
    // DSA cards
    if (card.difficulty === "easy") return totalReviews >= 3;
    if (card.difficulty === "medium") return totalReviews >= 5;
    if (card.difficulty === "hard") return totalReviews >= 7;
    return false;
}

/**
 * Returns true if the card's reviews are currently paused individually or globally.
 */
export function isCardPaused(card: Flashcard): boolean {
    return card.metadata?.review_paused === true || card.metadata?.globally_paused === true;
}

/**
 * Returns the minimum number of reviews needed before pause is available.
 */
export function pauseThreshold(card: Flashcard): number {
    if (card.type === "cs") return 3;
    if (card.difficulty === "easy") return 3;
    if (card.difficulty === "medium") return 5;
    if (card.difficulty === "hard") return 7;
    return 3;
}
