import { NextRequest } from "next/server";
import { ApiError, handleApiError, jsonOk, withUser } from "@/lib/api";
import {
  getGlobalPauseStatus,
  globalPauseReviews,
  globalResumeReviews,
  extendGlobalPause,
  redistributeCards,
  shuffleAllCards,
} from "@/lib/repository";

export async function GET(request: NextRequest) {
  try {
    const user = await withUser(request);
    const status = await getGlobalPauseStatus(user.id);
    return jsonOk(status);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();
    const action = body?.action;

    if (action === "pause") {
      const days = body?.days;
      if (
        days == null ||
        typeof days !== "number" ||
        !Number.isFinite(days) ||
        days < 1
      ) {
        throw new ApiError("days must be a positive integer.", 400);
      }
      const autoResume = body?.autoResume === true;
      const type = body?.type || "all";
      if (!["all", "leetcode", "cs", "sql"].includes(type)) {
        throw new ApiError("invalid type parameter.", 400);
      }
      const status = await globalPauseReviews(user.id, days, autoResume, type);
      return jsonOk(status);
    }

    if (action === "resume") {
      const type = body?.type || "all";
      if (!["all", "leetcode", "cs", "sql"].includes(type)) {
        throw new ApiError("invalid type parameter.", 400);
      }
      const result = await globalResumeReviews(user.id, type);
      return jsonOk(result);
    }

    if (action === "extend") {
      const additionalDays = body?.additionalDays;
      if (
        additionalDays == null ||
        typeof additionalDays !== "number" ||
        !Number.isFinite(additionalDays) ||
        additionalDays < 1
      ) {
        throw new ApiError("additionalDays must be a positive integer.", 400);
      }
      const type = body?.type || "all";
      if (!["all", "leetcode", "cs", "sql"].includes(type)) {
        throw new ApiError("invalid type parameter.", 400);
      }
      const status = await extendGlobalPause(user.id, additionalDays, type);
      return jsonOk(status);
    }

    if (action === "redistribute") {
      const result = await redistributeCards(user.id);
      return jsonOk(result);
    }

    if (action === "shuffle_all") {
      const result = await shuffleAllCards(user.id);
      return jsonOk(result);
    }

    throw new ApiError('action must be "pause", "resume", "extend", "redistribute", or "shuffle_all".', 400);
  } catch (error) {
    return handleApiError(error);
  }
}
