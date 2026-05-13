"use client";

import { useEffect, useState } from "react";

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

export function BackgroundLayer() {
  const [bgImage, setBgImage] = useState<string | null>(null);

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

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .app-bg-photo { background-image: none !important; }
        }
      `}</style>
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
    </>
  );
}
