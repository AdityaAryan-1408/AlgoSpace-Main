import { NextRequest } from "next/server";
import { submitReview } from "@/lib/repository";
import { ApiError, handleApiError, jsonOk, withUser } from "@/lib/api";
import { ReviewRating } from "@/lib/srs";

const allowedRatings = new Set<ReviewRating>(["AGAIN", "HARD", "GOOD", "EASY"]);

export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();

    if (typeof body?.cardId !== "string" || !body.cardId.trim()) {
      throw new ApiError("cardId is required.");
    }
    if (!allowedRatings.has(body?.rating)) {
      throw new ApiError("rating must be one of: AGAIN, HARD, GOOD, EASY.");
    }
    if (
      body?.responseMs != null &&
      (typeof body.responseMs !== "number" || !Number.isFinite(body.responseMs) || body.responseMs < 0)
    ) {
      throw new ApiError("responseMs must be a positive number when provided.");
    }
    if (
      body?.manualReviewDays != null &&
      (typeof body.manualReviewDays !== "number" || !Number.isFinite(body.manualReviewDays) || body.manualReviewDays < 0)
    ) {
      throw new ApiError("manualReviewDays must be a positive number when provided.");
    }

    const result = await submitReview(
      user.id,
      body.cardId.trim(),
      body.rating,
      body.responseMs,
      body.manualReviewDays,
    );

    return jsonOk(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
