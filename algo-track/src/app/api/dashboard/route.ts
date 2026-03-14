import { NextRequest } from "next/server";
import { getDashboardStats } from "@/lib/repository";
import { handleApiError, jsonOk, withUser } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const user = await withUser(request);
    const stats = await getDashboardStats(user.id);
    return jsonOk({ stats });
  } catch (error) {
    return handleApiError(error);
  }
}
