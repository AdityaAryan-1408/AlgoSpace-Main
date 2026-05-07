import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { codeSubmissions } = body;

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
        }

        const systemPrompt = `You are a code pattern analyzer. Given multiple code submissions from the same developer across different problems, identify their PERSONAL coding anti-patterns and bad habits.

RULES:
- Look for recurring mistakes, NOT one-off errors
- Focus on patterns like: forgetting edge cases, poor variable naming habits, redundant code, off-by-one tendency, missing null checks, etc.
- For each anti-pattern, generate a custom flashcard-style challenge that targets that specific weakness
- The challenge should include a buggy code snippet that contains the user's typical mistake
- Be specific — reference the actual pattern you see across their submissions
- Output valid JSON only, no markdown

OUTPUT FORMAT (JSON):
{
  "patterns": [
    {
      "name": "Short descriptive name",
      "description": "Detailed explanation of the bad habit",
      "frequency": "How often this appears across submissions",
      "severity": "high" | "medium" | "low",
      "challenge": {
        "title": "Custom flashcard title",
        "buggyCode": "Code with this specific bug pattern",
        "hint": "What to look for",
        "fix": "The corrected version"
      }
    }
  ],
  "overallAssessment": "One paragraph summary of the developer's habits"
}`;

        const userMessage = `Analyze these code submissions from the same developer across different problems:

${codeSubmissions.map((s: { problem: string; code: string; rating: string }, i: number) =>
    `--- Submission ${i + 1}: ${s.problem} (rated: ${s.rating}) ---\n${s.code}\n`
).join("\n")}

Identify recurring anti-patterns and generate personalized challenges.`;

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
                max_tokens: 2000,
                response_format: { type: "json_object" },
            }),
        });

        if (!groqRes.ok) {
            const errBody = await groqRes.text();
            console.error("Groq anti-patterns error:", errBody);
            return NextResponse.json({ error: "AI analysis failed" }, { status: 502 });
        }

        const data = await groqRes.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return NextResponse.json({ error: "Empty response" }, { status: 502 });

        return NextResponse.json(JSON.parse(content));
    } catch (err) {
        console.error("Anti-patterns error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
