import { NextRequest } from "next/server";
import {
  getUserProfile,
  updateReminderSettings,
} from "@/lib/repository";
import { ApiError, handleApiError, jsonOk, withUser } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const user = await withUser(request);
    const profile = await getUserProfile(user.id);
    return jsonOk({ user: profile });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();

    if (body?.remindersEnabled != null && typeof body.remindersEnabled !== "boolean") {
      throw new ApiError("remindersEnabled must be a boolean when provided.");
    }
    if (body?.timezone != null && typeof body.timezone !== "string") {
      throw new ApiError("timezone must be a string when provided.");
    }
    if (body?.preferences != null && typeof body.preferences !== "object") {
      throw new ApiError("preferences must be an object when provided.");
    }

    const profile = await updateReminderSettings(user.id, {
      remindersEnabled: body?.remindersEnabled,
      timezone: body?.timezone?.trim(),
      preferences: body?.preferences,
    });

    return jsonOk({ user: profile });
  } catch (error) {
    return handleApiError(error);
  }
}
