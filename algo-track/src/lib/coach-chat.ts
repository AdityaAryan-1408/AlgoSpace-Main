import { getSupabaseAdmin } from "./db";
import type { ChatThread, ChatMessage, ChatMode, ChatRole } from "@/types";

export async function getChatThreads(userId: string): Promise<ChatThread[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  
  return data.map((d) => ({
    id: d.id,
    userId: d.user_id,
    cardId: d.card_id,
    mode: d.mode as ChatMode,
    title: d.title,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
}

export async function getChatMessages(threadId: string): Promise<ChatMessage[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return data.map((d) => ({
    id: d.id,
    threadId: d.thread_id,
    role: d.role as ChatRole,
    content: d.content,
    createdAt: d.created_at,
  }));
}

export async function createChatThread(
  userId: string,
  mode: ChatMode,
  title: string,
  cardId?: string
): Promise<ChatThread> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_threads")
    .insert([
      {
        user_id: userId,
        mode,
        title,
        card_id: cardId || null,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    userId: data.user_id,
    cardId: data.card_id,
    mode: data.mode as ChatMode,
    title: data.title,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function addChatMessage(
  threadId: string,
  role: ChatRole,
  content: string
): Promise<ChatMessage> {
  const supabase = getSupabaseAdmin();
  
  // Insert the message
  const { data, error } = await supabase
    .from("chat_messages")
    .insert([
      {
        thread_id: threadId,
        role,
        content,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Update thread's updated_at
  await supabase
    .from("chat_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  return {
    id: data.id,
    threadId: data.thread_id,
    role: data.role as ChatRole,
    content: data.content,
    createdAt: data.created_at,
  };
}

export async function deleteChatThread(threadId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("chat_threads")
    .delete()
    .eq("id", threadId);

  if (error) throw new Error(error.message);
}
