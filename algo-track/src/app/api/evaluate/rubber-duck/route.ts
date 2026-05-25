import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            problemTitle,
            problemDescription,
            savedSolution,
            savedNotes,
            userExplanation,
            conversationHistory = [],
        } = body;

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GROQ_API_KEY is not configured" },
                { status: 500 },
            );
        }

        const systemPrompt = `You are a helpful, technically rigorous "Rubber Duck" AI coach. 
The student is trying to unlock their code editor to solve a coding problem.
Before they can write any code, they MUST explain their intended algorithmic approach, including the key data structures, core logic, and time/space complexity, in plain English.

Your job is to critically evaluate if their approach is theoretically correct, fits the problem requirements, and is optimal.

RULES:
- Talk directly to the student using "you" and "your". Keep your tone encouraging, warm (like a rubber duck 🦆), but technically precise.
- Check their approach against the provided problem description and reference solution/notes.
- If their approach is correct and optimal (or very close to the optimal complexity), set "approved" to true.
- If their approach is incorrect, suboptimal (e.g., O(N^2) when an O(N) or O(N log N) is possible), or too vague, set "approved" to false. Explain clearly but encouragingly what is missing or how they can improve, and provide 1-2 subtle, guiding hints.
- DO NOT write any code or templates for them.
- Output valid JSON only, no markdown fences.

OUTPUT FORMAT (JSON):
{
  "approved": true | false,
  "verdict": "A brief summary status (e.g., 'Approved! Optimal approach.' or 'Keep Thinking... Let\\'s refine the complexity.')",
  "feedback": "Detailed, conversational review addressing the student directly.",
  "hints": ["List of subtle hints if not approved (leave empty if approved)"]
}`;

        const messages = [
            { role: "system" as const, content: systemPrompt },
            ...conversationHistory.map((m: { role: string; content: string }) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
            })),
            {
                role: "user" as const,
                content: `Problem: ${problemTitle}
Description: ${problemDescription}

Reference Solution/Notes:
${savedSolution || ""}
${savedNotes || ""}

Student's Explanation:
${userExplanation}

Evaluate their logic and let them know if they are approved to start coding.`,
            },
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
                temperature: 0.4,
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
    } catch (err) {
        console.error("Rubber duck route error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
