"use client";

import { useEffect, useRef, useState } from "react";

/* ============================================================
   南高祭 スクロール・シーケンスLP（連番画像／フレームスクラブ）
   ------------------------------------------------------------
   public/2025/frames/0001.jpg 〜 0121.jpg（121枚）を
   スクロール量に同期して1枚ずつ描画し、動画をコマ送りする。
   ・全フレームをプリロードしてから開始（カクつき防止）
   ・position: sticky な canvas を cover で描画（devicePixelRatio対応）
   ・prefers-reduced-motion: reduce では先頭フレームを静止表示
   ・画像が一部読めなくても onerror で進行
   ============================================================ */

// ===== 設定：ここだけ書き換える =====
const FRAME_COUNT = 121;
const framePath = (i: number) => `/2025/frames/${String(i + 1).padStart(4, "0")}.jpg`;
// スクロール量（vh）。目安：枚数 × 5〜6
const FRAMES_VH = 680;
// ===================================

export default function HistoryLpPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<HTMLElement | null>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentRef = useRef(-1);
  const tickingRef = useRef(false);

  const [progress, setProgress] = useState(0); // 0〜1（ローダー用）
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function drawCover(img: HTMLImageElement | undefined) {
      if (!canvas || !ctx || !img || !img.complete || !img.naturalWidth) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const ir = img.width / img.height;
      const cr = cw / ch;
      let dw: number, dh: number, dx: number, dy: number;
      if (ir > cr) {
        dh = ch;
        dw = ch * ir;
        dx = (cw - dw) / 2;
        dy = 0;
      } else {
        dw = cw;
        dh = cw / ir;
        dx = 0;
        dy = (ch - dh) / 2;
      }
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, dx, dy, dw, dh);
    }

    function draw(idx: number, force = false) {
      idx = Math.max(0, Math.min(FRAME_COUNT - 1, idx));
      if (idx === currentRef.current && !force) return;
      currentRef.current = idx;
      drawCover(imagesRef.current[idx]);
    }

    function resize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      draw(currentRef.current < 0 ? 0 : currentRef.current, true);
    }

    function onScroll() {
      if (reduce || tickingRef.current || !scene) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        const total = scene.offsetHeight - window.innerHeight;
        const p = total > 0 ? -scene.getBoundingClientRect().top / total : 0;
        const clamped = Math.max(0, Math.min(1, p));
        draw(Math.round(clamped * (FRAME_COUNT - 1)));
        tickingRef.current = false;
      });
    }

    let cancelled = false;
    let loaded = 0;
    const images: HTMLImageElement[] = [];

    function start() {
      if (cancelled) return;
      setReady(true);
      resize();
      if (reduce) {
        draw(0, true);
      } else {
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
      }
      window.addEventListener("resize", resize);
    }

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded++;
        setProgress(loaded / FRAME_COUNT);
        if (loaded === FRAME_COUNT) start();
      };
      img.src = framePath(i);
      images.push(img);
    }
    imagesRef.current = images;

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <main style={{ background: "#0b0d12", color: "#fff" }}>
      {/* ローダー */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0d12",
          zIndex: 10,
          opacity: ready ? 0 : 1,
          pointerEvents: ready ? "none" : "auto",
          transition: "opacity .5s ease",
        }}
      >
        <div
          style={{
            width: 200,
            height: 4,
            background: "#222936",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <i
            style={{
              display: "block",
              height: "100%",
              width: `${Math.round(progress * 100)}%`,
              background: "#6aa3ff",
              transition: "width .2s ease",
            }}
          />
        </div>
      </div>

      {/* スクロール領域（高さ＝コマ送りの速さ） */}
      <section
        ref={sceneRef}
        style={{
          position: "relative",
          height: `${FRAMES_VH}vh`,
        }}
        data-reduced-motion-height="100vh"
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            width: "100%",
            overflow: "hidden",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ display: "block", width: "100%", height: "100%" }}
          />
        </div>
      </section>

      {/* prefers-reduced-motion: reduce のときは先頭フレームを静止表示 */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          section[data-reduced-motion-height] { height: 100vh !important; }
        }
      `}</style>
    </main>
  );
}
