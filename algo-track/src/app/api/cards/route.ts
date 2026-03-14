import { NextRequest } from "next/server";
import {
  addCardForUser,
  listCardsForUser,
} from "@/lib/repository";
import {
  ApiError,
  handleApiError,
  jsonOk,
  toStringArray,
  withUser,
} from "@/lib/api";

const allowedTypes = new Set(["leetcode", "cs"]);
const allowedDifficulties = new Set(["easy", "medium", "hard"]);

function toSolutions(value: unknown) {
  if (value == null) return undefined;
  if (!Array.isArray(value)) {
    throw new ApiError("solutions must be an array when provided.");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new ApiError(`solutions[${index}] must be an object.`);
    }
    const maybeName = (item as { name?: unknown }).name;
    const maybeContent = (item as { content?: unknown }).content;

    if (typeof maybeContent !== "string" || !maybeContent.trim()) {
      throw new ApiError(
        `solutions[${index}].content must be a non-empty string.`,
      );
    }

    return {
      name:
        typeof maybeName === "string" && maybeName.trim()
          ? maybeName.trim()
          : "Solution",
      content: maybeContent.trim(),
    };
  });
}

function toRelatedProblems(value: unknown) {
  if (value == null) return undefined;
  if (!Array.isArray(value)) {
    throw new ApiError("relatedProblems must be an array when provided.");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new ApiError(`relatedProblems[${index}] must be an object.`);
    }

    const maybeTitle = (item as { title?: unknown }).title;
    const maybeUrl = (item as { url?: unknown }).url;

    if (typeof maybeTitle !== "string" || !maybeTitle.trim()) {
      throw new ApiError(
        `relatedProblems[${index}].title must be a non-empty string.`,
      );
    }
    if (maybeUrl != null && typeof maybeUrl !== "string") {
      throw new ApiError(`relatedProblems[${index}].url must be a string.`);
    }

    return {
      title: maybeTitle.trim(),
      url: typeof maybeUrl === "string" && maybeUrl.trim() ? maybeUrl.trim() : undefined,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await withUser(request);
    const dueOnly = request.nextUrl.searchParams.get("dueOnly") === "true";
    const cards = await listCardsForUser(user.id, dueOnly);
    return jsonOk({ cards });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();

    if (!allowedTypes.has(body?.type)) {
      throw new ApiError("type must be either 'leetcode' or 'cs'.");
    }
    if (!allowedDifficulties.has(body?.difficulty)) {
      throw new ApiError("difficulty must be one of: easy, medium, hard.");
    }
    if (typeof body?.title !== "string" || !body.title.trim()) {
      throw new ApiError("title is required.");
    }
    if (typeof body?.description !== "string" || !body.description.trim()) {
      throw new ApiError("description is required.");
    }
    if (body?.url != null && typeof body.url !== "string") {
      throw new ApiError("url must be a string when provided.");
    }
    if (body?.notes != null && typeof body.notes !== "string") {
      throw new ApiError("notes must be a string when provided.");
    }
    if (body?.solution != null && typeof body.solution !== "string") {
      throw new ApiError("solution must be a string when provided.");
    }
    if (body?.timeComplexity != null && typeof body.timeComplexity !== "string") {
      throw new ApiError("timeComplexity must be a string when provided.");
    }
    if (body?.spaceComplexity != null && typeof body.spaceComplexity !== "string") {
      throw new ApiError("spaceComplexity must be a string when provided.");
    }
    if (
      body?.reviewInDays != null &&
      (typeof body.reviewInDays !== "number" ||
        !Number.isFinite(body.reviewInDays) ||
        body.reviewInDays < 0)
    ) {
      throw new ApiError("reviewInDays must be a non-negative number when provided.");
    }

    const card = await addCardForUser(user.id, {
      type: body.type,
      title: body.title.trim(),
      description: body.description.trim(),
      difficulty: body.difficulty,
      tags: toStringArray(body.tags, "tags"),
      notes: body.notes,
      solution: body.solution,
      solutions: toSolutions(body.solutions),
      timeComplexity: body.timeComplexity,
      spaceComplexity: body.spaceComplexity,
      relatedProblems: toRelatedProblems(body.relatedProblems),
      url: body.url,
      reviewInDays: body.reviewInDays,
    });

    return jsonOk({ card }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
