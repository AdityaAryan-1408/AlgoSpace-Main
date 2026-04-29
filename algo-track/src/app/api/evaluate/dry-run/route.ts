import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            problemTitle,
            problemDescription,
            savedSolution,
            cardType,
        } = body;

        if (cardType !== "leetcode") {
            return NextResponse.json(
                { error: "Dry-run challenges are only available for DSA problems" },
                { status: 400 },
            );
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GROQ_API_KEY is not configured" },
                { status: 500 },
            );
        }

        const systemPrompt = `You are a technical interviewer creating a "dry-run" / mental execution challenge. Given an algorithm problem and its solution, generate:

1. A specific code snippet (from the solution or a variation) for the user to mentally trace
2. An edge-case or tricky input for that code
3. The expected output/end-state after mental execution

RULES:
- The code should be concise (10-25 lines max)
- The input should be tricky enough to require careful tracing (off-by-one, empty arrays, single elements, etc.)
- Include step-by-step variable states as the "answer" so users can verify their trace
- Output valid JSON only, no markdown fences.

OUTPUT FORMAT (JSON):
{
  "code": "The code snippet to trace (with language hint in first comment line)",
  "input": "The specific input to trace through",
  "inputExplanation": "Why this input is tricky",
  "expectedOutput": "The final output/return value",
  "traceSteps": [
    {"step": 1, "description": "Brief description of what happens", "variables": "key variable states"},
    {"step": 2, "description": "...", "variables": "..."}
  ],
  "difficulty": "medium" | "hard"
}`;

        const userMessage = `Problem: ${problemTitle}
Description: ${problemDescription}

Reference Solution:
${savedSolution || "No reference solution"}

Generate a dry-run challenge with a tricky edge-case input.`;

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
                max_tokens: 1024,
                response_format: { type: "json_object" },
            }),
        });

        if (!groqRes.ok) {
            const errBody = await groqRes.text();
            console.error("Groq API error:", errBody);
            return NextResponse.json(
                { error: "AI dry-run generation failed" },
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
        console.error("Dry-run generate error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
