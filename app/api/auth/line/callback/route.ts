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

  const storedState = request.cookies.get("line_oauth_state")?.value;
  const nextPath = request.cookies.get("line_oauth_next")?.value ?? "/";

  const loginUrl = `${origin}/login`;

  function fail(reason: string): NextResponse {
    const r = NextResponse.redirect(`${loginUrl}?error=${reason}`);
    r.cookies.delete("line_oauth_state");
    r.cookies.delete("line_oauth_next");
    return r;
  }

  // ── Config ────────────────────────────────────────────────────────────────
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  const sessionSecret = process.env.LINE_SESSION_SECRET;

  if (!channelId || !channelSecret) return fail("line_not_configured");
  if (!sessionSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[LINE Login] LINE_SESSION_SECRET must be set in production.");
      return fail("line_not_configured");
    }
    console.warn("[LINE Login] LINE_SESSION_SECRET not set. Insecure dev fallback.");
  }
  const secret = sessionSecret ?? "dev-only-fallback-not-for-production";

  // ── CSRF ─────────────────────────────────────────────────────────────────
  if (errorParam || !code || !state) return fail("line_cancelled");
  if (!storedState || state !== storedState) return fail("line_state_mismatch");

  const callbackUrl =
    process.env.LINE_LOGIN_CALLBACK_URL ?? `${origin}/api/auth/line/callback`;

  // ── 1. Exchange code ──────────────────────────────────────────────────────
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

  // ── 2. LINE profile ───────────────────────────────────────────────────────
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

  // ── Supabase clients ──────────────────────────────────────────────────────
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Read-only session check: detect whether a Google/Magic Link user
  // is already logged in (= "LINE connect" mode, not "LINE login" mode).
  const checkClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
  );
  const { data: { user: sessionUser } } = await checkClient.auth.getUser();

  // "Link mode" = an existing non-LINE account is logged in.
  // The user clicked "LINE連携" from within the app.
  const isLinkMode =
    sessionUser != null && !sessionUser.email?.endsWith("@line.local");

  // ── Branch: LINK MODE ──────────────────────────────────────────────────────
  // Associate the LINE account with the currently logged-in Google/Magic Link user.
  // No new Supabase user or household is created.
  if (isLinkMode) {
    // Conflict check: is this LINE ID already linked to a DIFFERENT account?
    const { data: conflictHousehold } = await adminSupabase
      .from("households")
      .select("id, owner_id")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (conflictHousehold && conflictHousehold.owner_id !== sessionUser.id) {
      return fail("line_already_linked");
    }

    // Store line_user_id in the user's auth metadata
    await adminSupabase.auth.admin.updateUserById(sessionUser.id, {
      user_metadata: {
        ...sessionUser.user_metadata,
        line_user_id: lineUserId,
        line_display_name: displayName,
        line_picture_url: pictureUrl ?? null,
      },
    });

    // Set households.line_user_id so getAuthedHouseholdId() can find it later
    const { data: userHousehold } = await adminSupabase
      .from("households")
      .select("id")
      .eq("owner_id", sessionUser.id)
      .maybeSingle();

    if (userHousehold) {
      await adminSupabase
        .from("households")
        .update({ line_user_id: lineUserId })
        .eq("id", userHousehold.id);

      // Point existing LINE Bot subscription to this household
      await adminSupabase
        .from("line_notification_users")
        .update({ household_id: userHousehold.id })
        .eq("line_user_id", lineUserId);
    }

    // User is already logged in — just redirect back. No session change needed.
    const linkResponse = NextResponse.redirect(`${origin}${nextPath}`);
    linkResponse.cookies.delete("line_oauth_state");
    linkResponse.cookies.delete("line_oauth_next");
    return linkResponse;
  }

  // ── Branch: LOGIN MODE ─────────────────────────────────────────────────────
  // No active session. Sign in (or create) the line_xxx@line.local account.

  const syntheticEmail = `line_${lineUserId}@line.local`;
  const password = derivePassword(lineUserId, secret);

  const cookieStore = await cookies();
  const pendingSessionCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
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

  // ── 3. Sign in or create ──────────────────────────────────────────────────
  const { error: firstSignInError } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password,
  });

  if (firstSignInError) {
    await adminSupabase.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: userMeta,
    });
    const { error: secondSignInError } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password,
    });
    if (secondSignInError) return fail("line_signin_failed");
  }

  // ── 4. Get the signed-in user ─────────────────────────────────────────────
  const { data: { user: authedUser } } = await supabase.auth.getUser();
  if (!authedUser) return fail("line_signin_failed");

  // ── 5. Refresh LINE profile metadata ─────────────────────────────────────
  await adminSupabase.auth.admin.updateUserById(authedUser.id, {
    user_metadata: { ...authedUser.user_metadata, ...userMeta },
  });

  // ── 6. Resolve household (prioritise linked, then own, then create) ────────
  //
  // Priority 1: A Google/Magic Link user previously ran "LINE連携" and set
  //             households.line_user_id = lineUserId. Use that household so the
  //             LINE Login user sees the same garden as their Google account.
  // Priority 2: The line_xxx@line.local user already owns a household.
  // Priority 3: First login with no prior linking — create a new household.
  //             (Encourage the user to link to an existing account if they have one.)
  const { data: linkedHousehold } = await adminSupabase
    .from("households")
    .select("id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  let householdId = linkedHousehold?.id as string | undefined;

  if (!householdId) {
    const { data: ownHousehold } = await adminSupabase
      .from("households")
      .select("id")
      .eq("owner_id", authedUser.id)
      .maybeSingle();
    householdId = ownHousehold?.id;
  }

  if (!householdId) {
    const { data: newHousehold } = await adminSupabase
      .from("households")
      .insert({ name: `${displayName}のガーデン`, owner_id: authedUser.id })
      .select("id")
      .single();
    householdId = newHousehold?.id;
  }

  // ── 7. Sync LINE Bot notification subscription ────────────────────────────
  if (householdId) {
    await adminSupabase
      .from("line_notification_users")
      .update({ household_id: householdId })
      .eq("line_user_id", lineUserId)
      .neq("household_id", householdId);
  }

  // ── 8. Build response with session cookies ────────────────────────────────
  const response = NextResponse.redirect(`${origin}${nextPath}`);
  response.cookies.delete("line_oauth_state");
  response.cookies.delete("line_oauth_next");
  pendingSessionCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  });
  return response;
}
