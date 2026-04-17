import { mockCards } from "@/data";
import {
  encodeCardContent,
  parseCardContent,
  upsertComplexityTags,
  type CardSolutionItem,
  type RelatedProblemLink,
} from "@/lib/card-content";
import { mapCardRowToFlashcard } from "@/lib/cards";
import { getSupabaseAdmin } from "@/lib/db";
import { computeSrs, ReviewRating } from "@/lib/srs";

type CardRow = Parameters<typeof mapCardRowToFlashcard>[0];

type CardDbRow = {
  id: string;
  type: "leetcode" | "cs";
  title: string;
  description: string;
  url: string | null;
  notes: string | null;
  solution: string | null;
  difficulty: "easy" | "medium" | "hard";
  last_rating: ReviewRating | null;
  last_reviewed_at: string | null;
  next_review_at: string;
  tags: string[] | null;
  created_at: string;
  easiness_factor: number | string;
  interval_days: number;
  repetition_count: number;
  // New fields
  source: string;
  solved_at: string | null;
  topic_domain: string | null;
  topic_ids: string[] | null;
  metadata: Record<string, unknown> | null;
};

type ReviewDbRow = {
  card_id: string;
  rating: ReviewRating;
};

function toCardRow(
  row: CardDbRow,
  stats: { goodCount: number; totalCount: number },
): CardRow {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    url: row.url,
    notes: row.notes ?? "",
    solution: row.solution,
    difficulty: row.difficulty,
    last_rating: row.last_rating,
    last_reviewed_at: row.last_reviewed_at,
    next_review_at: row.next_review_at,
    tags: row.tags ?? [],
    good_count: stats.goodCount,
    total_count: stats.totalCount,
    // New fields
    source: row.source,
    solved_at: row.solved_at,
    topic_domain: row.topic_domain,
    topic_ids: row.topic_ids,
    metadata: row.metadata,
  };
}

function buildReviewStats(rows: ReviewDbRow[]) {
  const stats = new Map<string, { goodCount: number; totalCount: number }>();

  for (const row of rows) {
    const existing = stats.get(row.card_id) ?? { goodCount: 0, totalCount: 0 };
    existing.totalCount += 1;
    if (row.rating === "GOOD" || row.rating === "EASY") {
      existing.goodCount += 1;
    }
    stats.set(row.card_id, existing);
  }

  return stats;
}

