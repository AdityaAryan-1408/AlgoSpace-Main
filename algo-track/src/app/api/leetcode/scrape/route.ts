import { NextResponse } from "next/server";

// Clean HTML to Markdown converter tailored for LeetCode's markup styles
function htmlToMarkdown(html: string): string {
    if (!html) return "";
    let md = html;

    // Decode HTML entities
    md = md.replace(/&nbsp;/g, " ")
           .replace(/&lt;/g, "<")
           .replace(/&gt;/g, ">")
           .replace(/&amp;/g, "&")
           .replace(/&quot;/g, '"')
           .replace(/&#39;/g, "'");

    // Format Example headers in LeetCode style
    md = md.replace(/<strong class="example">Example (\d+):<\/strong>/gi, "\n\n**Example $1:**\n");

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

    // Code blocks
    md = md.replace(/<pre>/gi, "\n```\n").replace(/<\/pre>/gi, "\n```\n");

    // Lists
    md = md.replace(/<ul>/gi, "\n").replace(/<\/ul>/gi, "\n");
    md = md.replace(/<ol>/gi, "\n").replace(/<\/ol>/gi, "\n");
    md = md.replace(/<li>/gi, "- ").replace(/<\/li>/gi, "\n");

    // Superscripts and subscripts
    md = md.replace(/<sup>/gi, "^").replace(/<\/sup>/gi, "");
    md = md.replace(/<sub>/gi, "_").replace(/<\/sub>/gi, "");

    // Media & links
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, "![]($1)");
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

    // Break lines
    md = md.replace(/<br\s*\/?>/gi, "\n");

    // Remove remaining HTML tags
    md = md.replace(/<[^>]*>/g, "");

    // Clean up excessive newlines
    md = md.replace(/\n\s*\n\s*\n/g, "\n\n");
    md = md.replace(/\n\s*\n/g, "\n\n");

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

        // Check if query is a LeetCode URL
        const urlMatch = cleanQuery.match(/leetcode\.com\/problems\/([a-zA-Z0-9-]+)/i);
        if (urlMatch) {
            titleSlug = urlMatch[1];
        } else {
            // Check if query starts with a number (e.g. "1. Two Sum" -> search query: "Two Sum" or "1")
            const numberMatch = cleanQuery.match(/^(\d+)[\.\s]+(.*)$/);
            const searchTerms = numberMatch ? numberMatch[2].trim() : cleanQuery;

            // Search for question on LeetCode's official GraphQL Endpoint
            const searchResponse = await fetch("https://leetcode.com/graphql", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Chrome/120.0.0.0 Safari/537.36",
                    "Referer": "https://leetcode.com/",
                    "Origin": "https://leetcode.com"
                },
                body: JSON.stringify({
                    query: `
                        query problemsetQuestionList($filters: QuestionListFilterInput) {
                          problemsetQuestionList(limit: 10, skip: 0, filters: $filters) {
                            questions {
                              frontendQuestionId: questionFrontendId
                              title
                              titleSlug
                              difficulty
                            }
                          }
                        }
                    `,
                    variables: {
                        filters: { search: searchTerms }
                    }
                })
            });

            if (!searchResponse.ok) {
                throw new Error("Failed to query LeetCode search endpoint.");
            }

            const searchData = await searchResponse.json();
            const questions = searchData.data?.problemsetQuestionList?.questions || [];

            if (questions.length === 0) {
                return NextResponse.json(
                    { error: `Could not find LeetCode problem matching "${query}"` },
                    { status: 404 }
                );
            }

            // Select matching question
            let matchedQuestion = null;

            // If the query was a pure number (or had a number prefix), prioritize exact frontend ID match
            const targetId = numberMatch ? numberMatch[1] : (cleanQuery.match(/^\d+$/) ? cleanQuery : null);
            if (targetId) {
                matchedQuestion = questions.find((q: any) => q.frontendQuestionId === targetId);
            }

            // Fallback to first search result if no ID match
            if (!matchedQuestion) {
                matchedQuestion = questions[0];
            }

            titleSlug = matchedQuestion.titleSlug;
        }

        // Query the detailed question content
        const detailResponse = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://leetcode.com/",
                "Origin": "https://leetcode.com"
            },
            body: JSON.stringify({
                query: `
                    query questionData($titleSlug: String!) {
                      question(titleSlug: $titleSlug) {
                        questionFrontendId
                        title
                        titleSlug
                        content
                        difficulty
                        topicTags {
                          name
                        }
                      }
                    }
                `,
                variables: { titleSlug }
            })
        });

        if (!detailResponse.ok) {
            throw new Error("Failed to fetch detailed problem information from LeetCode.");
        }

        const detailData = await detailResponse.json();
        const question = detailData.data?.question;

        if (!question) {
            return NextResponse.json(
                { error: `Could not resolve LeetCode question data for slug "${titleSlug}"` },
                { status: 404 }
            );
        }

        // Parse difficulty & tags
        const rawDifficulty = question.difficulty || "Medium";
        const tags = (question.topicTags || []).map((tag: any) => tag.name);

        return NextResponse.json({
            success: true,
            title: question.title,
            frontendId: question.questionFrontendId,
            url: `https://leetcode.com/problems/${question.titleSlug}/`,
            description: htmlToMarkdown(question.content || ""),
            difficulty: rawDifficulty.toLowerCase(),
            tags
        });

    } catch (error: any) {
        console.error("LeetCode Scrape Error:", error);
        return NextResponse.json(
            { error: error.message || "An unexpected error occurred during scraping." },
            { status: 500 }
        );
    }
}
