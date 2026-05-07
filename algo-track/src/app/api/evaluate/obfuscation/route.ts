import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { code, problemTitle, mode } = body;

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
        }

        let systemPrompt: string;

        if (mode === "obfuscate") {
            systemPrompt = `You are a code obfuscator for educational purposes. Take the user's code and obfuscate it:
1. Rename ALL variables and function parameters to single letters (a, b, c, temp1, temp2, etc.)
2. Remove ALL comments
3. Collapse spacing where possible but keep it readable enough to analyze
4. Do NOT change the algorithm logic — the code must still be functionally identical
5. Output valid JSON only

OUTPUT FORMAT (JSON):
{
  "obfuscatedCode": "The obfuscated version",
  "variableCount": 5,
  "linesOfCode": 15
}`;
        } else {
            // mode === "evaluate"
            systemPrompt = `You are evaluating a student's attempt to refactor obfuscated code back into clean, readable code.

RULES:
- Check if they correctly identified the algorithm
- Score their variable naming quality (1-10)
- Score their comment quality (1-10)
- Check if the refactored code is functionally equivalent
- Provide overall feedback
- Output valid JSON only

OUTPUT FORMAT (JSON):
{
  "algorithmIdentified": true/false,
  "algorithmName": "Name of the algorithm",
  "namingScore": 8,
  "commentScore": 7,
  "isEquivalent": true/false,
  "overallScore": 82,
  "feedback": "Detailed feedback on their refactoring"
}`;
        }

        const userMessage = mode === "obfuscate"
            ? `Problem: ${problemTitle}\n\nCode to obfuscate:\n${code}`
            : `Problem: ${problemTitle}\n\nOriginal (before obfuscation):\n${body.originalCode}\n\nObfuscated version:\n${body.obfuscatedCode}\n\nStudent's refactored version:\n${code}`;

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
            return NextResponse.json({ error: "AI failed" }, { status: 502 });
        }

        const data = await groqRes.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return NextResponse.json({ error: "Empty response" }, { status: 502 });

        return NextResponse.json(JSON.parse(content));
    } catch (err) {
        console.error("Obfuscation error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
