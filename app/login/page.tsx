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
        /* Hallmark · genre: atmospheric · macrostructure: Long Document · theme: custom (vibe: "warm botanical dark journal") · enrichment: none · nav: none · footer: Ft2 */
        /* Pre-emit critique: P4 H4 E4 S4 R4 V4 */

        :root {
          --color-paper:     oklch(11% 0.04 140);
          --color-paper-2:   oklch(17% 0.04 135);
          --color-ink:       oklch(93% 0.025 82);
          --color-ink-2:     oklch(74% 0.025 82);
          --color-ink-3:     oklch(47% 0.025 90);
          --color-rule:      oklch(28% 0.06 130);
          --color-accent:    oklch(64% 0.09 118);
          --color-focus:     oklch(72% 0.12 118);
          --color-accent-ink: oklch(13% 0.04 140);
          --font-display:    var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, sans-serif;
          --space-xs:  0.75rem;
          --space-sm:  1rem;
          --space-md:  1.5rem;
          --space-lg:  2rem;
          --space-xl:  3rem;
          --space-2xl: 4.5rem;
          --ease-out:  cubic-bezier(0.16, 1, 0.3, 1);
          --dur-short: 180ms;
        }

        html { scroll-behavior: smooth; overflow-x: clip; }
        body { overflow-x: clip; }

        /* ─── Hero ─── */
        .lp-hero {
          min-height: 82vh;
          display: flex;
          align-items: center;
          max-width: 860px;
          margin: 0 auto;
          width: 100%;
        }
        .lp-hero-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 44px;
          align-items: center;
          width: 100%;
          padding-bottom: 40px;
        }
        @media (max-width: 680px) {
          .lp-hero-grid {
            grid-template-columns: 1fr;
            gap: 28px;
          }
          .lp-hero-left  { order: 1; }
          .lp-hero-right { order: 2; }
        }

        /* ─── Hero left ─── */
        .lp-h1 {
          font-size: clamp(24px, 4vw, 40px);
          font-weight: 800;
          color: var(--color-ink);
          margin: 0 0 18px;
          line-height: 1.28;
          letter-spacing: -0.7px;
          font-style: normal;
          text-shadow: 0 1px 8px rgba(0,0,0,0.45);
          overflow-wrap: anywhere;
          min-width: 0;
        }
        .lp-lead {
          font-size: 14px;
          color: var(--color-ink-2);
          line-height: 1.9;
          margin: 0 0 24px;
          text-shadow: 0 1px 5px rgba(0,0,0,0.35);
        }

        /* ─── Contents list ─── */
        .lp-toc {
          margin: 0;
          padding: 16px 0 0;
        }
        .lp-toc-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--color-ink-3);
          margin: 0 0 10px;
          font-style: normal;
        }
        .lp-toc-list {
          font-size: 12px;
          line-height: 1.9;
          margin: 0;
          list-style: none;
          padding: 0;
        }
        .lp-toc-list li::before {
          content: "— ";
          color: var(--color-accent);
          opacity: 0.7;
        }
        .lp-toc-list a {
          color: var(--color-ink-3);
          text-decoration: none;
          transition: color var(--dur-short) var(--ease-out);
        }
        .lp-toc-list a:hover {
          color: var(--color-ink-2);
        }
        .lp-toc-list a:focus-visible {
          outline: 2px solid var(--color-focus);
          outline-offset: 2px;
          border-radius: 2px;
        }

        /* ─── Login card ─── */
        .lp-card {
          background: var(--color-paper);
          border-radius: 16px;
          padding: 26px 22px 22px;
          box-shadow:
            0 8px 48px rgba(0, 10, 5, 0.62),
            0 2px 12px rgba(0, 0, 0, 0.40);
          border: 1.5px solid var(--color-rule);
          border-top: 2px solid var(--color-accent);
          box-sizing: border-box;
        }
        @media (max-width: 480px) {
          .lp-card { padding: 22px 18px 18px; }
        }
        .lp-card-brand {
          font-size: 17px;
          font-weight: 700;
          color: var(--color-accent);
          margin: 0 0 5px;
          letter-spacing: -0.3px;
          line-height: 1.2;
          font-style: normal;
        }
        .lp-card-sub {
          font-size: 12px;
          color: var(--color-ink-3);
          margin: 0 0 20px;
          line-height: 1.65;
        }

        /* ─── Form elements ─── */
        .lp-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 4px 0 14px;
        }
        .lp-divider-line  { flex: 1; height: 1px; background: var(--color-rule); }
        .lp-divider-label { font-size: 11px; color: var(--color-ink-3); white-space: nowrap; }
        .lp-input {
          width: 100%;
          padding: 11px 13px;
          border: 1.5px solid var(--color-rule);
          border-radius: 10px;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
          margin-bottom: 10px;
          font-family: var(--font-display);
          background: var(--color-paper-2);
          color: var(--color-ink);
          transition: border-color var(--dur-short) var(--ease-out), box-shadow var(--dur-short) var(--ease-out);
        }
        .lp-input::placeholder {
          color: var(--color-ink-3);
        }
        .lp-input:focus {
          border-color: var(--color-focus);
          box-shadow: 0 0 0 2px oklch(72% 0.12 118 / 0.18);
        }
        .lp-submit {
          width: 100%;
          padding: 12px;
          background: var(--color-accent);
          color: var(--color-accent-ink);
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          font-family: var(--font-display);
          transition: background var(--dur-short) var(--ease-out);
        }
        .lp-submit:hover { background: var(--color-focus); }
        .lp-submit:focus-visible {
          outline: 2px solid var(--color-focus);
          outline-offset: 2px;
        }
        .lp-submit:active { opacity: 0.88; }

        /* ─── Admin accordion ─── */
        .lp-admin {
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid var(--color-rule);
        }
        .lp-admin > summary {
          cursor: pointer;
          font-size: 11px;
          color: var(--color-ink-3);
          user-select: none;
          list-style: none;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 0;
          width: fit-content;
          transition: color var(--dur-short) var(--ease-out);
        }
        .lp-admin > summary:hover { color: var(--color-ink-2); }
        .lp-admin > summary:focus-visible {
          outline: 2px solid var(--color-focus);
          outline-offset: 2px;
          border-radius: 2px;
        }
        .lp-admin > summary::-webkit-details-marker { display: none; }
        .lp-admin > summary::marker { display: none; }
        .lp-admin[open] > summary { margin-bottom: 16px; }
        .lp-chevron { font-size: 9px; transition: transform var(--dur-short) var(--ease-out); }
        .lp-admin[open] .lp-chevron { transform: rotate(180deg); }

        /* ─── Section spacing after hero ─── */
        .lp-hero-spacer {
          max-width: 860px;
          margin: 0 auto;
          width: 100%;
          padding-bottom: 20px;
        }

        /* ─── Section wrappers ─── */
        .lp-section {
          max-width: 620px;
          margin: 0 auto;
          width: 100%;
          padding-top: 64px;
        }
        .lp-section--narrow { max-width: 560px; }

        .lp-section-h2 {
          font-size: 19px;
          font-weight: 700;
          color: var(--color-ink);
          margin: 0 0 14px;
          line-height: 1.4;
          letter-spacing: -0.25px;
          font-style: normal;
          text-shadow: 0 1px 6px rgba(0,0,0,0.40);
        }
        .lp-section-body {
          font-size: 13px;
          color: var(--color-ink-2);
          line-height: 1.9;
          margin: 0 0 22px;
          text-shadow: 0 1px 4px rgba(0,0,0,0.28);
        }
        .lp-section-note {
          margin-top: 12px;
          font-size: 11px;
          color: var(--color-ink-3);
          line-height: 1.72;
        }

        /* ─── Feature cards ─── */
        .lp-cards {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 640px) {
          .lp-cards { grid-template-columns: 1fr; gap: 8px; }
        }
        .lp-card-feature {
          background: var(--color-paper-2);
          border: 1px solid var(--color-rule);
          border-radius: 10px;
          padding: 18px 16px 20px;
        }
        .lp-card-feature-tag {
          font-size: 10px;
          font-weight: 600;
          color: var(--color-accent);
          margin: 0 0 9px;
          letter-spacing: 0.2px;
        }
        .lp-card-feature-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-ink);
          margin: 0 0 9px;
          line-height: 1.45;
        }
        .lp-card-feature-body {
          font-size: 12px;
          color: var(--color-ink-2);
          line-height: 1.82;
          margin: 0;
        }

        /* ─── Steps ─── */
        .lp-step {
          display: grid;
          grid-template-columns: 40px 1fr;
          gap: 16px;
          align-items: start;
          padding: 20px 0;
          border-top: 1px solid var(--color-rule);
        }
        .lp-step:last-child { border-bottom: 1px solid var(--color-rule); }
        .lp-step-num {
          font-size: 26px;
          font-weight: 800;
          color: var(--color-accent);
          opacity: 0.75;
          line-height: 1.15;
          letter-spacing: -1.5px;
          font-style: normal;
        }
        .lp-step-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-ink);
          margin: 0 0 6px;
          line-height: 1.4;
          text-shadow: 0 1px 5px rgba(0,0,0,0.35);
        }
        .lp-step-body {
          font-size: 12px;
          color: var(--color-ink-2);
          line-height: 1.8;
          margin: 0;
        }

        /* ─── LINE items ─── */
        .lp-line-item {
          padding: 20px 0;
          border-top: 1px solid var(--color-rule);
        }
        .lp-line-item:last-child { border-bottom: 1px solid var(--color-rule); }
        .lp-line-item-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-ink);
          margin: 0 0 6px;
          text-shadow: 0 1px 5px rgba(0,0,0,0.35);
        }
        .lp-line-item-body {
          font-size: 12px;
          color: var(--color-ink-2);
          line-height: 1.8;
          margin: 0;
          max-width: 480px;
        }

        /* ─── Sample block ─── */
        .lp-sample-block {
          background: var(--color-paper-2);
          border: 1px solid var(--color-rule);
          border-radius: 12px;
          padding: 24px 22px 26px;
        }
        .lp-sample-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-accent);
          text-decoration: none;
          border-bottom: 1px solid oklch(64% 0.09 118 / 0.38);
          padding-bottom: 2px;
          transition:
            color var(--dur-short) var(--ease-out),
            border-color var(--dur-short) var(--ease-out);
          white-space: nowrap;
        }
        .lp-sample-link:hover {
          color: var(--color-focus);
          border-color: oklch(72% 0.12 118 / 0.55);
        }
        .lp-sample-link:focus-visible {
          outline: 2px solid var(--color-focus);
          outline-offset: 2px;
          border-radius: 2px;
        }

        /* ─── Bottom CTA button ─── */
        .lp-cta-btn {
          display: inline-flex;
          align-items: center;
          padding: 13px 28px;
          background: var(--color-ink);
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          color: oklch(13% 0.04 140);
          text-decoration: none;
          font-family: var(--font-display);
          transition: background var(--dur-short) var(--ease-out);
          white-space: nowrap;
        }
        .lp-cta-btn:hover { background: oklch(98% 0.015 80); }
        .lp-cta-btn:focus-visible {
          outline: 2px solid var(--color-focus);
          outline-offset: 2px;
        }
        .lp-cta-btn:active { opacity: 0.88; }

        /* ─── Footer ─── */
        .lp-footer-link {
          font-size: 11px;
          color: var(--color-ink-3);
          text-decoration: none;
          border-bottom: 1px solid oklch(47% 0.025 90 / 0.28);
          padding-bottom: 1px;
          transition: color var(--dur-short) var(--ease-out);
        }
        .lp-footer-link:hover { color: var(--color-ink-2); }
        .lp-footer-link:focus-visible {
          outline: 2px solid var(--color-focus);
          outline-offset: 2px;
          border-radius: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            transition-duration: 0ms !important;
            animation-duration: 0ms !important;
          }
        }
      `}</style>

      <AnalyticsPageView pagePath="/login" />
      <BackgroundLayer overlayStrength="medium" fixedBg="/images/bg-14.jpg.jpg" />

      <main style={{ minHeight: "100vh", padding: "0 20px 80px", fontFamily: "var(--font-display)" }}>

        {/* ── Hero ── */}
        <div className="lp-hero">
          <div className="lp-hero-grid">

            {/* Left: headline + body + TOC */}
            <div className="lp-hero-left">
              <h1 className="lp-h1">
                植物の世話を、<br />
                ひとりで悩まないために。
              </h1>
              <p className="lp-lead">
                水やり、肥料、葉の変化。育てている植物の種類と写真をもとに、その植物に合ったヒントを受け取れます。毎日きっちり管理するというより、気になったときに少しずつ様子を残していけます。
              </p>
              <div className="lp-toc">
                <p className="lp-toc-label">このページで分かること</p>
                <ul className="lp-toc-list">
                  {CONTENTS.map((c) => (
                    <li key={c.anchor}>
                      <a href={c.anchor}>{c.text}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right: login card */}
            <div className="lp-hero-right">
              <div className="lp-card">
                <p className="lp-card-brand">Plant Careをはじめる</p>
                <p className="lp-card-sub">LINEログインで、植物の記録と相談をはじめられます。</p>

                {lineError && (
                  <p style={{
                    fontSize: 13,
                    color: "oklch(74% 0.16 24)",
                    background: "oklch(22% 0.06 24)",
                    border: "1px solid oklch(32% 0.10 24)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    margin: "0 0 14px",
                    lineHeight: 1.65,
                  }}>
                    {lineError}
                  </p>
                )}

                {params.sent ? (
                  <div>
                    <p style={{ fontSize: 14, color: "var(--color-accent)", lineHeight: 1.8, margin: "0 0 10px" }}>
                      メールを送信しました。<br />
                      届いたリンクを開くと、あなたのガーデンに入れます。
                    </p>
                    <p style={{ fontSize: 12, color: "var(--color-ink-3)", lineHeight: 1.65, margin: 0 }}>
                      メールが届かない場合は、迷惑メールフォルダをご確認ください。
                    </p>
                  </div>
                ) : (
                  <>
                    <LineSignInButton />
                    <details className="lp-admin">
                      <summary>
                        管理者・開発者向けログイン
                        <span className="lp-chevron">▾</span>
                      </summary>
                      <GoogleSignInButton />
                      <div className="lp-divider">
                        <div className="lp-divider-line" />
                        <span className="lp-divider-label">またはメールで続ける</span>
                        <div className="lp-divider-line" />
                      </div>
                      <form action={sendMagicLink}>
                        <input
                          type="email"
                          name="email"
                          placeholder="メールアドレス"
                          required
                          className="lp-input"
                        />
                        <button type="submit" className="lp-submit">
                          リンクを送る
                        </button>
                      </form>
                      <p style={{ fontSize: 12, color: "var(--color-ink-3)", lineHeight: 1.65, margin: "10px 0 0" }}>
                        パスワード不要。届いたリンクを開くとガーデンに入れます。
                      </p>
                    </details>
                  </>
                )}

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--color-rule)" }}>
                  <p style={{ fontSize: 11, color: "var(--color-ink-3)", margin: 0, lineHeight: 1.65 }}>
                    共有リンクを受け取った方はログイン不要です。リンクから直接開いてください。
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div className="lp-hero-spacer" />

        {/* ── Section 1: できること ── */}
        <div id="features" className="lp-section">
          <h2 className="lp-section-h2">Plant Care でできること</h2>
          <div className="lp-cards">
            {FEATURES.map((f) => (
              <div key={f.title} className="lp-card-feature">
                <p className="lp-card-feature-title">{f.title}</p>
                <p className="lp-card-feature-body">{f.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 2: 植物ごとのケアヒント例 ── */}
        <div id="care-hints" className="lp-section">
          <h2 className="lp-section-h2">植物によって、気にかけることは違う</h2>
          <p className="lp-section-body">
            サボテン、ハーブ、観葉植物など、植物ごとに水やりや肥料、見るポイントは違います。種類と写真をもとに、それぞれに合ったヒントをお知らせします。
          </p>
          <div className="lp-cards">
            {[
              { plant: "サボテン・多肉植物", hint: "土がしっかり乾いてから水やりを。乾燥気味のほうが安心です。水のあげすぎには注意が必要です。" },
              { plant: "ハーブ",             hint: "葉が混み合ってきたら、収穫や切り戻しのタイミングかもしれません。乾燥しすぎるとすぐ元気がなくなります。" },
              { plant: "観葉植物",           hint: "葉の色や張り、置き場所の光を気にかけます。季節によって日当たりを変えてみるのもよさそうです。" },
            ].map((ex) => (
              <div key={ex.plant} className="lp-card-feature">
                <p className="lp-card-feature-tag">{ex.plant}</p>
                <p className="lp-card-feature-body">{ex.hint}</p>
              </div>
            ))}
          </div>
          <p className="lp-section-note">
            ※ ヒントは植物の種類と記録をもとに生成されます。断定ではなく、気にかけるきっかけとしてお使いください。
          </p>
        </div>

        {/* ── Section 3: 使い方 ── */}
        <div id="how-it-works" className="lp-section lp-section--narrow">
          <h2 className="lp-section-h2">使い方はかんたんです</h2>
          <div>
            {STEPS.map((step) => (
              <div key={step.n} className="lp-step">
                <span className="lp-step-num">{step.n}</span>
                <div>
                  <p className="lp-step-title">{step.title}</p>
                  <p className="lp-step-body">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 4: LINEでできること ── */}
        <div id="line" className="lp-section lp-section--narrow">
          <h2 className="lp-section-h2">LINEでできること</h2>
          <p className="lp-section-body">
            LINEログインで始めると、アプリを毎日開かなくてもLINEを入口にして使えます。
          </p>
          <div>
            {LINE_FEATURES.map((item) => (
              <div key={item.title} className="lp-line-item">
                <p className="lp-line-item-title">{item.title}</p>
                <p className="lp-line-item-body">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="lp-section-note">
            LINEログインとLINE通知は別々に設定できます。まずはWebだけで始めても大丈夫です。
          </p>
        </div>

        {/* ── Section 5: サンプル ── */}
        <div id="sample" className="lp-section lp-section--narrow">
          <div className="lp-sample-block">
            <h2 className="lp-section-h2" style={{ marginBottom: 10, textShadow: "none" }}>
              ログイン前に、使い心地を確認できます
            </h2>
            <p style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.8, margin: "0 0 18px" }}>
              サンプルの植物ページを公開しています。どんなヒントが届くか、どんな見え方になるか、登録前に確認できます。
            </p>
            <TrackableSampleLink href={SAMPLE_URL} className="lp-sample-link">
              サンプルの植物ページを見る <span style={{ fontSize: 10 }}>↗</span>
            </TrackableSampleLink>
          </div>
        </div>

        {/* ── Section 6: Get started ── */}
        <div id="get-started" className="lp-section lp-section--narrow">
          <h2 className="lp-section-h2">LINEで始められます</h2>
          <p className="lp-section-body">
            LINEアカウントでログインできます。メールアドレスの入力は不要です。
          </p>
          <p className="lp-section-body" style={{ marginTop: -10 }}>
            まずはWebだけで使い始めても大丈夫です。朝のLINE通知は、ログイン後にいつでも設定できます。
          </p>
          <a href="/api/auth/line/authorize" className="lp-cta-btn">
            LINEで始める
          </a>
        </div>

        {/* ── Footer ── */}
        <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", paddingTop: 48, paddingBottom: 8 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link href="/privacy" className="lp-footer-link">プライバシーポリシー</Link>
            <Link href="/terms" className="lp-footer-link">利用規約</Link>
          </div>
        </div>

      </main>
    </>
  );
}
