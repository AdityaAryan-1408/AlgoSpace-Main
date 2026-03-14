'use client';

import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
} from "recharts";
import type { AnalyticsData } from "@/lib/client-api";

interface Props {
    data: AnalyticsData["performance"];
}

export function PerformanceChart({ data }: Props) {
    // Filter to only days with reviews for the trend line, but show all days
    const chartData = data.map((d) => ({
        date: formatDate(d.date),
        rawDate: d.date,
        accuracy: d.accuracy,
        reviews: d.total,
    }));

    const hasData = chartData.some((d) => d.reviews > 0);

    if (!hasData) {
        return (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm italic">
                No reviews in the last 30 days. Complete some reviews to see your trends!
            </div>
        );
    }

    return (
        <div className="w-full">
            <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <defs>
                        <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="reviewsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                    <XAxis
                        dataKey="date"
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                        contentStyle={{
                            background: "var(--color-background)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "8px",
                            fontSize: "12px",
                        }}
                        formatter={(value: number, name: string) => {
                            if (name === "accuracy") return [value != null ? `${value}%` : "—", "Accuracy"];
                            return [`${value}`, "Reviews"];
                        }}
                        labelFormatter={(label) => label}
                    />
                    <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.5} />
                    <Area
                        type="monotone"
                        dataKey="reviews"
                        fill="url(#reviewsGradient)"
                        stroke="#10b981"
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                    />
                    <Area
                        type="monotone"
                        dataKey="accuracy"
                        fill="url(#accuracyGradient)"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                    />
                </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-blue-500 rounded" />
                    <span>Accuracy %</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-emerald-500 rounded" />
                    <span>Reviews</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-amber-500 rounded opacity-50" style={{ borderTop: "1px dashed" }} />
                    <span>70% target</span>
                </div>
            </div>
        </div>
    );
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
