import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { originalCode, translatedCode, sourceLanguage, targetLanguage, problemTitle } = body;

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
        }

        const systemPrompt = `You are a polyglot programming expert. Evaluate a code translation from ${sourceLanguage} to ${targetLanguage}.

RULES:
- Check if the logic is correctly preserved
- Grade specifically on idiomatic usage of the TARGET language (not just a literal translation)
- Identify language-specific features they should have used (e.g., list comprehensions in Python, structured bindings in C++, etc.)
- Score the translation on: Correctness, Idiomaticness, and Code Quality
- Suggest specific improvements using TARGET language features
- Output valid JSON only, no markdown

OUTPUT FORMAT (JSON):
{
  "isCorrect": true/false,
  "correctnessScore": 9,
  "idiomaticScore": 7,
  "qualityScore": 8,
  "overallScore": 80,
  "feedback": "Overall assessment",
  "idiomaticIssues": [
    {
      "issue": "What's not idiomatic",
      "before": "Their code snippet",
      "after": "Idiomatic version",
      "feature": "Language feature they should use"
    }
  ],
  "missingFeatures": ["List of target language features not utilized"]
}`;

        const userMessage = `Problem: ${problemTitle}
Source Language: ${sourceLanguage}
Target Language: ${targetLanguage}

Original (${sourceLanguage}):
${originalCode}

Student's Translation (${targetLanguage}):
${translatedCode}`;

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
                max_tokens: 1500,
                response_format: { type: "json_object" },
            }),
        });

        if (!groqRes.ok) {
            return NextResponse.json({ error: "AI failed" }, { status: 502 });
        }

        const data = await groqRes.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return NextResponse.json({ error: "Empty response" }, { status: 502 });

        return NextResponse.json(JSON.parse(content));
    } catch (err) {
        console.error("Cross-language error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
