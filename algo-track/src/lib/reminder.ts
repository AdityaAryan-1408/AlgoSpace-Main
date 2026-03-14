import webpush from "web-push";
import { listPushSubscriptions, listUsersDueForReminder } from "@/lib/repository";

type ReminderUserResult = {
  userId: string;
  email: string;
  dueCount: number;
  pushSubscriptions: number;
  pushAttempted: number;
  pushSent: number;
  pushFailed: number;
  emailSent: boolean;
  pushError?: string;
  emailError?: string;
};

export interface ReminderJobResult {
  totalUsersDue: number;
  pushAttempted: number;
  pushSent: number;
  pushFailed: number;
  emailsAttempted: number;
  emailsSent: number;
  skippedReason?: string;
  users: ReminderUserResult[];
}

export async function runDailyReminderJob(): Promise<ReminderJobResult> {
  const users = await listUsersDueForReminder();
  const resendApiKey = process.env.RESEND_API_KEY;
  const reminderFromEmail = process.env.REMINDER_FROM_EMAIL;

  const pushSetup = configureWebPush();

  const result: ReminderJobResult = {
    totalUsersDue: users.length,
    pushAttempted: 0,
    pushSent: 0,
    pushFailed: 0,
    emailsAttempted: 0,
    emailsSent: 0,
    users: [],
  };

  if (!pushSetup.enabled && !resendApiKey) {
    result.skippedReason =
      "No reminder transport configured. Set VAPID keys for push and/or RESEND_API_KEY for email.";
  }

  for (const user of users) {
    const subscriptions = await listPushSubscriptions(user.id);
    const userResult: ReminderUserResult = {
      userId: user.id,
      email: user.email,
      dueCount: user.due_count,
      pushSubscriptions: subscriptions.length,
      pushAttempted: 0,
      pushSent: 0,
      pushFailed: 0,
      emailSent: false,
    };

    if (pushSetup.enabled && subscriptions.length > 0) {
      const pushSummary = await sendPushToSubscriptions(
        subscriptions,
        user.due_count,
      );
      userResult.pushAttempted = pushSummary.attempted;
      userResult.pushSent = pushSummary.sent;
      userResult.pushFailed = pushSummary.failed;
      userResult.pushError = pushSummary.error;

      result.pushAttempted += pushSummary.attempted;
      result.pushSent += pushSummary.sent;
      result.pushFailed += pushSummary.failed;
    }

    const shouldEmailFallback =
      userResult.pushSubscriptions === 0 || userResult.pushSent === 0;

    if (shouldEmailFallback && resendApiKey && reminderFromEmail) {
      result.emailsAttempted += 1;
      const emailResult = await sendReminderEmail({
        apiKey: resendApiKey,
        from: reminderFromEmail,
        to: user.email,
        dueCount: user.due_count,
      });

      userResult.emailSent = emailResult.ok;
      if (emailResult.ok) {
        result.emailsSent += 1;
      } else {
        userResult.emailError = emailResult.error;
      }
    }

    result.users.push(userResult);
  }

  return result;
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return { enabled: false as const };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { enabled: true as const };
}

async function sendPushToSubscriptions(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
  dueCount: number,
) {
  let attempted = 0;
  let sent = 0;
  let failed = 0;
  let error: string | undefined;

  for (const subscription of subscriptions) {
    attempted += 1;
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify({
          title: "AlgoTrack reminder",
          body: `You have ${dueCount} card(s) due for review today.`,
          url: "/",
        }),
        { TTL: 86_400 },
      );
      sent += 1;
    } catch (pushError) {
      failed += 1;
      if (pushError instanceof Error) {
        error = pushError.message;
      }
    }
  }

  return { attempted, sent, failed, error };
}

async function sendReminderEmail(input: {
  apiKey: string;
  from: string;
  to: string;
  dueCount: number;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: `AlgoTrack reminder: ${input.dueCount} card(s) due`,
      html: buildEmailHtml(input.dueCount),
    }),
  });

  if (response.ok) {
    return { ok: true as const };
  }

  const text = await response.text();
  return {
    ok: false as const,
    error: text || `HTTP ${response.status}`,
  };
}

function buildEmailHtml(dueCount: number) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>AlgoTrack Daily Reminder</h2>
      <p>You have <strong>${dueCount}</strong> card(s) due for review today.</p>
      <p>Open the app and clear today's review queue to keep your streak alive.</p>
    </div>
  `;
}
