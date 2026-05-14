import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

// Supabase auth callback — exchanges the one-time code for a session cookie.
// Called by Supabase after the user clicks the magic link in their email.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // One-time magic link codes must NOT be consumed inside LINE's WebView.
  // If we exchange the code here, the session lives only in LINE's browser and
  // the user can never use the app in an external browser with that code again.
  // Redirect to the relay page first; the code stays in the URL so the external
  // browser can exchange it after the user opens the link there.
  const ua = request.headers.get("user-agent") ?? "";
  if (/Line\/[\d.]+/i.test(ua) && code) {
    const relayUrl = new URL("/open-in-browser", origin);
    relayUrl.searchParams.set("next", request.url);
    return NextResponse.redirect(relayUrl.toString());
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/`);
}
