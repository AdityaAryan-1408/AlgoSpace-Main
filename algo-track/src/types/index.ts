// ── Card Source ──────────────────────────────────────────────────
export type CardSource = "manual" | "extension" | "import" | "seed";

// ── Topic Domain ────────────────────────────────────────────────
export type TopicDomain =
  | "dsa"
  | "cs"
  | "system-design"
  | "cloud"
  | "devops"
  | "web"
  | "database";

// ── Goal Types ──────────────────────────────────────────────────

export type GoalType =
  | "dsa_volume"
  | "dsa_retention"
  | "cs_topic_completion"
  | "hybrid_prep_plan";

export type GoalStatus =
  | "draft"
  | "active"
  | "completed"
  | "paused"
  | "abandoned";

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  goalType: GoalType;
  status: GoalStatus;
  startDate: string;   // ISO date string (YYYY-MM-DD)
  endDate: string;      // ISO date string (YYYY-MM-DD)
  createdAt: string;
  updatedAt: string;
  targets?: GoalTarget[];
  topicItems?: GoalTopicItem[];
}

export interface GoalTarget {
  id: string;
  goalId: string;
  metricKey: string;     // problems_solved | retained_pct | topics_completed
  targetValue: number;
  currentValue: number;
  unit: string;          // problems | percent | topics
  config: Record<string, unknown>;
}

export type GoalTopicItemStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "blocked";

export interface GoalTopicItem {
  id: string;
  goalId: string;
  topicDomain: string;
  topicId: string;
  title: string;
  status: GoalTopicItemStatus;
  deadline: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ── Coach / AI ──────────────────────────────────────────────────

export type SnapshotType =
  | "profile_overview"
  | "weakness_analysis"
  | "goal_status";

export interface CoachSnapshot {
  id: string;
  userId: string;
  snapshotType: SnapshotType;
  inputHash: string;
  summary: Record<string, unknown>;
  generatedAt: string;
}

// ── Chat ────────────────────────────────────────────────────────

export type ChatMode =
  | "debug_logic"
  | "system_design_review"
  | "theory_cross_question"
  | "interviewer_mode";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatThread {
  id: string;
  userId: string;
  cardId: string | null;
  mode: ChatMode;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

// ── Database Row Types ──────────────────────────────────────────
// These mirror the DB columns for use in repository functions.

export interface GoalDbRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  goal_type: string;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export interface GoalTargetDbRow {
  id: string;
  goal_id: string;
  metric_key: string;
  target_value: number | string;
  current_value: number | string;
  unit: string;
  config: Record<string, unknown>;
  created_at: string;
}

export interface GoalTopicItemDbRow {
  id: string;
  goal_id: string;
  topic_domain: string;
  topic_id: string;
  title: string;
  status: string;
  deadline: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CoachSnapshotDbRow {
  id: string;
  user_id: string;
  snapshot_type: string;
  input_hash: string;
  summary: Record<string, unknown>;
  generated_at: string;
}

export interface ChatThreadDbRow {
  id: string;
  user_id: string;
  card_id: string | null;
  mode: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageDbRow {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  created_at: string;
}

// ── Mappers ─────────────────────────────────────────────────────

export function mapGoalRowToGoal(row: GoalDbRow): Goal {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    goalType: row.goal_type as GoalType,
    status: row.status as GoalStatus,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapGoalTargetRow(row: GoalTargetDbRow): GoalTarget {
  return {
    id: row.id,
    goalId: row.goal_id,
    metricKey: row.metric_key,
    targetValue: Number(row.target_value),
    currentValue: Number(row.current_value),
    unit: row.unit,
    config: row.config,
  };
}

export function mapGoalTopicItemRow(row: GoalTopicItemDbRow): GoalTopicItem {
  return {
    id: row.id,
    goalId: row.goal_id,
    topicDomain: row.topic_domain,
    topicId: row.topic_id,
    title: row.title,
    status: row.status as GoalTopicItemStatus,
    deadline: row.deadline,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapChatThreadRow(row: ChatThreadDbRow): ChatThread {
  return {
    id: row.id,
    userId: row.user_id,
    cardId: row.card_id,
    mode: row.mode as ChatMode,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapChatMessageRow(row: ChatMessageDbRow): ChatMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    role: row.role as ChatRole,
    content: row.content,
    createdAt: row.created_at,
  };
}
