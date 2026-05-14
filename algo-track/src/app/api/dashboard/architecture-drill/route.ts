import { NextResponse } from "next/server";

export async function GET() {
    try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GROQ_API_KEY is not configured" },
                { status: 500 },
            );
        }

        const systemPrompt = `You are a Senior Software Engineer acting as a mentor.
Your task is to generate a single, realistic system design / architecture drill question.

Requirements:
1. "scenario": A 1-2 sentence real-world problem (e.g. "You need to build a rate limiter for an API...").
2. "options": An array of exactly 3 different data structures, databases, or architectural patterns.
3. "correctAnswer": The single best choice from the "options" array. MUST exactly match the string in options.
4. "explanation": A very brief 1-sentence explanation of why it is correct.

Output valid JSON ONLY.
Format: { "scenario": "...", "options": ["...", "...", "..."], "correctAnswer": "...", "explanation": "..." }`;

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
                    { role: "user", content: "Generate a new architecture drill." },
                ],
                temperature: 0.8,
                max_tokens: 256,
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
            return NextResponse.json(
                { error: "Empty AI response" },
                { status: 502 },
            );
        }

        const parsed = JSON.parse(content);
        return NextResponse.json(parsed);
    } catch (err) {
        console.error("Architecture Drill error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
