import { NextRequest } from "next/server";
import {
  ApiError,
  handleApiError,
  jsonError,
  jsonOk,
  withUser,
} from "@/lib/api";
import { getGoalById, updateGoal, deleteGoal } from "@/lib/goals";

interface RouteContext {
  params: Promise<{ goalId: string }>;
}

/**
 * GET /api/goals/[goalId]
 * Returns a single goal with targets and topic items.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await withUser(request);
    const { goalId } = await context.params;

    const goal = await getGoalById(goalId, user.id);
    if (!goal) {
      return jsonError("Goal not found.", 404);
    }

    return jsonOk({ goal });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/goals/[goalId]
 * Updates a goal's fields (title, description, status, dates).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await withUser(request);
    const { goalId } = await context.params;
    const body = await request.json();

    const hasUpdate =
      body?.title !== undefined ||
      body?.description !== undefined ||
      body?.status !== undefined ||
      body?.startDate !== undefined ||
      body?.endDate !== undefined;

    if (!body || !hasUpdate) {
      throw new ApiError(
        "At least one field (title, description, status, startDate, endDate) is required.",
      );
    }

    if (body?.title != null && (typeof body.title !== "string" || !body.title.trim())) {
      throw new ApiError("title must be a non-empty string when provided.");
    }
    if (body?.status != null && typeof body.status !== "string") {
      throw new ApiError("status must be a string when provided.");
    }

    const goal = await updateGoal(goalId, user.id, {
      title: body.title?.trim(),
      description: body.description,
      status: body.status,
      startDate: body.startDate,
      endDate: body.endDate,
    });

    if (!goal) {
      return jsonError("Goal not found.", 404);
    }

    return jsonOk({ goal });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/goals/[goalId]
 * Deletes a goal and cascades to targets and topic items.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await withUser(request);
    const { goalId } = await context.params;

    const deleted = await deleteGoal(goalId, user.id);
    if (!deleted) {
      return jsonError("Goal not found.", 404);
    }

    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
