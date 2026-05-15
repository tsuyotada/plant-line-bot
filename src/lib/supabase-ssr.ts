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
 *
 * Lookup order:
 *   1. households.line_user_id = user.user_metadata.line_user_id
 *      → For LINE-linked users (LINE Login or Google/Magic Link that linked LINE).
 *        This is set by the LINE-connect flow so a LINE Login user sees the same
 *        garden as their linked Google/Magic Link account.
 *   2. households.owner_id = user.id
 *      → Standard lookup for Google / Magic Link / standalone LINE users.
 */
export async function getAuthedHouseholdId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // 1. LINE-linked lookup (requires households.line_user_id column via migration)
  const lineUserId = user.user_metadata?.line_user_id as string | undefined;
  if (lineUserId) {
    const { data: linked, error: linkedErr } = await supabaseServer
      .from("households")
      .select("id")
      .eq("line_user_id", lineUserId)
      .limit(1)
      .maybeSingle();
    // linkedErr may occur if the column does not exist yet (pre-migration) — skip silently.
    if (!linkedErr && linked) return linked.id;
  }

  // 2. Standard owner lookup — limit(1) で重複 household があっても最初の1件を返す
  const { data: owned } = await supabaseServer
    .from("households")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return owned?.id ?? null;
}
