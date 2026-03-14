import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            userCode,
            savedSolution,
            savedNotes,
            problemTitle,
            problemDescription,
            cardType,
            hintLevel = 1,
        } = body;

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GROQ_API_KEY is not configured" },
                { status: 500 },
            );
        }

        const isDSA = cardType === "leetcode";
        const clampedLevel = Math.min(Math.max(hintLevel, 1), 3);

        const hintInstructions: Record<number, string> = {
            1: isDSA
                ? "Give a VERY brief nudge about which data structure or algorithm pattern to use. Do NOT reveal the approach — just hint at the category (e.g., 'Think about using a hash map' or 'This is a sliding window problem')."
                : "Give a brief nudge about which area of the concept to focus on. Do NOT explain the concept — just point them in the right direction.",
            2: isDSA
                ? "Outline the high-level approach in 2-3 bullet points WITHOUT showing any code. Describe the steps abstractly (e.g., 'First, sort the array, then use two pointers from both ends')."
                : "Describe the key sub-topics and their relationships at a surface level. Give the structure of the answer without the full details.",
            3: isDSA
                ? "Give a detailed pseudocode walkthrough of the approach. Show the logic step-by-step but do NOT give the actual code in any programming language. Include edge cases to consider."
                : "Give a detailed outline of the complete explanation, covering all major points. Use bullet points for each concept but don't write a full essay — leave the student to flesh out the details.",
        };

        const systemPrompt = `You are a helpful tutor. The student is working on a problem and needs a hint.

IMPORTANT: You must NEVER reveal the complete solution or full answer. Your job is to guide, not solve.

Hint Level: ${clampedLevel}/3 (1=gentle nudge, 2=approach outline, 3=detailed walkthrough)

Instructions: ${hintInstructions[clampedLevel]}

Output valid JSON only, no markdown fences.
Format: { "hint": "your hint text here", "level": ${clampedLevel} }`;

        const userMessage = isDSA
            ? `Problem: ${problemTitle}
Description: ${problemDescription}
${userCode ? `\nStudent's current code:\n${userCode}` : "\nStudent hasn't written any code yet."}`
            : `Concept: ${problemTitle}
Description: ${problemDescription}
${userCode ? `\nStudent's current answer:\n${userCode}` : "\nStudent hasn't written anything yet."}`;

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
                max_tokens: 512,
                response_format: { type: "json_object" },
            }),
        });

        if (!groqRes.ok) {
            const errBody = await groqRes.text();
            console.error("Groq hint API error:", errBody);
            return NextResponse.json(
                { error: "AI hint failed" },
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
        console.error("Hint error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
