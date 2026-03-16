import { NextRequest } from "next/server";
import { handleApiError, jsonOk, withUser } from "@/lib/api";
import { getSkillTreeProgress } from "@/lib/analytics-engine";

/**
 * GET /api/skill-tree
 *
 * Returns the skill-tree nodes with computed progress/mastery state
 * for the current user.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await withUser(request);
    const progress = await getSkillTreeProgress(user.id);
    return jsonOk({ nodes: progress });
  } catch (error) {
    return handleApiError(error);
  }
}
