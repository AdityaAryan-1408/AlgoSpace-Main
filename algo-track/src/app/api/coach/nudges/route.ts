import { NextRequest } from "next/server";
import { handleApiError, jsonOk, withUser } from "@/lib/api";
import { getSmartNudges } from "@/lib/nudge-engine";

/**
 * GET /api/coach/nudges
 *
 * Returns all smart nudges for the user's active goals,
 * plus general retention/weakness nudges.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await withUser(request);
    const result = await getSmartNudges(user.id);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
