import { NextRequest } from "next/server";
import { handleApiError, jsonOk, withUser } from "@/lib/api";

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  isJson: boolean
) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: isJson ? 0.2 : 0.7,
          ...(isJson ? { responseMimeType: "application/json" } : {}),
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Empty response from Gemini API");
  }
  return text;
}

async function callGroq(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  isJson: boolean
) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: isJson ? 0.2 : 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Empty response from Groq API");
  }
  return text;
}

function extractJsonString(str: string): string {
  let clean = str.trim();
  
  // Strip code fences if they wrap the entire thing or exist
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = clean.match(codeBlockRegex);
  if (match) {
    clean = match[1].trim();
  }
  
  const firstCurly = clean.indexOf("{");
  const firstBracket = clean.indexOf("[");
  
  let startIdx = -1;
  let endIdx = -1;
  
  if (firstCurly !== -1 && (firstBracket === -1 || firstCurly < firstBracket)) {
    startIdx = firstCurly;
    endIdx = clean.lastIndexOf("}");
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = clean.lastIndexOf("]");
  }
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return clean.slice(startIdx, endIdx + 1);
  }
  
  return clean;
}

export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();
    const { action, cardTitle, cardDescription, solution, notes, userPromptInput, chatHistory } = body;

    if (!action || !cardTitle) {
      throw new Error("Missing action or card info");
    }

    let systemPrompt = "";
    let userPrompt = "";
    let isJson = false;

    if (action === "dsa_hint") {
      systemPrompt = `You are an expert DSA Socratic tutor. 
Your goal is to guide the student to solve the coding problem: "${cardTitle}".
Description: ${cardDescription || "(No description)"}

RULES:
1. DO NOT write code for the student.
2. DO NOT give direct answers or final algorithmic approaches immediately.
3. Guide them using hints, Socratic questions, and debugging tips based on their query.
4. Keep responses encouraging, concise, and structured in clean Markdown.`;

      const formattedHistory = Array.isArray(chatHistory)
        ? chatHistory.map((m: any) => `${m.role === "user" ? "User" : "Tutor"}: ${m.text || m.message}`).join("\n")
        : "";

      userPrompt = `Student's input: "${userPromptInput}"
Chat History:
${formattedHistory || "(No history)"}`;

    } else if (action === "dsa_edge_cases") {
      systemPrompt = `You are a Senior QA Automation Engineer.
Review the DSA problem "${cardTitle}" and list critical, tricky edge cases that users must consider when writing a solution (e.g. empty arrays, extreme bounds, negative numbers, duplicates, large inputs).
Provide a structured list in clean Markdown with clear headings and short code/input example blocks.`;

      userPrompt = `Problem: ${cardTitle}
Description: ${cardDescription || ""}`;

    } else if (action === "sql_optimize") {
      systemPrompt = `You are an expert SQL Query Performance Optimizer.
Analyze the user's submitted SQL query and database details for the problem "${cardTitle}".
Provide concrete recommendations for optimization, index placement, execution plan analysis, or query rewrite tradeoffs.
Format your output in clean, readable Markdown with code blocks for optimized SQL.`;

      userPrompt = `Problem: ${cardTitle}
User's SQL Query / Solution:
${solution || ""}

Problem Description:
${cardDescription || ""}`;

    } else if (action === "sql_alternatives") {
      isJson = true;
      systemPrompt = `You are an expert database administrator and SQL developer.
For the SQL problem "${cardTitle}", generate alternative query approaches to solve it.
Examples: "using window functions", "using subqueries", "using joins", "using CTEs", "using aggregation functions".

You MUST return ONLY a JSON array of objects matching this schema:
[
  {
    "title": "A short heading of the approach (e.g., Using Window Functions)",
    "code": "The SQL query implementation",
    "explanation": "A concise explanation of how it works and its performance tradeoffs"
  }
]
Only return valid, raw JSON. Do NOT wrap it in markdown code blocks (\`\`\`json).`;

      userPrompt = `Problem: ${cardTitle}
Description:
${cardDescription || ""}

Primary Solution:
${solution || ""}`;

    } else if (action === "concept_analogy") {
      systemPrompt = `You are a legendary Computer Science teacher.
Explain the CS Core concept: "${cardTitle}" using a fun, highly relatable real-world analogy.
Avoid overly dry academic explanations. Make the analogy clear, memorable, and connect it back to how the concept behaves in software engineering.
Format your explanation in beautiful Markdown.`;

      userPrompt = `Explain "${cardTitle}".
Description:
${cardDescription || ""}`;

    } else if (action === "notes_enhancer") {
      systemPrompt = `You are a professional computer science tutor and technical writer.
Help the student learn the topic: "${cardTitle}".
You have access to the student's active study notes for context:
${notes || "(Empty)"}

GUIDELINES:
1. Answer the student's question in a clear, concise, and helpful manner using clean Markdown.
2. Provide concrete explanations, real-world analogies, or code/diagram examples if relevant.
3. Keep the context of their current notes in mind when answering.
4. Keep the response engaging and focused on teaching.`;

      const formattedHistory = Array.isArray(chatHistory)
        ? chatHistory.map((m: any) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.text || m.message}`).join("\n")
        : "";

      userPrompt = `Student's input: "${userPromptInput}"
Chat History:
${formattedHistory || "(No history)"}`;
      isJson = false;
    } else if (action === "sql_erd") {
      isJson = true;
      systemPrompt = `You are a Database Designer. Your job is to return ONLY a valid, parseable JSON object representing the Entity-Relationship Diagram (ERD) schema for the problem "${cardTitle}".
The JSON schema MUST exactly match:
{
  "nodes": [
    { 
      "id": "string", 
      "type": "class", 
      "label": "string (Table Name)", 
      "x": number, 
      "y": number, 
      "width": number, 
      "height": number,
      "attributes": "string (Column declarations, e.g. pk_id: int\\nname: varchar)",
      "isAbstract": false,
      "stereotype": "table"
    }
  ],
  "edges": [
    { "id": "string", "from": "string", "to": "string", "label": "string (e.g. 1:N, M:N)", "curvature": number }
  ]
}
PLACEMENT RULES:
- Use clean coordinates: x from 50 to 800, y from 50 to 500. Space them out nicely.
- Tables should contain column lists with types in the attributes field.
- Edges represent relationships between tables.`;

      userPrompt = `Generate a database schema diagram for:
Problem: ${cardTitle}
Description: ${cardDescription || ""}`;

    } else {
      throw new Error("Invalid action type");
    }

    let aiContent = "";
    let usedProvider = "Gemini";

    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (geminiKey && geminiKey.trim()) {
      try {
        aiContent = await callGemini(geminiKey, systemPrompt, userPrompt, isJson);
      } catch (geminiError) {
        console.error("Gemini failed, trying fallback to Groq:", geminiError);
        if (groqKey && groqKey.trim()) {
          aiContent = await callGroq(groqKey, systemPrompt, userPrompt, isJson);
          usedProvider = "Groq (Fallback)";
        } else {
          throw new Error("Gemini failed and GROQ_API_KEY is not configured for fallback.");
        }
      }
    } else if (groqKey && groqKey.trim()) {
      aiContent = await callGroq(groqKey, systemPrompt, userPrompt, isJson);
      usedProvider = "Groq";
    } else {
      throw new Error("Neither GEMINI_API_KEY nor GROQ_API_KEY is configured on the server.");
    }

    if (!isJson) {
      return jsonOk({ text: aiContent });
    }

    // JSON response parsing
    let cleanJson = aiContent.trim();
    try {
      const extracted = extractJsonString(cleanJson);
      const parsed = JSON.parse(extracted);
      return jsonOk(parsed);
    } catch (err) {
      // Fallback: try parsing cleanJson directly
      try {
        const parsed = JSON.parse(cleanJson);
        return jsonOk(parsed);
      } catch (err2) {
        console.error("Failed to parse study tools JSON:", err2, aiContent);
        throw new Error("AI model generated invalid JSON response data. Please try again.");
      }
    }
  } catch (err) {
    return handleApiError(err);
  }
}
