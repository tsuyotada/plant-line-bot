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
          background: rgba(255, 255, 255, 0.15) !important;
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

      {/* ── Control bar — owner only, top edge, blends into bg ── */}
      {props.mode === "owner" && (
        <div
          style={{
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            background: "transparent",
            fontFamily: ff,
          }}
        >
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: 0.3, textShadow: "0 1px 4px rgba(0,0,0,0.40)" }}>
            オーナーとして管理中
          </span>

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
                style={ctrlBtn}
              >
                リセット
              </button>
            )}
            <span
              style={{
                display: "inline-block",
                width: 1,
                height: 12,
                background: "rgba(255,255,255,0.25)",
                margin: "0 6px",
                flexShrink: 0,
              }}
            />
            <form
              action={props.signOutAction}
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              <button type="submit" style={ctrlBtn}>
                ログアウト
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Hero — directly over bg photo ── */}
      <div style={{ padding: "12px 20px 20px", fontFamily: ff }}>
        {props.mode === "owner" ? (
          <GardenTitleEditor
            name={props.householdName}
            updateAction={props.updateNameAction}
          />
        ) : (
          <span
            style={{
              display: "block",
              fontSize: 52,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: -1.5,
              lineHeight: 1.0,
              textShadow: "0 2px 12px rgba(0,0,0,0.55), 0 0 32px rgba(0,0,0,0.25)",
            }}
          >
            {props.householdName}
          </span>
        )}

        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "rgba(255,255,255,0.82)",
            margin: "6px 0 0",
            letterSpacing: 2.5,
            textTransform: "uppercase",
            textShadow: "0 1px 6px rgba(0,0,0,0.45)",
            lineHeight: 1,
          }}
        >
          {props.mode === "owner"
            ? "Home Plant Journal"
            : "わが家の植物ページ · 共有リンクで表示中"}
        </p>
      </div>
    </>
  );
}

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
  color: "rgba(255, 255, 255, 0.60)",
  textShadow: "0 1px 4px rgba(0,0,0,0.40)",
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
          display: "block",
          fontSize: 52,
          fontWeight: 800,
          color: "#ffffff",
          background: "rgba(255, 255, 255, 0.15)",
          border: "1.5px solid rgba(255, 255, 255, 0.60)",
          borderRadius: 8,
          padding: "0 10px",
          outline: "none",
          width: 400,
          maxWidth: "100%",
          letterSpacing: -1.5,
          lineHeight: 1.15,
          fontFamily: ff,
          boxSizing: "border-box",
          textShadow: "0 2px 12px rgba(0,0,0,0.55)",
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
        fontSize: 52,
        fontWeight: 800,
        color: "#ffffff",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "0 6px",
        borderRadius: 8,
        letterSpacing: -1.5,
        lineHeight: 1.0,
        fontFamily: ff,
        opacity: isPending ? 0.7 : 1,
        textShadow: "0 2px 12px rgba(0,0,0,0.55), 0 0 32px rgba(0,0,0,0.25)",
      }}
    >
      {name}
    </button>
  );
}
