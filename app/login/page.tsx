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
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
  });
  redirect("/login?sent=1");
}

const ff = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const SAMPLE_URL =
  "https://plant-line-bot-forme.vercel.app/share/e66f00d8-ae82-42c9-99ad-d133456d8cb6";

const FEATURES = [
  {
    title: "植物ごとのケアのヒント",
    body: "水やり、肥料、葉の変化のタイミングを、育てている植物の種類に合わせてお知らせします。サボテンと観葉植物では、適切なペースが違います。",
  },
  {
    title: "写真で変化を残す",
    body: "今日の写真を1枚残しておくと、あとから元気の変化に気づきやすくなります。記録が積み重なると、ケアの判断が楽になります。",
  },
  {
    title: "LINEを入口にする",
    body: "朝の植物メモを受け取るだけでなく、気になった写真をLINEから送ったり、葉の色や水やりについて相談したりできます。通知はあとから設定できます。",
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "植物の種類を入れる",
    body: "「サボテン」「バジル」など、わかる範囲で大丈夫です。種類をもとに、ケアのヒントを調整します。",
  },
  {
    n: "02",
    title: "写真を残す（任意）",
    body: "今日の姿を1枚。あとから元気の変化に気づきやすくなります。写真はあとからいつでも追加できます。",
  },
  {
    n: "03",
    title: "ヒントを見る",
    body: "水やり・肥料のタイミングや、葉の変化への気づきを確認できます。毎日開く必要はありません。",
  },
  {
    n: "04",
    title: "必要ならLINEで受け取る",
    body: "朝の植物メモをLINEで届けられます。通知はあとから設定できます。まずはWebだけでも使えます。",
  },
] as const;

const LINE_FEATURES = [
  {
    title: "写真を送って記録する",
    body: "気になったときに植物の写真をLINEへ送ると、どの植物の記録として残すか選べます。アプリを開き直さなくても、日々の変化をためていけます。",
  },
  {
    title: "気になることを相談する",
    body: "葉の色が気になる、水やりの頻度に迷う。そんなときはLINEから植物の様子を相談できます。答えを押しつけるのではなく、見るポイントを一緒に整理します。",
  },
  {
    title: "朝の植物メモを受け取る",
    body: "必要なら、今日気にかけたい植物メモをLINEで受け取れます。設定はあとからでも大丈夫です。",
  },
] as const;

