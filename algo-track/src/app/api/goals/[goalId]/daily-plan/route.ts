import { NextRequest } from "next/server";
import { handleApiError, jsonError, jsonOk, withUser } from "@/lib/api";
import { getDailyActionPlan } from "@/lib/nudge-engine";

interface RouteContext {
  params: Promise<{ goalId: string }>;
}

/**
 * GET /api/goals/[goalId]/daily-plan
 *
 * Returns a concise daily action plan for a specific goal:
 * how many to solve, how many to review, which topics to focus on.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await withUser(request);
    const { goalId } = await context.params;

    const plan = await getDailyActionPlan(goalId, user.id);
    if (!plan) {
      return jsonError("Goal not found.", 404);
    }

    return jsonOk(plan);
  } catch (error) {
    return handleApiError(error);
  }
}
