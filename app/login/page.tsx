import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase-ssr";
import { BackgroundLayer } from "@/app/BackgroundLayer";

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
  {
    icon: "🌿",
    title: "植物をまとめて見る",
    desc: "写真つきで、わが家の植物を一覧できます。",
  },
  {
    icon: "📷",
    title: "写真とメモを残す",
    desc: "成長や変化をあとから見返せます。",
  },
  {
    icon: "🔗",
    title: "家族と共有する",
    desc: "共有リンクで、ログインなしでも植物ページを見られます。",
  },
  {
    icon: "💬",
    title: "LINEで受け取る",
    desc: "朝の植物メモを家庭ごとに届けます。",
  },
];

const PREVIEW_PLANTS = [
  {
    bg: "linear-gradient(135deg, #c8e6d0 0%, #a8d4b0 100%)",
    emoji: "🌼",
    name: "カレンジュラ",
    badge: "水やり",
    badgeColor: "#1e40af",
    badgeBg: "#dbeafe",
  },
  {
    bg: "linear-gradient(135deg, #d0e8c8 0%, #b4d4a0 100%)",
    emoji: "🌿",
    name: "ミント",
    badge: "見守り",
    badgeColor: "#1a5c36",
    badgeBg: "#dcf5e4",
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <style>{`
        .login-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          align-items: start;
          max-width: 960px;
          margin: 0 auto;
        }
        @media (max-width: 768px) {
          .login-grid {
            grid-template-columns: 1fr;
          }
          .login-intro-col { order: 2; }
          .login-form-col  { order: 1; }
        }
        .login-card {
          background: rgba(253, 250, 244, 0.97);
          border-radius: 16px;
          padding: 28px 28px 24px;
          box-shadow: 0 2px 20px rgba(60, 50, 30, 0.10);
          border: 1px solid rgba(255, 255, 255, 0.95);
        }
        .feature-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          margin-bottom: 13px;
        }
        .feature-item:last-child { margin-bottom: 0; }
        .login-input {
          width: 100%;
          padding: 11px 13px;
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
          padding: 12px;
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
        .preview-card {
          background: rgba(253, 250, 244, 0.97);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(60, 50, 30, 0.08);
          border: 1px solid rgba(200, 190, 170, 0.30);
          margin-top: 20px;
          font-size: 11px;
          font-family: inherit;
        }
        .preview-header {
          background: #fdfaf4;
          border-bottom: 1px solid rgba(200, 190, 170, 0.25);
          padding: 8px 13px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .preview-body { padding: 11px 13px; }
        .preview-plant-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
          margin-bottom: 10px;
        }
        .preview-plant-card {
          background: #fff;
          border-radius: 7px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(60, 50, 30, 0.07);
        }
        .preview-plant-photo {
          width: 100%;
          aspect-ratio: 5/2;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        .preview-plant-info { padding: 5px 7px 6px; }
      `}</style>

      <BackgroundLayer />

      <main style={{ minHeight: "100vh", padding: "40px 20px 60px", fontFamily: ff }}>
        <div className="login-grid">

          {/* ── Left: service intro ── */}
          <div className="login-intro-col">
            <div className="login-card">

              {/* Hero */}
              <div style={{ marginBottom: 22 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1a3320", margin: "0 0 4px", letterSpacing: -0.5, lineHeight: 1.2 }}>
                  Plant Care
                </h1>
                <p style={{ fontSize: 13, color: "#4b7a5a", fontWeight: 500, margin: "0 0 14px", letterSpacing: 0.3 }}>
                  Keep every green healthy.
                </p>
                <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.8, margin: 0 }}>
                  わが家の植物を、写真とメモで見守る。
                  <br />
                  家族と共有して、LINEでも今日の植物メモを受け取れます。
                </p>
              </div>

              {/* Features */}
              <div style={{ marginBottom: 4 }}>
                {FEATURES.map(({ icon, title, desc }) => (
                  <div key={title} className="feature-item">
                    <span style={{ fontSize: 15, lineHeight: 1.5, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#2d4a3e", marginBottom: 1, lineHeight: 1.4 }}>
                        {title}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.65 }}>
                        {desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mini preview */}
              <div className="preview-card">
                <div className="preview-header">
                  <span style={{ fontWeight: 800, fontSize: 12, color: "#1a3320", letterSpacing: -0.2 }}>
                    My Garden
                  </span>
                  <span style={{ fontSize: 10, color: "#6b7280" }}>オーナーとして管理中</span>
                </div>
                <div className="preview-body">
                  <div className="preview-plant-grid">
                    {PREVIEW_PLANTS.map(({ bg, emoji, name, badge, badgeColor, badgeBg }) => (
                      <div key={name} className="preview-plant-card">
                        <div className="preview-plant-photo" style={{ background: bg }}>
                          <span>{emoji}</span>
                        </div>
                        <div className="preview-plant-info">
                          <div style={{ fontWeight: 700, color: "#2d4a3e", marginBottom: 3, fontSize: 11 }}>{name}</div>
                          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700, background: badgeBg, color: badgeColor }}>
                            {badge}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Today's pick */}
                  <div style={{ background: "#fff", borderRadius: 7, padding: "8px 10px", marginBottom: 8, boxShadow: "0 1px 2px rgba(60,50,30,0.06)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#4b7a5a", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Today's pick
                    </div>
                    <div style={{ fontWeight: 700, color: "#2d4a3e", marginBottom: 2, fontSize: 11 }}>カレンジュラ</div>
                    <div style={{ color: "#374151", lineHeight: 1.55, fontSize: 11 }}>
                      水やりのタイミングです。土の表面が乾いたら、たっぷりと。
                    </div>
                  </div>

                  {/* Footer badges */}
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, color: "#6b7280", background: "#f3f4f6", borderRadius: 5, padding: "2px 7px" }}>
                      🔗 家族に共有済み
                    </span>
                    <span style={{ fontSize: 10, color: "#6b7280", background: "#f3f4f6", borderRadius: 5, padding: "2px 7px" }}>
                      💬 LINE通知 ON
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ── Right: login form ── */}
          <div className="login-form-col">
            <div className="login-card">
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1a3320", margin: "0 0 6px", letterSpacing: -0.2 }}>
                メールでガーデンを開く
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
                <form action={sendMagicLink} style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.75, margin: "0 0 16px" }}>
                    パスワードは不要です。
                    <br />
                    届いたリンクを開くと、あなたのガーデンに入れます。
                  </p>
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
              )}

              <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid #f0ebe2" }}>
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
