import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { problemTitle, problemDescription, tags, difficulty, existingCards } = body;

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
        }

        const systemPrompt = `You are a DSA problem recommender. Given a problem a user just solved, suggest 4-5 similar problems that test the same pattern or a closely related pattern.

RULES:
- Include a mix: some from the user's existing card library and some well-known problems from LeetCode/other platforms.
- For existing cards, set "isExisting" to true and include the card ID.
- For external problems, set "isExisting" to false and include a URL if possible.
- Prioritize problems that reinforce the same algorithmic pattern.
- Include difficulty level for each suggestion.
- Keep descriptions very brief (1 sentence).
- Output valid JSON only, no markdown.

OUTPUT FORMAT (JSON):
{
  "pattern": "The algorithmic pattern identified",
  "suggestions": [
    {
      "title": "Problem Title",
      "description": "One-line description",
      "difficulty": "easy" | "medium" | "hard",
      "isExisting": true/false,
      "cardId": "id if existing, null otherwise",
      "url": "leetcode URL if external, null otherwise",
      "relevance": "Why this problem is similar"
    }
  ]
}`;

        const userMessage = `Just solved: ${problemTitle}
Description: ${problemDescription}
Tags/Patterns: ${tags.join(", ")}
Difficulty: ${difficulty}

User's existing card titles:
${existingCards.map((c: { id: string; title: string; tags: string[] }) => `- [${c.id}] ${c.title} (${c.tags.join(", ")})`).join("\n")}

Suggest 4-5 similar problems, prioritizing the user's existing cards when relevant.`;

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
                temperature: 0.5,
                max_tokens: 1200,
                response_format: { type: "json_object" },
            }),
        });

        if (!groqRes.ok) {
            const errBody = await groqRes.text();
            console.error("Groq similar-questions error:", errBody);
            return NextResponse.json({ error: "AI failed" }, { status: 502 });
        }

        const data = await groqRes.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return NextResponse.json({ error: "Empty response" }, { status: 502 });

        return NextResponse.json(JSON.parse(content));
    } catch (err) {
        console.error("Similar questions error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
