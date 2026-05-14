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
Your task is to generate a "mental tracing" exercise. This should be a tiny function (in JavaScript or Python) that tests raw logic (like a loop, simple recursion, or array manipulation).

Requirements:
1. "code": A short 3-6 line code snippet that includes a function definition AND a ` + "`console.log()`" + ` or ` + "`print()`" + ` call with a specific input. Keep syntax extremely standard. IMPORTANT: The code string MUST be properly formatted with \n newline characters and \t or space indentation to span multiple lines. Do NOT generate the entire function on a single line!
2. "correctOutput": The exact string output of that code. If it returns an integer, output it as a string (e.g. "5").
3. "explanation": A very brief 1-sentence explanation of what the logic does.

Make it slightly tricky but easy enough to trace in your head within 30 seconds.

Output valid JSON ONLY.
Format: { "code": "function foo() {\\n  let x = 1;\\n  return x;\\n}\\nconsole.log(foo());", "correctOutput": "...", "explanation": "..." }`;

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
                    { role: "user", content: "Generate a new mental tracing code snippet." },
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
        console.error("Mental Tracing error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
