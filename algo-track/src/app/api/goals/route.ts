import { NextRequest } from "next/server";
import {
  ApiError,
  handleApiError,
  jsonOk,
  withUser,
} from "@/lib/api";
import { listGoals, createGoal } from "@/lib/goals";

/**
 * GET /api/goals?status=active
 * Lists the user's goals, optionally filtered by status.
 *
 * POST /api/goals
 * Creates a new goal with optional targets and topic items.
 */

export async function GET(request: NextRequest) {
  try {
    const user = await withUser(request);
    const status =
      request.nextUrl.searchParams.get("status") ?? undefined;
    const goals = await listGoals(user.id, status);
    return jsonOk({ goals });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();

    // Validate required fields
    if (typeof body?.title !== "string" || !body.title.trim()) {
      throw new ApiError("title is required.");
    }
    if (typeof body?.goalType !== "string" || !body.goalType.trim()) {
      throw new ApiError("goalType is required.");
    }
    if (typeof body?.startDate !== "string" || !body.startDate.trim()) {
      throw new ApiError("startDate is required (YYYY-MM-DD).");
    }
    if (typeof body?.endDate !== "string" || !body.endDate.trim()) {
      throw new ApiError("endDate is required (YYYY-MM-DD).");
    }

    // Validate targets array if present
    if (body.targets != null) {
      if (!Array.isArray(body.targets)) {
        throw new ApiError("targets must be an array when provided.");
      }
      for (let i = 0; i < body.targets.length; i++) {
        const t = body.targets[i];
        if (!t || typeof t !== "object") {
          throw new ApiError(`targets[${i}] must be an object.`);
        }
        if (typeof t.metricKey !== "string" || !t.metricKey.trim()) {
          throw new ApiError(`targets[${i}].metricKey is required.`);
        }
        if (typeof t.targetValue !== "number" || t.targetValue < 0) {
          throw new ApiError(
            `targets[${i}].targetValue must be a non-negative number.`,
          );
        }
        if (typeof t.unit !== "string" || !t.unit.trim()) {
          throw new ApiError(`targets[${i}].unit is required.`);
        }
      }
    }

    // Validate topicItems array if present
    if (body.topicItems != null) {
      if (!Array.isArray(body.topicItems)) {
        throw new ApiError("topicItems must be an array when provided.");
      }
      for (let i = 0; i < body.topicItems.length; i++) {
        const item = body.topicItems[i];
        if (!item || typeof item !== "object") {
          throw new ApiError(`topicItems[${i}] must be an object.`);
        }
        if (typeof item.topicDomain !== "string" || !item.topicDomain.trim()) {
          throw new ApiError(`topicItems[${i}].topicDomain is required.`);
        }
        if (typeof item.topicId !== "string" || !item.topicId.trim()) {
          throw new ApiError(`topicItems[${i}].topicId is required.`);
        }
        if (typeof item.title !== "string" || !item.title.trim()) {
          throw new ApiError(`topicItems[${i}].title is required.`);
        }
      }
    }

    const goal = await createGoal(user.id, {
      title: body.title.trim(),
      description: body.description ?? "",
      goalType: body.goalType.trim(),
      status: body.status ?? "active",
      startDate: body.startDate.trim(),
      endDate: body.endDate.trim(),
      targets: body.targets,
      topicItems: body.topicItems,
    });

    return jsonOk({ goal }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
