import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) {
    return new NextResponse("LINE_LOGIN_CHANNEL_ID is not configured", { status: 500 });
  }

  const { origin } = new URL(request.url);
  const callbackUrl =
    process.env.LINE_LOGIN_CALLBACK_URL ?? `${origin}/api/auth/line/callback`;

  const state = randomBytes(16).toString("hex");
  const next = request.nextUrl.searchParams.get("next") ?? "/";

  const cookieStore = await cookies();
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };
  cookieStore.set("line_oauth_state", state, opts);
  cookieStore.set("line_oauth_next", next, opts);

  const authUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", channelId);
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", "profile openid");

  return NextResponse.redirect(authUrl.toString());
}
