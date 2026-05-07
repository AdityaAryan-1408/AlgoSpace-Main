import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            action,
            problemTitle,
            problemDescription,
            savedSolution,
            savedNotes,
            cardType,
            conversationHistory,
        } = body;

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GROQ_API_KEY is not configured" },
                { status: 500 },
            );
        }

        if (action === "generate") {
            // Generate a vague, real-world-sounding problem description
            const systemPrompt = `You are a senior software engineer conducting a technical interview. 
Your job is to present a coding problem in a DELIBERATELY VAGUE, real-world way — exactly like a real interviewer would.

RULES:
- Do NOT give the clean LeetCode-style problem statement.
- Instead, describe a real-world business scenario that maps to the underlying algorithm.
- Be conversational and somewhat ambiguous about exact constraints.
- Leave key details intentionally unclear so the candidate MUST ask clarifying questions.
- The candidate should need 2-4 clarifying questions to understand the full problem.
- Output valid JSON only, no markdown fences.

OUTPUT FORMAT (JSON):
{
  "vagueDescription": "The vague, real-world problem description",
  "hiddenConstraints": ["List of constraints you're deliberately hiding"],
  "idealClarifyingQuestions": ["List of questions a good candidate would ask"],
  "difficulty": "easy" | "medium" | "hard"
}`;

            const userMessage = `Original Problem: ${problemTitle}
Description: ${problemDescription}
${savedSolution ? `Solution: ${savedSolution}` : ""}
${savedNotes ? `Notes: ${savedNotes}` : ""}
Card Type: ${cardType}

Generate a vague, interview-style version of this problem.`;

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
                    temperature: 0.7,
                    max_tokens: 1024,
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

        if (action === "respond") {
            // Respond to a clarifying question
            const systemPrompt = `You are a senior software engineer being asked clarifying questions about a coding problem you presented vaguely.

RULES:
- Answer the candidate's question naturally — like a real interviewer.
- Reveal ONLY what they specifically asked about. Don't volunteer extra info.
- If they ask a great question, subtly acknowledge it.
- If they ask something irrelevant, gently redirect.
- Keep answers concise (1-3 sentences).
- Track how many constraints they've uncovered.
- Output valid JSON only, no markdown fences.

OUTPUT FORMAT (JSON):
{
  "response": "Your conversational answer",
  "constraintsRevealed": 0,
  "isReadyToCode": false,
  "hint": "optional subtle hint if they're stuck"
}`;

            const messages = [
                { role: "system" as const, content: systemPrompt },
                ...(conversationHistory || []).map((msg: { role: string; content: string }) => ({
                    role: msg.role as "user" | "assistant",
                    content: msg.content,
                })),
            ];

            const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages,
                    temperature: 0.5,
                    max_tokens: 512,
                    response_format: { type: "json_object" },
                }),
            });

            if (!groqRes.ok) {
                const errBody = await groqRes.text();
                console.error("Groq API error:", errBody);
                return NextResponse.json(
                    { error: "AI response failed" },
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
            // Evaluate how well the candidate extracted requirements
            const systemPrompt = `You are evaluating how well a candidate extracted requirements from a vague problem description.

RULES:
- Compare the clarifying questions they asked against the ideal ones.
- Score their requirement-extraction ability.
- Provide specific feedback on what they did well and what they missed.
- Talk directly to the candidate using "you" and "your".
- Output valid JSON only, no markdown fences.

OUTPUT FORMAT (JSON):
{
  "score": 0-100,
  "feedback": "Detailed feedback",
  "questionsAsked": 0,
  "constraintsUncovered": 0,
  "totalConstraints": 0,
  "missedAreas": ["areas they didn't explore"],
  "suggestedRating": "AGAIN" | "HARD" | "GOOD" | "EASY"
}`;

            const userMessage = `Original Problem: ${problemTitle}
Description: ${problemDescription}

Conversation History:
${(conversationHistory || []).map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join("\n")}

Evaluate the candidate's clarifying questions and requirement extraction.`;

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
        console.error("Vague interviewer error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
