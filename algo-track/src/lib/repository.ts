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
  description?: string;
  url: string | null;
  notes?: string | null;
  solution?: string | null;
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
    description: row.description ?? "",
    url: row.url,
    notes: row.notes ?? "",
    solution: row.solution ?? null,
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

export async function listCardsForUser(userId: string, dueOnly = false, light = false) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const endOfDayIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();

  let selectFields = "id, type, title, description, url, notes, solution, difficulty, last_rating, last_reviewed_at, next_review_at, tags, created_at, easiness_factor, interval_days, repetition_count, source, solved_at, topic_domain, topic_ids, metadata";

  if (light) {
    selectFields = "id, type, title, url, difficulty, last_rating, last_reviewed_at, next_review_at, tags, created_at, easiness_factor, interval_days, repetition_count, source, solved_at, topic_domain, topic_ids, metadata";
  }

  let query = supabase
    .from("cards")
    .select(selectFields)
    .eq("user_id", userId);

  if (dueOnly) {
    query = query.lte("next_review_at", endOfDayIso);
  }

  query = query
    .order("next_review_at", { ascending: true })
    .order("created_at", { ascending: true });

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const cardRows = (data as unknown as CardDbRow[]) ?? [];

  if (light) {
    for (const row of cardRows) {
      if (row.metadata) {
        row.metadata = { ...row.metadata };
        delete row.metadata.richNotes;
        delete row.metadata.systemDesignCanvas;
      }
    }
  }

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
    richNotes?: string;
    nextReview?: string;
    dueInDays?: number;
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
  const hasRichUpdate =
    updates.solution !== undefined ||
    updates.solutions !== undefined ||
    updates.timeComplexity !== undefined ||
    updates.spaceComplexity !== undefined ||
    updates.relatedProblems !== undefined;

  const needsExistingCard =
    hasRichUpdate ||
    updates.richNotes !== undefined ||
    updates.metadata !== undefined;

  let existingCard = null;
  if (needsExistingCard) {
    existingCard = await getCardById(userId, cardId);
    if (!existingCard) throw new Error("Card not found");
  }

  if (updates.metadata !== undefined || updates.richNotes !== undefined) {
    const existingMeta = existingCard?.metadata || {};
    payload.metadata = {
      ...existingMeta,
      ...(updates.metadata || {}),
      ...(updates.richNotes !== undefined ? { richNotes: updates.richNotes } : {})
    };
  }

  if (updates.nextReview !== undefined) payload.next_review_at = updates.nextReview;
  if (updates.dueInDays !== undefined) payload.interval_days = updates.dueInDays;

  let finalTags = updates.tags;

  if (hasRichUpdate) {
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
    richNotes?: string;
  },
) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const reviewDate = new Date(now);
  if (input.metadata?.reference_only === true) {
    reviewDate.setTime(new Date("9999-12-31T23:59:59.999Z").getTime());
  } else if (input.reviewInDays != null && input.reviewInDays > 0) {
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
      metadata: input.richNotes
        ? { ...(input.metadata ?? {}), richNotes: input.richNotes }
        : (input.metadata ?? {}),
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
    .select("easiness_factor, interval_days, repetition_count, metadata")
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

  const cardMeta = card.metadata as Record<string, unknown> | null;
  const isReference = cardMeta?.reference_only === true;
  const isPaused = cardMeta?.review_paused === true || cardMeta?.globally_paused === true;

  const { error: cardUpdateError } = await supabase
    .from("cards")
    .update({
      easiness_factor: srs.easinessFactor,
      interval_days: isReference ? 0 : srs.intervalDays,
      repetition_count: srs.repetitionCount,
      last_rating: rating,
      last_reviewed_at: now.toISOString(),
      next_review_at: (isReference || isPaused) ? "9999-12-31T23:59:59.999Z" : srs.nextReviewAt.toISOString(),
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
  const startOfDayIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)).toISOString();
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

  const { count: reviewsTodayCount, error: reviewsTodayError } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("reviewed_at", startOfDayIso)
    .lte("reviewed_at", endOfDayIso);

  if (reviewsTodayError) {
    throw new Error(reviewsTodayError.message);
  }

  return {
    cardsDueToday: dueCount ?? 0,
    totalCards: totalCount ?? 0,
    reviewsToday: reviewsTodayCount ?? 0,
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
    .select("id, email, timezone, reminders_enabled, metadata")
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
    preferences?: {
      defaultTheme?: string;
      keyboardShortcutsEnabled?: boolean;
      maxDailyReviews?: number | null;
    };
  },
) {
  const profile = await getUserProfile(userId);
  if (!profile) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const nextEnabled = updates.remindersEnabled ?? (profile as any).reminders_enabled;
  const nextTimezone = updates.timezone ?? (profile as any).timezone;

  const existingMeta = ((profile as any).metadata as Record<string, unknown>) || {};
  const existingPrefs = (existingMeta.preferences as Record<string, unknown>) || {};
  const nextPrefs = {
    ...existingPrefs,
    ...(updates.preferences ?? {}),
  };
  const nextMeta = {
    ...existingMeta,
    preferences: nextPrefs,
  };

  const { data, error } = await supabase
    .from("users")
    .update({
      reminders_enabled: nextEnabled,
      timezone: nextTimezone,
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id, email, timezone, reminders_enabled, metadata")
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
  types?: {
    all: GlobalPauseState;
    leetcode: GlobalPauseState;
    cs: GlobalPauseState;
    sql: GlobalPauseState;
  };
}

function getPauseState(gp: any): GlobalPauseState {
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
  const tp = (meta.type_pauses as Record<string, unknown>) || {};

  const allStatus = getPauseState(tp.all || gp);
  const leetcodeStatus = getPauseState(tp.leetcode);
  const csStatus = getPauseState(tp.cs);
  const sqlStatus = getPauseState(tp.sql);

  return {
    ...allStatus,
    types: {
      all: allStatus,
      leetcode: leetcodeStatus,
      cs: csStatus,
      sql: sqlStatus,
    }
  };
}

export async function globalPauseReviews(
  userId: string,
  pauseDays: number,
  autoResume: boolean,
  cardType: "all" | "leetcode" | "cs" | "sql" = "all",
) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const untilDate = new Date(now);
  untilDate.setDate(untilDate.getDate() + pauseDays);

  // 1. Get all active (non-paused) cards
  let query = supabase
    .from("cards")
    .select("id, type, next_review_at, metadata")
    .eq("user_id", userId);

  if (cardType !== "all") {
    query = query.eq("type", cardType);
  }

  const { data: cards, error: cardsError } = await query;

  if (cardsError) throw new Error(cardsError.message);

  // 2. For each card, snapshot the EXACT original next_review_at and push to far-future
  // Run updates in parallel batches of 25 to avoid N+1 sequential queries
  const eligibleCards = (cards ?? []).filter(card => {
    const currentMeta = (card.metadata as Record<string, unknown>) || {};
    // Skip already individually-paused or globally_paused cards
    return currentMeta.review_paused !== true && currentMeta.globally_paused !== true;
  });

  const BATCH_SIZE = 25;
  for (let i = 0; i < eligibleCards.length; i += BATCH_SIZE) {
    const batch = eligibleCards.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(card => {
      const currentMeta = (card.metadata as Record<string, unknown>) || {};
      return supabase
        .from("cards")
        .update({
          next_review_at: "9999-12-31T23:59:59.999Z",
          metadata: {
            ...currentMeta,
            original_next_review_at: card.next_review_at,
            pause_started_at: now.toISOString(),
            globally_paused: true,
            paused_by_type: cardType,
          },
          updated_at: now.toISOString(),
        })
        .eq("id", card.id)
        .eq("user_id", userId)
        .then(({ error }) => { if (error) throw new Error(error.message); });
    }));
  }

  // 3. Update user metadata with global pause state
  const { data: userData, error: userFetchError } = await supabase
    .from("users")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle();

  if (userFetchError) throw new Error(userFetchError.message);

  const userMeta = (userData?.metadata as Record<string, unknown>) || {};
  const currentTp = (userMeta.type_pauses as Record<string, unknown>) || {};

  const newPauseObj = {
    active: true,
    started_at: now.toISOString(),
    until: untilDate.toISOString(),
    auto_resume: autoResume,
  };

  const updatedTp = {
    ...currentTp,
    [cardType]: newPauseObj,
  };

  const updatedUserMeta: Record<string, unknown> = {
    ...userMeta,
    type_pauses: updatedTp,
  };

  if (cardType === "all") {
    updatedUserMeta.global_pause = newPauseObj;
  }

  const { error: userUpdateError } = await supabase
    .from("users")
    .update({
      metadata: updatedUserMeta,
      updated_at: now.toISOString(),
    })
    .eq("id", userId);

  if (userUpdateError) throw new Error(userUpdateError.message);

  return getGlobalPauseStatus(userId);
}

