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

const SAMPLE_URL =
  "https://plant-line-bot-forme.vercel.app/share/e66f00d8-ae82-42c9-99ad-d133456d8cb6";

const LINE_ERROR_MESSAGES: Record<string, string> = {
  line_cancelled:      "LINEログインがキャンセルされました。",
  line_state_mismatch: "セキュリティエラーが発生しました。もう一度お試しください。",
  line_token_failed:   "LINEとの認証に失敗しました。もう一度お試しください。",
  line_profile_failed: "LINEプロフィールの取得に失敗しました。",
  line_signin_failed:  "ログイン処理に失敗しました。もう一度お試しください。",
  line_already_linked: "このLINEアカウントは既に別のユーザーに連携されています。",
  line_not_configured: "LINEログインの設定が完了していません。管理者にお問い合わせください。",
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
        /* ─── Grid: 2 columns — intro | card ─── */
        .login-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: start;
          max-width: 900px;
          margin: 0 auto;
        }
        @media (max-width: 720px) {
          .login-grid      { grid-template-columns: 1fr; gap: 28px; }
          .login-intro-col { order: 1; }
          .login-form-col  { order: 2; }
        }

        /* ─── Login card ─── */
        .login-card-form {
          background: #ffffff;
          border-radius: 16px;
          padding: 28px 26px 22px;
          box-shadow: 0 6px 40px rgba(20, 50, 30, 0.28);
          border: 1px solid rgba(163, 196, 160, 0.45);
          box-sizing: border-box;
        }
        @media (max-width: 480px) {
          .login-card-form { padding: 22px 18px 18px; }
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
          padding: 12px 14px;
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
          padding: 13px;
          background: #4b7a5a;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 15px;
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
          color: #b0b8b0;
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
        .admin-login-details[open] > summary { margin-bottom: 16px; color: #9ca3af; }
        .admin-login-chevron { font-size: 9px; transition: transform 0.15s; }
        .admin-login-details[open] .admin-login-chevron { transform: rotate(180deg); }

        /* ─── Intro text on background ─── */
        .login-intro-lead {
          font-size: 18px;
          font-weight: 700;
          color: rgba(255,255,255,0.96);
          line-height: 1.5;
          margin: 0 0 18px;
          letter-spacing: -0.3px;
          text-shadow: 0 1px 10px rgba(0,0,0,0.50);
        }
        .login-intro-body {
          font-size: 13px;
          color: rgba(255,255,255,0.80);
          line-height: 1.9;
          margin: 0 0 28px;
          text-shadow: 0 1px 6px rgba(0,0,0,0.40);
        }
        .login-sample-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,0.65);
          text-decoration: none;
          border-bottom: 1px solid rgba(255,255,255,0.28);
          padding-bottom: 2px;
          line-height: 1.4;
          text-shadow: 0 1px 4px rgba(0,0,0,0.35);
          transition: color 0.15s, border-color 0.15s;
        }
        .login-sample-link:hover {
          color: rgba(255,255,255,0.88);
          border-color: rgba(255,255,255,0.55);
        }
      `}</style>

      <BackgroundLayer overlayStrength="medium" />

      <main style={{ minHeight: "100vh", padding: "0 20px 60px", fontFamily: ff }}>

        {/* ── Hero ── */}
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "52px 0 44px" }}>
          <h1
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "#ffffff",
              margin: "0 0 8px",
              letterSpacing: -2,
              lineHeight: 1.0,
              textShadow: "0 2px 12px rgba(0,0,0,0.60), 0 0 40px rgba(0,0,0,0.30)",
            }}
          >
            Plant Care
          </h1>
          <p
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "rgba(255,255,255,0.80)",
              margin: 0,
              letterSpacing: 1.4,
              textShadow: "0 1px 6px rgba(0,0,0,0.50)",
              textTransform: "uppercase",
            }}
          >
            Keep every green healthy.
          </p>
        </div>

        {/* ── 2-column grid: intro | card ── */}
        <div className="login-grid">

          {/* ── Left: intro on background ── */}
          <div className="login-intro-col">

            <p className="login-intro-lead">
              植物ごとのケアを、<br />
              少し相談できる場所。
            </p>

            <p className="login-intro-body">
              水やり、肥料、葉の変化。<br />
              種類と写真をもとに、<br />
              その植物に合ったヒントを受け取れます。<br />
              <br />
              毎日きっちり管理するというより、<br />
              気になったときに少しずつ。
            </p>

            <a
              href={SAMPLE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="login-sample-link"
            >
              サンプルを見る
              <span style={{ fontSize: 10 }}>↗</span>
            </a>

          </div>

          {/* ── Right: login card ── */}
          <div className="login-form-col">
            <div className="login-card-form">
              <h2
                style={{
                  fontSize: 19,
                  fontWeight: 800,
                  color: "#1a3320",
                  margin: "0 0 4px",
                  letterSpacing: -0.3,
                }}
              >
                ガーデンを開く
              </h2>

              {lineError && (
                <p style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", margin: "10px 0 0" }}>
                  {lineError}
                </p>
              )}

              {params.sent ? (
                <div style={{ paddingTop: 10 }}>
                  <p style={{ fontSize: 14, color: "#4b7a5a", lineHeight: 1.8, margin: "0 0 10px" }}>
                    メールを送信しました。<br />
                    届いたリンクを開くと、あなたのガーデンに入れます。
                  </p>
                  <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.65, margin: 0 }}>
                    メールが届かない場合は、迷惑メールフォルダをご確認ください。
                  </p>
                </div>
              ) : (
                <div style={{ marginTop: 16 }}>

                  <LineSignInButton />

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

              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #f0ebe2" }}>
                <p style={{ fontSize: 11, color: "#b0b8b0", margin: 0, lineHeight: 1.65 }}>
                  共有リンクを受け取った方はログイン不要です。
                  リンクから直接開いてください。
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
