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

export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();

    const { prompt, currentNotes, currentCanvas, action } = body;
    if (!prompt || !action) {
      throw new Error("Missing prompt or action");
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "generate_text") {
      systemPrompt = `You are a Principal System Design Architect.
Generate clean, production-grade System Design specs/notes based on the user's prompt.
RULES:
1. Write in clear, structured Markdown format (use headings, bullet points, and key-value tables).
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
      "type": "service" | "client" | "database" | "router" | "text" | "class", 
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
- All nodes must have clean, concise uppercase or PascalCase labels (e.g. "API Gateway", "User DB", "Redis Cache", "React App", "ProductService").
- Edges must link valid node ids. Use unique ids for edges like "e1", "e2".
- Label edges with the protocol/data sent (e.g. "HTTP POST", "SQL Query", "gRPC", "TCP/IP").`;

      userPrompt = `Generate a system design diagram structure for: ${prompt}`;
    } else if (action === "optimize_diagram") {
      systemPrompt = `You are a System Design Optimizer. You will inspect the current diagram and return an optimized JSON layout containing nodes and edges.
The JSON schema MUST exactly match:
{
  "nodes": [
    { 
      "id": "string", 
      "type": "service" | "client" | "database" | "router" | "text" | "class", 
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
Improve the layout, add missing standard components (like caches, replica databases, queue/message brokers, rate limiters, or domain/entities classes), and space them out nicely so they look beautiful and professional. Return ONLY the JSON. No explanations.`;

      userPrompt = `Optimize and expand this current diagram layout:
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

    if (action === "generate_text") {
      return jsonOk({ text: aiContent });
    }

    // Canvas actions: Parse JSON out of response
    let cleanJson = aiContent.trim();
    
    // Remove Markdown formatting code fences if the model included them
    const codeFenceMatch = cleanJson.match(/```(?:json)?\n([\s\S]*?)```/) || cleanJson.match(/\{[\s\S]*\}/);
    if (codeFenceMatch) {
      cleanJson = codeFenceMatch[1] || codeFenceMatch[0];
    }

    try {
      const parsedDiagram = JSON.parse(cleanJson.trim());
      // basic schema sanitization
      const nodes = Array.isArray(parsedDiagram?.nodes) ? parsedDiagram.nodes : [];
      const edges = Array.isArray(parsedDiagram?.edges) ? parsedDiagram.edges : [];
      
      return jsonOk({ 
        diagram: { nodes, edges } 
      });
    } catch (err) {
      console.error("Failed to parse diagram JSON from LLM content:", err, cleanJson);
      throw new Error("AI model generated invalid diagram layout data. Please try again.");
    }

  } catch (err) {
    return handleApiError(err);
  }
}