export async function globalResumeReviews(
  userId: string,
  cardType: "all" | "leetcode" | "cs" | "sql" = "all",
) {
  const supabase = getSupabaseAdmin();
  const now = new Date();

  // 0. Fetch the user-level pause metadata to get fallback started_at
  const { data: userData, error: userFetchError } = await supabase
    .from("users")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle();

  if (userFetchError) throw new Error(userFetchError.message);

  const userMeta = (userData?.metadata as Record<string, unknown>) || {};
  const gp = (userMeta.global_pause as Record<string, unknown>) || {};
  const tp = (userMeta.type_pauses as Record<string, unknown>) || {};
  const targetPauseObj = (cardType === "all" ? (tp.all || gp) : tp[cardType]) as Record<string, unknown> || {};
  const userPauseStartedAt = targetPauseObj.started_at
    ? new Date(targetPauseObj.started_at as string)
    : now;

  // 1. Fetch all globally-paused cards
  let query = supabase
    .from("cards")
    .select("id, type, metadata, last_reviewed_at, interval_days")
    .eq("user_id", userId);

  if (cardType !== "all") {
    query = query.eq("type", cardType);
  }

  const { data: cards, error: cardsError } = await query;

  if (cardsError) throw new Error(cardsError.message);

  // Separate cards into those with valid offsets and those that were already overdue
  const cardsToResume: Array<{
    id: string;
    meta: Record<string, unknown>;
    offsetDays: number;
  }> = [];

  for (const card of cards ?? []) {
    const meta = (card.metadata as Record<string, unknown>) || {};

    // Only restore cards that were globally paused (not individually paused)
    if (meta.globally_paused !== true) continue;

    // Filter by cardType: a card matches if we are resuming all, or if its paused_by_type matches,
    // or if paused_by_type is missing and card type matches cardType
    if (cardType !== "all") {
      const pausedByType = meta.paused_by_type as string | undefined;
      const isMatch = pausedByType === cardType || (!pausedByType && card.type === cardType);
      if (!isMatch) continue;
    }

    // Determine the pause start time for this card
    const cardPauseStartedAt = meta.pause_started_at
      ? new Date(meta.pause_started_at as string)
      : userPauseStartedAt;

    // Calculate relative offset: how many days from pause-start to original next_review
    let offsetDays = 0;
    if (meta.original_next_review_at && typeof meta.original_next_review_at === "string") {
      const originalNext = new Date(meta.original_next_review_at as string);
      const diffMs = originalNext.getTime() - cardPauseStartedAt.getTime();
      offsetDays = diffMs / 86_400_000; // can be negative if card was already overdue
    } else if (meta.remaining_review_days != null) {
      // Legacy fallback
      let remainingDays = meta.remaining_review_days as number;
      if (remainingDays > 10000) remainingDays = 0;
      offsetDays = remainingDays;
    } else if (card.last_reviewed_at != null && card.interval_days != null) {
      // Recovery: reconstruct from SRS data relative to pause start
      const lastReview = new Date(card.last_reviewed_at as string);
      const intendedNext = new Date(lastReview);
      intendedNext.setDate(intendedNext.getDate() + (card.interval_days as number));
      const diffMs = intendedNext.getTime() - cardPauseStartedAt.getTime();
      offsetDays = diffMs / 86_400_000;
    }

    cardsToResume.push({ id: card.id, meta, offsetDays });
  }

  // Sort cards by offsetDays so we can stagger overdue ones
  cardsToResume.sort((a, b) => a.offsetDays - b.offsetDays);

  // For cards that were already overdue (offset <= 0), stagger them evenly
  // starting from today (day 0..N) in batches of 7 per day
  const overdueCards = cardsToResume.filter((c) => c.offsetDays <= 0);
  const futureCards = cardsToResume.filter((c) => c.offsetDays > 0);

  // Assign staggered days for overdue cards: 7 cards per day starting from day 0
  const BATCH_SIZE = 7;
  for (let i = 0; i < overdueCards.length; i++) {
    overdueCards[i].offsetDays = Math.floor(i / BATCH_SIZE);
  }

  // Now update all cards in the database — run in parallel batches of 25
  const allCards = [...overdueCards, ...futureCards];

  const RESUME_BATCH = 25;
  for (let i = 0; i < allCards.length; i += RESUME_BATCH) {
    const batch = allCards.slice(i, i + RESUME_BATCH);
    await Promise.all(batch.map(({ id, meta, offsetDays }) => {
      // Calculate new next_review_at relative to now
      const nextReview = new Date(now);
      nextReview.setTime(nextReview.getTime() + offsetDays * 86_400_000);
      const nextReviewIso = nextReview.toISOString();

      // Clean up the global-pause metadata
      const { remaining_review_days, globally_paused, original_next_review_at, pause_started_at, paused_by_type, ...cleanMeta } = meta;
      void remaining_review_days;
      void globally_paused;
      void original_next_review_at;
      void pause_started_at;
      void paused_by_type;

      return supabase
        .from("cards")
        .update({
          next_review_at: nextReviewIso,
          metadata: cleanMeta,
          updated_at: now.toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId)
        .then(({ error }) => { if (error) throw new Error(error.message); });
    }));
  }

  // 2. Clear user pause state
  let updatedUserMeta = { ...userMeta };

  if (cardType === "all") {
    const { global_pause, type_pauses, ...clean } = userMeta;
    void global_pause;
    void type_pauses;
    updatedUserMeta = clean;
  } else {
    const cleanTp = { ...tp };
    delete cleanTp[cardType];
    
    const { global_pause, ...clean } = userMeta;
    void global_pause;
    updatedUserMeta = {
      ...clean,
      type_pauses: cleanTp,
    };
  }

  const { error: userUpdateError } = await supabase
    .from("users")
    .update({
      metadata: updatedUserMeta,
      updated_at: now.toISOString(),
    })
    .eq("id", userId);

  if (userUpdateError) throw new Error(userUpdateError.message);

  return { resumed: true };
}

/**
 * Redistribute all currently-due cards into staggered batches.
 * Cards with next_review_at in the past are split into groups of 7 per day
 * starting from today. Future-scheduled cards are left untouched.
 */
export async function redistributeCards(userId: string, cardsPerDay: number = 7) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const nowIso = now.toISOString();

  // Fetch all cards for this user that are currently due (next_review_at <= now)
  const { data: dueCards, error } = await supabase
    .from("cards")
    .select("id, next_review_at, metadata")
    .eq("user_id", userId)
    .lte("next_review_at", nowIso)
    .order("next_review_at", { ascending: true });

  if (error) throw new Error(error.message);

  const cards = (dueCards ?? []).filter((c) => {
    // Skip individually paused cards
    const meta = (c.metadata as Record<string, unknown>) || {};
    return meta.review_paused !== true;
  });

  if (cards.length === 0) {
    return { redistributed: 0 };
  }

  // Stagger: cardsPerDay cards per day starting from day 1
  // Run in parallel batches of 25 to avoid N+1 sequential queries
  const REDIST_BATCH = 25;
  for (let batchStart = 0; batchStart < cards.length; batchStart += REDIST_BATCH) {
    const batch = cards.slice(batchStart, batchStart + REDIST_BATCH);
    await Promise.all(batch.map((card, batchIdx) => {
      const i = batchStart + batchIdx;
      const dayOffset = Math.floor(i / cardsPerDay) + 1; // start from day 1
      const nextReview = new Date(now);
      nextReview.setDate(nextReview.getDate() + dayOffset);
      // Set to start of that day (midnight UTC) for clean scheduling
      nextReview.setUTCHours(0, 0, 0, 0);

      return supabase
        .from("cards")
        .update({
          next_review_at: nextReview.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", card.id)
        .eq("user_id", userId)
        .then(({ error: updateError }) => { if (updateError) throw new Error(updateError.message); });
    }));
  }

  return { redistributed: cards.length };
}

/**
 * Shuffle ALL unpaused cards randomly and distribute them X/day.
 * Unlike redistributeCards (which only touches overdue cards), this takes
 * every active card regardless of its current next_review_at, shuffles
 * them into a random order, and staggers them at cardsPerDay cards/day starting
 * from tomorrow. This guarantees every card gets a review slot even if
 * the user hasn't been able to keep up with the normal SRS schedule.
 */
export async function shuffleAllCards(userId: string, cardsPerDay: number = 7) {
  const supabase = getSupabaseAdmin();
  const now = new Date();

  // Fetch ALL cards for this user
  const { data: allCards, error } = await supabase
    .from("cards")
    .select("id, metadata")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  // Filter out individually paused and globally paused cards
  const cards = (allCards ?? []).filter((c) => {
    const meta = (c.metadata as Record<string, unknown>) || {};
    return meta.review_paused !== true && meta.globally_paused !== true;
  });

  if (cards.length === 0) {
    return { shuffled: 0 };
  }

  // Fisher-Yates shuffle for true randomness
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  // Stagger: cardsPerDay cards per day starting from day 1 (tomorrow)
  // Run in parallel batches of 25 to avoid N+1 sequential queries
  const SHUFFLE_BATCH = 25;
  for (let batchStart = 0; batchStart < cards.length; batchStart += SHUFFLE_BATCH) {
    const batch = cards.slice(batchStart, batchStart + SHUFFLE_BATCH);
    await Promise.all(batch.map((card, batchIdx) => {
      const i = batchStart + batchIdx;
      const dayOffset = Math.floor(i / cardsPerDay) + 1; // start from day 1
      const nextReview = new Date(now);
      nextReview.setDate(nextReview.getDate() + dayOffset);
      // Set to start of that day (midnight UTC) for clean scheduling
      nextReview.setUTCHours(0, 0, 0, 0);

      return supabase
        .from("cards")
        .update({
          next_review_at: nextReview.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", card.id)
        .eq("user_id", userId)
        .then(({ error: updateError }) => { if (updateError) throw new Error(updateError.message); });
    }));
  }

  return { shuffled: cards.length };
}

export async function extendGlobalPause(
  userId: string,
  additionalDays: number,
  cardType: "all" | "leetcode" | "cs" | "sql" = "all",
) {
  const supabase = getSupabaseAdmin();

  const { data: userData, error: fetchError } = await supabase
    .from("users")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);

  const userMeta = (userData?.metadata as Record<string, unknown>) || {};
  
  if (cardType === "all") {
    const gp = (userMeta.global_pause as Record<string, unknown>) || {};
    if (gp.active !== true) throw new Error("Reviews are not currently paused.");
    const currentUntil = new Date(gp.until as string);
    currentUntil.setDate(currentUntil.getDate() + additionalDays);
    
    // update global_pause and type_pauses.all
    const tp = (userMeta.type_pauses as Record<string, unknown>) || {};
    const updatedTp = {
      ...tp,
      all: {
        ...((tp.all as Record<string, unknown>) || gp),
        until: currentUntil.toISOString(),
      }
    };
    
    const { error: updateError } = await supabase
      .from("users")
      .update({
        metadata: {
          ...userMeta,
          global_pause: {
            ...gp,
            until: currentUntil.toISOString(),
          },
          type_pauses: updatedTp,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) throw new Error(updateError.message);
  } else {
    const tp = (userMeta.type_pauses as Record<string, unknown>) || {};
    const p = (tp[cardType] as Record<string, unknown>) || {};
    if (p.active !== true) throw new Error(`${cardType} reviews are not currently paused.`);
    const currentUntil = new Date(p.until as string);
    currentUntil.setDate(currentUntil.getDate() + additionalDays);
    
    const updatedTp = {
      ...tp,
      [cardType]: {
        ...p,
        until: currentUntil.toISOString(),
      }
    };

    const { error: updateError } = await supabase
      .from("users")
      .update({
        metadata: {
          ...userMeta,
          type_pauses: updatedTp,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) throw new Error(updateError.message);
  }

  return getGlobalPauseStatus(userId);
}

/**
 * Returns users whose global pause or specific card-type pause expires within the next ~24-48 hours (for advance email).
 */
export async function listUsersWithExpiringPause() {
  const supabase = getSupabaseAdmin();
  const now = new Date();

  const { data, error } = await supabase
    .from("users")
    .select("id, email, metadata");

  if (error) throw new Error(error.message);

  const expiring: Array<{ id: string; email: string; until: string; type: "all" | "leetcode" | "cs" | "sql" }> = [];

  for (const user of data ?? []) {
    const meta = (user.metadata as Record<string, unknown>) || {};
    
    // Check global_pause (all)
    const gp = (meta.global_pause as Record<string, unknown>) || {};
    if (gp.active === true && gp.auto_resume === true) {
      const until = new Date(gp.until as string);
      const hoursUntilExpiry = (until.getTime() - now.getTime()) / 3_600_000;
      if (hoursUntilExpiry > 0 && hoursUntilExpiry <= 48) {
        expiring.push({ id: user.id, email: user.email as string, until: gp.until as string, type: "all" });
      }
    }

    // Check type_pauses
    const tp = (meta.type_pauses as Record<string, unknown>) || {};
    for (const type of ["all", "leetcode", "cs", "sql"] as const) {
      const p = (tp[type] as Record<string, unknown>) || {};
      if (p.active === true && p.auto_resume === true) {
        const until = new Date(p.until as string);
        const hoursUntilExpiry = (until.getTime() - now.getTime()) / 3_600_000;
        if (hoursUntilExpiry > 0 && hoursUntilExpiry <= 48) {
          if (type === "all" && expiring.some(e => e.id === user.id && e.type === "all")) continue;
          expiring.push({ id: user.id, email: user.email as string, until: p.until as string, type });
        }
      }
    }
  }

  return expiring;
}

/**
 * Returns users whose global pause or specific card-type pause has expired and auto_resume is true.
 */
export async function listUsersWithExpiredPause() {
  const supabase = getSupabaseAdmin();
  const now = new Date();

  const { data, error } = await supabase
    .from("users")
    .select("id, email, metadata");

  if (error) throw new Error(error.message);

  const expired: Array<{ id: string; email: string; type: "all" | "leetcode" | "cs" | "sql" }> = [];

  for (const user of data ?? []) {
    const meta = (user.metadata as Record<string, unknown>) || {};
    
    // Check global_pause (all)
    const gp = (meta.global_pause as Record<string, unknown>) || {};
    if (gp.active === true && gp.auto_resume === true) {
      const until = new Date(gp.until as string);
      if (until.getTime() <= now.getTime()) {
        expired.push({ id: user.id, email: user.email as string, type: "all" });
      }
    }

    // Check type_pauses
    const tp = (meta.type_pauses as Record<string, unknown>) || {};
    for (const type of ["all", "leetcode", "cs", "sql"] as const) {
      const p = (tp[type] as Record<string, unknown>) || {};
      if (p.active === true && p.auto_resume === true) {
        const until = new Date(p.until as string);
        if (until.getTime() <= now.getTime()) {
          if (type === "all" && expired.some(e => e.id === user.id && e.type === "all")) continue;
          expired.push({ id: user.id, email: user.email as string, type });
        }
      }
    }
  }

  return expired;
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
    .select("tags, interval_days, difficulty, repetition_count")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const tagStats = new Map<
    string,
    { earned: number; maxPoints: number; count: number }
  >();

  const TARGET_INTERVAL_DAYS = 21;
  const MIN_MASTERY_THRESHOLD = 5;

  function getDifficultyWeight(diff: string) {
    if (diff === "hard") return 3;
    if (diff === "medium") return 2;
    return 1;
  }

  for (const row of data ?? []) {
    const tags = (row.tags as string[] | null) ?? [];
    const intervalDays = (row.interval_days as number) || 0;
    const diff = (row.difficulty as string) || "medium";
    
    const weight = getDifficultyWeight(diff);
    // If it hasn't been reviewed, interval is 0, retention is 0
    const retentionRatio = Math.min(1.0, Math.max(0, intervalDays / TARGET_INTERVAL_DAYS));

    for (const tag of tags) {
      if (/^(Time|Space):/i.test(tag)) continue;
      const existing = tagStats.get(tag) ?? { earned: 0, maxPoints: 0, count: 0 };
      existing.earned += weight * retentionRatio;
      existing.maxPoints += weight;
      existing.count += 1;
      tagStats.set(tag, existing);
    }
  }

  return Array.from(tagStats.entries())
    .map(([topic, stats]) => {
      const denominator = Math.max(MIN_MASTERY_THRESHOLD, stats.maxPoints);
      const mastery = Math.round((stats.earned / denominator) * 100);
      return { 
        topic, 
        mastery: Math.min(100, mastery), 
        cardCount: stats.count
      };
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
