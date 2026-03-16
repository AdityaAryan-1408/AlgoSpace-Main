/**
 * Recovery Mode Planner — Schedule Safety & Execution (Phase 6)
 *
 * Extends Phase 3's getRecoveryModePlan with:
 *   - Safe deferral of green-bucket cards
 *   - Partial flattening of amber-bucket cards
 *   - Recovery session tracking
 *   - Metadata recording so deferred cards are marked as recovery-adjusted
 *
 * Key rules (from IMPLEMENTATION_PLAN):
 *   - Never silently modify schedules — the user must accept the plan first
 *   - Only defer cards with stable history (high EF, multiple reps)
 *   - Never defer red-zone cards
 *   - Record that a recovery adjustment was applied (in card metadata)
 */

import { getSupabaseAdmin } from "@/lib/db";
import {
  getRecoveryModePlan,
  type RecoveryModePlan,
  type RecoveryCard,
} from "@/lib/analytics-engine";

// ── Types ───────────────────────────────────────────────────────

export interface RecoveryPlanPreview {
  /** The raw recovery plan data */
  plan: RecoveryModePlan;
  /** What will happen if the user accepts the plan */
  actions: {
    /** Red cards: kept at current due date, reviewed first */
    keepDue: number;
    /** Amber cards: partially flattened over the next N days */
    flatten: number;
    flattenOverDays: number;
    /** Green cards: safely deferred by X days */
    defer: number;
    deferByDays: number;
  };
  /** Human-readable explanation */
  explanation: string[];
}

export interface RecoveryApplyResult {
  /** How many cards were kept as-is (red bucket) */
  keptDue: number;
  /** How many cards were flattened (amber bucket) */
  flattened: number;
  /** How many cards were deferred (green bucket) */
  deferred: number;
  /** Total cards affected */
  totalAffected: number;
  /** New recommended daily review count */
  dailyCap: number;
}

// ── Preview (dry run) ───────────────────────────────────────────

/**
 * Generates a preview of what the recovery plan will do.
 * Does NOT modify any data — this is a dry run.
 */
export async function previewRecoveryPlan(
  userId: string,
): Promise<RecoveryPlanPreview> {
  const plan = await getRecoveryModePlan(userId);

  const deferByDays: number = plan.totalOverdue > 100 ? 7 : plan.totalOverdue > 50 ? 5 : 3;
  const flattenOverDays = Math.min(
    7,
    Math.ceil(plan.amberCards.length / Math.max(1, plan.recommendedDailyCap)),
  );

  const explanation: string[] = [];

  if (plan.redCards.length > 0) {
    explanation.push(
      `${plan.redCards.length} critical card${plan.redCards.length !== 1 ? "s" : ""} (failed or very overdue) will be reviewed first. These are at the highest risk of being forgotten.`,
    );
  }

  if (plan.amberCards.length > 0) {
    explanation.push(
      `${plan.amberCards.length} moderately overdue card${plan.amberCards.length !== 1 ? "s" : ""} will be spread over ${flattenOverDays} day${flattenOverDays !== 1 ? "s" : ""} to keep your daily load manageable.`,
    );
  }

  if (plan.greenCards.length > 0) {
    explanation.push(
      `${plan.greenCards.length} stable card${plan.greenCards.length !== 1 ? "s" : ""} (high retention, lightly overdue) will be safely deferred by ${deferByDays} day${deferByDays !== 1 ? "s" : ""} -- they are not at risk.`,
    );
  }

  explanation.push(
    `Your daily review cap will be set to ${plan.recommendedDailyCap} cards until the backlog is cleared.`,
  );

  return {
    plan,
    actions: {
      keepDue: plan.redCards.length,
      flatten: plan.amberCards.length,
      flattenOverDays,
      defer: plan.greenCards.length,
      deferByDays,
    },
    explanation,
  };
}

// ── Apply (execute the plan) ────────────────────────────────────

/**
 * Applies the recovery plan by:
 * 1. Keeping red cards at their current due dates (no change)
 * 2. Flattening amber cards across `flattenOverDays` days
 * 3. Deferring green cards by `deferByDays` days
 *
 * Each modified card gets a `recovery_adjusted_at` entry in metadata.
 */
export async function applyRecoveryPlan(
  userId: string,
  options?: {
    deferByDays?: number;
    flattenOverDays?: number;
  },
): Promise<RecoveryApplyResult> {
  const supabase = getSupabaseAdmin();
  const plan = await getRecoveryModePlan(userId);

  const deferByDays = options?.deferByDays ??
    (plan.totalOverdue > 100 ? 7 : plan.totalOverdue > 50 ? 5 : 3);
  const flattenOverDays = options?.flattenOverDays ??
    Math.min(7, Math.ceil(plan.amberCards.length / Math.max(1, plan.recommendedDailyCap)));

  const now = new Date();
  const nowIso = now.toISOString();
  let flattened = 0;
  let deferred = 0;

  // ── Flatten amber cards ──
  // Spread them across the next `flattenOverDays` days
  if (plan.amberCards.length > 0 && flattenOverDays > 0) {
    const cardsPerDay = Math.ceil(plan.amberCards.length / flattenOverDays);

    for (let i = 0; i < plan.amberCards.length; i++) {
      const card = plan.amberCards[i];
      const dayOffset = Math.floor(i / cardsPerDay);
      const newDue = new Date(now.getTime() + dayOffset * 86_400_000);

      const { error } = await supabase
        .from("cards")
        .update({
          next_review_at: newDue.toISOString(),
          metadata: { recovery_adjusted_at: nowIso },
        })
        .eq("id", card.id)
        .eq("user_id", userId);

      if (!error) flattened++;
    }
  }

  // ── Defer green cards ──
  // Push their due date forward by `deferByDays` days
  for (const card of plan.greenCards) {
    const newDue = new Date(now.getTime() + deferByDays * 86_400_000);

    const { error } = await supabase
      .from("cards")
      .update({
        next_review_at: newDue.toISOString(),
        metadata: {
          recovery_adjusted_at: nowIso,
          recovery_deferred_days: deferByDays,
        },
      })
      .eq("id", card.id)
      .eq("user_id", userId);

    if (!error) deferred++;
  }

  return {
    keptDue: plan.redCards.length,
    flattened,
    deferred,
    totalAffected: plan.redCards.length + flattened + deferred,
    dailyCap: plan.recommendedDailyCap,
  };
}
