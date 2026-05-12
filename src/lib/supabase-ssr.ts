import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseServer } from "./supabase-server";

/**
 * Session-aware Supabase client for Server Components, Server Actions, and Route Handlers.
 * Uses cookie-based session (anon key). Do NOT use in middleware — middleware has its own client.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context can't set cookies — middleware handles token refresh.
          }
        },
      },
    }
  );
}

/**
 * Returns the household_id for the currently logged-in user, or null if not found.
 * Phase 0→1: looks up households.owner_id = auth.uid().
 * Phase 2 以降: household_members テーブルに移行予定。
 */
export async function getAuthedHouseholdId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: household } = await supabaseServer
    .from("households")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  return household?.id ?? null;
}
