'use client';

import {
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Tooltip,
} from "recharts";
import type { AnalyticsData } from "@/lib/client-api";

interface Props {
    data: AnalyticsData["topics"];
}

export function TopicRadarChart({ data }: Props) {
    // Filter out complexity tags (Time: O(N), Space: O(N), etc.)
    const filtered = data.filter((t) => !/^(Time|Space):/i.test(t.topic));

    if (filtered.length < 3) {
        return (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm italic">
                Add cards with at least 3 different tags to visualize topic mastery.
            </div>
        );
    }

    const chartData = filtered.map((t) => ({
        topic: truncate(t.topic, 12),
        fullTopic: t.topic,
        cards: t.cardCount,
    }));

    const maxCards = Math.max(...chartData.map((d) => d.cards), 1);

    return (
        <div className="w-full">
            <ResponsiveContainer width="100%" height={280}>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                    <PolarGrid stroke="var(--color-border)" opacity={0.5} />
                    <PolarAngleAxis
                        dataKey="topic"
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                        angle={90}
                        domain={[0, maxCards]}
                        tick={false}
                        axisLine={false}
                    />
                    <Tooltip
                        contentStyle={{
                            background: "var(--color-background)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "8px",
                            fontSize: "12px",
                        }}
                        formatter={(value: number, _name: string, entry) => {
                            const item = entry.payload;
                            return [`${value} question${value !== 1 ? "s" : ""}`, item.fullTopic];
                        }}
                    />
                    <Radar
                        name="questions"
                        dataKey="cards"
                        stroke="#8b5cf6"
                        fill="#8b5cf6"
                        fillOpacity={0.2}
                        strokeWidth={2}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}

function truncate(str: string, max: number): string {
    return str.length > max ? str.slice(0, max - 1) + "…" : str;
}
