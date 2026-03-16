import { NextRequest } from "next/server";
import { handleApiError, jsonOk, withUser } from "@/lib/api";
import { getCoachContext } from "@/lib/analytics-engine";
import { getSmartNudges } from "@/lib/nudge-engine";
import { getRecoveryModePlan } from "@/lib/analytics-engine";

/**
 * GET /api/coach/overview
 *
 * Returns the full Guide screen payload:
 *   - profileSummary (strengths, weak spots, difficulty distribution)
 *   - goalStatus (active goal nudges and pacing)
 *   - dailyPlan (what to do today)
 *   - recoveryMode (if recovery is needed)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await withUser(request);

    const [context, nudgesResult, recovery] = await Promise.all([
      getCoachContext(user.id),
      getSmartNudges(user.id),
      getRecoveryModePlan(user.id),
    ]);

    return jsonOk({
      profileSummary: {
        totalCards: context.totalCards,
        totalDue: context.totalDue,
        totalOverdue: context.totalOverdue,
        currentStreak: context.currentStreak,
        recentAccuracy: context.recentAccuracy,
        difficultyDistribution: context.difficultyDistribution,
      },
      strengths: context.strengths,
      weakSpots: context.weakSpots,
      goalStatus: {
        activeGoalCount: context.activeGoalCount,
        goals: nudgesResult.goals.map((g) => ({
          goalId: g.goalId,
          goalTitle: g.goalTitle,
          progress: g.progress,
          pacing: g.pacing,
          nudges: g.nudges,
        })),
      },
      dailyPlan: {
        totalNudges: nudgesResult.totalNudges,
        generalNudges: nudgesResult.generalNudges,
      },
      recoveryMode: {
        isRecoveryNeeded: recovery.isRecoveryNeeded,
        totalOverdue: recovery.totalOverdue,
        daysSinceLastReview: recovery.daysSinceLastReview,
        recommendedDailyCap: recovery.recommendedDailyCap,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
