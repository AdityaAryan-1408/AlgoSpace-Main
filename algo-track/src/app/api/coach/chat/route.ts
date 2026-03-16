import { NextRequest, NextResponse } from "next/server";
import { handleApiError, jsonOk, withUser } from "@/lib/api";
import {
  getChatThreads,
  getChatMessages,
  createChatThread,
  addChatMessage,
  deleteChatThread,
} from "@/lib/coach-chat";
import type { ChatMode } from "@/types";

// ── Helpers ─────────────────────────────────────────────────────

function getSystemPrompt(mode: ChatMode): string {
  const base = `You are an expert Socratic Senior Engineer and Coach. Your goal is to mentor the user, not just give them the answers.
RULES:
1. NEVER write production-ready solutions or full code dumps unless explicitly asked to switch modes by the user out of sheer frustration.
2. Ask leading questions first.
3. Challenge their assumptions and weak reasoning.
4. Keep your responses concise and focused. Do not lecture excessively.
`;

  switch (mode) {
    case "debug_logic":
      return (
        base +
        `MODE: Logic Debugging
- Help the user debug their logic, not just syntax.
- Point out potential edge cases, missing invariants, or logic gaps.
- Instead of fixing the code, explain where the contradiction or flaw is and ask how they might resolve it.`
      );
    case "system_design_review":
      return (
        base +
        `MODE: System Design Review
- Challenge their architecture choices.
- Probe for tradeoffs (e.g., consistency vs availability, latency vs throughput).
- Ask about failure modes: "What happens if this component goes down?"
- Ask how the system scales up by 10x or 100x.`
      );
    case "theory_cross_question":
      return (
        base +
        `MODE: Theory Cross-Questioning
- Cross-question the user on CS / Theory concepts.
- Ask follow-up questions to test the depth of their understanding.
- If they give a superficial answer, ask them to explain 'why' or 'how' it works under the hood.`
      );
    case "interviewer_mode":
      return (
        base +
        `MODE: Strict Interviewer
- Act like a strict FAANG technical interviewer.
- Ask about data structures, time complexity, space complexity, and counterexamples.
- Be polite but very demanding regarding optimization and correctness.`
      );
  }
}

// ── GET ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await withUser(request);
    const url = new URL(request.url);
    const threadId = url.searchParams.get("threadId");

    if (threadId) {
      // Get single thread messages
      const messages = await getChatMessages(threadId);
      return jsonOk({ messages });
    } else {
      // Get all user threads
      const threads = await getChatThreads(user.id);
      return jsonOk({ threads });
    }
  } catch (err) {
    return handleApiError(err);
  }
}

// ── POST ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await withUser(request);
    const body = await request.json();

    // 1. CREATE NEW THREAD
    if (body.action === "create_thread") {
      const { title, mode, cardId } = body;
      if (!title || !mode) throw new Error("Missing title or mode");

      const thread = await createChatThread(user.id, mode as ChatMode, title, cardId);

      // Add initial greeting from assistant
      let greeting = "Hello. How can I help you today?";
      if (mode === "interviewer_mode") greeting = "Welcome. Let me know when you're ready to begin the interview.";
      if (mode === "theory_cross_question") greeting = "What CS or theory topic would you like to discuss?";
      if (mode === "debug_logic") greeting = "What logic are we debugging? Feel free to paste your approach or thought process.";

      const initialMessage = await addChatMessage(thread.id, "assistant", greeting);

      return jsonOk({ thread, messages: [initialMessage] });
    }

    // 2. SEND MESSAGE
    if (body.action === "send_message") {
      const { threadId, content, mode } = body;
      if (!threadId || !content || !mode) throw new Error("Missing threadId, content, or mode");

      // Save user message
      const userMsg = await addChatMessage(threadId, "user", content);

      // Fetch history for context
      const history = await getChatMessages(threadId);

      // Strict conversation memory trimming:
      // Keep system prompt + last 10 messages max to prevent token bloat
      const systemPrompt = getSystemPrompt(mode as ChatMode);
      
      const MAX_HISTORY = 10;
      const recentHistory = history.slice(-MAX_HISTORY).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const messages = [
        { role: "system", content: systemPrompt },
        ...recentHistory,
      ];

      // Call Groq AI
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

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
          max_tokens: 1024,
        }),
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        console.error("Coach Chat Groq Error:", errText);
        throw new Error("AI provider error");
      }

      const groqData = await groqRes.json();
      const aiContent = groqData.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

      // Save AI message
      const aiMsg = await addChatMessage(threadId, "assistant", aiContent);

      return jsonOk({ 
        userMessage: userMsg, 
        assistantMessage: aiMsg 
      });
    }

    throw new Error("Invalid action");
  } catch (err) {
    return handleApiError(err);
  }
}

// ── DELETE ──────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const _user = await withUser(request); // just valid auth check
    const url = new URL(request.url);
    const threadId = url.searchParams.get("threadId");

    if (!threadId) throw new Error("Missing threadId");

    await deleteChatThread(threadId);
    return jsonOk({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
