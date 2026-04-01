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
            ? `You are a code reviewer helping a student improve their solution.

RULES:
- You are given the student's code, the AI feedback they received, and the reference solution.
- Your job is to show the MINIMAL changes needed to fix or improve their code.
- If only 1-5 lines need changing, return their code with clear markers showing what to change.
- Use "// ← ADD THIS" or "// ← CHANGE THIS" comments to mark changes.
- If the approach is fundamentally wrong and needs a complete rewrite, set type to "rewrite" and provide a brief explanation of why their approach won't work, then show the reference solution with brief annotations.
- Be concise. Don't repeat the full feedback — just show the fix.
- IMPORTANT: Always wrap any code inside the suggestion field in markdown code fences (e.g. \`\`\`cpp ... \`\`\`). Use the correct language identifier.
- Output valid JSON only. The outer response must NOT be in markdown fences, but code INSIDE the suggestion string value MUST use markdown fences.

OUTPUT FORMAT (JSON):
{
  "hasImprovements": true,
  "type": "patch" | "rewrite",
  "suggestion": "Brief explanation then \`\`\`lang\\ncode here\\n\`\`\`"
}`
            : `You are a CS professor helping a student improve their explanation.

RULES:
- You are given the student's explanation, the AI feedback, and the reference notes.
- Show what specific points or sentences need to be added or changed.
- Use bullet points with "ADD:" or "CHANGE:" prefixes.
- Tell the student exactly where in their explanation each change should go.
- Be concise — just show the improvements, not the full corrected answer.
- Output valid JSON only, no markdown fences.

OUTPUT FORMAT (JSON):
{
  "hasImprovements": true,
  "type": "patch" | "rewrite",
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
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage },
                ],
                temperature: 0.2,
                max_tokens: 512,
                response_format: { type: "json_object" },
            }),
        });

        if (!groqRes.ok) {
            const errBody = await groqRes.text();
            console.error("Groq suggestion API error:", errBody);
            return NextResponse.json(
                { error: "AI suggestion failed" },
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

        // Ensure code in suggestion is wrapped in markdown fences for proper rendering
        if (parsed.suggestion && parsed.hasImprovements && isDSA) {
            const s = parsed.suggestion as string;
            // If it contains code-like patterns but no markdown fences, wrap it
            if (!s.includes("```") && /[{};()=]/.test(s)) {
                parsed.suggestion = "```\n" + s + "\n```";
            }
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
