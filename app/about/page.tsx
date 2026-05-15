import Link from "next/link";
import { BackgroundLayer } from "@/app/BackgroundLayer";

const ff =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const SAMPLE_URL =
  "https://plant-line-bot-forme.vercel.app/share/e66f00d8-ae82-42c9-99ad-d133456d8cb6";

const EXAMPLES = [
  {
    plant: "サボテン・多肉植物",
    hint: "土がしっかり乾いてから水やりを。乾燥気味のほうが安心です。水のあげすぎには注意が必要です。",
  },
  {
    plant: "ハーブ",
    hint: "葉が混み合ってきたら、収穫や切り戻しのタイミングかもしれません。乾燥しすぎるとすぐ元気がなくなります。",
  },
  {
    plant: "観葉植物",
    hint: "葉の色や張り、置き場所の光を気にかけます。季節によって日当たりを変えてみるのもよさそうです。",
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

export default function AboutPage() {
  return (
    <>
      <style>{`
        /* ─── Top bar ─── */
        .about-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 820px;
          margin: 0 auto;
          width: 100%;
          padding: 24px 0 0;
        }
        .about-brand {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          color: rgba(255,255,255,0.38);
          text-shadow: 0 1px 4px rgba(0,0,0,0.30);
          text-transform: uppercase;
        }
        .about-back-link {
          font-size: 11px;
          color: rgba(255,255,255,0.38);
          text-decoration: none;
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
          transition: color 0.15s;
        }
        .about-back-link:hover { color: rgba(255,255,255,0.65); }

        /* ─── Hero ─── */
        .about-hero {
          min-height: 88vh;
          display: flex;
          align-items: center;
          max-width: 620px;
          margin: 0 auto;
          width: 100%;
        }
        .about-hero-inner { padding-bottom: 48px; width: 100%; }
        .about-hero-h1 {
          font-size: 40px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 18px;
          line-height: 1.28;
          letter-spacing: -0.8px;
          text-shadow: 0 2px 12px rgba(0,0,0,0.55), 0 0 32px rgba(0,0,0,0.25);
        }
        @media (max-width: 480px) {
          .about-hero-h1 { font-size: 32px; }
        }
        .about-hero-body {
          font-size: 14px;
          color: rgba(255,255,255,0.78);
          line-height: 1.85;
          margin: 0 0 10px;
          text-shadow: 0 1px 6px rgba(0,0,0,0.40);
          max-width: 500px;
        }
        .about-hero-sample-note {
          font-size: 11px;
          color: rgba(255,255,255,0.45);
          margin: 0 0 22px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }
        .about-hero-line-note {
          margin-top: 14px;
          font-size: 11px;
          color: rgba(255,255,255,0.42);
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }

        /* ─── CTA row ─── */
        .about-cta-row {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .about-login-btn {
          display: inline-flex;
          align-items: center;
          padding: 11px 22px;
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
        .about-login-btn:hover { background: #ffffff; }
        .about-sample-link {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.78);
          text-decoration: none;
          border-bottom: 1px solid rgba(255,255,255,0.40);
          padding-bottom: 2px;
          text-shadow: 0 1px 4px rgba(0,0,0,0.35);
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .about-sample-link:hover {
          color: rgba(255,255,255,0.95);
          border-color: rgba(255,255,255,0.65);
        }

        /* ─── Scroll hint ─── */
        .about-scroll-hint {
          max-width: 620px;
          margin: 0 auto;
          width: 100%;
          padding-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .about-scroll-line {
          flex: none;
          width: 24px;
          height: 1px;
          background: rgba(255,255,255,0.25);
        }
        .about-scroll-text {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.30);
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }

        /* ─── Section common ─── */
        .about-section-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.38);
          margin: 0 0 16px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }
        .about-section-heading {
          font-size: 18px;
          font-weight: 700;
          color: rgba(255,255,255,0.96);
          margin: 0 0 12px;
          line-height: 1.45;
          letter-spacing: -0.2px;
          text-shadow: 0 1px 8px rgba(0,0,0,0.45);
        }
        .about-section-body {
          font-size: 13px;
          color: rgba(255,255,255,0.76);
          line-height: 1.85;
          margin: 0 0 24px;
          text-shadow: 0 1px 5px rgba(0,0,0,0.35);
        }

        /* ─── Example cards ─── */
        .about-examples {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 14px;
          width: 100%;
        }
        @media (max-width: 640px) {
          .about-examples { grid-template-columns: 1fr; gap: 10px; }
        }
        .about-example-card {
          background: rgba(255,255,255,0.09);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 10px;
          padding: 16px 16px 18px;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .about-example-plant {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255,255,255,0.60);
          letter-spacing: 0.5px;
          margin: 0 0 8px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
          text-transform: uppercase;
        }
        .about-example-hint {
          font-size: 12px;
          color: rgba(255,255,255,0.80);
          line-height: 1.75;
          margin: 0;
          text-shadow: 0 1px 4px rgba(0,0,0,0.30);
        }

        /* ─── Steps ─── */
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
          color: rgba(255,255,255,0.28);
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
          color: rgba(255,255,255,0.68);
          line-height: 1.75;
          margin: 0;
          text-shadow: 0 1px 4px rgba(0,0,0,0.28);
        }

        /* ─── Sample block ─── */
        .about-sample-block {
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 12px;
          padding: 24px 24px 26px;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
      `}</style>

      <BackgroundLayer overlayStrength="medium" />

      <main style={{ minHeight: "100vh", padding: "0 20px 80px", fontFamily: ff }}>

        {/* ── Top bar: small brand + back link ── */}
        <div className="about-topbar">
          <span className="about-brand">Plant Care</span>
          <Link href="/login" className="about-back-link">← ログイン画面へ</Link>
        </div>

        {/* ── Hero ── */}
        <div className="about-hero">
          <div className="about-hero-inner">

            <h1 className="about-hero-h1">
              植物の世話を、<br />
              ひとりで悩まないために。
            </h1>

            <p className="about-hero-body">
              水やり、肥料、葉の変化。育てている植物の種類と写真をもとに、その植物に合ったヒントを受け取れます。毎日きっちり管理するというより、気になったときに少しずつ様子を残していけます。
            </p>

            <p className="about-hero-sample-note">
              ログイン前に、実際の植物ページを確認できます。
            </p>

            <div className="about-cta-row">
              <Link href="/login" className="about-login-btn">
                LINEで始める
              </Link>
              <a href={SAMPLE_URL} target="_blank" rel="noopener noreferrer" className="about-sample-link">
                サンプルを見る <span style={{ fontSize: 10 }}>↗</span>
              </a>
            </div>

            <p className="about-hero-line-note">
              LINEアカウントで始められます。朝の通知はあとから設定できます。
            </p>

          </div>
        </div>

        {/* ── Scroll hint ── */}
        <div className="about-scroll-hint">
          <span className="about-scroll-line" />
          <span className="about-scroll-text">植物ごとのケアのヒントについて</span>
        </div>

        {/* ══ Section 1: 植物によって違う ══ */}
        <div style={{ maxWidth: 620, margin: "0 auto", width: "100%", paddingTop: 56 }}>
          <p className="about-section-label">Care Hints</p>
          <h2 className="about-section-heading">植物によって、気にかけることは違う</h2>
          <p className="about-section-body">
            サボテン、ハーブ、観葉植物など、植物ごとに水やりや肥料、見るポイントは違います。
            育てている植物の種類と写真をもとに、それぞれに合ったヒントをお知らせします。
          </p>

          <div className="about-examples">
            {EXAMPLES.map((ex) => (
              <div key={ex.plant} className="about-example-card">
                <p className="about-example-plant">{ex.plant}</p>
                <p className="about-example-hint">{ex.hint}</p>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.7, textShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
            ※ ヒントは植物の種類と記録をもとに生成されます。断定ではなく、気にかけるきっかけとしてお使いください。
          </p>
        </div>

        {/* ══ Section 2: 使い方 ══ */}
        <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", paddingTop: 72 }}>
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

        {/* ══ Section 3: サンプルで確認 ══ */}
        <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", paddingTop: 72 }}>
          <p className="about-section-label">Sample</p>
          <div className="about-sample-block">
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.96)", margin: "0 0 10px", textShadow: "0 1px 6px rgba(0,0,0,0.40)" }}>
              ログイン前に、使い心地を確認できます
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.8, margin: "0 0 18px", textShadow: "0 1px 4px rgba(0,0,0,0.30)" }}>
              サンプルの植物ページを公開しています。どんなヒントが届くか、どんな見え方になるか、登録前に確認できます。
            </p>
            <a href={SAMPLE_URL} target="_blank" rel="noopener noreferrer" className="about-sample-link">
              サンプルの植物ページを見る <span style={{ fontSize: 10 }}>↗</span>
            </a>
          </div>
        </div>

        {/* ══ Section 4: LINEで始める ══ */}
        <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", paddingTop: 72 }}>
          <p className="about-section-label">Get started</p>
          <h2 className="about-section-heading">LINEで始められます</h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.76)", lineHeight: 1.85, margin: "0 0 8px", textShadow: "0 1px 5px rgba(0,0,0,0.35)" }}>
            LINEアカウントでログインできます。メールアドレスの入力は不要です。
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.76)", lineHeight: 1.85, margin: "0 0 28px", textShadow: "0 1px 5px rgba(0,0,0,0.35)" }}>
            まずはWebだけで使い始めても大丈夫です。朝のLINE通知は、ログイン後にいつでも設定できます。LINEログインと朝の通知は、別々に設定できます。
          </p>
          <div className="about-cta-row">
            <Link href="/login" className="about-login-btn">
              LINEで始める
            </Link>
            <Link href="/login" className="about-back-link">
              ログイン画面へ →
            </Link>
          </div>
        </div>

      </main>
    </>
  );
}
