import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            userAnswer,
            savedSolution,
            savedNotes,
            problemTitle,
            problemDescription,
            cardType,
            strictMode = false,
        } = body;

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GROQ_API_KEY is not configured" },
                { status: 500 },
            );
        }

        const isDSA = cardType === "leetcode" || cardType === "sql";

        const systemPrompt = isDSA
            ? `You are a strict but fair technical interviewer. Talk directly to the candidate using "you" and "your".

RULES:
- Compare their code against the reference solution by LOGIC, not syntax. They may write in any language.
- Address the candidate directly: "Your approach uses...", "You missed...", etc.
- Evaluate the solution across three distinct criteria:
  1. Approach: Is the algorithmic strategy optimal? (Compare their approach to the stored reference solution).
  2. Efficiency: Are the Big-O time and space complexities optimal?
  3. Code Style: Is the code clean, readable, well-structured, and elegant compared to the reference solution?
- ${strictMode ? "STRICT MODE: Fail the attempt for any syntax errors, missing edge cases, or suboptimal complexity/strategy." : "RELAXED MODE: Accept the solution if the core algorithmic logic is correct, even with minor syntax issues, minor style issues, or missing edge cases."}
- Output valid JSON only, no markdown fences.

OUTPUT FORMAT (JSON):
{
  "feedback": "Detailed overall feedback addressing the candidate directly using you/your",
  "isCorrect": true/false,
  "suggestedRating": "AGAIN" | "HARD" | "GOOD" | "EASY",
  "criteria": {
    "approach": {
      "passed": true/false,
      "current": "A concise title/name of their approach (e.g. Breadth-First Search / Queue)",
      "suggested": "The optimal or alternative approaches (e.g. Breadth-First Search / Depth-First Search / Union-Find)",
      "keyIdea": "Concise key concept behind the solution",
      "consider": "An engaging, thought-provoking question about trade-offs or a minor detail (e.g. iterative stack usage vs recursion)"
    },
    "efficiency": {
      "passed": true/false,
      "userTime": "O(?)",
      "userSpace": "O(?)",
      "optimalTime": "O(?)",
      "optimalSpace": "O(?)",
      "comparison": "Brief complexity comparison comment"
    },
    "codeStyle": {
      "passed": true/false,
      "score": 85, // integer score between 0 and 100 rating their code quality against reference solutions
      "grade": "A-", // letter grade corresponding to score (e.g. A+, A, B, C)
      "comparisonComment": "A brief explanation of how their code structure, naming, and style rates against stored solutions"
    }
  }
}`
            : `You are a knowledgeable CS professor. Talk directly to the student using "you" and "your".

RULES:
- Evaluate their explanation for correctness, depth, and clarity.
- Address them directly: "You correctly explained...", "You missed...", etc.
- Compare against the reference notes/answer.
- ${strictMode ? "STRICT MODE: Require precise technical terminology and comprehensive coverage of all key points." : "RELAXED MODE: Accept explanations that demonstrate understanding of core concepts, even if not perfectly worded."}
- Output valid JSON only, no markdown fences.

OUTPUT FORMAT (JSON):
{
  "feedback": "Detailed feedback addressing the student directly using you/your",
  "isCorrect": true/false,
  "suggestedRating": "AGAIN" | "HARD" | "GOOD" | "EASY",
  "conceptCoverage": {
    "coveredPoints": ["point1", "point2"],
    "missedPoints": ["point1"],
    "misconceptions": ["if any"]
  }
}`;

        const userMessage = isDSA
            ? `Problem: ${problemTitle}
Description: ${problemDescription}

Reference Solution:
${savedSolution}

User's Code:
${userAnswer}`
            : `Concept: ${problemTitle}
Reference Notes:
${savedNotes || savedSolution}

Student's Explanation:
${userAnswer}`;

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
        console.error("Evaluate error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