const CONTENTS = [
  { text: "Plant Care でできること", anchor: "#features"     },
  { text: "植物ごとのケアのヒント例", anchor: "#care-hints"   },
  { text: "使い方のながれ",           anchor: "#how-it-works" },
  { text: "LINEでできること",         anchor: "#line"         },
  { text: "サンプルを確認する",       anchor: "#sample"       },
];

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
        html { scroll-behavior: smooth; }

        /* ─── Hero: 2-col grid ─── */
        .login-hero {
          min-height: 80vh;
          display: flex;
          align-items: center;
          max-width: 860px;
          margin: 0 auto;
          width: 100%;
        }
        .login-hero-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          align-items: center;
          width: 100%;
          padding-bottom: 32px;
        }
        @media (max-width: 680px) {
          .login-hero-grid {
            grid-template-columns: 1fr;
            gap: 28px;
          }
          .login-hero-left  { order: 1; }
          .login-hero-right { order: 2; }
        }

        /* ─── Hero left ─── */
        .login-hero-h1 {
          font-size: 34px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 16px;
          line-height: 1.3;
          letter-spacing: -0.6px;
          text-shadow: 0 2px 12px rgba(0,0,0,0.55), 0 0 32px rgba(0,0,0,0.25);
        }
        @media (max-width: 480px) {
          .login-hero-h1 { font-size: 28px; }
        }
        .login-hero-body {
          font-size: 13px;
          color: rgba(255,255,255,0.76);
          line-height: 1.85;
          margin: 0 0 22px;
          text-shadow: 0 1px 6px rgba(0,0,0,0.40);
        }

        /* ─── Contents list ─── */
        .login-contents {
          margin: 0 0 8px;
          padding: 14px 16px;
          border-left: 2px solid rgba(255,255,255,0.20);
        }
        .login-contents-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
          margin: 0 0 8px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }
        .login-contents-list {
          font-size: 12px;
          line-height: 1.8;
          margin: 0;
          list-style: none;
          padding: 0;
        }
        .login-contents-list li::before {
          content: "— ";
          color: rgba(255,255,255,0.28);
        }
        .login-contents-list a {
          color: rgba(255,255,255,0.55);
          text-decoration: none;
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
          transition: color 0.15s;
          border-bottom: 1px solid transparent;
        }
        .login-contents-list a:hover {
          color: rgba(255,255,255,0.85);
          border-bottom-color: rgba(255,255,255,0.35);
        }

        /* ─── Login card (right) ─── */
        .login-card {
          background: #ffffff;
          border-radius: 14px;
          padding: 24px 22px 20px;
          box-shadow: 0 6px 36px rgba(20, 50, 30, 0.28);
          border: 1px solid rgba(163, 196, 160, 0.40);
          box-sizing: border-box;
        }
        @media (max-width: 480px) {
          .login-card { padding: 20px 16px 16px; }
        }
        .login-card-brand {
          font-size: 20px;
          font-weight: 800;
          color: #1a3320;
          margin: 0 0 2px;
          letter-spacing: -0.5px;
          line-height: 1.2;
        }
        .login-card-sub {
          font-size: 11px;
          color: #9ca3af;
          margin: 0 0 16px;
          letter-spacing: 0.2px;
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

        /* ─── Scroll hint ─── */
        .login-scroll-hint {
          max-width: 860px;
          margin: 0 auto;
          width: 100%;
          padding-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .login-scroll-line {
          flex: none;
          width: 24px;
          height: 1px;
          background: rgba(255,255,255,0.22);
        }
        .login-scroll-text {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.28);
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }

        /* ─── Below-fold sections (shared with about) ─── */
        .about-section-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.38);
          margin: 0 0 14px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }
        .about-section-heading {
          font-size: 18px;
          font-weight: 700;
          color: rgba(255,255,255,0.96);
          margin: 0 0 11px;
          line-height: 1.45;
          letter-spacing: -0.2px;
          text-shadow: 0 1px 8px rgba(0,0,0,0.45);
        }
        .about-section-body {
          font-size: 13px;
          color: rgba(255,255,255,0.74);
          line-height: 1.85;
          margin: 0 0 22px;
          text-shadow: 0 1px 5px rgba(0,0,0,0.35);
        }
        .about-features {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 14px;
          width: 100%;
        }
        @media (max-width: 640px) {
          .about-features { grid-template-columns: 1fr; gap: 10px; }
        }
        .about-feature-card {
          background: rgba(255,255,255,0.09);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 10px;
          padding: 16px 16px 18px;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .about-feature-title {
          font-size: 13px;
          font-weight: 700;
          color: rgba(255,255,255,0.92);
          margin: 0 0 8px;
          line-height: 1.4;
          text-shadow: 0 1px 5px rgba(0,0,0,0.35);
        }
        .about-feature-body {
          font-size: 12px;
          color: rgba(255,255,255,0.70);
          line-height: 1.78;
          margin: 0;
          text-shadow: 0 1px 4px rgba(0,0,0,0.28);
        }
        .about-step {
          display: grid;
          grid-template-columns: 36px 1fr;
          gap: 14px;
          align-items: start;
          padding: 18px 0;
          border-top: 1px solid rgba(255,255,255,0.12);
        }
        .about-step:last-child { border-bottom: 1px solid rgba(255,255,255,0.12); }
        .about-step-num {
          font-size: 20px;
          font-weight: 800;
          color: rgba(255,255,255,0.26);
          line-height: 1.2;
          letter-spacing: -1px;
          text-shadow: 0 1px 4px rgba(0,0,0,0.30);
        }
        .about-step-title {
          font-size: 14px;
          font-weight: 700;
          color: rgba(255,255,255,0.92);
          margin: 0 0 5px;
          line-height: 1.4;
          text-shadow: 0 1px 5px rgba(0,0,0,0.40);
        }
        .about-step-body {
          font-size: 12px;
          color: rgba(255,255,255,0.66);
          line-height: 1.75;
          margin: 0;
          text-shadow: 0 1px 4px rgba(0,0,0,0.28);
        }
        .about-line-item {
          padding: 18px 0;
          border-top: 1px solid rgba(255,255,255,0.12);
        }
        .about-line-item:last-child { border-bottom: 1px solid rgba(255,255,255,0.12); }
        .about-line-item-title {
          font-size: 14px;
          font-weight: 700;
          color: rgba(255,255,255,0.90);
          margin: 0 0 6px;
          text-shadow: 0 1px 5px rgba(0,0,0,0.40);
        }
        .about-line-item-body {
          font-size: 12px;
          color: rgba(255,255,255,0.66);
          line-height: 1.8;
          margin: 0;
          text-shadow: 0 1px 4px rgba(0,0,0,0.28);
          max-width: 480px;
        }
        .about-sample-block {
          background: rgba(255,255,255,0.09);
          border: 1px solid rgba(255,255,255,0.20);
          border-radius: 12px;
          padding: 22px 22px 24px;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .about-sample-link {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.72);
          text-decoration: none;
          border-bottom: 1px solid rgba(255,255,255,0.36);
          padding-bottom: 2px;
          text-shadow: 0 1px 4px rgba(0,0,0,0.35);
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .about-sample-link:hover {
          color: rgba(255,255,255,0.95);
          border-color: rgba(255,255,255,0.65);
        }
        .about-cta-row {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }
        .about-login-btn-solid {
          display: inline-flex;
          align-items: center;
          padding: 11px 24px;
          background: rgba(255,255,255,0.92);
          border-radius: 9px;
          font-size: 14px;
          font-weight: 700;
          color: #1a3320;
          text-decoration: none;
          transition: background 0.15s;
          white-space: nowrap;
          font-family: inherit;
        }
        .about-login-btn-solid:hover { background: #ffffff; }
        .about-back-link {
          font-size: 11px;
          color: rgba(255,255,255,0.38);
          text-decoration: none;
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
          transition: color 0.15s;
        }
        .about-back-link:hover { color: rgba(255,255,255,0.65); }
      `}</style>

      <AnalyticsPageView pagePath="/login" />
      <BackgroundLayer overlayStrength="medium" fixedBg="/images/bg-14.jpg.jpg" />

      <main style={{ minHeight: "100vh", padding: "0 20px 80px", fontFamily: ff }}>

        {/* ── Hero: h1 left + login card right ── */}
        <div className="login-hero">
          <div className="login-hero-grid">

            {/* Left: headline + body + contents list */}
            <div className="login-hero-left">
              <h1 className="login-hero-h1">
                植物の世話を、<br />
                ひとりで悩まないために。
              </h1>
              <p className="login-hero-body">
                水やり、肥料、葉の変化。育てている植物の種類と写真をもとに、その植物に合ったヒントを受け取れます。毎日きっちり管理するというより、気になったときに少しずつ様子を残していけます。
              </p>
              <div className="login-contents">
                <p className="login-contents-label">このページで分かること</p>
                <ul className="login-contents-list">
                  {CONTENTS.map((c) => (
                    <li key={c.anchor}>
                      <a href={c.anchor}>{c.text}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right: login card */}
            <div className="login-hero-right">
              <div className="login-card">
                <p className="login-card-brand">Plant Careをはじめる</p>
                <p className="login-card-sub">LINEログインで、植物の記録と相談をはじめられます。</p>

                {lineError && (
                  <p style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", margin: "0 0 12px" }}>
                    {lineError}
                  </p>
                )}

                {params.sent ? (
                  <div>
                    <p style={{ fontSize: 14, color: "#4b7a5a", lineHeight: 1.8, margin: "0 0 10px" }}>
                      メールを送信しました。<br />
                      届いたリンクを開くと、あなたのガーデンに入れます。
                    </p>
                    <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.65, margin: 0 }}>
                      メールが届かない場合は、迷惑メールフォルダをご確認ください。
                    </p>
                  </div>
                ) : (
                  <>
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
                  </>
                )}

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f0ebe2" }}>
                  <p style={{ fontSize: 11, color: "#b0b8b0", margin: 0, lineHeight: 1.65 }}>
                    共有リンクを受け取った方はログイン不要です。リンクから直接開いてください。
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Scroll hint */}
        <div className="login-scroll-hint">
          <span className="login-scroll-line" />
          <span className="login-scroll-text">植物ごとのケアのヒントについて</span>
        </div>

        {/* ══ Section 1: できること ══ */}
        <div id="features" style={{ maxWidth: 620, margin: "0 auto", width: "100%", paddingTop: 56 }}>
          <p className="about-section-label">Features</p>
          <h2 className="about-section-heading">Plant Care でできること</h2>
          <div className="about-features">
            {FEATURES.map((f) => (
              <div key={f.title} className="about-feature-card">
                <p className="about-feature-title">{f.title}</p>
                <p className="about-feature-body">{f.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ══ Section 2: 植物ごとのケアヒント例 ══ */}
        <div id="care-hints" style={{ maxWidth: 620, margin: "0 auto", width: "100%", paddingTop: 64 }}>
          <p className="about-section-label">Care Hints</p>
          <h2 className="about-section-heading">植物によって、気にかけることは違う</h2>
          <p className="about-section-body">
            サボテン、ハーブ、観葉植物など、植物ごとに水やりや肥料、見るポイントは違います。種類と写真をもとに、それぞれに合ったヒントをお知らせします。
          </p>
          <div className="about-features">
            {[
              { plant: "サボテン・多肉植物", hint: "土がしっかり乾いてから水やりを。乾燥気味のほうが安心です。水のあげすぎには注意が必要です。" },
              { plant: "ハーブ",             hint: "葉が混み合ってきたら、収穫や切り戻しのタイミングかもしれません。乾燥しすぎるとすぐ元気がなくなります。" },
              { plant: "観葉植物",           hint: "葉の色や張り、置き場所の光を気にかけます。季節によって日当たりを変えてみるのもよさそうです。" },
            ].map((ex) => (
              <div key={ex.plant} className="about-feature-card">
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.50)", letterSpacing: "0.5px", margin: "0 0 8px", textTransform: "uppercase", textShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>{ex.plant}</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.78)", lineHeight: 1.75, margin: 0, textShadow: "0 1px 4px rgba(0,0,0,0.28)" }}>{ex.hint}</p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.32)", lineHeight: 1.7, textShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
            ※ ヒントは植物の種類と記録をもとに生成されます。断定ではなく、気にかけるきっかけとしてお使いください。
          </p>
        </div>

        {/* ══ Section 3: 使い方 ══ */}
        <div id="how-it-works" style={{ maxWidth: 560, margin: "0 auto", width: "100%", paddingTop: 72 }}>
          <p className="about-section-label">How it works</p>
          <h2 className="about-section-heading">使い方はかんたんです</h2>
          <div>
            {STEPS.map((step) => (
              <div key={step.n} className="about-step">
                <span className="about-step-num">{step.n}</span>
                <div>
                  <p className="about-step-title">{step.title}</p>
                  <p className="about-step-body">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ Section 4: LINEでできること ══ */}
        <div id="line" style={{ maxWidth: 560, margin: "0 auto", width: "100%", paddingTop: 72 }}>
          <p className="about-section-label">LINE</p>
          <h2 className="about-section-heading">LINEでできること</h2>
          <p className="about-section-body">
            LINEログインで始めると、アプリを毎日開かなくてもLINEを入口にして使えます。
          </p>
          <div>
            {LINE_FEATURES.map((item) => (
              <div key={item.title} className="about-line-item">
                <p className="about-line-item-title">{item.title}</p>
                <p className="about-line-item-body">{item.body}</p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.35)", textShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
            LINEログインとLINE通知は別々に設定できます。まずはWebだけで始めても大丈夫です。
          </p>
        </div>

        {/* ══ Section 5: サンプル ══ */}
        <div id="sample" style={{ maxWidth: 560, margin: "0 auto", width: "100%", paddingTop: 72 }}>
          <p className="about-section-label">Sample</p>
          <div className="about-sample-block">
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.96)", margin: "0 0 10px", textShadow: "0 1px 6px rgba(0,0,0,0.40)" }}>
              ログイン前に、使い心地を確認できます
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.70)", lineHeight: 1.8, margin: "0 0 16px", textShadow: "0 1px 4px rgba(0,0,0,0.28)" }}>
              サンプルの植物ページを公開しています。どんなヒントが届くか、どんな見え方になるか、登録前に確認できます。
            </p>
            <TrackableSampleLink href={SAMPLE_URL} className="about-sample-link">
              サンプルの植物ページを見る <span style={{ fontSize: 10 }}>↗</span>
            </TrackableSampleLink>
          </div>
        </div>

        {/* ══ Section 6: Get started ══ */}
        <div id="get-started" style={{ maxWidth: 560, margin: "0 auto", width: "100%", paddingTop: 72 }}>
          <p className="about-section-label">Get started</p>
          <h2 className="about-section-heading">LINEで始められます</h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.74)", lineHeight: 1.85, margin: "0 0 8px", textShadow: "0 1px 5px rgba(0,0,0,0.35)" }}>
            LINEアカウントでログインできます。メールアドレスの入力は不要です。
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.74)", lineHeight: 1.85, margin: "0 0 28px", textShadow: "0 1px 5px rgba(0,0,0,0.35)" }}>
            まずはWebだけで使い始めても大丈夫です。朝のLINE通知は、ログイン後にいつでも設定できます。
          </p>
          <div className="about-cta-row">
            <a href="/api/auth/line/authorize" className="about-login-btn-solid">
              LINEで始める
            </a>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", paddingTop: 48, paddingBottom: 8 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link href="/privacy" style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 1, textShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
              プライバシーポリシー
            </Link>
            <Link href="/terms" style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 1, textShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
              利用規約
            </Link>
          </div>
        </div>

      </main>
    </>
  );
}
