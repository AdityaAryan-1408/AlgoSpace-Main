import { NextRequest } from "next/server";
import { handleApiError, jsonOk, withUser } from "@/lib/api";

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  action: string
) {
  const isJson = action !== "generate_text";
  
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
            parts: [
              {
                text: userPrompt,
              },
            ],
          },
        ],
        systemInstruction: {
          parts: [
            {
              text: systemPrompt,
            },
          ],
        },
        generationConfig: {
          temperature: action === "generate_text" ? 0.6 : 0.2,
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
  action: string
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
      temperature: action === "generate_text" ? 0.6 : 0.2,
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
    const { prompt, currentNotes, currentCanvas, action, chatHistory } = body;
    if (!prompt && action !== "optimize_diagram" && action !== "analyze_spof" && action !== "estimate_cost") {
      throw new Error("Missing prompt or action");
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "generate_text") {
      systemPrompt = `You are a Principal System Design Architect.
Generate clean, production-grade System Design specs/notes based on the user's prompt.
RULES:
1. Write in clean, structured Markdown format (use headings, bullet points, and key-value tables).
2. Integrate a beautiful, valid Mermaid.js block (use \`\`\`mermaid ... \`\`\`) to show the architecture flowchart, sequence diagram, or state layout.
3. Keep the explanations concise, professional, and clear. Proactively list architectural tradeoffs (like CAP theorem choices, latency vs throughput, bottlenecks).
4. Do NOT wrap your entire output in a markdown block, only the code blocks.`;

      userPrompt = `Please design specs for: ${prompt}
${currentNotes ? `Here are the existing notes to build upon: \n${currentNotes}` : ""}`;
    } else if (action === "generate_diagram") {
      systemPrompt = `You are a System Design Diagram Generator. Your job is to return ONLY a valid, parseable JSON object representing the layout of nodes and connection edges. Do NOT explain the diagram. Do NOT output any markdown tags (like \`\`\`json) or other text.
      
The JSON schema MUST exactly match:
{
  "nodes": [
    { 
      "id": "string", 
      "type": "service" | "client" | "database" | "router" | "text" | "class" | "group", 
      "label": "string", 
      "x": number, 
      "y": number, 
      "width": number, 
      "height": number,
      "attributes": "string" (optional, only for type "class", multiline attributes/methods separated by \n),
      "isAbstract": boolean (optional, only for type "class"),
      "stereotype": "string" (optional, only for type "class", e.g. "abstract", "model class", "singleton class")
    }
  ],
  "edges": [
    { "id": "string", "from": "string", "to": "string", "label": "string", "curvature": number (optional, bend offset of control point, e.g. from -80 to 80 to avoid overlaps) }
  ]
}

PLACEMENT RULES:
- Use clean coordinates: x from 50 to 800, y from 50 to 500.
- Space out nodes to avoid overlaps. Arrange them logically from left to right or top to bottom.
- Suggested widths/heights:
  - client: width 110, height 50
  - router: width 110, height 50
  - service: width 140, height 60
  - database: width 120, height 80
  - text: width 150, height 40
  - class: width 150, height 110
  - group: width 300, height 200 (serves as a subsystem/boundary, dotted rectangular border)
- All nodes must have clean, concise uppercase or PascalCase labels.
- Edges must link valid node ids. Use unique ids for edges like "e1", "e2".`;

      userPrompt = `Generate a system design diagram structure for: ${prompt}`;
    } else if (action === "optimize_diagram") {
      systemPrompt = `You are a System Design Optimizer. You will inspect the current diagram and return an optimized JSON layout containing nodes and edges.
The JSON schema MUST exactly match:
{
  "nodes": [
    { 
      "id": "string", 
      "type": "service" | "client" | "database" | "router" | "text" | "class" | "group", 
      "label": "string", 
      "x": number, 
      "y": number, 
      "width": number, 
      "height": number,
      "attributes": "string" (optional),
      "isAbstract": boolean (optional),
      "stereotype": "string" (optional)
    }
  ],
  "edges": [
    { "id": "string", "from": "string", "to": "string", "label": "string", "curvature": number }
  ]
}
Improve the layout, add missing standard components (like caches, replica databases, queue/message brokers, rate limiters, or domain/entities classes), and space them out nicely so they look beautiful and professional. Return ONLY the JSON. No explanations.`;

      userPrompt = `Optimize and expand this current diagram layout:
${JSON.stringify(currentCanvas || { nodes: [], edges: [] }, null, 2)}`;
    } else if (action === "chat") {
      systemPrompt = `You are an AI System Design Co-pilot. The user is collaborating with you on their architecture notes and diagram.
Respond with a JSON object containing:
{
  "message": "your reply in clean markdown explaining your suggestions or changes",
  "notes": "optional updated markdown system design notes if they asked you to edit/write notes",
  "diagram": optional updated diagram layout JSON object { nodes: [...], edges: [...] } if they asked you to make visual changes
}
Do NOT return markdown code fences wrapping the entire JSON. Return ONLY the raw JSON object. Make sure to retain existing node structures and IDs unless they asked to modify them.
If nodes are inside boundary groups, make sure they remain grouped or layout coordinates place them inside the group bounds.`;

      const formattedHistory = Array.isArray(chatHistory)
        ? chatHistory.map((m: any) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text || m.message}`).join("\n")
        : "";

      userPrompt = `User request: "${prompt}"

Current Notes:
${currentNotes || "(Empty)"}

Current Diagram Canvas:
${JSON.stringify(currentCanvas || { nodes: [], edges: [] }, null, 2)}

Chat History:
${formattedHistory || "(No history)"}`;
    } else if (action === "analyze_spof") {
      systemPrompt = `You are a System Design Reliability Engineer.
Analyze the user's system diagram and specs. Identify Single Points of Failure (SPOFs), scalability gaps, high-availability suggestions, and fault-tolerance tradeoffs.
Return a detailed reliability review report in clean Markdown format with headers and lists.`;

      userPrompt = `Analyze the reliability of this architecture:
Notes:
${currentNotes || "(Empty)"}

Diagram Canvas:
${JSON.stringify(currentCanvas || { nodes: [], edges: [] }, null, 2)}`;
    } else if (action === "estimate_cost") {
      systemPrompt = `You are a Cloud Infrastructure Architect.
Analyze the user's system components and specs. Estimate monthly hosting costs (e.g. AWS EC2 instances, managed RDS, load balancers, caching nodes) and request latency profiles.
Return a clean, detailed estimation report in Markdown format with cost breakdown tables.`;

      userPrompt = `Estimate cost and latency for this architecture:
Notes:
${currentNotes || "(Empty)"}

Diagram Canvas:
${JSON.stringify(currentCanvas || { nodes: [], edges: [] }, null, 2)}`;
    } else {
      throw new Error("Invalid action type");
    }

    let aiContent = "";
    let usedProvider = "Gemini";

    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (geminiKey && geminiKey.trim()) {
      try {
        console.log("Attempting system design generation using Gemini...");
        aiContent = await callGemini(geminiKey, systemPrompt, userPrompt, action);
        usedProvider = "Gemini";
      } catch (geminiError) {
        console.error("Gemini failed, trying fallback to Groq:", geminiError);
        if (groqKey && groqKey.trim()) {
          aiContent = await callGroq(groqKey, systemPrompt, userPrompt, action);
          usedProvider = "Groq (Fallback)";
        } else {
          throw new Error("Gemini failed and GROQ_API_KEY is not configured for fallback.");
        }
      }
    } else if (groqKey && groqKey.trim()) {
      console.log("GEMINI_API_KEY not configured, using Groq directly...");
      aiContent = await callGroq(groqKey, systemPrompt, userPrompt, action);
      usedProvider = "Groq";
    } else {
      throw new Error("Neither GEMINI_API_KEY nor GROQ_API_KEY is configured on the server.");
    }

    console.log(`System design generated successfully using ${usedProvider}.`);

    if (action === "generate_text" || action === "analyze_spof" || action === "estimate_cost") {
      return jsonOk({ text: aiContent });
    }

    // JSON response parsing for diagrams or chat
    let cleanJson = aiContent.trim();
    try {
      const extracted = extractJsonString(cleanJson);
      const parsed = JSON.parse(extracted);
      if (action === "chat") {
        return jsonOk({
          message: parsed.message || "I've processed your request.",
          diagram: parsed.diagram || null,
          notes: parsed.notes || null
        });
      }
      const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
      const edges = Array.isArray(parsed?.edges) ? parsed.edges : [];
      return jsonOk({ 
        diagram: { nodes, edges } 
      });
    } catch (err) {
      // Fallback: try parsing cleanJson directly
      try {
        const parsed = JSON.parse(cleanJson);
        if (action === "chat") {
          return jsonOk({
            message: parsed.message || "I've processed your request.",
            diagram: parsed.diagram || null,
            notes: parsed.notes || null
          });
        }
        const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
        const edges = Array.isArray(parsed?.edges) ? parsed.edges : [];
        return jsonOk({ 
          diagram: { nodes, edges } 
        });
      } catch (err2) {
        console.error("Failed to parse diagram/chat JSON from LLM content:", err2, aiContent);
        if (action === "chat") {
          // Fallback for chat
          return jsonOk({
            message: aiContent,
            diagram: null,
            notes: null
          });
        }
        throw new Error("AI model generated invalid JSON layout data. Please try again.");
      }
    }

  } catch (err) {
    return handleApiError(err);
  }
}
