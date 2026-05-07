import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            company,
            daysUntilInterview,
            cardTitles,
            cardTags,
        } = body;

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GROQ_API_KEY is not configured" },
                { status: 500 },
            );
        }

        const systemPrompt = `You are an interview preparation strategist. Given a company name and the user's existing flashcard library, identify which cards are most relevant for that specific company's coding interviews.

RULES:
- Use your knowledge of the company's interview patterns, commonly asked problem types, and preferred topics.
- Rank the user's existing card tags by relevance to the company.
- Suggest additional topics the user should study that they may not have cards for.
- Be specific about WHY certain topics are prioritized for this company.
- Output valid JSON only, no markdown fences.

OUTPUT FORMAT (JSON):
{
  "companyProfile": "Brief description of the company's interview style",
  "prioritizedTags": ["tag1", "tag2", "tag3"],
  "tagRelevance": [
    {"tag": "tag1", "relevance": "high" | "medium" | "low", "reason": "Why this is important for the company"}
  ],
  "missingTopics": ["Topics the user should add cards for"],
  "studyPlan": "A brief daily study plan for the remaining days",
  "focusAreas": ["Top 3-5 specific areas to focus on"]
}`;

        const userMessage = `Company: ${company}
Days Until Interview: ${daysUntilInterview}
User's Card Titles: ${cardTitles.join(", ")}
User's Tags: ${[...new Set(cardTags)].join(", ")}

Analyze this company's interview patterns and prioritize the user's existing cards.`;

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage },
                ],
                temperature: 0.4,
                max_tokens: 1500,
                response_format: { type: "json_object" },
            }),
        });

        if (!groqRes.ok) {
            const errBody = await groqRes.text();
            console.error("Groq API error:", errBody);
            return NextResponse.json(
                { error: "AI analysis failed" },
                { status: 502 },
            );
        }

        const data = await groqRes.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
        }

        const parsed = JSON.parse(content);
        return NextResponse.json(parsed);
    } catch (err) {
        console.error("Cram mode error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
