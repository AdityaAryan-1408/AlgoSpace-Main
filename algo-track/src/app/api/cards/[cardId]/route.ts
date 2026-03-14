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

    if (!body || (body.notes == null && body.tags == null)) {
      throw new ApiError("At least one field (notes, tags) is required.");
    }
    if (body?.notes != null && typeof body.notes !== "string") {
      throw new ApiError("notes must be a string when provided.");
    }

    const card = await updateCardById(user.id, cardId, {
      notes: body.notes,
      tags: toStringArray(body.tags, "tags"),
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
