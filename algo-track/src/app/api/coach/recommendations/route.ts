import { NextRequest } from "next/server";
import { handleApiError, jsonOk, withUser } from "@/lib/api";
import { getRecommendations } from "@/lib/recommendation-engine";

/**
 * GET /api/coach/recommendations
 *
 * Returns personalized recommendations:
 *   - suggestedProblems: DSA problems to solve (recovery, strengthen, stretch)
 *   - suggestedTopics: CS theory topics to study (weak areas + uncovered)
 *   - priorityActions: high-level actionable items
 */
export async function GET(request: NextRequest) {
  try {
    const user = await withUser(request);

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(20, Math.max(1, parseInt(limitParam, 10))) : 6;

    const result = await getRecommendations(user.id, limit);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
