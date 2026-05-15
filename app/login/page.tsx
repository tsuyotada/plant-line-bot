import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase-ssr";
import { BackgroundLayer } from "@/app/BackgroundLayer";
import { LineSignInButton } from "./LineSignInButton";
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

const LINE_ERROR_MESSAGES: Record<string, string> = {
  line_cancelled:     "LINEログインがキャンセルされました。",
  line_state_mismatch:"セキュリティエラーが発生しました。もう一度お試しください。",
  line_token_failed:  "LINEとの認証に失敗しました。もう一度お試しください。",
  line_profile_failed:"LINEプロフィールの取得に失敗しました。",
  line_signin_failed: "ログイン処理に失敗しました。もう一度お試しください。",
  line_already_linked:"このLINEアカウントは既に別のユーザーに連携されています。",
  line_not_configured:"LINEログインの設定が完了していません。管理者にお問い合わせください。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const lineError = params.error
    ? (LINE_ERROR_MESSAGES[params.error] ?? "ログインでエラーが発生しました。")
    : null;

  return (
    <>
      <style>{`
        /* ─── Grid: magazine spread ─── */
        .login-grid {
          display: grid;
          grid-template-columns: 5fr 8fr;
          gap: 48px;
          align-items: start;
          max-width: 960px;
          margin: 0 auto;
        }
        /* Mobile: stack — intro (on bg) first, card second */
        @media (max-width: 768px) {
          .login-grid  { grid-template-columns: 1fr; gap: 24px; }
          .login-intro-col { order: 1; }
          .login-form-col  { order: 2; }
        }

        /* ─── Login card ─── */
        .login-card-form {
          background: #ffffff;
          border-radius: 16px;
          padding: 32px 28px 24px;
          box-shadow: 0 6px 40px rgba(30, 60, 40, 0.22);
          border: 1px solid rgba(163, 196, 160, 0.50);
          box-sizing: border-box;
        }
        @media (max-width: 480px) {
          .login-card-form { padding: 24px 20px 20px; }
        }

        /* ─── Form fields ─── */
        .login-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 4px 0 14px;
        }
        .login-divider-line  { flex: 1; height: 1px; background: #e5e7eb; }
        .login-divider-label { font-size: 11px; color: #9ca3af; white-space: nowrap; }
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

        /* ─── Dev/admin accordion ─── */
        .admin-login-details {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid #f0ebe2;
        }
        .admin-login-details > summary {
          cursor: pointer;
          font-size: 11px;
          color: #9ca3af;
          user-select: none;
          list-style: none;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 0;
          width: fit-content;
        }
        .admin-login-details > summary::-webkit-details-marker { display: none; }
        .admin-login-details > summary::marker { display: none; }
        .admin-login-details[open] > summary { margin-bottom: 16px; color: #6b7280; }
        .admin-login-chevron { font-size: 9px; transition: transform 0.15s; }
        .admin-login-details[open] .admin-login-chevron { transform: rotate(180deg); }

        /* ─── Intro: text directly on background ─── */
        .login-intro-text {
          font-size: 13px;
          color: rgba(255,255,255,0.88);
          line-height: 1.85;
          margin: 0 0 22px;
          text-shadow: 0 1px 5px rgba(0,0,0,0.35);
        }
        .login-feature-icon {
          font-size: 15px;
          line-height: 1.4;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .login-feature-title {
          font-size: 12px;
          font-weight: 700;
          color: rgba(255,255,255,0.95);
          margin-bottom: 2px;
          line-height: 1.4;
          text-shadow: 0 1px 4px rgba(0,0,0,0.35);
        }
        .login-feature-desc {
          font-size: 11px;
          color: rgba(255,255,255,0.62);
          line-height: 1.6;
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }
      `}</style>

      <BackgroundLayer />

      <main style={{ minHeight: "100vh", padding: "0 20px 60px", fontFamily: ff }}>

        {/* ── Hero ── */}
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "52px 0 40px" }}>
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

          {/* ── Left: intro directly on background — no card ── */}
          <div className="login-intro-col">

            <p className="login-intro-text">
              わが家の植物を、写真とメモで見守る。<br />
              家族と共有して、LINEでも今日の植物メモを受け取れます。
            </p>

            <div style={{ marginBottom: 20 }}>
              {FEATURES.map(({ icon, title, desc }) => (
                <div key={title} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                  <span className="login-feature-icon">{icon}</span>
                  <div>
                    <div className="login-feature-title">{title}</div>
                    <div className="login-feature-desc">{desc}</div>
                  </div>
                </div>
              ))}
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
                color: "rgba(255,255,255,0.72)",
                textDecoration: "none",
                borderBottom: "1px solid rgba(255,255,255,0.30)",
                paddingBottom: 1,
                lineHeight: 1.4,
                textShadow: "0 1px 3px rgba(0,0,0,0.30)",
              }}
            >
              サンプルの植物ページを開く
              <span style={{ fontSize: 10 }}>↗</span>
            </a>

          </div>

          {/* ── Right: login card ── */}
          <div className="login-form-col">
            <div className="login-card-form">
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#1a3320",
                  margin: "0 0 6px",
                  letterSpacing: -0.3,
                }}
              >
                ガーデンを開く
              </h2>

              {/* LINE login error */}
              {lineError && (
                <p style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", margin: "8px 0 0" }}>
                  {lineError}
                </p>
              )}

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

                  {/* ── Primary: LINE Login ── */}
                  <LineSignInButton />

                  {/* ── Dev / Admin accordion ── */}
                  <details className="admin-login-details">
                    <summary>
                      管理者・開発者向けログイン
                      <span className="admin-login-chevron">▾</span>
                    </summary>

                    <GoogleSignInButton />

                    <div className="login-divider">
                      <div className="login-divider-line" />
                      <span className="login-divider-label">またはメールで続ける</span>
                      <div className="login-divider-line" />
                    </div>

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
                  </details>
                </div>
              )}

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #f0ebe2" }}>
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
