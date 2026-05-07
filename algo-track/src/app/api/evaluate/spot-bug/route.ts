import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            action,
            problemTitle,
            problemDescription,
            savedSolution,
            cardType,
            userFix,
            buggyCode,
        } = body;

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GROQ_API_KEY is not configured" },
                { status: 500 },
            );
        }

        if (action === "generate") {
            const systemPrompt = `You are a code challenge generator creating "Spot the Bug" challenges.

RULES:
- Take the reference solution and introduce EXACTLY ONE subtle bug.
- The bug should be realistic — the kind a developer might accidentally write.
- Good bug types: off-by-one errors, wrong comparison operators, missing edge cases, incorrect variable usage, wrong loop bounds, missing break/return, incorrect initialization.
- The code should LOOK correct at first glance. The bug must be subtle.
- Do NOT introduce syntax errors — the code should parse/compile.
- Use the same language as the reference solution.
- Provide a clear explanation of what the bug is and why it causes problems.
- Output valid JSON only, no markdown fences.

OUTPUT FORMAT (JSON):
{
  "buggyCode": "The code with exactly one bug introduced",
  "bugType": "off-by-one" | "wrong-operator" | "missing-edge-case" | "wrong-variable" | "wrong-bounds" | "missing-return" | "wrong-init" | "logic-error",
  "bugDescription": "What the bug is (hidden from user until reveal)",
  "bugLine": 0,
  "hint": "A subtle hint about where to look",
  "difficulty": "medium" | "hard"
}`;

            const userMessage = `Problem: ${problemTitle}
Description: ${problemDescription}
Card Type: ${cardType}

Reference Solution:
${savedSolution}

Create a version of this code with exactly one subtle bug.`;

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
                    temperature: 0.6,
                    max_tokens: 1500,
                    response_format: { type: "json_object" },
                }),
            });

            if (!groqRes.ok) {
                const errBody = await groqRes.text();
                console.error("Groq API error:", errBody);
                return NextResponse.json(
                    { error: "AI generation failed" },
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
        }

        if (action === "evaluate") {
            const systemPrompt = `You are evaluating a developer's bug fix attempt.

RULES:
- Compare their fix against the known bug.
- Determine if they correctly identified and fixed the bug.
- Provide feedback on their debugging approach.
- Talk directly to the candidate using "you" and "your".
- Output valid JSON only, no markdown fences.

OUTPUT FORMAT (JSON):
{
  "isCorrect": true/false,
  "feedback": "Detailed feedback on their fix",
  "correctFix": "What the correct fix should be",
  "suggestedRating": "AGAIN" | "HARD" | "GOOD" | "EASY",
  "debuggingSkill": "novice" | "intermediate" | "expert"
}`;

            const userMessage = `Problem: ${problemTitle}

Buggy Code:
${buggyCode}

Reference Solution:
${savedSolution}

User's Fix:
${userFix}

Evaluate whether the user correctly identified and fixed the bug.`;

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
                    max_tokens: 1024,
                    response_format: { type: "json_object" },
                }),
            });

            if (!groqRes.ok) {
                const errBody = await groqRes.text();
                console.error("Groq API error:", errBody);
                return NextResponse.json(
                    { error: "AI evaluation failed" },
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
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (err) {
        console.error("Spot the bug error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
