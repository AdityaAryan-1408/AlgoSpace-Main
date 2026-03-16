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
      body?.notes != null ||
      body?.tags != null ||
      body?.solvedAt !== undefined ||
      body?.topicDomain !== undefined ||
      body?.topicIds != null ||
      body?.metadata != null;

    if (!body || !hasUpdate) {
      throw new ApiError(
        "At least one field (notes, tags, solvedAt, topicDomain, topicIds, metadata) is required.",
      );
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
      notes: body.notes,
      tags: toStringArray(body.tags, "tags"),
      solvedAt: body.solvedAt,
      topicDomain: body.topicDomain,
      topicIds: body.topicIds != null ? toStringArray(body.topicIds, "topicIds") : undefined,
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
