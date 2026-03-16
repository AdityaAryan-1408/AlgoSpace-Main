import { NextRequest } from "next/server";
import { handleApiError, jsonOk, withUser } from "@/lib/api";
import { getRecoveryModePlan } from "@/lib/analytics-engine";
import { previewRecoveryPlan, applyRecoveryPlan } from "@/lib/recovery-planner";

/**
 * GET /api/coach/recovery
 *
 * Returns a recovery mode plan when the user has a large overdue backlog.
 * Classifies overdue cards into red/amber/green buckets with a daily cap.
 *
 * Query params:
 *   ?preview=true — includes a detailed preview of what applying the plan would do
 */
export async function GET(request: NextRequest) {
  try {
    const user = await withUser(request);
    const wantPreview =
      request.nextUrl.searchParams.get("preview") === "true";

    if (wantPreview) {
      const preview = await previewRecoveryPlan(user.id);
      return jsonOk(preview);
    }

    const plan = await getRecoveryModePlan(user.id);
    return jsonOk(plan);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/coach/recovery
 *
 * Applies the recovery plan: flattens amber cards, defers green cards.
 * The user must explicitly trigger this — schedules are never modified silently.
 *
 * Optional body:
 *   { deferByDays?: number, flattenOverDays?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);

    let options: { deferByDays?: number; flattenOverDays?: number } | undefined;
    try {
      const body = await request.json();
      if (body && typeof body === "object") {
        options = {
          deferByDays:
            typeof body.deferByDays === "number" ? body.deferByDays : undefined,
          flattenOverDays:
            typeof body.flattenOverDays === "number"
              ? body.flattenOverDays
              : undefined,
        };
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    const result = await applyRecoveryPlan(user.id, options);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
