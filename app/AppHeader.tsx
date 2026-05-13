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

      {/* Fixed header bar */}
      <header
        style={{
          position: "fixed",
          top: 0, left: 0, right: 0,
          height: 44,
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          background: "rgba(253, 250, 244, 0.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.70)",
          boxShadow: "0 1px 8px rgba(60, 50, 30, 0.08)",
          fontFamily: ff,
        }}
      >
        {/* Left: garden name */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>🌱</span>
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
              <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500 }}>
                わが家の植物ページ
              </span>
              <span style={{ fontSize: 10, color: "#c4b89a" }}>
                共有リンクで表示中
              </span>
            </div>
          )}
        </div>

        {/* Right: owner controls */}
        {props.mode === "owner" && (
          <div
            className="app-header-actions"
            style={{ display: "flex", alignItems: "center", gap: 4 }}
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
                background: "rgba(0,0,0,0.12)",
                margin: "0 6px",
              }}
            />
            <form action={props.signOutAction} style={{ margin: 0 }}>
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

const ctrlBtn: React.CSSProperties = {
  padding: "4px 8px",
  background: "transparent",
  border: "none",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 500,
  cursor: "pointer",
  color: "rgba(60, 90, 60, 0.65)",
  fontFamily: ff,
  lineHeight: 1,
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
          fontSize: 14,
          fontWeight: 800,
          color: "#1a3320",
          background: "rgba(255, 255, 255, 0.85)",
          border: "1.5px solid #a3c4a0",
          borderRadius: 6,
          padding: "2px 8px",
          outline: "none",
          width: 200,
          letterSpacing: -0.2,
          fontFamily: ff,
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={isPending}
      title="クリックしてガーデン名を変更"
      style={{
        fontSize: 14,
        fontWeight: 800,
        color: "#1a3320",
        background: "none",
        border: "none",
        cursor: "text",
        padding: "2px 4px",
        borderRadius: 4,
        letterSpacing: -0.2,
        fontFamily: ff,
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {name}
    </button>
  );
}
