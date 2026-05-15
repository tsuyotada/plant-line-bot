import Link from "next/link";
import { BackgroundLayer } from "@/app/BackgroundLayer";

const ff =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const SAMPLE_URL =
  "https://plant-line-bot-forme.vercel.app/share/e66f00d8-ae82-42c9-99ad-d133456d8cb6";

const FEATURES = [
  {
    title: "植物ごとのケアのヒント",
    body: "水やり、肥料、葉の変化のタイミングを、育てている植物の種類に合わせてお知らせします。サボテンと観葉植物では適切なペースが違います。種類と写真をもとに、気にかけるポイントを提案します。",
  },
  {
    title: "写真で変化を残す",
    body: "今日の写真を1枚残しておくと、あとから元気の変化に気づきやすくなります。いつ葉が黄色くなったか、水やりの頻度はどれくらいか。記録が積み重なると、ケアの判断が楽になります。",
  },
  {
    title: "LINEで朝の植物メモ",
    body: "毎朝、今日の気にかけどころをLINEでお届けします。アプリを毎日開かなくても、通知を受け取るだけでケアのリズムが続けられます。必要なときだけ、深く見ればよい。",
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <style>{`
        /* ─── Features grid ─── */
        .about-features {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 18px;
          max-width: 820px;
          margin: 0 auto;
          width: 100%;
        }
        @media (max-width: 680px) {
          .about-features { grid-template-columns: 1fr; gap: 14px; }
        }

        /* ─── Feature card ─── */
        .about-feature-card {
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.20);
          border-radius: 12px;
          padding: 20px 20px 22px;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .about-feature-title {
          font-size: 14px;
          font-weight: 700;
          color: rgba(255,255,255,0.96);
          margin: 0 0 10px;
          line-height: 1.4;
          text-shadow: 0 1px 6px rgba(0,0,0,0.40);
          letter-spacing: -0.1px;
        }
        .about-feature-body {
          font-size: 12px;
          color: rgba(255,255,255,0.72);
          line-height: 1.85;
          margin: 0;
          text-shadow: 0 1px 4px rgba(0,0,0,0.30);
        }

        /* ─── CTAs ─── */
        .about-cta-row {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        @media (max-width: 480px) {
          .about-cta-row { flex-direction: column; align-items: flex-start; gap: 14px; }
        }
        .about-login-btn {
          display: inline-flex;
          align-items: center;
          padding: 10px 22px;
          background: rgba(255,255,255,0.92);
          border-radius: 9px;
          font-size: 14px;
          font-weight: 700;
          color: #1a3320;
          text-decoration: none;
          transition: background 0.15s;
          white-space: nowrap;
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
        .about-back-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: rgba(255,255,255,0.48);
          text-decoration: none;
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
          transition: color 0.15s;
        }
        .about-back-link:hover { color: rgba(255,255,255,0.70); }
      `}</style>

      <BackgroundLayer overlayStrength="medium" />

      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 20px 52px",
          fontFamily: ff,
        }}
      >

        {/* ── Hero ── */}
        <div
          style={{
            maxWidth: 560,
            margin: "0 auto",
            width: "100%",
            paddingBottom: 48,
          }}
        >
          {/* Back link */}
          <Link href="/login" className="about-back-link" style={{ display: "inline-flex", marginBottom: 28 }}>
            ← ログイン画面へ
          </Link>

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
              margin: "0 0 28px",
              letterSpacing: 1.5,
              textShadow: "0 1px 6px rgba(0,0,0,0.50)",
              textTransform: "uppercase",
            }}
          >
            Keep every green healthy.
          </p>

          <p
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.88)",
              lineHeight: 1.85,
              margin: "0 0 28px",
              textShadow: "0 1px 6px rgba(0,0,0,0.40)",
            }}
          >
            水やり、肥料、葉の変化のヒントを、育てている植物の種類と写真をもとにお届けします。
            毎日きっちり管理するというより、気になったときに少しずつ。
            そのくらいの距離感で続けられます。
          </p>

          <div className="about-cta-row">
            <Link href="/login" className="about-login-btn">
              LINEで始める
            </Link>
            <a
              href={SAMPLE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="about-sample-link"
            >
              サンプルを見る
              <span style={{ fontSize: 10 }}>↗</span>
            </a>
          </div>
        </div>

        {/* ── Features ── */}
        <div className="about-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="about-feature-card">
              <p className="about-feature-title">{f.title}</p>
              <p className="about-feature-body">{f.body}</p>
            </div>
          ))}
        </div>

        {/* ── Bottom note ── */}
        <div
          style={{
            maxWidth: 820,
            margin: "36px auto 0",
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.42)",
              margin: 0,
              textShadow: "0 1px 3px rgba(0,0,0,0.25)",
            }}
          >
            LINEアカウントで始められます。メールアドレス不要。
          </p>
          <Link href="/login" className="about-back-link">
            ガーデンを開く →
          </Link>
        </div>

      </main>
    </>
  );
}