async function listReviewStatsForCards(userId: string, cardIds: string[]) {
  if (cardIds.length === 0) {
    return new Map<string, { goodCount: number; totalCount: number }>();
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reviews")
    .select("card_id, rating")
    .eq("user_id", userId)
    .in("card_id", cardIds);

  if (error) {
    throw new Error(error.message);
  }

  return buildReviewStats((data ?? []) as ReviewDbRow[]);
}

export async function listCardsForUser(userId: string, dueOnly = false) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const endOfDayIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();

  let query = supabase
    .from("cards")
    .select(
      "id, type, title, description, url, notes, solution, difficulty, last_rating, last_reviewed_at, next_review_at, tags, created_at, easiness_factor, interval_days, repetition_count, source, solved_at, topic_domain, topic_ids, metadata",
    )
    .eq("user_id", userId)
    .order("next_review_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (dueOnly) {
    query = query.lte("next_review_at", endOfDayIso);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const cardRows = (data ?? []) as CardDbRow[];
  const stats = await listReviewStatsForCards(
    userId,
    cardRows.map((row) => row.id),
  );

  return cardRows.map((row) =>
    mapCardRowToFlashcard(
      toCardRow(row, stats.get(row.id) ?? { goodCount: 0, totalCount: 0 }),
    ),
  );
}

export async function getCardById(userId: string, cardId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("cards")
    .select(
      "id, type, title, description, url, notes, solution, difficulty, last_rating, last_reviewed_at, next_review_at, tags, created_at, easiness_factor, interval_days, repetition_count, source, solved_at, topic_domain, topic_ids, metadata",
    )
    .eq("user_id", userId)
    .eq("id", cardId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }

  const stats = await listReviewStatsForCards(userId, [cardId]);
  const row = data as CardDbRow;

  return mapCardRowToFlashcard(
    toCardRow(row, stats.get(row.id) ?? { goodCount: 0, totalCount: 0 }),
  );
}

export async function updateCardById(
  userId: string,
  cardId: string,
  updates: {
    title?: string;
    description?: string;
    url?: string | null;
    difficulty?: "easy" | "medium" | "hard";
    notes?: string;
    tags?: string[];
    solution?: string | null;
    solutions?: { name: string; content: string }[] | null;
    timeComplexity?: string | null;
    spaceComplexity?: string | null;
    relatedProblems?: { title: string; url?: string }[] | null;
    solvedAt?: string | null;
    topicDomain?: string | null;
    topicIds?: string[];
    metadata?: Record<string, unknown>;
  },
) {
  const supabase = getSupabaseAdmin();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.url !== undefined) payload.url = updates.url;
  if (updates.difficulty !== undefined) payload.difficulty = updates.difficulty;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.solvedAt !== undefined) payload.solved_at = updates.solvedAt;
  if (updates.topicDomain !== undefined) payload.topic_domain = updates.topicDomain;
  if (updates.topicIds !== undefined) payload.topic_ids = updates.topicIds;
  if (updates.metadata !== undefined) payload.metadata = updates.metadata;

  const hasRichUpdate =
    updates.solution !== undefined ||
    updates.solutions !== undefined ||
    updates.timeComplexity !== undefined ||
    updates.spaceComplexity !== undefined ||
    updates.relatedProblems !== undefined;

  let finalTags = updates.tags;

  if (hasRichUpdate) {
    const existingCard = await getCardById(userId, cardId);
    if (!existingCard) throw new Error("Card not found");

    if (finalTags === undefined) {
      finalTags = existingCard.tags;
    }

    const mergedTime = updates.timeComplexity !== undefined ? updates.timeComplexity : existingCard.timeComplexity;
    const mergedSpace = updates.spaceComplexity !== undefined ? updates.spaceComplexity : existingCard.spaceComplexity;

    finalTags = upsertComplexityTags(finalTags, mergedTime || undefined, mergedSpace || undefined);

    payload.solution = encodeCardContent({
      fallbackSolution: updates.solution !== undefined ? updates.solution || undefined : existingCard.solution,
      solutions: updates.solutions !== undefined ? updates.solutions || [] : existingCard.solutions,
      timeComplexity: mergedTime || undefined,
      spaceComplexity: mergedSpace || undefined,
      relatedProblems: updates.relatedProblems !== undefined ? updates.relatedProblems || [] : existingCard.relatedProblems,
    });
  } else if (updates.tags !== undefined) {
    payload.tags = updates.tags;
  }

  if (finalTags !== undefined) {
    payload.tags = finalTags;
  }

  const { data, error } = await supabase
    .from("cards")
    .update(payload)
    .eq("user_id", userId)
    .eq("id", cardId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }

  return getCardById(userId, cardId);
}

