import { NextRequest } from "next/server";
import { submitReview, updateCardById, getDashboardStats } from "@/lib/repository";
import { ApiError, handleApiError, jsonOk, withUser } from "@/lib/api";
import { ReviewRating } from "@/lib/srs";

const allowedRatings = new Set<ReviewRating>(["AGAIN", "HARD", "GOOD", "EASY"]);

export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();

    if (!Array.isArray(body?.reviews)) {
      throw new ApiError("reviews array is required.");
    }

    const updatedCards = [];
    for (const item of body.reviews) {
      if (typeof item.cardId !== "string" || !item.cardId.trim()) {
        throw new ApiError("Each review must have a cardId.");
      }
      if (item.rating !== undefined && !allowedRatings.has(item.rating)) {
        throw new ApiError("rating must be one of: AGAIN, HARD, GOOD, EASY.");
      }
      if (
        item.responseMs != null &&
        (typeof item.responseMs !== "number" || !Number.isFinite(item.responseMs) || item.responseMs < 0)
      ) {
        throw new ApiError("responseMs must be a positive number when provided.");
      }
      if (
        item.manualReviewDays != null &&
        (typeof item.manualReviewDays !== "number" || !Number.isFinite(item.manualReviewDays) || item.manualReviewDays < 0)
      ) {
        throw new ApiError("manualReviewDays must be a positive number when provided.");
      }

      let card = null;
      if (item.rating !== undefined) {
        // Submit review
        const result = await submitReview(
          user.id,
          item.cardId.trim(),
          item.rating,
          item.responseMs,
          item.manualReviewDays,
        );
        card = result.card;
      }

      // Handle optional actions
      if (item.action === "pause") {
        card = await updateCardById(user.id, item.cardId.trim(), {
          metadata: {
            review_paused: true,
            review_paused_at: new Date().toISOString(),
            ...(item.reviewNote ? { reviewNote: item.reviewNote } : {}),
          },
          nextReview: "9999-12-31T23:59:59.999Z",
        });
      } else if (item.action === "reference") {
        card = await updateCardById(user.id, item.cardId.trim(), {
          metadata: {
            reference_only: true,
            ...(item.reviewNote ? { reviewNote: item.reviewNote } : {}),
          },
          nextReview: "9999-12-31T23:59:59.999Z",
          dueInDays: 0,
        });
      } else if (item.reviewNote !== undefined) {
        card = await updateCardById(user.id, item.cardId.trim(), {
          metadata: {
            reviewNote: item.reviewNote,
          },
        });
      }

      if (card) {
        updatedCards.push(card);
      }
    }

    const stats = await getDashboardStats(user.id);

    return jsonOk({
      updatedCards,
      reviewsToday: stats.reviewsToday,
    }, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
