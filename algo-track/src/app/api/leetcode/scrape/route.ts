import { NextResponse } from "next/server";

const LEETCODE_API_BASE = "https://leetcode-api-pied.vercel.app";

// Clean HTML to Markdown converter tailored for LeetCode's markup styles
function htmlToMarkdown(html: string): string {
    if (!html) return "";
    let md = html;

    // STEP 1: Strip formatting tags INSIDE <pre> blocks so they don't become literal **text**
    md = md.replace(/<pre>([\s\S]*?)<\/pre>/gi, (_match, inner: string) => {
        let clean = inner;
        clean = clean.replace(/<\/?strong>/gi, "");
        clean = clean.replace(/<\/?b>/gi, "");
        clean = clean.replace(/<\/?em>/gi, "");
        clean = clean.replace(/<\/?i>/gi, "");
        clean = clean.replace(/<\/?code>/gi, "");
        return `<pre>${clean}</pre>`;
    });

    // Decode HTML entities — but NOT &lt; and &gt; yet (they'd be mistaken for HTML tags later)
    md = md.replace(/&nbsp;/g, " ")
           .replace(/&amp;/g, "&")
           .replace(/&quot;/g, '"')
           .replace(/&#39;/g, "'")
           .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code)))
           .replace(/&#x([0-9a-fA-F]+);/g, (_m, code) => String.fromCharCode(parseInt(code, 16)));

    // Format Example headers in LeetCode style
    md = md.replace(/<strong class="example">(.*?)<\/strong>/gi, "\n\n**$1**\n");

    // Superscripts BEFORE removing tags (e.g. 10^4 from 10<sup>4</sup>)
    md = md.replace(/<sup>/gi, "^").replace(/<\/sup>/gi, "");
    md = md.replace(/<sub>/gi, "_").replace(/<\/sub>/gi, "");

    // Core paragraph & styling tags
    md = md.replace(/<p>/gi, "\n").replace(/<\/p>/gi, "\n");
    md = md.replace(/<code>/gi, "`").replace(/<\/code>/gi, "`");
    md = md.replace(/<strong>/gi, "**").replace(/<\/strong>/gi, "**");
    md = md.replace(/<b>/gi, "**").replace(/<\/b>/gi, "**");
    md = md.replace(/<i>/gi, "*").replace(/<\/i>/gi, "*");
    md = md.replace(/<em>/gi, "*").replace(/<\/em>/gi, "*");

    // Headers
    md = md.replace(/<h1>/gi, "# ").replace(/<\/h1>/gi, "\n");
    md = md.replace(/<h2>/gi, "## ").replace(/<\/h2>/gi, "\n");
    md = md.replace(/<h3>/gi, "### ").replace(/<\/h3>/gi, "\n");

    // Code blocks — convert <pre> to plain text blocks (not fenced code)
    // since BlockNote rich editor handles formatting itself
    md = md.replace(/<pre>/gi, "\n").replace(/<\/pre>/gi, "\n");

    // Lists
    md = md.replace(/<ul>/gi, "\n").replace(/<\/ul>/gi, "\n");
    md = md.replace(/<ol>/gi, "\n").replace(/<\/ol>/gi, "\n");
    md = md.replace(/<li>/gi, "- ").replace(/<\/li>/gi, "\n");

    // Media & links
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, "![]($1)");
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

    // Break lines
    md = md.replace(/<br\s*\/?>/gi, "\n");

    // Remove remaining HTML tags (divs, spans, etc.)
    md = md.replace(/<[^>]*>/g, "");

    // NOW decode &lt; and &gt; — safe because all real HTML tags are already gone
    md = md.replace(/&lt;/g, "<").replace(/&gt;/g, ">");

    // Clean up excessive newlines
    md = md.replace(/\n{3,}/g, "\n\n");

    return md.trim();
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("query");

        if (!query || !query.trim()) {
            return NextResponse.json(
                { error: "A search query or URL is required." },
                { status: 400 }
            );
        }

        const cleanQuery = query.trim();
        let titleSlug = "";
        let frontendId = "";

        // Check if query is a LeetCode URL
        const urlMatch = cleanQuery.match(/leetcode\.com\/problems\/([a-zA-Z0-9-]+)/i);
        if (urlMatch) {
            titleSlug = urlMatch[1];
        }

        // Check if query is a pure number (e.g. "1" or "15")
        const isPureNumber = /^\d+$/.test(cleanQuery);

        // Check if query starts with a number prefix (e.g. "1. Two Sum")
        const numberPrefixMatch = cleanQuery.match(/^(\d+)[\.\s]+(.*)$/);

        if (titleSlug) {
            // We already have the slug from URL, fetch directly
        } else if (isPureNumber || numberPrefixMatch) {
            // Use the problem-by-ID endpoint directly
            const problemId = isPureNumber ? cleanQuery : numberPrefixMatch![1];
            frontendId = problemId;
        } else {
            // Text search — use the /search endpoint to find the slug
            const searchRes = await fetch(`${LEETCODE_API_BASE}/search?query=${encodeURIComponent(cleanQuery)}`);
            if (!searchRes.ok) {
                throw new Error("Failed to search LeetCode problems.");
            }
            const searchResults = await searchRes.json();

            if (!Array.isArray(searchResults) || searchResults.length === 0) {
                return NextResponse.json(
                    { error: `Could not find a LeetCode problem matching "${cleanQuery}"` },
                    { status: 404 }
                );
            }

            // Use the first search result
            titleSlug = searchResults[0].title_slug;
            frontendId = searchResults[0].frontend_id;
        }

        // Fetch full problem details using either slug or ID
        const lookupKey = titleSlug || frontendId;
        const detailRes = await fetch(`${LEETCODE_API_BASE}/problem/${lookupKey}`);

        if (!detailRes.ok) {
            throw new Error(`Failed to fetch problem details for "${lookupKey}".`);
        }

        const problem = await detailRes.json();

        if (!problem || !problem.title) {
            return NextResponse.json(
                { error: `Could not resolve LeetCode question data for "${lookupKey}"` },
                { status: 404 }
            );
        }

        // Parse tags
        const tags = (problem.topicTags || []).map((tag: { name: string }) => tag.name);
        const rawDifficulty = (problem.difficulty || "Medium").toLowerCase();

        return NextResponse.json({
            success: true,
            title: problem.title,
            frontendId: problem.questionFrontendId || problem.frontend_id || frontendId,
            url: problem.url || `https://leetcode.com/problems/${problem.titleSlug || titleSlug}/`,
            description: htmlToMarkdown(problem.content || ""),
            difficulty: rawDifficulty,
            tags
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred during scraping.";
        console.error("LeetCode Scrape Error:", message);
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
