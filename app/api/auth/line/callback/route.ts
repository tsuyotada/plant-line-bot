import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";

// Deterministic password derived from LINE userId + server-side secret.
// This lets the server sign in as any LINE user without storing credentials,
// while remaining safe because the secret is never exposed to clients.
function derivePassword(lineUserId: string): string {
  const secret = process.env.LINE_SESSION_SECRET ?? "change-this-secret-in-production";
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

  cookieStore.delete("line_oauth_state");
  cookieStore.delete("line_oauth_next");

  const loginUrl = `${origin}/login`;

  function fail(reason: string) {
    return NextResponse.redirect(`${loginUrl}?error=${reason}`);
  }

  if (errorParam || !code || !state) return fail("line_cancelled");
  if (!storedState || state !== storedState) return fail("line_state_mismatch");

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  if (!channelId || !channelSecret) return fail("line_not_configured");

  const callbackUrl =
    process.env.LINE_LOGIN_CALLBACK_URL ?? `${origin}/api/auth/line/callback`;

  // 1. Exchange authorization code for LINE access token
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

  // 2. Fetch LINE profile (userId, displayName, pictureUrl)
  const profileRes = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${lineAccessToken}` },
  });
  if (!profileRes.ok) return fail("line_profile_failed");
  const { userId: lineUserId, displayName, pictureUrl } = (await profileRes.json()) as {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  };

  // Supabase users created from LINE Login use a synthetic email so they can
  // use signInWithPassword without needing a real email address.
  const syntheticEmail = `line_${lineUserId}@line.local`;
  const password = derivePassword(lineUserId);

  // Admin client — creates/updates users, bypasses RLS
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // SSR client — signInWithPassword writes session cookies via the setAll callback
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
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

  // 3. Sign in (or create account on first login)
  let { error: signInError } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password,
  });

  if (signInError) {
    // First login — create the Supabase user
    const { data: created, error: createError } =
      await adminSupabase.auth.admin.createUser({
        email: syntheticEmail,
        password,
        email_confirm: true,
        user_metadata: userMeta,
      });

    if (createError) {
      // Possible race condition: another request created the user concurrently.
      // Try signing in one more time before giving up.
      const { error: retryError } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password,
      });
      if (retryError) return fail("line_signin_failed");
    } else {
      // Sign the new user in
      const { error: newSignInError } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password,
      });
      if (newSignInError) return fail("line_signin_failed");

      // Create a household for the new user
      if (created.user) {
        await adminSupabase.from("households").insert({
          name: `${displayName}のガーデン`,
          owner_id: created.user.id,
        });
      }
    }
  } else {
    // Returning user — refresh LINE profile in metadata
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await adminSupabase.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, ...userMeta },
      });
    }
  }

  // 4. Auto-link existing LINE Bot notification subscription to this household.
  //    When the user already registered with the LINE Bot before their first web login,
  //    line_notification_users.household_id may point to the default household.
  //    We update it to the user's own household so BOT notifications reach the right place.
  const {
    data: { user: authedUser },
  } = await supabase.auth.getUser();

  if (authedUser) {
    const { data: household } = await adminSupabase
      .from("households")
      .select("id")
      .eq("owner_id", authedUser.id)
      .maybeSingle();

    if (household) {
      await adminSupabase
        .from("line_notification_users")
        .update({ household_id: household.id })
        .eq("line_user_id", lineUserId)
        .neq("household_id", household.id);
    }
  }

  return NextResponse.redirect(`${origin}${nextPath}`);
}
