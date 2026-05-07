import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            userCode,
            problemTitle,
            problemDescription,
            language,
        } = body;

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GROQ_API_KEY is not configured" },
                { status: 500 },
            );
        }

        const systemPrompt = `You are a senior code reviewer specializing in clean, idiomatic code. Your task is to evaluate the "elegance" of the user's working code solution.

RULES:
- Score the code on 5 dimensions: Readability, Idiomaticness, Conciseness, Naming Quality, and Modern Features usage.
- Each dimension is scored 1-10.
- Compute an overall elegance score (1-100) as a weighted average.
- Identify 1-3 SPECIFIC chunks of their code that can be improved with more idiomatic patterns.
- For each improvement, show the BEFORE (their code) and AFTER (improved version).
- Be language-specific. Use idiomatic features of the detected language.
- The code WORKS correctly — you are only scoring style and elegance, not correctness.
- NEVER include HTML tags or CSS classes in your output.
- Output valid JSON only, no markdown fences.

OUTPUT FORMAT (JSON):
{
  "overallScore": 72,
  "dimensions": {
    "readability": {"score": 8, "comment": "Brief note"},
    "idiomaticness": {"score": 6, "comment": "Brief note"},
    "conciseness": {"score": 7, "comment": "Brief note"},
    "naming": {"score": 8, "comment": "Brief note"},
    "modernFeatures": {"score": 5, "comment": "Brief note"}
  },
  "improvements": [
    {
      "description": "What can be improved",
      "before": "exact code lines from their solution",
      "after": "improved idiomatic version",
      "technique": "Name of the technique (e.g., 'List Comprehension', 'Destructuring')"
    }
  ],
  "verdict": "One-sentence summary of the code's elegance"
}`;

        const userMessage = `Problem: ${problemTitle}
Description: ${problemDescription}
Language: ${language || "auto-detect"}

Code to score:
${userCode}`;

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
                temperature: 0.3,
                max_tokens: 1500,
                response_format: { type: "json_object" },
            }),
        });

        if (!groqRes.ok) {
            const errBody = await groqRes.text();
            console.error("Groq API error:", errBody);
            return NextResponse.json(
                { error: "Elegance scoring failed" },
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
        console.error("Elegance score error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
