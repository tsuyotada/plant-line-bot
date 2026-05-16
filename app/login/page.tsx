import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/src/lib/supabase-ssr";
import { BackgroundLayer } from "@/app/BackgroundLayer";
import { AnalyticsPageView } from "@/app/AnalyticsPageView";
import { LineSignInButton } from "./LineSignInButton";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { TrackableSampleLink } from "./TrackableSampleLink";

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
        /* ─── Hero grid: 2 columns — intro | card ─── */
        .login-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 36px;
          align-items: center;
          max-width: 820px;
          margin: 0 auto;
        }
        @media (max-width: 680px) {
          .login-grid      { grid-template-columns: 1fr; gap: 24px; }
          .login-intro-col { order: 1; }
          .login-form-col  { order: 2; }
        }

        /* ─── Login card ─── */
        .login-card-form {
          background: #ffffff;
          border-radius: 14px;
          padding: 24px 22px 20px;
          box-shadow: 0 6px 36px rgba(20, 50, 30, 0.26);
          border: 1px solid rgba(163, 196, 160, 0.40);
          box-sizing: border-box;
        }
        @media (max-width: 480px) {
          .login-card-form { padding: 20px 16px 16px; }
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
          font-size: 17px;
          font-weight: 700;
          color: rgba(255,255,255,0.96);
          line-height: 1.5;
          margin: 0 0 14px;
          letter-spacing: -0.3px;
          text-shadow: 0 1px 10px rgba(0,0,0,0.50);
        }
        .login-intro-body {
          font-size: 13px;
          color: rgba(255,255,255,0.80);
          line-height: 1.85;
          margin: 0 0 18px;
          text-shadow: 0 1px 6px rgba(0,0,0,0.40);
        }
        .login-sample-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,0.78);
          text-decoration: none;
          border-bottom: 1px solid rgba(255,255,255,0.42);
          padding-bottom: 2px;
          line-height: 1.4;
          text-shadow: 0 1px 4px rgba(0,0,0,0.35);
          transition: color 0.15s, border-color 0.15s;
        }
        .login-sample-link:hover {
          color: rgba(255,255,255,0.95);
          border-color: rgba(255,255,255,0.70);
        }
        .login-about-link {
          display: block;
          margin-top: 10px;
          font-size: 11px;
          color: rgba(255,255,255,0.42);
          text-decoration: none;
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
          transition: color 0.15s;
        }
        .login-about-link:hover { color: rgba(255,255,255,0.65); }

        /* ─── Below-fold sections ─── */
        .lp-section {
          max-width: 820px;
          margin: 0 auto;
          width: 100%;
          padding-top: 72px;
        }
        .lp-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.38);
          margin: 0 0 12px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }
        .lp-heading {
          font-size: 18px;
          font-weight: 700;
          color: rgba(255,255,255,0.96);
          margin: 0 0 20px;
          line-height: 1.45;
          letter-spacing: -0.2px;
          text-shadow: 0 1px 8px rgba(0,0,0,0.45);
        }

        /* ─── Feature card grid ─── */
        .lp-feature-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        @media (max-width: 600px) {
          .lp-feature-grid { grid-template-columns: 1fr; gap: 10px; }
        }
        .lp-feature-card {
          background: rgba(255,255,255,0.09);
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 10px;
          padding: 16px 16px 18px;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .lp-feature-title {
          font-size: 13px;
          font-weight: 700;
          color: rgba(255,255,255,0.92);
          margin: 0 0 7px;
          line-height: 1.4;
          text-shadow: 0 1px 5px rgba(0,0,0,0.35);
        }
        .lp-feature-body {
          font-size: 12px;
          color: rgba(255,255,255,0.68);
          line-height: 1.8;
          margin: 0;
          text-shadow: 0 1px 4px rgba(0,0,0,0.28);
        }

        /* ─── LINE list items ─── */
        .lp-line-item {
          padding: 16px 0;
          border-top: 1px solid rgba(255,255,255,0.10);
        }
        .lp-line-item:last-child { border-bottom: 1px solid rgba(255,255,255,0.10); }
        .lp-line-item-title {
          font-size: 13px;
          font-weight: 700;
          color: rgba(255,255,255,0.90);
          margin: 0 0 5px;
          text-shadow: 0 1px 5px rgba(0,0,0,0.40);
        }
        .lp-line-item-body {
          font-size: 12px;
          color: rgba(255,255,255,0.64);
          line-height: 1.8;
          margin: 0;
          text-shadow: 0 1px 4px rgba(0,0,0,0.28);
          max-width: 520px;
        }

        /* ─── Share preview card ─── */
        .lp-share-card {
          background: rgba(255,255,255,0.09);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 12px;
          padding: 20px 22px 22px;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        /* ─── Final CTA ─── */
        .lp-cta-section {
          max-width: 820px;
          margin: 0 auto;
          width: 100%;
          padding-top: 72px;
          padding-bottom: 80px;
        }
        .lp-cta-line-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 28px;
          background: rgba(255,255,255,0.92);
          color: #1a3320;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 700;
          text-decoration: none;
          font-family: inherit;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .lp-cta-line-btn:hover { background: #ffffff; }
        @media (max-width: 480px) {
          .lp-cta-line-btn { width: 100%; font-size: 16px; padding: 15px 24px; }
        }
      `}</style>

      <AnalyticsPageView pagePath="/login" />
      <BackgroundLayer overlayStrength="medium" />

      <main style={{ fontFamily: ff }}>

        {/* ══ ① Hero viewport — vertically centered ══ */}
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "40px 20px",
          }}
        >
          {/* Title */}
          <div style={{ maxWidth: 820, margin: "0 auto", width: "100%", paddingBottom: 20 }}>
            <h1
              style={{
                fontSize: 70,
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
                fontSize: 13,
                fontWeight: 500,
                color: "rgba(255,255,255,0.72)",
                margin: 0,
                letterSpacing: 1.5,
                textShadow: "0 1px 6px rgba(0,0,0,0.50)",
                textTransform: "uppercase",
              }}
            >
              Keep every green healthy.
            </p>
          </div>

          {/* 2-column: intro | login card */}
          <div className="login-grid">

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
              <TrackableSampleLink href={SAMPLE_URL} className="login-sample-link">
                サンプルを見る
                <span style={{ fontSize: 10 }}>↗</span>
              </TrackableSampleLink>
              <a
                href="#about-plant-care"
                className="login-about-link"
                style={{ scrollBehavior: "smooth" }}
              >
                Plant Care について ↓
              </a>
            </div>

            <div className="login-form-col">
              <div className="login-card-form">
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#1a3320",
                    margin: "0 0 2px",
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
                  <div style={{ marginTop: 14 }}>
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

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f0ebe2" }}>
                  <p style={{ fontSize: 11, color: "#b0b8b0", margin: "0 0 10px", lineHeight: 1.65 }}>
                    共有リンクを受け取った方はログイン不要です。
                    リンクから直接開いてください。
                  </p>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <Link href="/privacy" style={{ fontSize: 11, color: "#b0b8b0", textDecoration: "none", borderBottom: "1px solid #e5e7eb" }}>
                      プライバシーポリシー
                    </Link>
                    <Link href="/terms" style={{ fontSize: 11, color: "#b0b8b0", textDecoration: "none", borderBottom: "1px solid #e5e7eb" }}>
                      利用規約
                    </Link>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>{/* /hero viewport */}

        {/* ══ ② Plant Care でできること ══ */}
        <div id="about-plant-care" style={{ padding: "0 20px" }}>
          <div className="lp-section">
            <p className="lp-label">Plant Care</p>
            <h2 className="lp-heading">気にかける、記録する、相談する。</h2>
            <div className="lp-feature-grid">
              {[
                {
                  title: "写真で、変化に気づく",
                  body: "今日の様子を1枚残しておくと、葉の色や育ち具合の変化に気づきやすくなります。記録が積み重なると、ケアのタイミングも見えてきます。",
                },
                {
                  title: "種類に合ったヒントを受け取る",
                  body: "育てている植物の種類と写真をもとに、水やり・肥料・葉の変化のタイミングをお知らせします。サボテンとハーブでは、気にかけるポイントが違います。",
                },
                {
                  title: "少しずつ、自分のガーデンを育てる",
                  body: "植物を追加していくと、自分だけのガーデンページが少しずつ育っていきます。最初は1鉢からでも大丈夫です。",
                },
              ].map((f) => (
                <div key={f.title} className="lp-feature-card">
                  <p className="lp-feature-title">{f.title}</p>
                  <p className="lp-feature-body">{f.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ══ ③ LINEでできること ══ */}
          <div className="lp-section">
            <p className="lp-label">LINE</p>
            <h2 className="lp-heading">LINEを入口にして使える。</h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.68)", lineHeight: 1.85, margin: "0 0 16px", textShadow: "0 1px 5px rgba(0,0,0,0.35)", maxWidth: 520 }}>
              LINEログインで始めると、アプリを毎日開かなくてもLINEを入口にして使えます。
            </p>
            <div>
              {[
                {
                  title: "写真をLINEで送って記録する",
                  body: "気になったときに植物の写真をLINEへ送ると、どの植物の記録にするか選べます。アプリを開き直さなくても、日々の変化をためていけます。",
                },
                {
                  title: "気になることをLINEで相談する",
                  body: "葉の色が気になる、水やりの頻度に迷う。そんなときはLINEから植物の様子を相談できます。答えを押しつけるのではなく、見るポイントを一緒に整理します。",
                },
                {
                  title: "朝の植物メモを受け取る",
                  body: "必要なら、今日気にかけたい植物のメモをLINEで受け取れます。通知の設定はログイン後にいつでもできます。まずはWebだけで使い始めても大丈夫です。",
                },
              ].map((item) => (
                <div key={item.title} className="lp-line-item">
                  <p className="lp-line-item-title">{item.title}</p>
                  <p className="lp-line-item-body">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ══ ④ 家族に見せられる植物ページ ══ */}
          <div className="lp-section">
            <p className="lp-label">Share</p>
            <h2 className="lp-heading">植物の様子を、家族と共有できる。</h2>
            <div className="lp-share-card">
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", lineHeight: 1.85, margin: "0 0 14px", textShadow: "0 1px 4px rgba(0,0,0,0.30)" }}>
                共有リンクを使うと、ログインなしで家族や友人に植物の様子を見てもらえます。
                植物ごとの写真・ケアのメモ・今日の注目植物を、そのままシェアできます。
              </p>
              <TrackableSampleLink
                href={SAMPLE_URL}
                className="login-sample-link"
              >
                共有ページのサンプルを見る
                <span style={{ fontSize: 10 }}>↗</span>
              </TrackableSampleLink>
            </div>
          </div>
        </div>

        {/* ══ ⑤ Final CTA ══ */}
        <div style={{ padding: "0 20px" }}>
          <div className="lp-cta-section">
            <p className="lp-label">Get started</p>
            <h2 className="lp-heading">LINEで始められます。</h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.85, margin: "0 0 28px", textShadow: "0 1px 5px rgba(0,0,0,0.35)", maxWidth: 400 }}>
              LINEアカウントでログインできます。メールアドレスの入力は不要です。
              通知の設定はあとからでも大丈夫です。
            </p>
            <a href="/api/auth/line/authorize" className="lp-cta-line-btn">
              <svg width="20" height="20" viewBox="0 0 44 44" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path fill="#06C755" d="M22 4C12.06 4 4 11.163 4 20c0 5.34 2.9 10.074 7.4 13.1l-1.75 6.5 7.3-3.85A19.9 19.9 0 0022 36c9.94 0 18-7.163 18-16S31.94 4 22 4zm9.14 20.9h-4.58c-.29 0-.53-.23-.53-.52v-7.36c0-.29.24-.52.53-.52.3 0 .53.23.53.52v6.85h4.05c.3 0 .53.23.53.52 0 .28-.23.51-.53.51zm-6.96 0c-.29 0-.52-.23-.52-.52v-7.36c0-.29.23-.52.52-.52.3 0 .53.23.53.52v7.36c0 .29-.23.52-.53.52zm-2.07 0c-.19 0-.37-.1-.46-.27l-3.63-4.95v4.7c0 .29-.24.52-.53.52-.3 0-.53-.23-.53-.52v-7.36c0-.28.23-.51.53-.51.19 0 .36.1.46.26l3.63 4.95v-4.7c0-.29.24-.52.53-.52.3 0 .53.23.53.52v7.36c0 .29-.23.52-.53.52zm-5.17 0H12.4c-.3 0-.53-.23-.53-.52v-7.36c0-.29.23-.52.53-.52h4.54c.3 0 .53.23.53.52 0 .3-.23.53-.53.53h-4.01v2.44h3.44c.3 0 .53.24.53.53 0 .29-.23.52-.53.52h-3.44v2.82h4.01c.3 0 .53.24.53.53 0 .28-.23.51-.53.51z"/>
              </svg>
              LINEで始める
            </a>
            <div style={{ marginTop: 28, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <Link href="/privacy" style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 1 }}>
                プライバシーポリシー
              </Link>
              <Link href="/terms" style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 1 }}>
                利用規約
              </Link>
            </div>
          </div>
        </div>

      </main>
    </>
  );
}
