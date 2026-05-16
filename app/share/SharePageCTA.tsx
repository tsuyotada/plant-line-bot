"use client";

import Link from "next/link";

export function SharePageCTA() {
  return (
    <>
      <style>{`
        .share-cta-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 20px;
          padding-bottom: max(10px, calc(10px + env(safe-area-inset-bottom)));
          background: rgba(22, 44, 28, 0.90);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid rgba(255,255,255,0.10);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
        }

        .share-cta-label {
          font-size: 12px;
          color: rgba(255,255,255,0.50);
          line-height: 1.5;
          flex: 1;
          min-width: 0;
        }
        .share-cta-label strong {
          display: block;
          font-weight: 700;
          color: rgba(255,255,255,0.75);
          font-size: 12px;
          margin-bottom: 1px;
        }

        .share-cta-btn {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 9px 18px;
          background: rgba(255,255,255,0.92);
          color: #1a3320;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
          transition: background 0.15s;
          line-height: 1;
        }
        .share-cta-btn:hover { background: #ffffff; }

        /* Mobile: hide label, center button */
        @media (max-width: 540px) {
          .share-cta-label { display: none; }
          .share-cta-bar { justify-content: center; }
          .share-cta-btn {
            width: 100%;
            max-width: 320px;
            justify-content: center;
            font-size: 14px;
            padding: 12px 20px;
          }
        }
      `}</style>

      <div className="share-cta-bar" role="complementary" aria-label="Plant Care への案内">
        <div className="share-cta-label">
          <strong>Plant Care</strong>
          自分のガーデンページを作ってみる
        </div>
        <Link href="/login" className="share-cta-btn">
          はじめる →
        </Link>
      </div>
    </>
  );
}
