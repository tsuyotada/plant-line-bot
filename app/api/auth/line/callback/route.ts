import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";

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

  // Read state cookies set by the authorize route.
  // We use request.cookies here (not next/headers cookies()) because
  // we need to read what the browser actually sent, and we'll build
  // the response separately to avoid the cookieStore ↔ redirect mismatch.
  const storedState = request.cookies.get("line_oauth_state")?.value;
  const nextPath = request.cookies.get("line_oauth_next")?.value ?? "/";

  const loginUrl = `${origin}/login`;

  function fail(reason: string): NextResponse {
    const r = NextResponse.redirect(`${loginUrl}?error=${reason}`);
    // Clear state cookies on any failure path
    r.cookies.delete("line_oauth_state");
    r.cookies.delete("line_oauth_next");
    return r;
  }

  // ── Config validation ──────────────────────────────────────────────────────
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  const sessionSecret = process.env.LINE_SESSION_SECRET;

  if (!channelId || !channelSecret) return fail("line_not_configured");

  if (!sessionSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[LINE Login] LINE_SESSION_SECRET must be set in production.");
      return fail("line_not_configured");
    }
    console.warn("[LINE Login] LINE_SESSION_SECRET is not set. Insecure dev fallback active.");
  }
  const secret = sessionSecret ?? "dev-only-fallback-not-for-production";

  // ── CSRF state check ───────────────────────────────────────────────────────
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

  // ── 2. Fetch LINE profile ──────────────────────────────────────────────────
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

  const syntheticEmail = `line_${lineUserId}@line.local`;
  const password = derivePassword(lineUserId, secret);

  // ── Supabase clients ───────────────────────────────────────────────────────
  //
  // adminSupabase (service role): user creation, metadata updates, DB writes
  //   that bypass RLS. Never exposed to the client.
  //
  // supabase (anon key + SSR): session management only.
  //   signInWithPassword triggers setAll, which we intercept to capture the
  //   session cookies. We then attach those cookies directly to the final
  //   redirect response — this is the same pattern the middleware uses and
  //   guarantees the session cookie reaches the browser on the redirect.
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Collect session cookies produced by signInWithPassword so we can
  // attach them to the redirect response (response.cookies.set).
  // Using only cookieStore.set() here is unreliable with NextResponse.redirect().
  const cookieStore = await cookies();
  type PendingCookie = { name: string; value: string; options: Record<string, unknown> };
  const pendingSessionCookies: PendingCookie[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Also write to cookieStore so getUser() below can read the session
            // within the same request handler.
            try { cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]); } catch { /* ignore */ }
            pendingSessionCookies.push({ name, value, options: options as Record<string, unknown> });
          });
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

  // ── 3. Sign in (returning) or create + sign in (first login) ───────────────
  let isReturningUser = false;

  const { error: firstSignInError } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password,
  });

  if (!firstSignInError) {
    isReturningUser = true;
  } else {
    // First login — create the account.
    await adminSupabase.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: userMeta,
    });
    // Works whether createUser just succeeded or the user was concurrently created.
    const { error: secondSignInError } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password,
    });
    if (secondSignInError) return fail("line_signin_failed");
  }

  // ── 4. Verify session is active ────────────────────────────────────────────
  const {
    data: { user: authedUser },
  } = await supabase.auth.getUser();
  if (!authedUser) return fail("line_signin_failed");

  // ── 5. Refresh LINE profile metadata ──────────────────────────────────────
  await adminSupabase.auth.admin.updateUserById(authedUser.id, {
    user_metadata: { ...authedUser.user_metadata, ...userMeta },
  });

  // ── 6. Ensure household exists (idempotent) ────────────────────────────────
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

  // ── 7. Auto-link LINE Bot notification subscription ────────────────────────
  if (householdId) {
    await adminSupabase
      .from("line_notification_users")
      .update({ household_id: householdId })
      .eq("line_user_id", lineUserId)
      .neq("household_id", householdId);
  }

  // ── 8. Build redirect response and attach session + cleanup cookies ─────────
  //
  // Attach session cookies directly to the response object.
  // This mirrors the middleware pattern (supabaseResponse.cookies.set) and
  // guarantees the browser receives the session JWT in the same HTTP response
  // that redirects them to the app — no extra round-trip needed.
  const response = NextResponse.redirect(`${origin}${nextPath}`);

  // Clear the OAuth state cookies
  response.cookies.delete("line_oauth_state");
  response.cookies.delete("line_oauth_next");

  // Attach session cookies collected during signInWithPassword
  pendingSessionCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  });

  void isReturningUser; // reserved for future onboarding redirect
  return response;
}
