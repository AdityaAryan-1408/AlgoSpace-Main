import { NextRequest } from "next/server";
import { upsertPushSubscription, updateReminderSettings } from "@/lib/repository";
import { ApiError, handleApiError, jsonOk, withUser } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();

    if (typeof body?.endpoint !== "string" || !body.endpoint.trim()) {
      throw new ApiError("endpoint is required.");
    }
    if (typeof body?.p256dh !== "string" || !body.p256dh.trim()) {
      throw new ApiError("p256dh is required.");
    }
    if (typeof body?.auth !== "string" || !body.auth.trim()) {
      throw new ApiError("auth is required.");
    }
    if (body?.timezone != null && typeof body.timezone !== "string") {
      throw new ApiError("timezone must be a string when provided.");
    }

    await upsertPushSubscription(user.id, {
      endpoint: body.endpoint.trim(),
      p256dh: body.p256dh.trim(),
      auth: body.auth.trim(),
    });

    const profile = await updateReminderSettings(user.id, {
      remindersEnabled: true,
      timezone: body?.timezone?.trim(),
    });

    return jsonOk({
      ok: true,
      user: profile,
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
