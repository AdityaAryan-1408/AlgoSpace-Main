import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { title, description, notes } = body;

        if (!title || (!notes && !description)) {
            return NextResponse.json(
                { error: "Card title and notes/description are required." },
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
Your task is to analyze the provided flashcard details (Title, Description, and Reference Notes) of a CS Core concept, and generate a comprehensive question bank and active-recall resources containing:
1. Exactly 15 to 20 highly effective, deep conceptual Multiple-Choice Questions (MCQs).
2. Exactly 6 to 8 important technical keywords/terms found in the notes.
3. Exactly 3 to 4 summary sentences of the concept where exactly one key technical term per sentence is masked using curly braces like {{term}}.
4. Exactly 4 to 6 key-value matching pairs representing definitions, layers, components, or mappings of the concept.

RULES FOR RESOURCE GENERATION:
1. MCQs: DO NOT make the questions trivial. Test deep edge cases, failure scenarios, or design trade-offs. Each MCQ has exactly 4 options.
2. Keywords: List 6 to 8 short, technical key terms or keywords that are essential to explaining this concept.
3. Cloze Sentences: Generate 3 to 4 highly informative summary sentences. Wrap exactly one critical key term per sentence in double curly braces {{likeThis}} (e.g., "ACID is a set of properties where {{Atomicity}} means all-or-nothing."). The wrapped term must be the exact word that needs to be filled in.
4. Concept Matches: Create 4 to 6 distinct pairs where "term" is a key component, layer, or keyword (e.g., "Atomicity", "Physical Layer"), and "definition" is a concise 1-sentence description of its role or function.
5. You must output a JSON object with five fields:
   - "questions": An array of MCQ objects, each containing:
     - "id": A unique string ID (e.g. "q1", "q2")
     - "questionText": The text of the question.
     - "options": An array of exactly 4 strings.
     - "correctOptionIndex": The index (0, 1, 2, or 3) of the correct option.
     - "explanation": A clear, comprehensive, and detailed 3-4 sentence explanation. Break down exactly why the correct option is correct, and explain why the incorrect options are incorrect.
     - "subtopic": The specific facet covered.
   - "suggestedSubtopics": An array of 3 to 4 related advanced study topics.
   - "keywords": An array of 6 to 8 strings (the key terms).
   - "clozeSentences": An array of 3 to 4 cloze deletion strings.
   - "conceptMatches": An array of objects, each containing:
     - "term": The key term, layer, or phase.
     - "definition": A 1-sentence definition or role matching this term.

OUTPUT FORMAT (JSON):
{
  "questions": [
    {
      "id": "q1",
      "questionText": "...",
      "options": ["...", "...", "...", "..."],
      "correctOptionIndex": 0,
      "explanation": "...",
      "subtopic": "..."
    }
  ],
  "suggestedSubtopics": ["Topic A", "Topic B"],
  "keywords": ["Term A", "Term B", "Term C"],
  "clozeSentences": [
    "A key concept is {{Term A}} which does XYZ.",
    "Another one is {{Term B}} which ensures ABC."
  ],
  "conceptMatches": [
    { "term": "Term A", "definition": "A 1-sentence description of Term A" },
    { "term": "Term B", "definition": "A 1-sentence description of Term B" }
  ]
}

Return ONLY valid JSON. No markdown fences, no conversational text.`;

        const userMessage = `Concept Title: ${title}
Description: ${description || "None provided"}
Reference Notes:
${notes || "None provided"}`;

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
                max_tokens: 4000,
                response_format: { type: "json_object" },
            }),
        });

        if (!groqRes.ok) {
            const errBody = await groqRes.text();
            console.error("Groq API error in theory-quiz:", errBody);
            return NextResponse.json(
                { error: "AI question bank generation failed" },
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
        console.error("theory-quiz generator error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
