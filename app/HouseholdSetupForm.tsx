"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const fontFamily =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

type Props = {
  createHouseholdAction: (
    formData: FormData
  ) => Promise<{ error: string } | { ok: true }>;
  userEmail: string | null;
};

export function HouseholdSetupForm({ createHouseholdAction, userEmail }: Props) {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAction(formData: FormData) {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await createHouseholdAction(formData);
      if ("error" in result) {
        setErrorMsg(result.error);
      } else {
        // redirect() を使わず router.refresh() で Server Component を再描画
        router.refresh();
      }
    });
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "40px 32px",
        maxWidth: 400,
        width: "100%",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        textAlign: "center",
        fontFamily,
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
      <h1
        style={{ fontSize: 20, fontWeight: 700, color: "#1f3a2a", margin: "0 0 10px" }}
      >
        あなたの植物ページを作りましょう
      </h1>
      <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6, margin: "0 0 24px" }}>
        育てている植物を記録するページを作ります。
        <br />
        名前はあとからいつでも変えられます。
      </p>

      <form action={handleAction}>
        {errorMsg && (
          <p
            style={{
              fontSize: 13,
              color: "#b91c1c",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: "8px 12px",
              margin: "0 0 14px",
              textAlign: "left",
            }}
          >
            {errorMsg}
          </p>
        )}
        <input
          type="text"
          name="name"
          placeholder="例：ベランダの植物、My Garden"
          maxLength={50}
          required
          disabled={isPending}
          style={{
            width: "100%",
            padding: "12px 14px",
            border: "1.5px solid #d1e8d8",
            borderRadius: 10,
            fontSize: 15,
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 14,
            fontFamily: "inherit",
            opacity: isPending ? 0.6 : 1,
            cursor: isPending ? "not-allowed" : "text",
          }}
        />
        <button
          type="submit"
          disabled={isPending}
          style={{
            width: "100%",
            padding: "12px",
            background: isPending ? "#7aaa8a" : "#4b7a5a",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: isPending ? "not-allowed" : "pointer",
            transition: "background 0.2s",
            fontFamily: "inherit",
          }}
        >
          {isPending ? "作成中..." : "はじめる"}
        </button>
      </form>

      {userEmail && (
        <p style={{ fontSize: 12, color: "#9ca3af", margin: "20px 0 0", lineHeight: 1.5 }}>
          ログイン中: {userEmail}
        </p>
      )}
    </div>
  );
}
