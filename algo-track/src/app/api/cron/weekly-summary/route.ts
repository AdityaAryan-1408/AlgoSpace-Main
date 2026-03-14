import { NextRequest } from "next/server";
import { assertCronAuthorized, handleApiError, jsonOk } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/db";
import { getWeeklySummary } from "@/lib/repository";

export async function GET(request: NextRequest) {
    try {
        assertCronAuthorized(request);

        const supabase = getSupabaseAdmin();
        const resendApiKey = process.env.RESEND_API_KEY;
        const reminderFromEmail = process.env.REMINDER_FROM_EMAIL;

        if (!resendApiKey || !reminderFromEmail) {
            return jsonOk({
                ok: false,
                skipped: "RESEND_API_KEY or REMINDER_FROM_EMAIL not configured.",
            });
        }

        // Get all users with reminders enabled
        const { data: users, error } = await supabase
            .from("users")
            .select("id, email")
            .eq("reminders_enabled", true);

        if (error) throw new Error(error.message);

        const results = [];

        for (const user of users ?? []) {
            try {
                const summary = await getWeeklySummary(user.id);

                // Skip if no activity this week
                if (summary.totalReviews === 0) {
                    results.push({ email: user.email, sent: false, reason: "no activity" });
                    continue;
                }

                const html = buildWeeklySummaryHtml(summary);

                const res = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${resendApiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        from: reminderFromEmail,
                        to: user.email,
                        subject: `AlgoTrack Weekly Summary: ${summary.totalReviews} reviews, ${summary.accuracy}% accuracy`,
                        html,
                    }),
                });

                results.push({
                    email: user.email,
                    sent: res.ok,
                    status: res.status,
                });
            } catch (err) {
                results.push({
                    email: user.email,
                    sent: false,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }

        return jsonOk({ ok: true, results });
    } catch (error) {
        return handleApiError(error);
    }
}

function buildWeeklySummaryHtml(summary: {
    totalReviews: number;
    uniqueCards: number;
    ratings: Record<string, number>;
    accuracy: number;
    currentStreak: number;
    strongestTopic: string | null;
    weakestTopic: string | null;
}) {
    const { totalReviews, uniqueCards, ratings, accuracy, currentStreak, strongestTopic, weakestTopic } = summary;

    return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #fafafa; border-radius: 12px;">
      <h2 style="margin: 0 0 4px 0; color: #09090b;">📊 Your Weekly AlgoTrack Summary</h2>
      <p style="color: #71717a; font-size: 14px; margin: 0 0 20px 0;">Here's how you did this week.</p>

      <div style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 16px; border: 1px solid #e4e4e7;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #71717a;">Reviews completed</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #09090b;">${totalReviews}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #71717a;">Unique cards reviewed</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #09090b;">${uniqueCards}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #71717a;">Accuracy</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${accuracy >= 70 ? "#22c55e" : "#f59e0b"};">${accuracy}%</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #71717a;">Current streak</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #09090b;">${currentStreak} day${currentStreak !== 1 ? "s" : ""} 🔥</td>
          </tr>
        </table>
      </div>

      <div style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 16px; border: 1px solid #e4e4e7;">
        <p style="margin: 0 0 8px 0; font-weight: 600; font-size: 13px; color: #09090b;">Rating Breakdown</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 4px 0; color: #22c55e;">EASY</td>
            <td style="padding: 4px 0; text-align: right;">${ratings.EASY}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #3b82f6;">GOOD</td>
            <td style="padding: 4px 0; text-align: right;">${ratings.GOOD}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #f59e0b;">HARD</td>
            <td style="padding: 4px 0; text-align: right;">${ratings.HARD}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #ef4444;">AGAIN</td>
            <td style="padding: 4px 0; text-align: right;">${ratings.AGAIN}</td>
          </tr>
        </table>
      </div>

      ${strongestTopic || weakestTopic ? `
        <div style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 16px; border: 1px solid #e4e4e7;">
          ${strongestTopic ? `<p style="margin: 0 0 4px 0; font-size: 13px;">💪 <strong>Strongest:</strong> ${strongestTopic}</p>` : ""}
          ${weakestTopic ? `<p style="margin: 0; font-size: 13px;">📚 <strong>Needs work:</strong> ${weakestTopic}</p>` : ""}
        </div>
      ` : ""}

      <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 16px 0 0 0;">
        Keep up the great work! Consistency is key to mastering DSA.
      </p>
    </div>
  `;
}
