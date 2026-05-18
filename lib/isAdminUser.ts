import "server-only";
import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "@/src/lib/supabase-server";

/**
 * Returns true if the given Supabase user should have admin access.
 *
 * Two paths:
 *  1. Google / magic-link users: direct email match against ADMIN_EMAILS.
 *  2. LINE Login users (email ends with @line.local): these have a synthetic
 *     email that never matches. Instead we look up the household linked to
 *     their LINE user ID and check the *owner*'s real email. This handles the
 *     case where a user did 「LINE連携」from their Google account first, setting
 *     households.line_user_id, and later signs in via LINE Login.
 */
export async function checkIsAdmin(user: User): Promise<boolean> {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (adminEmails.length === 0) return false;

  // Path 1: direct email match
  if (adminEmails.includes(user.email ?? "")) return true;

  // Path 2: LINE Login user — resolve via linked household owner
  if (user.email?.endsWith("@line.local")) {
    const lineId = user.user_metadata?.line_user_id as string | undefined;
    if (lineId) {
      const { data: hh } = await supabaseServer
        .from("households")
        .select("owner_id")
        .eq("line_user_id", lineId)
        .maybeSingle();
      if (hh?.owner_id) {
        const { data: ownerData } = await supabaseServer.auth.admin.getUserById(hh.owner_id);
        if (adminEmails.includes(ownerData.user?.email ?? "")) return true;
      }
    }
  }

  return false;
}
