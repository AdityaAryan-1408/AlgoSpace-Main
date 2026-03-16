import { NextRequest } from "next/server";
import { getCardById, updateCardById, deleteCardById } from "@/lib/repository";
import {
  ApiError,
  handleApiError,
  jsonError,
  jsonOk,
  toStringArray,
  withUser,
} from "@/lib/api";

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
      throw new ApiError(`solutions[${index}].content must be a non-empty string.`);
    }
    return {
      name: typeof maybeName === "string" && maybeName.trim() ? maybeName.trim() : "Solution",
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
      throw new ApiError(`relatedProblems[${index}].title must be a non-empty string.`);
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

interface RouteContext {
  params: Promise<{ cardId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await withUser(request);
    const { cardId } = await context.params;

    const card = await getCardById(user.id, cardId);
    if (!card) {
      return jsonError("Card not found.", 404);
    }

    return jsonOk({ card });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await withUser(request);
    const { cardId } = await context.params;
    const body = await request.json();

    const hasUpdate =
      body?.title !== undefined ||
      body?.description !== undefined ||
      body?.url !== undefined ||
      body?.difficulty !== undefined ||
      body?.solution !== undefined ||
      body?.solutions !== undefined ||
      body?.timeComplexity !== undefined ||
      body?.spaceComplexity !== undefined ||
      body?.relatedProblems !== undefined ||
      body?.notes !== undefined ||
      body?.tags !== undefined ||
      body?.solvedAt !== undefined ||
      body?.topicDomain !== undefined ||
      body?.topicIds !== undefined ||
      body?.metadata !== undefined;

    if (!body || !hasUpdate) {
      throw new ApiError("At least one field is required to update.");
    }
    
    if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim())) {
      throw new ApiError("title must be a non-empty string when provided.");
    }
    if (body.description !== undefined && (typeof body.description !== "string" || !body.description.trim())) {
      throw new ApiError("description must be a non-empty string when provided.");
    }
    if (body.difficulty !== undefined && !allowedDifficulties.has(body.difficulty)) {
      throw new ApiError("difficulty must be one of: easy, medium, hard.");
    }
    
    if (body?.notes != null && typeof body.notes !== "string") {
      throw new ApiError("notes must be a string when provided.");
    }
    if (body?.solvedAt != null && typeof body.solvedAt !== "string") {
      throw new ApiError("solvedAt must be an ISO timestamp string when provided.");
    }
    if (body?.topicDomain !== undefined && body.topicDomain != null && typeof body.topicDomain !== "string") {
      throw new ApiError("topicDomain must be a string when provided.");
    }

    const card = await updateCardById(user.id, cardId, {
      title: body.title?.trim(),
      description: body.description?.trim(),
      url: body.url !== undefined ? body.url?.trim() || null : undefined,
      difficulty: body.difficulty,
      solution: body.solution !== undefined ? body.solution?.trim() || null : undefined,
      solutions: body.solutions !== undefined ? (body.solutions === null ? null : toSolutions(body.solutions)) : undefined,
      timeComplexity: body.timeComplexity !== undefined ? body.timeComplexity?.trim() || null : undefined,
      spaceComplexity: body.spaceComplexity !== undefined ? body.spaceComplexity?.trim() || null : undefined,
      relatedProblems: body.relatedProblems !== undefined ? (body.relatedProblems === null ? null : toRelatedProblems(body.relatedProblems)) : undefined,
      notes: body.notes,
      tags: body.tags !== undefined ? toStringArray(body.tags, "tags") : undefined,
      solvedAt: body.solvedAt,
      topicDomain: body.topicDomain,
      topicIds: body.topicIds !== undefined ? (body.topicIds === null ? [] : toStringArray(body.topicIds, "topicIds")) : undefined,
      metadata: body.metadata,
    });

    if (!card) {
      return jsonError("Card not found.", 404);
    }

    return jsonOk({ card });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await withUser(request);
    const { cardId } = await context.params;

    const deleted = await deleteCardById(user.id, cardId);
    if (!deleted) {
      return jsonError("Card not found.", 404);
    }

    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
