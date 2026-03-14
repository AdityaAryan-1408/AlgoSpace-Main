import type { Flashcard } from "@/data";

export function exportAsJSON(cards: Flashcard[]) {
    const data = JSON.stringify(cards, null, 2);
    downloadFile(data, "algotrack-backup.json", "application/json");
}

export function exportAsCSV(cards: Flashcard[]) {
    const headers = [
        "Title",
        "Type",
        "Difficulty",
        "Tags",
        "URL",
        "Last Rating",
        "Last Review",
        "Next Review",
        "Due In Days",
        "Good Reviews",
        "Total Reviews",
        "Notes",
    ];

    const rows = cards.map((c) => [
        escapeCsv(c.title),
        c.type,
        c.difficulty,
        escapeCsv(c.tags.join(", ")),
        c.url ?? "",
        c.lastRating,
        c.lastReview,
        c.nextReview,
        String(c.dueInDays),
        String(c.history.good),
        String(c.history.total),
        escapeCsv(c.notes),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadFile(csv, "algotrack-backup.csv", "text/csv");
}

function escapeCsv(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
