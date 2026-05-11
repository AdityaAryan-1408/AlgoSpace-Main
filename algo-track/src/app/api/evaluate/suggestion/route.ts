import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            userCode,
            savedSolution,
            problemTitle,
            problemDescription,
            cardType,
            aiFeedback,
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
            ? `You are a code reviewer helping a student fix their solution.

CRITICAL RULES:
1. Take the student's EXACT submitted code and return it with the minimal fixes applied.
2. Mark every changed line with a comment like "// <- FIXED: explanation" or "// <- ADDED: explanation".
3. Do NOT include any HTML tags, CSS classes, CSS properties, or any styling markup. Output PURE CODE ONLY.
4. Do NOT invent new code from scratch. Start from the student's code and apply targeted fixes.
5. The code you return MUST be the corrected version that actually works — not pseudocode or partial snippets.
6. If the approach is fundamentally wrong and needs a complete rewrite, set type to "rewrite", explain why briefly, then show the reference solution with brief annotations.
7. Wrap all code in markdown code fences with the correct language identifier.
8. Output valid JSON only, no markdown fences around the JSON itself.

OUTPUT FORMAT (JSON):
{
  "hasImprovements": true,
  "type": "patch" or "rewrite",
  "suggestion": "Brief 1-line explanation of what was wrong, followed by the corrected code in markdown code fences"
}`
            : `You are a CS professor helping a student improve their explanation.

RULES:
- Show what specific points or sentences need to be added or changed.
- Use bullet points with "ADD:" or "CHANGE:" prefixes.
- Tell the student exactly where in their explanation each change should go.
- Do NOT include any HTML tags or CSS. Output plain text only.
- Be concise — just show the improvements.
- Output valid JSON only.

OUTPUT FORMAT (JSON):
{
  "hasImprovements": true,
  "type": "patch" or "rewrite",
  "suggestion": "Bullet-pointed improvements with clear placement instructions"
}`;

        const userMessage = isDSA
            ? `Problem: ${problemTitle}
Description: ${problemDescription}

Reference Solution:
${savedSolution}

Student's Code:
${userCode}

AI Feedback They Received:
${aiFeedback}`
            : `Concept: ${problemTitle}

Reference Notes:
${savedSolution}

Student's Explanation:
${userCode}

AI Feedback They Received:
${aiFeedback}`;

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
                temperature: 0.2,
                max_tokens: 1024,
                response_format: { type: "json_object" },
            }),
        });

        if (!groqRes.ok) {
            const errBody = await groqRes.text();
            console.error("Groq suggestion API error:", errBody);
            return NextResponse.json(
                { error: `AI suggestion failed: ${groqRes.status}` },
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

        if (parsed.suggestion && typeof parsed.suggestion === "string") {
            // Safety net: strip any HTML tags the AI may have injected
            parsed.suggestion = parsed.suggestion.replace(
                /<\/?[a-zA-Z][^>]*\/?>/g,
                ""
            );
            // Strip stray class attributes
            parsed.suggestion = parsed.suggestion.replace(
                /\s*class="[^"]*"/g,
                ""
            );
        }

        return NextResponse.json(parsed);
    } catch (err) {
        console.error("Suggestion error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
