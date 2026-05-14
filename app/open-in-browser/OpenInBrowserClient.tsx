"use client";

import { useEffect, useState } from "react";

const ff = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function isLineInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Line\/[\d.]+/i.test(navigator.userAgent);
}

export function OpenInBrowserClient({ nextUrl }: { nextUrl: string }) {
  const [inLine, setInLine] = useState(true); // assume true to avoid flash
  const [liffAvailable, setLiffAvailable] = useState(false);
  const [showCopyFallback, setShowCopyFallback] = useState(false);
  const [copied, setCopied] = useState(false);
  const [absUrl, setAbsUrl] = useState(nextUrl);

  useEffect(() => {
    const resolved = nextUrl.startsWith("http")
      ? nextUrl
      : new URL(nextUrl, window.location.origin).href;
    setAbsUrl(resolved);

    const line = isLineInAppBrowser();
    setInLine(line);

    if (!line) {
      // Already in external browser — proceed directly to the target URL.
      window.location.replace(resolved);
      return;
    }

    // Check LIFF SDK: only usable if already initialized and running inside LINE client.
    const liff = (window as any).liff;
    if (
      liff &&
      typeof liff.isInClient === "function" &&
      liff.isInClient() &&
      typeof liff.openWindow === "function"
    ) {
      setLiffAvailable(true);
    } else {
      // LIFF not available — show copy UI immediately.
      setShowCopyFallback(true);
    }
  }, [nextUrl]);

  function handleOpenExternal(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const liff = (window as any).liff;
    if (
      liff &&
      typeof liff.isInClient === "function" &&
      liff.isInClient() &&
      typeof liff.openWindow === "function"
    ) {
      try {
        liff.openWindow({ url: absUrl, external: true });
        return;
      } catch {
        // liff.openWindow failed — fall through to copy UI.
      }
    }
    setShowCopyFallback(true);
  }

  async function handleCopy(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(absUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable — URL is visible for manual copy.
    }
  }

  // Brief loading state while checking UA (avoids layout flash on external browser redirect)
  if (!inLine) {
    return (
      <div style={{ fontFamily: ff, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#6b7280", fontSize: 14 }}>移動しています...</p>
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        fontFamily: ff,
        background: "#f6faf6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "36px 28px 28px",
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 4px 24px rgba(30,60,40,0.12)",
          border: "1px solid rgba(163,196,160,0.5)",
        }}
      >
        <div style={{ fontSize: 40, textAlign: "center", marginBottom: 14 }}>🌿</div>

        <h1
          style={{
            fontSize: 19,
            fontWeight: 800,
            color: "#1a3320",
            textAlign: "center",
            margin: "0 0 10px",
            letterSpacing: -0.3,
          }}
        >
          外部ブラウザで開いてください
        </h1>

        <p
          style={{
            fontSize: 13,
            color: "#4b5563",
            lineHeight: 1.75,
            margin: "0 0 20px",
            textAlign: "center",
          }}
        >
          LINEブラウザではGoogleログイン・メール認証が
          <br />
          ご利用いただけません。
        </p>

        {/* Step-by-step instructions */}
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #c8e6cc",
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 20,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: "#2d4a3e", margin: "0 0 6px" }}>
            手順
          </p>
          <ol
            style={{
              fontSize: 12,
              color: "#4b5563",
              lineHeight: 1.9,
              margin: 0,
              paddingLeft: 18,
            }}
          >
            <li>画面右上の <strong>[…]</strong> をタップ</li>
            <li><strong>「ブラウザで開く」</strong> を選ぶ</li>
            <li>外部ブラウザでGoogleログイン</li>
          </ol>
        </div>

        {/* LIFF button — only shown when LIFF SDK is initialized and in LINE client */}
        {liffAvailable && !showCopyFallback && (
          <button
            type="button"
            onClick={handleOpenExternal}
            style={{
              width: "100%",
              padding: "13px 14px",
              background: "#4b7a5a",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: ff,
              marginBottom: 12,
              transition: "background 0.15s",
            }}
          >
            外部ブラウザで開く
          </button>
        )}

        {/* Copy URL fallback */}
        {showCopyFallback && (
          <div>
            <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 8px", lineHeight: 1.65 }}>
              または、このURLをコピーして外部ブラウザで開いてください：
            </p>
            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 11,
                color: "#374151",
                wordBreak: "break-all",
                marginBottom: 10,
                fontFamily: "monospace",
                lineHeight: 1.5,
              }}
            >
              {absUrl}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                width: "100%",
                padding: "11px 14px",
                background: copied ? "#d1fae5" : "#f3f4f6",
                color: copied ? "#065f46" : "#374151",
                border: "1.5px solid",
                borderColor: copied ? "#6ee7b7" : "#d1d5db",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: ff,
                transition: "all 0.2s",
              }}
            >
              {copied ? "コピーしました ✓" : "URLをコピー"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
