import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { subtopic, parentConcept } = body;

        if (!subtopic) {
            return NextResponse.json(
                { error: "Subtopic is required." },
                { status: 400 }
            );
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GROQ_API_KEY is not configured on the server." },
                { status: 500 }
            );
        }

        const systemPrompt = `You are an elite Computer Science professor and technical interviewer.
Your task is to analyze the requested subtopic related to the parent computer science concept, and generate a concise, high-impact study guide.

Format the output strictly as a JSON object with the following fields:
- "briefSummary": A clear 2-3 sentence overview explaining what this subtopic is and its core relevance to the parent concept.
- "keyTakeaways": An array of exactly 3-4 bullet points explaining crucial mechanics, trade-offs, or use cases. Keep each point extremely direct and high-yield.
- "illustrativeExample": A short (max 6-8 lines) snippet of illustrative pseudocode, structural diagram representation, or dry-run example explaining the core mechanism.

Return ONLY valid JSON. No markdown fences, no conversational text.`;

        const userMessage = `Subtopic to explain: ${subtopic}
Parent Concept context: ${parentConcept}`;

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
                max_tokens: 1000,
                response_format: { type: "json_object" },
            }),
        });

        if (!groqRes.ok) {
            const errBody = await groqRes.text();
            console.error("Groq API error in explain-subtopic:", errBody);
            return NextResponse.json(
                { error: "AI explanation generation failed" },
                { status: 502 }
            );
        }

        const data = await groqRes.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            return NextResponse.json(
                { error: "Received empty response from AI model" },
                { status: 502 }
            );
        }

        const parsed = JSON.parse(content);
        return NextResponse.json(parsed);
    } catch (err) {
        console.error("explain-subtopic API error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