export async function addCardForUser(
  userId: string,
  input: {
    type: "leetcode" | "cs";
    title: string;
    description: string;
    difficulty: "easy" | "medium" | "hard";
    tags?: string[];
    notes?: string;
    solution?: string;
    solutions?: CardSolutionItem[];
    timeComplexity?: string;
    spaceComplexity?: string;
    relatedProblems?: RelatedProblemLink[];
    url?: string;
    reviewInDays?: number;
    // New fields
    source?: string;
    solvedAt?: string;
    topicDomain?: string;
    topicIds?: string[];
    metadata?: Record<string, unknown>;
  },
) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const reviewDate = new Date(now);
  if (input.reviewInDays != null && input.reviewInDays > 0) {
    reviewDate.setUTCDate(reviewDate.getUTCDate() + input.reviewInDays);
  }
  const finalTags = upsertComplexityTags(
    input.tags,
    input.timeComplexity,
    input.spaceComplexity,
  );
  const serializedSolution = encodeCardContent({
    fallbackSolution: input.solution,
    solutions: input.solutions,
    timeComplexity: input.timeComplexity,
    spaceComplexity: input.spaceComplexity,
    relatedProblems: input.relatedProblems,
  });

  const { data, error } = await supabase
    .from("cards")
    .insert({
      user_id: userId,
      type: input.type,
      title: input.title,
      description: input.description,
      difficulty: input.difficulty,
      tags: finalTags,
      notes: input.notes ?? "",
      solution: serializedSolution,
      url: input.url ?? null,
      next_review_at: reviewDate.toISOString(),
      // New fields
      source: input.source ?? "manual",
      solved_at: input.solvedAt ?? null,
      topic_domain: input.topicDomain ?? null,
      topic_ids: input.topicIds ?? [],
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return getCardById(userId, data.id);
}

export async function deleteCardById(userId: string, cardId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("cards")
    .delete()
    .eq("user_id", userId)
    .eq("id", cardId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data !== null;
}

export async function submitReview(
  userId: string,
  cardId: string,
  rating: ReviewRating,
  responseMs?: number,
  manualReviewDays?: number,
) {
  const supabase = getSupabaseAdmin();

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("easiness_factor, interval_days, repetition_count")
    .eq("id", cardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (cardError) {
    throw new Error(cardError.message);
  }
  if (!card) {
    throw new Error("Card not found.");
  }

  const now = new Date();
  const srs = computeSrs(
    {
      easinessFactor: Number(card.easiness_factor),
      intervalDays: card.interval_days,
      repetitionCount: card.repetition_count,
    },
    rating,
    now,
  );

  if (manualReviewDays !== undefined && manualReviewDays >= 0) {
    srs.intervalDays = manualReviewDays;
    const nextDate = new Date(now);
    nextDate.setDate(nextDate.getDate() + manualReviewDays);
    srs.nextReviewAt = nextDate;
  }

  const { error: reviewError } = await supabase.from("reviews").insert({
    user_id: userId,
    card_id: cardId,
    rating,
    reviewed_at: now.toISOString(),
    response_ms: responseMs ?? null,
    interval_days: srs.intervalDays,
    easiness_factor: srs.easinessFactor,
    repetition_count: srs.repetitionCount,
  });

  if (reviewError) {
    throw new Error(reviewError.message);
  }

  const { error: cardUpdateError } = await supabase
    .from("cards")
    .update({
      easiness_factor: srs.easinessFactor,
      interval_days: srs.intervalDays,
      repetition_count: srs.repetitionCount,
      last_rating: rating,
      last_reviewed_at: now.toISOString(),
      next_review_at: srs.nextReviewAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", cardId)
    .eq("user_id", userId);

  if (cardUpdateError) {
    throw new Error(cardUpdateError.message);
  }

  return {
    card: await getCardById(userId, cardId),
    schedule: srs,
  };
}

export async function getDashboardStats(userId: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const endOfDayIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();

  const { count: dueCount, error: dueError } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .lte("next_review_at", endOfDayIso);

  if (dueError) {
    throw new Error(dueError.message);
  }

  const { count: totalCount, error: totalError } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (totalError) {
    throw new Error(totalError.message);
  }

  return {
    cardsDueToday: dueCount ?? 0,
    totalCards: totalCount ?? 0,
  };
}

export async function listUsersDueForReminder() {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const endOfDayIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, timezone")
    .eq("reminders_enabled", true);

  if (usersError) {
    throw new Error(usersError.message);
  }

  const userRows =
    (users as Array<{ id: string; email: string; timezone: string }> | null) ?? [];
  if (userRows.length === 0) {
    return [];
  }

  const userIds = userRows.map((user) => user.id);
  const { data: dueCards, error: dueCardsError } = await supabase
    .from("cards")
    .select("user_id")
    .in("user_id", userIds)
    .lte("next_review_at", endOfDayIso);

  if (dueCardsError) {
    throw new Error(dueCardsError.message);
  }

  const dueByUser = new Map<string, number>();
  for (const row of (dueCards as Array<{ user_id: string }> | null) ?? []) {
    dueByUser.set(row.user_id, (dueByUser.get(row.user_id) ?? 0) + 1);
  }

  return userRows
    .map((user) => ({
      id: user.id,
      email: user.email,
      timezone: user.timezone,
      due_count: dueByUser.get(user.id) ?? 0,
    }))
    .filter((user) => user.due_count > 0)
    .sort((a, b) => b.due_count - a.due_count);
}

export async function upsertPushSubscription(
  userId: string,
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function listPushSubscriptions(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (
    (data as Array<{ endpoint: string; p256dh: string; auth: string }> | null) ??
    []
  );
}

export async function getUserProfile(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, timezone, reminders_enabled")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateReminderSettings(
  userId: string,
  updates: {
    remindersEnabled?: boolean;
    timezone?: string;
  },
) {
  const profile = await getUserProfile(userId);
  if (!profile) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const nextEnabled = updates.remindersEnabled ?? profile.reminders_enabled;
  const nextTimezone = updates.timezone ?? profile.timezone;

  const { data, error } = await supabase
    .from("users")
    .update({
      reminders_enabled: nextEnabled,
      timezone: nextTimezone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id, email, timezone, reminders_enabled")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// ── Global Pause ──────────────────────────────────────────────

export interface GlobalPauseState {
  active: boolean;
  startedAt: string | null;
  until: string | null;
  autoResume: boolean;
  remainingDays: number | null; // days left in pause
}

export async function getGlobalPauseStatus(userId: string): Promise<GlobalPauseState> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const meta = (data?.metadata as Record<string, unknown>) || {};
  const gp = (meta.global_pause as Record<string, unknown>) || null;

  if (!gp || gp.active !== true) {
    return { active: false, startedAt: null, until: null, autoResume: false, remainingDays: null };
  }

  const until = gp.until as string | null;
  let remainingDays: number | null = null;
  if (until) {
    const diff = new Date(until).getTime() - Date.now();
    remainingDays = Math.max(0, Math.ceil(diff / 86_400_000));
  }

  return {
    active: true,
    startedAt: (gp.started_at as string) || null,
    until,
    autoResume: (gp.auto_resume as boolean) || false,
    remainingDays,
  };
}

export async function globalPauseReviews(
  userId: string,
  pauseDays: number,
  autoResume: boolean,
) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const untilDate = new Date(now);
  untilDate.setDate(untilDate.getDate() + pauseDays);

  // 1. Get all active (non-paused) cards
  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, next_review_at, metadata")
    .eq("user_id", userId);

  if (cardsError) throw new Error(cardsError.message);

  // 2. For each card, snapshot the EXACT original next_review_at and push to far-future
  for (const card of cards ?? []) {
    const currentMeta = (card.metadata as Record<string, unknown>) || {};

    // Skip already individually-paused cards (they already have far-future next_review_at)
    if (currentMeta.review_paused === true) continue;
    // Skip already globally_paused cards
    if (currentMeta.globally_paused === true) continue;

    const { error } = await supabase
      .from("cards")
      .update({
        next_review_at: "9999-12-31T23:59:59.999Z",
        metadata: {
          ...currentMeta,
          original_next_review_at: card.next_review_at,
          globally_paused: true,
        },
        updated_at: now.toISOString(),
      })
      .eq("id", card.id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
  }

  // 3. Update user metadata with global pause state
  const { data: userData, error: userFetchError } = await supabase
    .from("users")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle();

  if (userFetchError) throw new Error(userFetchError.message);

  const userMeta = (userData?.metadata as Record<string, unknown>) || {};
  const { error: userUpdateError } = await supabase
    .from("users")
    .update({
      metadata: {
        ...userMeta,
        global_pause: {
          active: true,
          started_at: now.toISOString(),
          until: untilDate.toISOString(),
          auto_resume: autoResume,
        },
      },
      updated_at: now.toISOString(),
    })
    .eq("id", userId);

  if (userUpdateError) throw new Error(userUpdateError.message);

  return getGlobalPauseStatus(userId);
}

export async function globalResumeReviews(userId: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date();

  // 1. Restore all globally-paused cards
  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, metadata, last_reviewed_at, interval_days")
    .eq("user_id", userId);

  if (cardsError) throw new Error(cardsError.message);

  for (const card of cards ?? []) {
    const meta = (card.metadata as Record<string, unknown>) || {};

    // Only restore cards that were globally paused (not individually paused)
    if (meta.globally_paused !== true) continue;

    // Restore the exact original next_review_at if we have it
    let nextReviewIso: string;
    if (meta.original_next_review_at && typeof meta.original_next_review_at === "string") {
      nextReviewIso = meta.original_next_review_at;
    } else if (meta.remaining_review_days != null) {
      // Legacy fallback: reconstruct from remaining_review_days
      let remainingDays = meta.remaining_review_days as number;
      if (remainingDays > 10000) remainingDays = 0;
      const nextReview = new Date(now);
      nextReview.setDate(nextReview.getDate() + remainingDays);
      nextReviewIso = nextReview.toISOString();
    } else if (card.last_reviewed_at != null && card.interval_days != null) {
      // Recovery: reconstruct from SRS data
      const lastReview = new Date(card.last_reviewed_at as string);
      const intendedNext = new Date(lastReview);
      intendedNext.setDate(intendedNext.getDate() + (card.interval_days as number));
      nextReviewIso = intendedNext.toISOString();
    } else {
      nextReviewIso = now.toISOString();
    }

    // Clean up the global-pause metadata
    const { remaining_review_days, globally_paused, original_next_review_at, ...cleanMeta } = meta;
    void remaining_review_days;
    void globally_paused;
    void original_next_review_at;

    const { error } = await supabase
      .from("cards")
      .update({
        next_review_at: nextReviewIso,
        metadata: cleanMeta,
        updated_at: now.toISOString(),
      })
      .eq("id", card.id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
  }

  // 2. Clear user pause state
  const { data: userData, error: userFetchError } = await supabase
    .from("users")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle();

  if (userFetchError) throw new Error(userFetchError.message);

  const userMeta = (userData?.metadata as Record<string, unknown>) || {};
  const { global_pause, ...cleanUserMeta } = userMeta;
  void global_pause;

  const { error: userUpdateError } = await supabase
    .from("users")
    .update({
      metadata: cleanUserMeta,
      updated_at: now.toISOString(),
    })
    .eq("id", userId);

  if (userUpdateError) throw new Error(userUpdateError.message);

  return { resumed: true };
}

export async function extendGlobalPause(userId: string, additionalDays: number) {
  const supabase = getSupabaseAdmin();

  const { data: userData, error: fetchError } = await supabase
    .from("users")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);

  const userMeta = (userData?.metadata as Record<string, unknown>) || {};
  const gp = (userMeta.global_pause as Record<string, unknown>) || {};

  if (gp.active !== true) {
    throw new Error("Reviews are not currently paused.");
  }

  const currentUntil = new Date(gp.until as string);
  currentUntil.setDate(currentUntil.getDate() + additionalDays);

  const { error: updateError } = await supabase
    .from("users")
    .update({
      metadata: {
        ...userMeta,
        global_pause: {
          ...gp,
          until: currentUntil.toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) throw new Error(updateError.message);

  return getGlobalPauseStatus(userId);
}

/**
 * Returns users whose global pause expires within the next ~24 hours (for advance email).
 */
export async function listUsersWithExpiringPause() {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // We need to search users whose metadata.global_pause.until is between now and tomorrow
  // Supabase JSON filtering: metadata->global_pause->>until
  const { data, error } = await supabase
    .from("users")
    .select("id, email, metadata")
    .not("metadata->global_pause", "is", null);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((user) => {
      const meta = (user.metadata as Record<string, unknown>) || {};
      const gp = (meta.global_pause as Record<string, unknown>) || {};
      if (gp.active !== true || gp.auto_resume !== true) return false;
      const until = new Date(gp.until as string);
      // Expires within 24-48h from now (so we send 1 day before)
      const hoursUntilExpiry = (until.getTime() - now.getTime()) / 3_600_000;
      return hoursUntilExpiry > 0 && hoursUntilExpiry <= 48;
    })
    .map((user) => ({
      id: user.id,
      email: user.email as string,
      until: ((user.metadata as Record<string, unknown>)?.global_pause as Record<string, unknown>)?.until as string,
    }));
}

/**
 * Returns users whose global pause has expired and auto_resume is true.
 */
export async function listUsersWithExpiredPause() {
  const supabase = getSupabaseAdmin();
  const now = new Date();

  const { data, error } = await supabase
    .from("users")
    .select("id, email, metadata")
    .not("metadata->global_pause", "is", null);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((user) => {
      const meta = (user.metadata as Record<string, unknown>) || {};
      const gp = (meta.global_pause as Record<string, unknown>) || {};
      if (gp.active !== true || gp.auto_resume !== true) return false;
      const until = new Date(gp.until as string);
      return until.getTime() <= now.getTime();
    })
    .map((user) => ({
      id: user.id,
      email: user.email as string,
    }));
}


export async function seedInitialCards(userId: string) {
  const supabase = getSupabaseAdmin();

  const { count, error: countError } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) {
    throw new Error(countError.message);
  }

  if ((count ?? 0) > 0) {
    return { inserted: 0 };
  }

  const now = new Date();
  const oneDayMs = 86_400_000;

  const rows = mockCards.map((card) => ({
    user_id: userId,
    type: card.type,
    title: card.title,
    description: card.description,
    url: card.url ?? null,
    notes: card.notes,
    solution: card.solution ?? null,
    difficulty: card.difficulty,
    tags: card.tags,
    last_rating: card.lastRating,
    last_reviewed_at: new Date(now.getTime() - oneDayMs).toISOString(),
    next_review_at: new Date(now.getTime() + card.dueInDays * oneDayMs).toISOString(),
    // New fields
    source: card.source ?? "seed",
    topic_domain: card.topicDomain ?? null,
    topic_ids: card.topicIds ?? [],
    metadata: card.metadata ?? {},
  }));

  const { error: insertError } = await supabase.from("cards").insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }

  return { inserted: rows.length };
}

// ── Analytics ─────────────────────────────────────────────────

/**
 * Returns daily accuracy data for the last N days.
 * Each entry: { date, total, good, accuracy }
 */
export async function getPerformanceData(userId: string, days = 30) {
  const supabase = getSupabaseAdmin();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("reviews")
    .select("rating, reviewed_at")
    .eq("user_id", userId)
    .gte("reviewed_at", since.toISOString())
    .order("reviewed_at", { ascending: true });

  if (error) throw new Error(error.message);

  const dayMap = new Map<string, { total: number; good: number }>();

  // Pre-fill all days so the chart has no gaps
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, { total: 0, good: 0 });
  }

  for (const row of data ?? []) {
    const key = (row.reviewed_at as string).slice(0, 10);
    const entry = dayMap.get(key);
    if (entry) {
      entry.total += 1;
      if (row.rating === "GOOD" || row.rating === "EASY") {
        entry.good += 1;
      }
    }
  }

  return Array.from(dayMap.entries()).map(([date, { total, good }]) => ({
    date,
    total,
    good,
    accuracy: total > 0 ? Math.round((good / total) * 100) : null,
  }));
}

/**
 * Returns mastery scores grouped by tag.
 * Score is based on average easiness_factor of cards with that tag.
 */
export async function getTopicMastery(userId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("cards")
    .select("tags, easiness_factor, repetition_count, last_rating")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const tagStats = new Map<
    string,
    { totalEf: number; count: number; reviewed: number }
  >();

  for (const row of data ?? []) {
    const tags = (row.tags as string[] | null) ?? [];
    const ef = Number(row.easiness_factor) || 2.5;
    const reviewed = (row.repetition_count as number) > 0 ? 1 : 0;

    for (const tag of tags) {
      if (/^(Time|Space):/i.test(tag)) continue;
      const existing = tagStats.get(tag) ?? { totalEf: 0, count: 0, reviewed: 0 };
      existing.totalEf += ef;
      existing.count += 1;
      existing.reviewed += reviewed;
      tagStats.set(tag, existing);
    }
  }

  // Normalize EF (1.3 – 2.5+) to 0–100 mastery score
  return Array.from(tagStats.entries())
    .map(([topic, { totalEf, count, reviewed }]) => {
      const avgEf = totalEf / count;
      // EF ranges from 1.3 (hard) to ~4.0 (easy). Map to 0-100.
      const mastery = Math.min(100, Math.max(0, Math.round(((avgEf - 1.3) / 1.7) * 100)));
      return { topic, mastery, cardCount: count, reviewedCount: reviewed };
    })
    .sort((a, b) => b.cardCount - a.cardCount);
}

/**
 * Returns the user's current review streak (consecutive days with reviews).
 */
export async function getUserStreak(userId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("reviews")
    .select("reviewed_at")
    .eq("user_id", userId)
    .order("reviewed_at", { ascending: false })
    .limit(500); // Recent reviews only

  if (error) throw new Error(error.message);

  if (!data || data.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalReviewDays: 0 };
  }

  // Get unique review days
  const reviewDays = new Set<string>();
  for (const row of data) {
    reviewDays.add((row.reviewed_at as string).slice(0, 10));
  }

  const sortedDays = Array.from(reviewDays).sort().reverse(); // Most recent first

  // Calculate current streak
  let currentStreak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  // Streak must include today or yesterday
  if (sortedDays[0] !== today && sortedDays[0] !== yesterday) {
    currentStreak = 0;
  } else {
    let expectedDate = new Date(sortedDays[0]);
    for (const day of sortedDays) {
      const dayDate = new Date(day);
      const expected = expectedDate.toISOString().slice(0, 10);
      if (day === expected) {
        currentStreak += 1;
        expectedDate = new Date(dayDate.getTime() - 86_400_000);
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;
  const ascending = Array.from(reviewDays).sort();
  for (let i = 1; i < ascending.length; i++) {
    const prev = new Date(ascending[i - 1]);
    const curr = new Date(ascending[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / 86_400_000;
    if (diffDays === 1) {
      tempStreak += 1;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    currentStreak,
    longestStreak,
    totalReviewDays: reviewDays.size,
  };
}

/**
 * Returns a summary of the past week's activity for the weekly email.
 */
export async function getWeeklySummary(userId: string) {
  const supabase = getSupabaseAdmin();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("card_id, rating, reviewed_at")
    .eq("user_id", userId)
    .gte("reviewed_at", weekAgo.toISOString());

  if (error) throw new Error(error.message);

  const totalReviews = reviews?.length ?? 0;
  const uniqueCards = new Set((reviews ?? []).map((r) => r.card_id)).size;

  const ratings: Record<string, number> = { AGAIN: 0, HARD: 0, GOOD: 0, EASY: 0 };
  for (const r of reviews ?? []) {
    ratings[r.rating as string] = (ratings[r.rating as string] || 0) + 1;
  }

  const accuracy =
    totalReviews > 0
      ? Math.round(((ratings.GOOD + ratings.EASY) / totalReviews) * 100)
      : 0;

  // Get topic mastery for strongest/weakest
  const mastery = await getTopicMastery(userId);
  const strongest = mastery.length > 0 ? mastery.reduce((a, b) => (a.mastery > b.mastery ? a : b)) : null;
  const weakest = mastery.length > 0 ? mastery.reduce((a, b) => (a.mastery < b.mastery ? a : b)) : null;

  // Get streak info
  const streak = await getUserStreak(userId);

  return {
    totalReviews,
    uniqueCards,
    ratings,
    accuracy,
    currentStreak: streak.currentStreak,
    strongestTopic: strongest?.topic ?? null,
    weakestTopic: weakest?.topic ?? null,
  };
}
