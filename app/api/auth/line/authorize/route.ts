import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const { origin } = new URL(request.url);

  // Return a proper redirect (not 500) so LINE browser shows the login error page
  // rather than its generic "cannot open page" network error.
  if (!channelId) {
    return NextResponse.redirect(`${origin}/login?error=line_not_configured`);
  }

  const callbackUrl =
    process.env.LINE_LOGIN_CALLBACK_URL ?? `${origin}/api/auth/line/callback`;

  const state = randomBytes(16).toString("hex");
  const next = request.nextUrl.searchParams.get("next") ?? "/";

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };

  const authUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", channelId);
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", "profile openid");

  // Set cookies directly on the redirect response object.
  // cookieStore.set() from next/headers does NOT reliably attach to NextResponse.redirect()
  // in Next.js 16 — the middleware pattern (response.cookies.set) is the correct approach.
  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("line_oauth_state", state, cookieOpts);
  response.cookies.set("line_oauth_next", next, cookieOpts);
  return response;
}
