export interface CardSolutionItem {
  name: string;
  content: string;
}

export interface RelatedProblemLink {
  title: string;
  url?: string;
}

interface StoredCardContentV1 {
  v: 1;
  solutions: CardSolutionItem[];
  timeComplexity?: string;
  spaceComplexity?: string;
  relatedProblems?: RelatedProblemLink[];
}

export interface ParsedCardContent {
  solutions: CardSolutionItem[];
  primarySolution?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  relatedProblems: RelatedProblemLink[];
}

const TIME_TAG_PREFIX = "Time:";
const SPACE_TAG_PREFIX = "Space:";

function normalizeSolutionItems(value: unknown): CardSolutionItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const name =
        typeof (item as { name?: unknown }).name === "string"
          ? (item as { name: string }).name.trim()
          : "";
      const content =
        typeof (item as { content?: unknown }).content === "string"
          ? (item as { content: string }).content.trim()
          : "";

      if (!content) return null;
      return {
        name: name || "Solution",
        content,
      } satisfies CardSolutionItem;
    })
    .filter((item): item is CardSolutionItem => item !== null);
}

function normalizeRelatedProblems(value: unknown): RelatedProblemLink[] {
  if (!Array.isArray(value)) return [];
  const normalized: RelatedProblemLink[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const title =
      typeof (item as { title?: unknown }).title === "string"
        ? (item as { title: string }).title.trim()
        : "";
    const url =
      typeof (item as { url?: unknown }).url === "string"
        ? (item as { url: string }).url.trim()
        : "";

    if (!title) continue;
    normalized.push({
      title,
      url: url || undefined,
    });
  }

  return normalized;
}

function parseComplexityFromTags(tags: string[]) {
  let timeComplexity: string | undefined;
  let spaceComplexity: string | undefined;

  for (const tag of tags) {
    if (!timeComplexity && tag.startsWith(TIME_TAG_PREFIX)) {
      const value = tag.slice(TIME_TAG_PREFIX.length).trim();
      if (value) timeComplexity = value;
    }
    if (!spaceComplexity && tag.startsWith(SPACE_TAG_PREFIX)) {
      const value = tag.slice(SPACE_TAG_PREFIX.length).trim();
      if (value) spaceComplexity = value;
    }
  }

  return { timeComplexity, spaceComplexity };
}

function isStoredCardContent(value: unknown): value is StoredCardContentV1 {
  if (!value || typeof value !== "object") return false;
  const maybe = value as Partial<StoredCardContentV1>;
  return maybe.v === 1 && Array.isArray(maybe.solutions);
}

export function parseCardContent(
  rawSolution: string | null | undefined,
  tags: string[] = [],
): ParsedCardContent {
  const fromTags = parseComplexityFromTags(tags);
  const raw = rawSolution?.trim();

  if (!raw) {
    return {
      solutions: [],
      primarySolution: undefined,
      timeComplexity: fromTags.timeComplexity,
      spaceComplexity: fromTags.spaceComplexity,
      relatedProblems: [],
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isStoredCardContent(parsed)) {
      const solutions = normalizeSolutionItems(parsed.solutions);
      return {
        solutions,
        primarySolution: solutions[0]?.content,
        timeComplexity:
          typeof parsed.timeComplexity === "string"
            ? parsed.timeComplexity
            : fromTags.timeComplexity,
        spaceComplexity:
          typeof parsed.spaceComplexity === "string"
            ? parsed.spaceComplexity
            : fromTags.spaceComplexity,
        relatedProblems: normalizeRelatedProblems(parsed.relatedProblems),
      };
    }
  } catch {
    // Legacy plain-text solution format.
  }

  const solutions = [{ name: "Optimal", content: raw }];
  return {
    solutions,
    primarySolution: raw,
    timeComplexity: fromTags.timeComplexity,
    spaceComplexity: fromTags.spaceComplexity,
    relatedProblems: [],
  };
}

export function upsertComplexityTags(
  tags: string[] | undefined,
  timeComplexity?: string,
  spaceComplexity?: string,
) {
  const normalized = (tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter(
      (tag) =>
        !tag.startsWith(TIME_TAG_PREFIX) && !tag.startsWith(SPACE_TAG_PREFIX),
    );

  if (timeComplexity?.trim()) {
    normalized.push(`${TIME_TAG_PREFIX} ${timeComplexity.trim()}`);
  }
  if (spaceComplexity?.trim()) {
    normalized.push(`${SPACE_TAG_PREFIX} ${spaceComplexity.trim()}`);
  }

  return Array.from(new Set(normalized));
}

export function encodeCardContent(input: {
  fallbackSolution?: string;
  solutions?: CardSolutionItem[];
  timeComplexity?: string;
  spaceComplexity?: string;
  relatedProblems?: RelatedProblemLink[];
}) {
  const fallback = input.fallbackSolution?.trim();
  const solutions = normalizeSolutionItems(
    input.solutions?.length
      ? input.solutions
      : fallback
        ? [{ name: "Optimal", content: fallback }]
        : [],
  );
  const relatedProblems = normalizeRelatedProblems(input.relatedProblems);
  const timeComplexity = input.timeComplexity?.trim() || undefined;
  const spaceComplexity = input.spaceComplexity?.trim() || undefined;

  if (solutions.length === 0) {
    return null;
  }

  const hasRichMetadata =
    solutions.length > 1 ||
    relatedProblems.length > 0 ||
    Boolean(timeComplexity) ||
    Boolean(spaceComplexity) ||
    (solutions.length === 1 && solutions[0].name !== "Optimal");

  if (!hasRichMetadata) {
    return solutions[0].content;
  }

  const payload: StoredCardContentV1 = {
    v: 1,
    solutions,
    timeComplexity,
    spaceComplexity,
    relatedProblems,
  };

  return JSON.stringify(payload);
}
