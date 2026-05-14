import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/src/lib/supabase-ssr";
import { BackgroundLayer } from "@/app/BackgroundLayer";
import { GoogleSignInButton } from "./GoogleSignInButton";

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").trim();
  if (!email) return;

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });
  redirect("/login?sent=1");
}

const ff = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const FEATURES = [
  { icon: "🌿", title: "植物をまとめて見る",  desc: "写真つきで、わが家の植物を一覧できます。" },
  { icon: "📷", title: "写真とメモを残す",    desc: "成長や変化をあとから見返せます。" },
  { icon: "🔗", title: "家族と共有する",      desc: "共有リンクで、ログインなしでも植物ページを見られます。" },
  { icon: "💬", title: "LINEで受け取る",     desc: "朝の植物メモを家庭ごとに届けます。" },
];

const SAMPLE_URL =
  "https://plant-line-bot-forme.vercel.app/share/8f24ee1b-d5d1-47a3-be24-4a4ae1809ef0";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  // Block LINE's in-app browser before rendering any login form.
  // Both Google OAuth and Magic Link fail inside LINE WebView, so redirect
  // users to a relay page that instructs them to open in an external browser.
  const ua = (await headers()).get("user-agent") ?? "";
  if (/Line\/[\d.]+/i.test(ua)) {
    redirect("/open-in-browser?next=/login");
  }

  const params = await searchParams;

  return (
    <>
      <style>{`
        .login-grid {
          display: grid;
          grid-template-columns: 5fr 8fr;
          gap: 24px;
          align-items: stretch;
          max-width: 960px;
          margin: 0 auto;
        }
        @media (max-width: 768px) {
          .login-grid { grid-template-columns: 1fr; align-items: start; }
          .login-intro-col { order: 2; }
          .login-form-col  { order: 1; }
        }
        .login-card-intro {
          background: rgba(253, 250, 244, 0.92);
          border-radius: 16px;
          padding: 24px 22px 20px;
          box-shadow: 0 2px 12px rgba(60, 50, 30, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.88);
          box-sizing: border-box;
          height: 100%;
        }
        .login-card-form {
          background: #ffffff;
          border-radius: 16px;
          padding: 36px 32px 28px;
          box-shadow: 0 6px 40px rgba(30, 60, 40, 0.22);
          border: 1px solid rgba(163, 196, 160, 0.50);
          box-sizing: border-box;
          height: 100%;
        }
        .feature-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          margin-bottom: 10px;
        }
        .feature-item:last-child { margin-bottom: 0; }
        .sample-link-block {
          margin-top: 18px;
          background: #f0fdf4;
          border: 1px solid #c8e6cc;
          border-radius: 10px;
          padding: 12px 14px;
        }
        .login-input {
          width: 100%;
          padding: 13px 14px;
          border: 1.5px solid #d1e8d8;
          border-radius: 10px;
          font-size: 15px;
          outline: none;
          box-sizing: border-box;
          margin-bottom: 12px;
          font-family: inherit;
          background: #fff;
          color: #1f2937;
        }
        .login-input:focus {
          border-color: #6db07b;
          box-shadow: 0 0 0 2px rgba(109, 176, 123, 0.18);
        }
        .login-btn {
          width: 100%;
          padding: 14px;
          background: #4b7a5a;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s;
        }
        .login-btn:hover { background: #3d6649; }
      `}</style>

      <BackgroundLayer />

      <main style={{ minHeight: "100vh", padding: "0 20px 60px", fontFamily: ff }}>

        {/* ── Hero — outside any card, directly over bg photo ── */}
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            padding: "52px 0 36px",
          }}
        >
          <h1
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "#ffffff",
              margin: "0 0 8px",
              letterSpacing: -2,
              lineHeight: 1.0,
              textShadow: "0 2px 12px rgba(0,0,0,0.55), 0 0 32px rgba(0,0,0,0.25)",
            }}
          >
            Plant Care
          </h1>
          <p
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "rgba(255,255,255,0.88)",
              margin: 0,
              letterSpacing: 1.2,
              textShadow: "0 1px 6px rgba(0,0,0,0.50)",
              textTransform: "uppercase",
            }}
          >
            Keep every green healthy.
          </p>
        </div>

        {/* ── 2-column grid ── */}
        <div className="login-grid">

          {/* ── Left: service intro ── */}
          <div className="login-intro-col">
            <div className="login-card-intro">

              <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.85, margin: "0 0 16px" }}>
                わが家の植物を、写真とメモで見守る。
                <br />
                家族と共有して、LINEでも今日の植物メモを受け取れます。
              </p>

              <div>
                {FEATURES.map(({ icon, title, desc }) => (
                  <div key={title} className="feature-item">
                    <span style={{ fontSize: 14, lineHeight: 1.5, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#2d4a3e", marginBottom: 1, lineHeight: 1.4 }}>
                        {title}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
                        {desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="sample-link-block">
                <div style={{ fontSize: 11, color: "#4b7a5a", fontWeight: 600, marginBottom: 4 }}>
                  共有ページの見え方を試す
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6, marginBottom: 8 }}>
                  実際の家族向けページがどう見えるか確認できます。
                </div>
                <a
                  href={SAMPLE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#2d6a3f",
                    textDecoration: "none",
                    borderBottom: "1px solid #93c9a0",
                    paddingBottom: 1,
                    lineHeight: 1.4,
                  }}
                >
                  サンプルの植物ページを開く
                  <span style={{ fontSize: 10 }}>↗</span>
                </a>
              </div>

            </div>
          </div>

          {/* ── Right: login form (主役) ── */}
          <div className="login-form-col">
            <div className="login-card-form">
              <h2 style={{ fontSize: 21, fontWeight: 800, color: "#1a3320", margin: "0 0 6px", letterSpacing: -0.3 }}>
                ガーデンを開く
              </h2>

              {params.sent ? (
                <div style={{ paddingTop: 10 }}>
                  <p style={{ fontSize: 14, color: "#4b7a5a", lineHeight: 1.8, margin: "0 0 10px" }}>
                    メールを送信しました。
                    <br />
                    届いたリンクを開くと、あなたのガーデンに入れます。
                  </p>
                  <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.65, margin: 0 }}>
                    メールが届かない場合は、迷惑メールフォルダをご確認ください。
                  </p>
                </div>
              ) : (
                <div style={{ marginTop: 18 }}>
                  {/* Google — primary CTA */}
                  <GoogleSignInButton />

                  {/* Divider */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 16px" }}>
                    <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                    <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>またはメールで続ける</span>
                    <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                  </div>

                  {/* Magic Link — secondary */}
                  <form action={sendMagicLink}>
                    <input
                      type="email"
                      name="email"
                      placeholder="メールアドレス"
                      required
                      className="login-input"
                    />
                    <button type="submit" className="login-btn">
                      リンクを送る
                    </button>
                  </form>
                  <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.65, margin: "10px 0 0" }}>
                    パスワード不要。届いたリンクを開くとガーデンに入れます。
                  </p>
                </div>
              )}

              <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid #f0ebe2" }}>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: 0, lineHeight: 1.7 }}>
                  共有リンクを受け取った方は、ログイン不要です。
                  <br />
                  共有リンクから開いてください。
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
