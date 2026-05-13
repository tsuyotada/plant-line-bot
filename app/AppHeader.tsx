"use client";

import { useEffect, useRef, useState, useTransition } from "react";

const STORAGE_KEY = "gc-bg-image";
const DEFAULT_BG_LIST = [
  "/images/bg-1.jpg.jpg",
  "/images/bg-2.jpg.jpg",
  "/images/bg-3.jpg.jpg",
  "/images/bg-4.jpg.jpg",
  "/images/bg-5.jpg.jpg",
  "/images/bg-6.jpg.jpg",
  "/images/bg-7.jpg.jpg",
  "/images/bg-8.jpg.jpg",
  "/images/bg-9.jpg.jpg",
  "/images/bg-10.jpg.jpg",
  "/images/bg-11.jpg.jpg",
];

const ff = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

type Props =
  | {
      mode: "owner";
      householdName: string;
      updateNameAction: (name: string) => Promise<void>;
      signOutAction: () => Promise<void>;
    }
  | {
      mode: "share";
      householdName: string;
    };

export function AppHeader(props: Props) {
  const [bgImage, setBgImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const randomDefault =
      DEFAULT_BG_LIST[Math.floor(Math.random() * DEFAULT_BG_LIST.length)];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setBgImage(stored ?? randomDefault);
    } catch {
      setBgImage(randomDefault);
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
          .app-header-actions { display: none !important; }
        }
        .garden-title-btn {
          transition: background 0.15s ease;
        }
        .garden-title-btn:hover:not(:disabled) {
          background: rgba(0, 0, 0, 0.07) !important;
        }
      `}</style>

      {/* Fixed full-screen background */}
      <div
        className="app-bg-photo"
        style={
          bgImage
            ? {
                position: "fixed",
                top: 0, right: 0, bottom: 0, left: 0,
                zIndex: -1,
                backgroundImage: `url("${bgImage}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                position: "fixed",
                top: 0, right: 0, bottom: 0, left: 0,
                zIndex: -1,
                background:
                  "linear-gradient(160deg, #c8dfc4 0%, #a3c4a0 45%, #7aaa78 100%)",
              }
        }
      />

      {/* Header bar — normal document flow (not fixed/sticky) */}
      <header
        style={{
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          background: "rgba(255, 255, 255, 0.32)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.28)",
          fontFamily: ff,
        }}
      >
        {/* Left: garden name — no icon */}
        <div>
          {props.mode === "owner" ? (
            <GardenTitleEditor
              name={props.householdName}
              updateAction={props.updateNameAction}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#1a3320",
                  letterSpacing: -0.2,
                }}
              >
                {props.householdName}
              </span>
              <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 500 }}>
                わが家の植物ページ
              </span>
              <span style={{ fontSize: 10, color: "#9ca3af" }}>
                共有リンクで表示中
              </span>
            </div>
          )}
        </div>

        {/* Right: owner controls — all same height via inline-flex */}
        {props.mode === "owner" && (
          <div
            className="app-header-actions"
            style={{ display: "flex", alignItems: "center", gap: 2 }}
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
              style={ctrlBtn}
            >
              背景を変更
            </button>
            {bgImage && (
              <button
                type="button"
                onClick={handleReset}
                style={{ ...ctrlBtn, color: "#9ca3af" }}
              >
                リセット
              </button>
            )}
            <span
              style={{
                display: "inline-block",
                width: 1,
                height: 14,
                background: "rgba(0,0,0,0.10)",
                margin: "0 6px",
                flexShrink: 0,
              }}
            />
            <form
              action={props.signOutAction}
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              <button type="submit" style={{ ...ctrlBtn, color: "#9ca3af" }}>
                ログアウト
              </button>
            </form>
          </div>
        )}
      </header>
    </>
  );
}

// Shared button style: inline-flex + explicit height keeps all buttons identical
const ctrlBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 28,
  padding: "0 8px",
  background: "transparent",
  border: "none",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 500,
  cursor: "pointer",
  color: "rgba(60, 90, 60, 0.70)",
  fontFamily: ff,
  lineHeight: 1,
  flexShrink: 0,
};

function GardenTitleEditor({
  name,
  updateAction,
}: {
  name: string;
  updateAction: (name: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function startEdit() {
    setValue(name);
    setEditing(true);
  }

  function save() {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      startTransition(() => updateAction(trimmed));
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape") {
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: 28,
          padding: "0 8px",
          fontSize: 14,
          fontWeight: 800,
          color: "#1a3320",
          background: "rgba(255, 255, 255, 0.80)",
          border: "1.5px solid rgba(163, 196, 160, 0.9)",
          borderRadius: 6,
          outline: "none",
          width: 200,
          letterSpacing: -0.2,
          fontFamily: ff,
          boxSizing: "border-box",
          lineHeight: 1,
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="garden-title-btn"
      onClick={startEdit}
      disabled={isPending}
      title="クリックしてガーデン名を変更"
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 28,
        padding: "0 6px",
        fontSize: 14,
        fontWeight: 800,
        color: "#1a3320",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        borderRadius: 6,
        letterSpacing: -0.2,
        fontFamily: ff,
        opacity: isPending ? 0.6 : 1,
        lineHeight: 1,
      }}
    >
      {name}
    </button>
  );
}
