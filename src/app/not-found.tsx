"use client";

import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(160deg, #fff8f0 0%, #ffe8cc 50%, #ffd4a0 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Kiwi Maru', serif",
      padding: "40px 24px",
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-12px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* 背景デコ */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {[100, 180, 260].map((size, i) => (
          <div key={i} style={{
            position: "absolute",
            width: size, height: size,
            borderRadius: "50%",
            border: `1.5px solid rgba(255,140,0,${0.07 - i * 0.01})`,
            top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
          }} />
        ))}
        <div style={{
          position: "absolute", top: "10%", right: "8%",
          width: 16, height: 16, borderRadius: "50%",
          background: "rgba(255,140,0,0.25)",
        }} />
        <div style={{
          position: "absolute", bottom: "20%", left: "8%",
          width: 24, height: 24, borderRadius: 6,
          background: "rgba(255,140,0,0.15)", transform: "rotate(20deg)",
        }} />
      </div>

      {/* なんぺん */}
      <div style={{
        animation: "float 3.5s ease-in-out infinite",
        filter: "drop-shadow(0 12px 28px rgba(255,140,0,0.3))",
        marginBottom: 24,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nanpen.png"
          alt="なんぺん"
          style={{ width: 140, height: "auto", display: "block" }}
        />
      </div>

      {/* 404 */}
      <div style={{
        fontFamily: "'Kaisei Decol', serif",
        fontSize: 80, fontWeight: 700, lineHeight: 1,
        background: "linear-gradient(135deg, #FF4500, #FF8C00, #FFB347)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        animation: "fadeInUp 0.6s ease both",
        marginBottom: 8,
      }}>
        404
      </div>

      {/* メッセージ */}
      <div style={{
        fontFamily: "'Kaisei Decol', serif",
        fontSize: 18, fontWeight: 700, color: "#FF6B00",
        animation: "fadeInUp 0.6s ease both", animationDelay: "0.1s",
        marginBottom: 8,
      }}>
        ページが見つかりません
      </div>
      <p style={{
        fontSize: 12, color: "#FFAB5E", lineHeight: 1.8,
        maxWidth: 240,
        animation: "fadeInUp 0.6s ease both", animationDelay: "0.2s",
        marginBottom: 36,
      }}>
        お探しのページは移動または削除された可能性があります
      </p>

      {/* ボタン */}
      <div style={{
        width: "100%", maxWidth: 240,
        animation: "fadeInUp 0.6s ease both", animationDelay: "0.3s",
      }}>
        <button
          onClick={() => router.push("/")}
          style={{
            width: "100%", padding: "13px 0", borderRadius: 99, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #FF4500, #FF8C00)",
            color: "#fff", fontSize: 13, fontWeight: "bold",
            fontFamily: "'Kiwi Maru', serif",
            boxShadow: "0 6px 20px rgba(255,107,0,0.35)",
            letterSpacing: "0.04em",
          }}
          onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.96)"; }}
          onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          トップに戻る
        </button>
      </div>
    </div>
  );
}
