"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "gc-bg-image";

const fontFamily =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const controlBtnStyle: React.CSSProperties = {
  padding: "4px 10px",
  background: "transparent",
  border: "none",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 500,
  cursor: "pointer",
  color: "rgba(80, 100, 80, 0.50)",
  fontFamily,
  lineHeight: 1,
};

export function BackgroundLayer() {
  const [bgImage, setBgImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setBgImage(stored);
    } catch {
      // localStorage unavailable
    }
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      try {
        localStorage.setItem(STORAGE_KEY, dataUrl);
      } catch {
        // quota exceeded — apply in-session only
      }
      setBgImage(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function handleReset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setBgImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .app-bg-photo { background-image: none !important; }
          .app-bg-controls { display: none !important; }
        }
      `}</style>

      {/* Fixed background */}
      <div
        className="app-bg-photo"
        style={
          bgImage
            ? {
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                zIndex: -1,
                backgroundImage: `url("${bgImage}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                zIndex: -1,
                background:
                  "linear-gradient(160deg, #c8dfc4 0%, #a3c4a0 45%, #7aaa78 100%)",
              }
        }
      />

      {/* Background controls — fixed top-right */}
      <div
        className="app-bg-controls"
        style={{
          position: "fixed",
          top: 14,
          right: 18,
          zIndex: 100,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={controlBtnStyle}
        >
          背景を変更
        </button>
        {bgImage && (
          <button
            type="button"
            onClick={handleReset}
            style={{ ...controlBtnStyle, color: "#9ca3af" }}
          >
            リセット
          </button>
        )}
      </div>
    </>
  );
}
