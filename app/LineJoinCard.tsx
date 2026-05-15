"use client";

import { useState, useTransition } from "react";

type Props = {
  code: string | null;
  createJoinCodeAction: () => Promise<string | null>;
  revokeJoinCodeAction: () => Promise<void>;
  regenerateJoinCodeAction: () => Promise<string | null>;
};

export function LineJoinCard({
  code: initialCode,
  createJoinCodeAction,
  revokeJoinCodeAction,
  regenerateJoinCodeAction,
}: Props) {
  const [code, setCode] = useState(initialCode);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleCopy() {
    if (!code) return;
    navigator.clipboard.writeText(`参加 ${code}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCreate() {
    startTransition(async () => {
      const newCode = await createJoinCodeAction();
      if (newCode) setCode(newCode);
    });
  }

  function handleRevoke() {
    startTransition(async () => {
      await revokeJoinCodeAction();
      setCode(null);
    });
  }

  function handleRegenerate() {
    startTransition(async () => {
      const newCode = await regenerateJoinCodeAction();
      if (newCode) setCode(newCode);
    });
  }

  return (
    <div
      style={{
        background: "rgba(253, 250, 244, 0.96)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.95)",
        borderRadius: 14,
        padding: 18,
        boxShadow: "0 2px 16px rgba(60, 50, 30, 0.10)",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      <h2
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: "#1a3320",
          margin: "0 0 14px",
          letterSpacing: -0.1,
          lineHeight: 1.3,
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <span
          style={{
            display: "block",
            width: 11,
            height: 11,
            borderRadius: 3,
            background: "#06c755",
            flexShrink: 0,
          }}
        />
        LINEで通知を受け取る
      </h2>

      {code ? (
        <div>
          <p style={{ fontSize: 12, color: "#555", margin: "0 0 12px", lineHeight: 1.7 }}>
            以下の手順でLINEに通知を追加できます。
          </p>

          {/* ── ステップ① ── */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#4b7a5a", margin: "0 0 6px" }}>
              ステップ① 友だち追加
            </p>
            {process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL ? (
              <a
                href={process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 12px",
                  background: "#06c755",
                  color: "#fff",
                  textDecoration: "none",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                Plant Care Bot を友だち追加する
              </a>
            ) : (
              <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
                友だち追加URLが未設定です（NEXT_PUBLIC_LINE_ADD_FRIEND_URL）
              </p>
            )}
          </div>

          {/* ── ステップ② ── */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#4b7a5a", margin: "0 0 6px" }}>
              ステップ② LINEでメッセージを送る
            </p>
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                background: "#f0fdf4",
                borderRadius: 8,
                padding: "8px 10px",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1a3320",
                  fontFamily: "monospace",
                  letterSpacing: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                参加 {code}
              </span>
              <button
                onClick={handleCopy}
                disabled={isPending}
                style={{
                  flexShrink: 0,
                  padding: "4px 10px",
                  background: copied ? "#d1fae5" : "#06c755",
                  color: copied ? "#065f46" : "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                {copied ? "コピー済み" : "コピー"}
              </button>
            </div>
          </div>

          <p style={{ fontSize: 11, color: "#7a8a7a", margin: "0 0 12px", lineHeight: 1.6 }}>
            翌朝からあなたの植物メモが届きます。
          </p>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={handleRegenerate}
              disabled={isPending}
              style={{
                flex: 1,
                padding: "7px 0",
                background: "#fff",
                color: "#4b7a5a",
                border: "1.5px solid #c8e6cc",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              再発行
            </button>
            <button
              onClick={handleRevoke}
              disabled={isPending}
              style={{
                flex: 1,
                padding: "7px 0",
                background: "#fff",
                color: "#b45309",
                border: "1.5px solid #fde68a",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              無効化
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 12, color: "#555", margin: "0 0 12px", lineHeight: 1.6 }}>
            参加コードを使うと、LINEで朝の植物メモを受け取れます。通知はあとから設定しても大丈夫です。
          </p>
          <button
            onClick={handleCreate}
            disabled={isPending}
            style={{
              width: "100%",
              padding: "10px 0",
              background: "#06c755",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {isPending ? "発行中..." : "参加コードを発行"}
          </button>
        </div>
      )}
    </div>
  );
}
