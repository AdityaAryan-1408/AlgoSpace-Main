import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/db";

const FALLBACK_USER_EMAIL = "me@example.com";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function resolveUserEmail(request: NextRequest) {
  const fromHeader = request.headers.get("x-user-email");
  const fromQuery = request.nextUrl.searchParams.get("userEmail");
  const envDefault = process.env.DEFAULT_USER_EMAIL;

  const raw = fromHeader || fromQuery || envDefault || FALLBACK_USER_EMAIL;
  return normalizeEmail(raw);
}

export async function ensureUserByEmail(email: string) {
  const supabase = getSupabaseAdmin();
  const normalized = normalizeEmail(email);

  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        email: normalized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    )
    .select("id, email")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
