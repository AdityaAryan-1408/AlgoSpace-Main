import { NextRequest } from "next/server";
import { seedInitialCards } from "@/lib/repository";
import { handleApiError, jsonOk, withUser } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);
    const result = await seedInitialCards(user.id);
    return jsonOk(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
