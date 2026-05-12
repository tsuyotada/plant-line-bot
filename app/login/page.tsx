import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase-ssr";

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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)",
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "40px 32px",
          maxWidth: "360px",
          width: "100%",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>🌱</div>
        <h1
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "#1f3a2a",
            margin: "0 0 8px",
          }}
        >
          Plant Care
        </h1>

        {params.sent ? (
          <div>
            <p
              style={{
                color: "#4b7a5a",
                fontSize: "15px",
                lineHeight: 1.6,
                margin: "24px 0 0",
              }}
            >
              メールを送信しました。
              <br />
              受信トレイのリンクをクリックしてログインしてください。
            </p>
          </div>
        ) : (
          <form action={sendMagicLink} style={{ marginTop: "28px" }}>
            <p
              style={{
                color: "#555",
                fontSize: "14px",
                marginBottom: "20px",
              }}
            >
              登録済みのメールアドレスを入力してください。
              <br />
              ログイン用リンクをお送りします。
            </p>
            <input
              type="email"
              name="email"
              placeholder="メールアドレス"
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1.5px solid #d1e8d8",
                borderRadius: "10px",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: "14px",
              }}
            />
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "12px",
                background: "#4b7a5a",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              リンクを送る
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
