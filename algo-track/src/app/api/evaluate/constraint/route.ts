import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            problemTitle,
            problemDescription,
            savedSolution,
            cardType,
            easyCount,
        } = body;

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GROQ_API_KEY is not configured" },
                { status: 500 },
            );
        }

        const isDSA = cardType === "leetcode";

        const systemPrompt = isDSA
            ? `You are a creative algorithm problem designer. Given a problem that the user has already mastered, generate ONE additional constraint that forces the user to think differently about their solution.

RULES:
- The constraint should be realistic and meaningful
- It should push the user to consider a different algorithmic approach or optimization
- Examples of good constraints: "Solve it iteratively instead of recursively", "Use O(1) auxiliary space", "Handle the case where input is streamed", "Do it without using a hash map", "Solve it in-place"
- The constraint should be clearly stated in one sentence
- Provide a brief hint about how the constraint changes the approach
- Output valid JSON only, no markdown fences.

OUTPUT FORMAT (JSON):
{
  "constraint": "The additional constraint text",
  "hint": "A brief hint about how this changes the approach",
  "difficulty": "medium" | "hard",
  "category": "space" | "time" | "approach" | "edge-case" | "in-place"
}`
            : `You are a CS concept expert. Given a CS concept the user has mastered, generate ONE deeper question or constraint that tests their understanding at a deeper level.

RULES:
- Ask something that goes beyond surface-level recall
- Examples: "Explain how this works in a distributed system", "What happens under extreme concurrency?", "Design a system that violates this principle intentionally — when would that be acceptable?"
- Output valid JSON only, no markdown fences.

OUTPUT FORMAT (JSON):
{
  "constraint": "The deeper question or constraint",
  "hint": "A brief hint about the expected direction",
  "difficulty": "medium" | "hard",
  "category": "depth" | "application" | "edge-case" | "comparison"
}`;

        const userMessage = `Problem: ${problemTitle}
Description: ${problemDescription}
${savedSolution ? `\nReference Solution:\n${savedSolution}` : ""}
Times rated EASY: ${easyCount || 3}

Generate a constraint that pushes beyond simple recall.`;

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
                temperature: 0.7,
                max_tokens: 512,
                response_format: { type: "json_object" },
            }),
        });

        if (!groqRes.ok) {
            const errBody = await groqRes.text();
            console.error("Groq API error:", errBody);
            return NextResponse.json(
                { error: "AI constraint generation failed" },
                { status: 502 },
            );
        }

        const data = await groqRes.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            return NextResponse.json(
                { error: "Empty AI response" },
                { status: 502 },
            );
        }

        const parsed = JSON.parse(content);
        return NextResponse.json(parsed);
    } catch (err) {
        console.error("Constraint shifter error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
