"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const ff =
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
        router.refresh();
      }
    });
  }

  return (
    <>
      <style>{`
        .setup-grid {
          display: grid;
          grid-template-columns: 5fr 8fr;
          gap: 48px;
          align-items: start;
          max-width: 960px;
          margin: 0 auto;
        }
        @media (max-width: 768px) {
          .setup-grid { grid-template-columns: 1fr; gap: 24px; }
          .setup-intro-col { order: 1; }
          .setup-form-col  { order: 2; }
        }
        .setup-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 32px 28px 24px;
          box-shadow: 0 6px 40px rgba(30, 60, 40, 0.22);
          border: 1px solid rgba(163, 196, 160, 0.50);
          box-sizing: border-box;
        }
        @media (max-width: 480px) {
          .setup-card { padding: 24px 20px 20px; }
        }
        .setup-input {
          width: 100%;
          padding: 13px 14px;
          border: 1.5px solid #d1e8d8;
          border-radius: 10px;
          font-size: 15px;
          outline: none;
          box-sizing: border-box;
          margin-bottom: 14px;
          font-family: inherit;
          background: #fff;
          color: #1f2937;
        }
        .setup-input:focus {
          border-color: #6db07b;
          box-shadow: 0 0 0 2px rgba(109, 176, 123, 0.18);
        }
        .setup-input:disabled { opacity: 0.6; cursor: not-allowed; }
        .setup-btn {
          width: 100%;
          padding: 14px;
          background: #4b7a5a;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s;
        }
        .setup-btn:hover:not(:disabled) { background: #3d6649; }
        .setup-btn:disabled { background: #7aaa8a; cursor: not-allowed; }
      `}</style>

      {/* Plant Care hero */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "52px 0 40px" }}>
        <h1
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#ffffff",
            margin: "0 0 8px",
            letterSpacing: -2,
            lineHeight: 1.0,
            textShadow:
              "0 2px 12px rgba(0,0,0,0.55), 0 0 32px rgba(0,0,0,0.25)",
            fontFamily: ff,
          }}
        >
          Plant Care
        </h1>
        <p
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "rgba(255,255,255,0.88)",
            margin: 0,
            letterSpacing: 1.2,
            textShadow: "0 1px 6px rgba(0,0,0,0.50)",
            textTransform: "uppercase",
            fontFamily: ff,
          }}
        >
          Keep every green healthy.
        </p>
      </div>

      {/* 2-column layout */}
      <div className="setup-grid">
        {/* Left: intro text directly on background */}
        <div className="setup-intro-col">
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.88)",
              lineHeight: 1.85,
              margin: "0 0 18px",
              textShadow: "0 1px 5px rgba(0,0,0,0.35)",
              fontFamily: ff,
            }}
          >
            まずは、植物を置いておく場所を作ります。
            <br />
            種類と写真を登録すると、その植物に合わせた
            <br />
            ケアのタイミングを少しずつ調整していきます。
          </p>
          <p
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.58)",
              lineHeight: 1.7,
              margin: 0,
              textShadow: "0 1px 3px rgba(0,0,0,0.25)",
              fontFamily: ff,
            }}
          >
            名前はあとからいつでも変えられます。
          </p>
        </div>

        {/* Right: form card */}
        <div className="setup-form-col">
          <div className="setup-card">
            <h2
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "#1a3320",
                margin: "0 0 6px",
                letterSpacing: -0.3,
                fontFamily: ff,
              }}
            >
              ガーデンを作る
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "#6b7280",
                margin: "0 0 20px",
                lineHeight: 1.6,
                fontFamily: ff,
              }}
            >
              ページの名前を決めてください。
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
                    fontFamily: ff,
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
                className="setup-input"
              />
              <button type="submit" disabled={isPending} className="setup-btn">
                {isPending ? "作成中..." : "はじめる"}
              </button>
            </form>

            {userEmail && (
              <p
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  margin: "16px 0 0",
                  lineHeight: 1.5,
                  fontFamily: ff,
                }}
              >
                ログイン中: {userEmail}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
