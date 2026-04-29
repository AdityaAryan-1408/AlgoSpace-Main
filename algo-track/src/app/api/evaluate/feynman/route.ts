import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            transcript,
            problemTitle,
            problemDescription,
            savedSolution,
            savedNotes,
            cardType,
        } = body;

        if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10) {
            return NextResponse.json(
                { error: "Transcript is too short or missing" },
                { status: 400 },
            );
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GROQ_API_KEY is not configured" },
                { status: 500 },
            );
        }

        const isDSA = cardType === "leetcode";

        const systemPrompt = `You are a senior technical interviewer evaluating a candidate's VERBAL explanation of ${isDSA ? "an algorithm problem" : "a CS concept"}. Talk directly to the candidate using "you" and "your".

The candidate was asked to explain their approach out loud (Feynman Technique). You received a transcript of their spoken explanation.

EVALUATE ON THESE CRITERIA:
1. **Clarity** (1-10): Can you understand what they're saying? Is the explanation well-structured?
2. **Technical Accuracy** (1-10): Is the algorithmic/technical content correct?
3. **Communication** (1-10): Did they articulate trade-offs, edge cases, Big-O complexity verbally?
4. **Completeness** (1-10): Did they cover the key aspects of the solution?

RULES:
- Address them directly: "You explained...", "Your description of...", etc.
- Highlight what they communicated well and what they missed.
- Suggest specific improvements for their verbal communication.
- Be encouraging but honest.
- Output valid JSON only, no markdown fences.

OUTPUT FORMAT (JSON):
{
  "overallScore": <number 1-10>,
  "clarity": <number 1-10>,
  "technicalAccuracy": <number 1-10>,
  "communication": <number 1-10>,
  "completeness": <number 1-10>,
  "feedback": "Detailed feedback text with markdown formatting",
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "suggestedRating": "AGAIN" | "HARD" | "GOOD" | "EASY"
}`;

        const userMessage = isDSA
            ? `Problem: ${problemTitle}
Description: ${problemDescription}

Reference Solution:
${savedSolution || "No reference solution provided"}

Candidate's Verbal Explanation (Transcript):
${transcript}`
            : `Concept: ${problemTitle}
Reference Notes:
${savedNotes || savedSolution || "No reference notes provided"}

Candidate's Verbal Explanation (Transcript):
${transcript}`;

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
            return NextResponse.json(
                { error: "Empty AI response" },
                { status: 502 },
            );
        }

        const parsed = JSON.parse(content);
        return NextResponse.json(parsed);
    } catch (err) {
        console.error("Feynman evaluate error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
