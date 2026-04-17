import { NextRequest } from "next/server";
import { ApiError, handleApiError, jsonOk, withUser } from "@/lib/api";
import {
  getGlobalPauseStatus,
  globalPauseReviews,
  globalResumeReviews,
  extendGlobalPause,
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
      const status = await globalPauseReviews(user.id, days, autoResume);
      return jsonOk(status);
    }

    if (action === "resume") {
      const result = await globalResumeReviews(user.id);
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
      const status = await extendGlobalPause(user.id, additionalDays);
      return jsonOk(status);
    }

    throw new ApiError('action must be "pause", "resume", or "extend".', 400);
  } catch (error) {
    return handleApiError(error);
  }
}
