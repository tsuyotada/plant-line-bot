"use client";

import { useState, useTransition } from "react";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  shareUrl: string | null;
  linkId: string | null;
  createShareLinkAction: () => Promise<string | null>;
  revokeShareLinkAction: (formData: FormData) => Promise<void>;
  regenerateShareLinkAction: (formData: FormData) => Promise<string | null>;
};

export function ShareLinkCard({
  shareUrl: initialShareUrl,
  linkId,
  createShareLinkAction,
  revokeShareLinkAction,
  regenerateShareLinkAction,
}: Props) {
  const [shareUrl, setShareUrl] = useState(initialShareUrl);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleCopy() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCreate() {
    startTransition(async () => {
      const token = await createShareLinkAction();
      if (token) {
        const base = window.location.origin;
        setShareUrl(`${base}/share/${token}`);
      }
    });
  }

  function handleRevoke() {
    if (!linkId) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("link_id", linkId);
      await revokeShareLinkAction(fd);
      setShareUrl(null);
      setShowQr(false);
    });
  }

  function handleRegenerate() {
    if (!linkId) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("link_id", linkId);
      const token = await regenerateShareLinkAction(fd);
      if (token) {
        const base = window.location.origin;
        setShareUrl(`${base}/share/${token}`);
        setShowQr(false);
      }
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
            background: "#48b06a",
            flexShrink: 0,
          }}
        />
        わが家の植物ページ
      </h2>

      {shareUrl ? (
        <div>
          <p style={{ fontSize: 12, color: "#555", margin: "0 0 10px", lineHeight: 1.6 }}>
            このリンクを家族に送ると、ログインなしでわが家の植物ページを見ることができます。
          </p>
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              background: "#f0fdf4",
              borderRadius: 8,
              padding: "8px 10px",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 11,
                color: "#374151",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "monospace",
              }}
            >
              {shareUrl}
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
          <div style={{ margin: "10px 0" }}>
            <button
              onClick={() => setShowQr((v) => !v)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: 11,
                color: "#4b7a5a",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {showQr ? "QRを隠す" : "QRを表示"}
            </button>
            {showQr && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
                <QRCodeSVG value={shareUrl} size={160} />
              </div>
            )}
          </div>
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
            家族に共有リンクを送ると、ログインなしでわが家の植物ページを見せることができます。
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
            {isPending ? "発行中..." : "リンクを発行する"}
          </button>
        </div>
      )}
    </div>
  );
}
