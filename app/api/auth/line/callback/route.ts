import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";

/**
 * Derives a stable password for a LINE user's synthetic Supabase account.
 *
 * Security model:
 *   password = SHA-256("line:<lineUserId>:<LINE_SESSION_SECRET>")
 *
 * - The secret never leaves the server, so the password cannot be derived
 *   by a client even if they know their own LINE userId.
 * - Changing LINE_SESSION_SECRET invalidates all existing LINE Login sessions
 *   (users must log in again via LINE OAuth to re-derive the new password).
 * - In production, LINE_SESSION_SECRET MUST be set. The caller validates this
 *   before calling this function.
 */
function derivePassword(lineUserId: string, secret: string): string {
  return createHash("sha256")
    .update(`line:${lineUserId}:${secret}`)
    .digest("hex");
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("line_oauth_state")?.value;
  const nextPath = cookieStore.get("line_oauth_next")?.value ?? "/";

  // Always clear state cookies regardless of outcome
  cookieStore.delete("line_oauth_state");
  cookieStore.delete("line_oauth_next");

  const loginUrl = `${origin}/login`;

  function fail(reason: string) {
    return NextResponse.redirect(`${loginUrl}?error=${reason}`);
  }

  // ── Config validation (fail fast before touching LINE API) ──────────────────
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  const sessionSecret = process.env.LINE_SESSION_SECRET;

  if (!channelId || !channelSecret) return fail("line_not_configured");

  // In production, LINE_SESSION_SECRET is required.
  // Without it every LINE user's password is predictable to anyone who can
  // read this source code — a critical security hole.
  if (!sessionSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[LINE Login] LINE_SESSION_SECRET must be set in production. Aborting login."
      );
      return fail("line_not_configured");
    }
    console.warn(
      "[LINE Login] LINE_SESSION_SECRET is not set. " +
        "This is insecure. Set it before going to production."
    );
  }
  const secret = sessionSecret ?? "dev-only-fallback-not-for-production";

  // ── CSRF state check ────────────────────────────────────────────────────────
  if (errorParam || !code || !state) return fail("line_cancelled");
  if (!storedState || state !== storedState) return fail("line_state_mismatch");

  const callbackUrl =
    process.env.LINE_LOGIN_CALLBACK_URL ?? `${origin}/api/auth/line/callback`;

  // ── 1. Exchange authorization code for LINE access token ───────────────────
  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      client_id: channelId,
      client_secret: channelSecret,
    }),
  });
  if (!tokenRes.ok) return fail("line_token_failed");
  const { access_token: lineAccessToken } = (await tokenRes.json()) as {
    access_token: string;
  };

  // ── 2. Fetch LINE profile ───────────────────────────────────────────────────
  const profileRes = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${lineAccessToken}` },
  });
  if (!profileRes.ok) return fail("line_profile_failed");
  const { userId: lineUserId, displayName, pictureUrl } =
    (await profileRes.json()) as {
      userId: string;
      displayName: string;
      pictureUrl?: string;
    };

  // Synthetic email for Supabase account. The @line.local domain is intentionally
  // non-routable — no emails are ever sent to this address.
  const syntheticEmail = `line_${lineUserId}@line.local`;
  const password = derivePassword(lineUserId, secret);

  // ── Supabase clients ────────────────────────────────────────────────────────
  //
  // adminSupabase (service role):
  //   Used ONLY for operations that require bypassing RLS:
  //     - auth.admin.createUser / updateUserById  (no user session exists yet)
  //     - households INSERT on behalf of a just-created user
  //     - line_notification_users UPDATE (cross-row ownership during linking)
  //   Never passes this client to the browser or leaks tokens to response body.
  //
  // supabase (anon key + SSR cookie):
  //   Used for session operations: signInWithPassword writes the session JWT
  //   into httpOnly cookies via the setAll callback below. All subsequent
  //   requests from the browser use these cookies, which Supabase validates
  //   server-side — RLS applies normally after this point.
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // setAll is called by signInWithPassword to persist the session JWT.
        // Writing to cookieStore here causes Next.js to include Set-Cookie
        // headers in the final NextResponse.redirect(), so the browser
        // receives the session cookie in the same response that sends them
        // to the app.
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const userMeta = {
    line_user_id: lineUserId,
    name: displayName,
    display_name: displayName,
    avatar_url: pictureUrl ?? null,
    picture_url: pictureUrl ?? null,
  };

  // ── 3. Sign in (returning user) or create + sign in (first login) ───────────
  //
  // Strategy: try signInWithPassword first.
  //   - Success → returning user, session set.
  //   - Failure → assume user doesn't exist, call createUser, then sign in.
  //
  // The race-condition path (two concurrent callbacks for the same LINE user):
  //   createUser will return an "already registered" error.
  //   We still try signInWithPassword with the same derived password,
  //   which succeeds because the password is deterministic.
  let isReturningUser = false;

  const { error: firstSignInError } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password,
  });

  if (!firstSignInError) {
    // Returning user — session is now active in supabase SSR client.
    isReturningUser = true;
  } else {
    // First login (or transient error) — attempt to create the account.
    await adminSupabase.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true, // skip email confirmation, we verified via LINE OAuth
      user_metadata: userMeta,
    });
    // Whether createUser succeeded or failed (race condition), the derived
    // password matches. A second signInWithPassword will work in both cases.
    const { error: secondSignInError } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password,
    });
    if (secondSignInError) return fail("line_signin_failed");
  }

  // ── 4. Get authenticated user — single call, after confirmed sign-in ────────
  const {
    data: { user: authedUser },
  } = await supabase.auth.getUser();
  if (!authedUser) return fail("line_signin_failed");

  // ── 5. Keep LINE profile metadata fresh on every login ─────────────────────
  //
  // For new users, createUser already set userMeta; this updateUserById would
  // be redundant. But for returning users, their displayName or pictureUrl
  // may have changed since their last login. We always refresh.
  await adminSupabase.auth.admin.updateUserById(authedUser.id, {
    user_metadata: { ...authedUser.user_metadata, ...userMeta },
  });

  // ── 6. Ensure household exists (idempotent) ─────────────────────────────────
  //
  // We use adminSupabase because RLS on households may require owner_id =
  // auth.uid(), which is only available to the anon client after its session
  // propagates. The admin client lets us reliably read/write here regardless.
  //
  // This runs on EVERY login (not just first) so that race-condition paths
  // (where createUser succeeded but an earlier request beat us to it) also
  // get a household. The SELECT before INSERT makes the operation idempotent.
  const { data: existingHousehold } = await adminSupabase
    .from("households")
    .select("id")
    .eq("owner_id", authedUser.id)
    .maybeSingle();

  let householdId = existingHousehold?.id as string | undefined;

  if (!householdId) {
    const { data: newHousehold } = await adminSupabase
      .from("households")
      .insert({ name: `${displayName}のガーデン`, owner_id: authedUser.id })
      .select("id")
      .single();
    householdId = newHousehold?.id;
  }

  // ── 7. Auto-link LINE Bot notification subscription ─────────────────────────
  //
  // If the user already registered with the LINE Bot (line_notification_users
  // exists for their lineUserId), update household_id to point to their own
  // household so daily notifications reach the right place.
  // The .neq() guard makes this a no-op when already linked correctly.
  if (householdId) {
    await adminSupabase
      .from("line_notification_users")
      .update({ household_id: householdId })
      .eq("line_user_id", lineUserId)
      .neq("household_id", householdId);
  }

  // isReturningUser is captured for future use (e.g., onboarding redirect).
  void isReturningUser;

  return NextResponse.redirect(`${origin}${nextPath}`);
}
