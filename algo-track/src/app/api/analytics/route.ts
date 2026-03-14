import { NextRequest } from "next/server";
import {
    getPerformanceData,
    getTopicMastery,
    getUserStreak,
} from "@/lib/repository";
import { handleApiError, jsonOk, withUser } from "@/lib/api";

export async function GET(request: NextRequest) {
    try {
        const user = await withUser(request);

        const [performance, topics, streak] = await Promise.all([
            getPerformanceData(user.id, 30),
            getTopicMastery(user.id),
            getUserStreak(user.id),
        ]);

        return jsonOk({
            performance,
            topics,
            streak,
        });
    } catch (error) {
        return handleApiError(error);
    }
}
