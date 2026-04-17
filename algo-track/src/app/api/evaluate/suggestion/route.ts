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
- Use plain code comments like "// <- ADD THIS" or "// <- CHANGE THIS" to mark changes.
- NEVER include HTML tags, CSS classes, or any markup in the code. Output pure code only.
- If the approach is fundamentally wrong and needs a complete rewrite, set type to "rewrite" and provide a brief explanation of why their approach won't work, then show the reference solution with brief annotations.
- Be concise. Don't repeat the full feedback — just show the fix.
- IMPORTANT: When including code in the suggestion field, wrap it in triple-backtick markdown code fences with the language name. For example, use triple backticks followed by cpp, then the code, then closing triple backticks.
- Output valid JSON only.

OUTPUT FORMAT (JSON):
{
  "hasImprovements": true,
  "type": "patch" or "rewrite",
  "suggestion": "Brief explanation followed by code in markdown code fences"
}`
            : `You are a CS professor helping a student improve their explanation.

RULES:
- You are given the student's explanation, the AI feedback, and the reference notes.
- Show what specific points or sentences need to be added or changed.
- Use bullet points with "ADD:" or "CHANGE:" prefixes.
- Tell the student exactly where in their explanation each change should go.
- Be concise — just show the improvements, not the full corrected answer.
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
            // Strip any HTML tags/attributes the AI may have injected
            // e.g. <span class="text-zinc-500">, </span>, class="text-amber-300">
            // Step 1: Remove stray class="..." attributes (with or without closing >)
            parsed.suggestion = parsed.suggestion.replace(
                /\s*class="[^"]*">/g,
                ""
            );
            // Step 2: Remove all HTML tags (opening, closing, self-closing)
            parsed.suggestion = parsed.suggestion.replace(
                /<\/?[a-zA-Z][^>]*\/?>/g,
                ""
            );
            // Step 3: Remove leftover stray class attributes without tags
            parsed.suggestion = parsed.suggestion.replace(
                /\s*class="[^"]*"/g,
                ""
            );

            // Ensure code in suggestion is wrapped in markdown fences for proper rendering
            if (parsed.hasImprovements && isDSA) {
                if (!parsed.suggestion.includes("```") && /[{};()=]/.test(parsed.suggestion)) {
                    parsed.suggestion = "```\n" + parsed.suggestion + "\n```";
                }
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
