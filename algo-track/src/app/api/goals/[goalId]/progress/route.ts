import { NextRequest } from "next/server";
import { handleApiError, jsonError, jsonOk, withUser } from "@/lib/api";
import { getGoalProgress, getGoalPacing } from "@/lib/analytics-engine";

interface RouteContext {
  params: Promise<{ goalId: string }>;
}

/**
 * GET /api/goals/[goalId]/progress
 *
 * Returns combined progress metrics and pacing analysis for a goal.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await withUser(request);
    const { goalId } = await context.params;

    const [progress, pacing] = await Promise.all([
      getGoalProgress(goalId, user.id),
      getGoalPacing(goalId, user.id),
    ]);

    if (!progress) {
      return jsonError("Goal not found.", 404);
    }

    return jsonOk({ progress, pacing });
  } catch (error) {
    return handleApiError(error);
  }
}
