"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

// ============================================================
// 型定義
// ============================================================
interface SitemapItem {
  id: string;
  icon: string;
  label: string;
  color: string;
  lightColor: string;
  desc: string;
  sub: string[];
}

interface NanpenLoaderProps {
  onComplete?: () => void;
}

interface TopPageProps {
  onNavigate: (dest: string) => void;
}

// ============================================================
// サイトマップデータ
// ============================================================
const SITEMAP: SitemapItem[] = [
  {
    id: "map", icon: "🗺️", label: "校内マップ", color: "#FF6B00", lightColor: "#FFF3E0",
    desc: "1F〜6Fの展示を地図で確認", sub: ["フロア切り替え", "教室タップで詳細", "待ち時間表示"],
  },
  {
    id: "news", icon: "📣", label: "お知らせ", color: "#E65100", lightColor: "#FBE9E7",
    desc: "各クラス・実行委員からの最新情報", sub: ["リアルタイム更新", "未読バッジ", "クラス別"],
  },
  {
    id: "exhibits", icon: "🎭", label: "展示一覧", color: "#F57C00", lightColor: "#FFF8E1",
    desc: "全クラスの展示をまとめて見る", sub: ["ジャンル別", "お気に入り", "待ち時間順"],
  },
  {
    id: "schedule", icon: "📅", label: "タイムテーブル", color: "#EF6C00", lightColor: "#FFF3E0",
    desc: "ステージ・イベントのスケジュール", sub: ["体育館ステージ", "屋外エリア", "時間帯"],
  },
  {
    id: "food", icon: "🍱", label: "フード", color: "#BF360C", lightColor: "#FBE9E7",
    desc: "模擬店・フードコートの情報", sub: ["メニュー一覧", "営業時間", "混雑状況"],
  },
  {
    id: "info", icon: "ℹ️", label: "インフォ", color: "#FF8F00", lightColor: "#FFFDE7",
    desc: "アクセス・ルール・お問い合わせ", sub: ["来場ガイド", "注意事項", "緊急連絡先"],
  },
];

// ============================================================
// ローディング画面
// ============================================================
type LoaderPhase = "hanging" | "swing" | "land" | "bounce" | "show";

function NanpenLoader({ onComplete }: NanpenLoaderProps) {
  const [phase, setPhase] = useState<LoaderPhase>("hanging");
  const [progress, setProgress] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(true);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("swing"),  300);
    const t2 = setTimeout(() => setPhase("land"),  3000);
    const t3 = setTimeout(() => setPhase("bounce"), 3450);
    const t4 = setTimeout(() => setPhase("show"),  3900);

    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(interval); return 100; }
        return p + 1.8;
      });
    }, 55);

    const t5 = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onComplete?.(), 700);
    }, 5400);

    return () => {
      [t1, t2, t3, t4, t5].forEach(clearTimeout);
      clearInterval(interval);
    };
  }, [onComplete]);

  const isLanded = (["land", "bounce", "show"] as LoaderPhase[]).includes(phase);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Kaisei+Decol:wght@700&family=Kiwi+Maru:wght@400;500&display=swap');

        @keyframes pendulum {
          0%  { transform: rotate(0deg); }
          6%  { transform: rotate(26deg); }
          18% { transform: rotate(-22deg); }
          30% { transform: rotate(18deg); }
          42% { transform: rotate(-14deg); }
          54% { transform: rotate(10deg); }
          65% { transform: rotate(-6deg); }
          75% { transform: rotate(4deg); }
          84% { transform: rotate(-2deg); }
          92% { transform: rotate(1deg); }
          100%{ transform: rotate(0deg); }
        }
        @keyframes landBounce {
          0%  { transform: translateY(0)     scaleY(1);    }
          28% { transform: translateY(-18px) scaleY(1.05); }
          50% { transform: translateY(0)     scaleY(0.93); }
          70% { transform: translateY(-8px)  scaleY(1.02); }
          88% { transform: translateY(0)     scaleY(0.98); }
          100%{ transform: translateY(0)     scaleY(1);    }
        }
        @keyframes loaderShimmer {
          0%  { background-position: -200% center; }
          100%{ background-position:  200% center; }
        }
        @keyframes pulseRing {
          0%  { transform: scale(0.7); opacity: 0.6; }
          100%{ transform: scale(2.0); opacity: 0;   }
        }
        @keyframes fadeInUp {
          from{ opacity: 0; transform: translateY(18px); }
          to  { opacity: 1; transform: translateY(0);    }
        }
        .pendulum-wrap {
          transform-origin: top center;
          animation: pendulum 2.7s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .land-bounce {
          animation: landBounce 0.75s cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
        }
      `}</style>

      <div style={{
        position: "fixed", inset: 0,
        background: "linear-gradient(160deg, #fff8f0 0%, #ffe8cc 50%, #ffd4a0 100%)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.7s ease",
      }}>
        {/* 背景デコ */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              width: 100 + i * 60, height: 100 + i * 60,
              borderRadius: "50%",
              border: `1.5px solid rgba(255,140,0,${0.05 + i * 0.01})`,
              top: "50%", left: "50%",
              transform: "translate(-50%,-50%)",
            }} />
          ))}
          <div style={{
            position: "absolute", top: "12%", right: "8%",
            width: 20, height: 20, borderRadius: "50%",
            background: "rgba(255,140,0,0.25)",
          }} />
          <div style={{
            position: "absolute", bottom: "22%", left: "10%",
            width: 28, height: 28, borderRadius: 6,
            background: "rgba(255,140,0,0.15)", transform: "rotate(20deg)",
          }} />
        </div>

        {/* パルスリング */}
        <div style={{
          position: "absolute",
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,140,0,0.12) 0%, transparent 70%)",
          animation: "pulseRing 2.4s ease-out infinite",
          pointerEvents: "none",
        }} />

        {/* 振り子エリア */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          height: 350, position: "relative",
          justifyContent: isLanded ? "flex-end" : "flex-start",
        }}>
          {!isLanded && (
            <div
              className={phase === "swing" ? "pendulum-wrap" : ""}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", top: 0 }}
            >
              {/* 画鋲 */}
              <div style={{
                width: 14, height: 14, borderRadius: "50%",
                background: "linear-gradient(135deg, #aaa, #ddd)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)", zIndex: 1,
              }} />
              {/* 糸 */}
              <div style={{
                width: 2.5, height: 100,
                background: "linear-gradient(to bottom, #999, #ccc)",
                borderRadius: 2, marginTop: -2,
              }} />
              {/* なんぺん */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/nanpen.png"
                alt="なんぺん"
                style={{
                  width: 175, height: "auto", marginTop: -4,
                  filter: "drop-shadow(0 8px 24px rgba(255,140,0,0.3))",
                }}
              />
            </div>
          )}

          {isLanded && (
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute", bottom: -8, left: "50%",
                transform: "translateX(-50%)",
                width: 100, height: 18,
                background: "rgba(255,140,0,0.15)",
                borderRadius: "50%", filter: "blur(6px)",
              }} />
              <div className={phase === "bounce" ? "land-bounce" : ""}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/nanpen.png"
                  alt="なんぺん"
                  style={{
                    width: 175, height: "auto",
                    filter: "drop-shadow(0 10px 24px rgba(255,140,0,0.35))",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* タイトル */}
        <div style={{
          marginTop: 12, textAlign: "center",
          animation: "fadeInUp 0.8s ease forwards",
          animationDelay: "3.7s", opacity: 0,
        }}>
          <div style={{
            fontFamily: "'Kaisei Decol', serif",
            fontSize: 36, fontWeight: 700,
            background: "linear-gradient(90deg, #FF4500, #FF8C00, #FFB347, #FF8C00, #FF4500)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            animation: "loaderShimmer 2.5s linear infinite",
            letterSpacing: "0.06em",
          }}>
            南高祭
          </div>
          <div style={{
            fontFamily: "'Kiwi Maru', serif",
            fontSize: 11, color: "#FF8C00",
            marginTop: 4, letterSpacing: "0.2em",
          }}>
            しばらくお待ちください
          </div>
        </div>

        {/* プログレスバー */}
        <div style={{
          marginTop: 28, width: 200, height: 4,
          background: "rgba(255,140,0,0.12)",
          borderRadius: 99, overflow: "hidden",
          animation: "fadeInUp 0.4s ease forwards",
          animationDelay: "0.3s", opacity: 0,
        }}>
          <div style={{
            height: "100%", width: `${Math.min(progress, 100)}%`,
            background: "linear-gradient(90deg, #FF4500, #FF8C00, #FFD54F)",
            borderRadius: 99,
            transition: "width 0.06s linear",
            boxShadow: "0 0 10px rgba(255,140,0,0.5)",
          }} />
        </div>
        <div style={{
          marginTop: 8, fontSize: 11, color: "#FF8C00",
          fontFamily: "'Kiwi Maru', serif",
          animation: "fadeInUp 0.4s ease forwards",
          animationDelay: "0.3s", opacity: 0,
        }}>
          {Math.min(Math.round(progress), 100)}%
        </div>
      </div>
    </>
  );
}

// ============================================================
// トップページ
// ============================================================
function TopPage({ onNavigate }: TopPageProps) {
  const router = useRouter();
  const [nanpenTap, setNanpenTap] = useState<boolean>(false);
  const [footerBounce, setFooterBounce] = useState<number>(0);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const sitemapRef    = useRef<HTMLDivElement>(null);
  const tapCountRef   = useRef<number>(0);
  const tapTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNanpenTap = () => {
    setNanpenTap(true);
    setTimeout(() => setNanpenTap(false), 700);
  };

  const handleFooterNanpenTap = () => {
    setFooterBounce(n => n + 1);
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      router.push('/admin');
      return;
    }
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1500);
  };

  return (
    <div style={{
      width: "100%", minHeight: "100dvh",
      background: "#fff8f0",
      fontFamily: "'Kiwi Maru', serif",
      overflowX: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Kaisei+Decol:wght@700&family=Kiwi+Maru:wght@400;500&display=swap');

        @keyframes float {
          0%, 100%{ transform: translateY(0px) rotate(0deg);    }
          33%     { transform: translateY(-10px) rotate(-1.5deg); }
          66%     { transform: translateY(-5px) rotate(1deg);    }
        }
        @keyframes nanpenJump {
          0%  { transform: translateY(0)     scale(1);       }
          20% { transform: translateY(-26px) scale(1.05, 0.95); }
          45% { transform: translateY(0)     scale(0.92, 1.07); }
          65% { transform: translateY(-10px) scale(1.02, 0.98); }
          82% { transform: translateY(0)     scale(0.97, 1.02); }
          100%{ transform: translateY(0)     scale(1);       }
        }
        @keyframes titleReveal {
          from{ opacity: 0; transform: translateY(28px) skewY(1.5deg); }
          to  { opacity: 1; transform: translateY(0)    skewY(0);      }
        }
        @keyframes cardIn {
          from{ opacity: 0; transform: translateY(20px); }
          to  { opacity: 1; transform: translateY(0);    }
        }
        @keyframes badgePop {
          0%  { transform: scale(0.8); opacity: 0;   }
          70% { transform: scale(1.08);              }
          100%{ transform: scale(1);   opacity: 1;   }
        }
        @keyframes scrollBounce {
          0%, 100%{ transform: translateY(0);  opacity: 0.4; }
          50%     { transform: translateY(8px); opacity: 1;   }
        }
        @keyframes bgShift {
          0%  { background-position: 0%   50%; }
          50% { background-position: 100% 50%; }
          100%{ background-position: 0%   50%; }
        }
        @keyframes decorSpin {
          from{ transform: rotate(0deg);   }
          to  { transform: rotate(360deg); }
        }
        @keyframes shimmerText {
          0%  { background-position: -200% center; }
          100%{ background-position:  200% center; }
        }
        @keyframes decorSpinReverse {
          from{ transform: rotate(0deg);    }
          to  { transform: rotate(-360deg); }
        }
      `}</style>

      {/* ====== ヒーローセクション ====== */}
      <section style={{
        minHeight: "100dvh",
        background: "linear-gradient(160deg, #fff8f0 0%, #ffe8cc 40%, #ffd4a0 70%, #fff0e0 100%)",
        backgroundSize: "300% 300%",
        animation: "bgShift 10s ease infinite",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
        padding: "60px 20px 80px",
        textAlign: "center",
      }}>
        {/* 背景デコ */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div style={{
            position: "absolute", top: "-8%", right: "-12%",
            width: 360, height: 360, borderRadius: "50%",
            border: "2px solid rgba(255,140,0,0.1)",
            animation: "decorSpin 28s linear infinite",
          }} />
          <div style={{
            position: "absolute", bottom: "-6%", left: "-8%",
            width: 260, height: 260, borderRadius: "50%",
            border: "1.5px solid rgba(255,140,0,0.08)",
            animation: "decorSpinReverse 20s linear infinite",
          }} />
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            width: 500, height: 500, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,140,0,0.06) 0%, transparent 70%)",
          }} />
          {/* アクセントドット */}
          <div style={{ position: "absolute", top: "10%", left: "8%",   width: 10, height: 10, borderRadius: "50%", background: "rgba(255,140,0,0.35)" }} />
          <div style={{ position: "absolute", top: "22%", right: "9%",  width: 14, height: 14, borderRadius: "50%", background: "rgba(255,140,0,0.2)"  }} />
          <div style={{ position: "absolute", bottom: "28%", right: "6%", width: 8,  height: 8,  borderRadius: "50%", background: "rgba(255,140,0,0.3)"  }} />
          <div style={{
            position: "absolute", bottom: "18%", left: "5%",
            width: 30, height: 30, borderRadius: 6,
            background: "rgba(255,140,0,0.1)", transform: "rotate(20deg)",
          }} />
        </div>

        {/* 日付バッジ */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,0.75)",
          backdropFilter: "blur(12px)",
          border: "1.5px solid rgba(255,140,0,0.3)",
          borderRadius: 99, padding: "7px 20px",
          marginBottom: 28,
          animation: "badgePop 0.6s ease both",
          boxShadow: "0 4px 20px rgba(255,140,0,0.12)",
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%", background: "#FF6B00",
            boxShadow: "0 0 0 3px rgba(255,107,0,0.2)",
          }} />
          <span style={{
            fontSize: 11, color: "#FF6B00", letterSpacing: "0.12em",
            fontWeight: 500, fontFamily: "'Kiwi Maru', serif",
          }}>
            2025年9月12日（土）・13日（日）
          </span>
        </div>

        {/* なんぺん */}
        <div
          onClick={handleNanpenTap}
          style={{
            marginBottom: 16, cursor: "pointer",
            animation: nanpenTap
              ? "nanpenJump 0.65s cubic-bezier(0.34,1.2,0.64,1)"
              : "float 4s ease-in-out infinite",
            filter: "drop-shadow(0 16px 32px rgba(255,140,0,0.25)) drop-shadow(0 4px 8px rgba(0,0,0,0.08))",
            willChange: "transform",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nanpen.png"
            alt="なんぺん"
            style={{ width: 160, height: "auto", display: "block" }}
          />
        </div>

        {/* タップヒント */}
        <div style={{
          fontSize: 9, color: "rgba(255,140,0,0.45)",
          letterSpacing: "0.18em", marginBottom: 22,
          fontFamily: "'Kiwi Maru', serif",
        }}>
          TAP ME!
        </div>

        {/* メインタイトル */}
        <h1 style={{
          fontFamily: "'Kaisei Decol', serif",
          fontSize: 60, fontWeight: 700, lineHeight: 1.05,
          background: "linear-gradient(135deg, #BF360C, #FF6B00, #FF8C00, #FFB347, #FF8C00, #FF6B00)",
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          animation: "shimmerText 4s linear infinite, titleReveal 0.8s ease both",
          letterSpacing: "0.05em", marginBottom: 6,
        }}>
          南高祭
        </h1>

        <div style={{
          fontFamily: "'Kaisei Decol', serif",
          fontSize: 13, letterSpacing: "0.4em", color: "#FF8C00",
          marginBottom: 14,
          animation: "titleReveal 0.7s ease both", animationDelay: "0.3s",
        }}>
          NANKOSAI
        </div>

        <p style={{
          fontSize: 13, color: "#b36800", lineHeight: 1.95,
          maxWidth: 260, marginBottom: 36,
          fontFamily: "'Kiwi Maru', serif",
          animation: "titleReveal 0.7s ease both", animationDelay: "0.45s",
        }}>
          南高校文化祭へようこそ。<br />
          今年も最高の二日間を一緒に。
        </p>

        {/* CTAボタン */}
        <div style={{
          display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center",
          animation: "titleReveal 0.7s ease both", animationDelay: "0.6s",
        }}>
          <button
            onClick={() => onNavigate("map")}
            style={{
              padding: "14px 32px", borderRadius: 99, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #FF4500, #FF8C00)",
              color: "#fff", fontSize: 13, fontWeight: "bold",
              fontFamily: "'Kiwi Maru', serif",
              boxShadow: "0 8px 24px rgba(255,107,0,0.4)",
              transition: "transform 0.15s, box-shadow 0.15s",
              letterSpacing: "0.04em",
            }}
            onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.95)"; }}
            onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            🗺️ マップを見る
          </button>
          <button
            onClick={() => sitemapRef.current?.scrollIntoView({ behavior: "smooth" })}
            style={{
              padding: "14px 24px", borderRadius: 99, cursor: "pointer",
              background: "rgba(255,255,255,0.75)",
              backdropFilter: "blur(12px)",
              border: "1.5px solid rgba(255,140,0,0.35)",
              color: "#FF6B00", fontSize: 13, fontWeight: "bold",
              fontFamily: "'Kiwi Maru', serif",
              transition: "transform 0.15s",
            }}
            onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.95)"; }}
            onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            ↓ コンテンツ一覧
          </button>
        </div>

        {/* スクロールヒント */}
        <div style={{
          position: "absolute", bottom: 28,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        }}>
          <span style={{ fontSize: 8, color: "rgba(255,140,0,0.35)", letterSpacing: "0.2em" }}>SCROLL</span>
          <div style={{
            width: 1.5, height: 32,
            background: "linear-gradient(to bottom, rgba(255,140,0,0.5), transparent)",
            animation: "scrollBounce 1.8s ease-in-out infinite",
          }} />
        </div>
      </section>

      {/* ====== サイトマップセクション ====== */}
      <section ref={sitemapRef} style={{
        padding: "52px 16px 64px",
        background: "linear-gradient(180deg, #fff3e6 0%, #fff8f0 100%)",
      }}>
        {/* セクションタイトル */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 14, marginBottom: 10,
          }}>
            <div style={{ height: 1.5, width: 40, background: "linear-gradient(to right, transparent, #FF8C00)" }} />
            <span style={{
              fontFamily: "'Kaisei Decol', serif",
              fontSize: 24, fontWeight: 700, color: "#FF6B00", letterSpacing: "0.06em",
            }}>
              コンテンツ
            </span>
            <div style={{ height: 1.5, width: 40, background: "linear-gradient(to left, transparent, #FF8C00)" }} />
          </div>
          <p style={{ fontSize: 11, color: "#FFAB5E", letterSpacing: "0.12em" }}>
            南高祭のすべてがここに
          </p>
        </div>

        {/* カードリスト */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 12,
          maxWidth: 480, margin: "0 auto",
        }}>
          {SITEMAP.map((item, i) => (
            <div
              key={item.id}
              onClick={() => onNavigate(item.id)}
              onPointerEnter={() => setHoveredCard(item.id)}
              onPointerLeave={() => setHoveredCard(null)}
              style={{
                background: hoveredCard === item.id ? item.lightColor : "#fff",
                borderRadius: 16,
                padding: "16px 18px",
                border: `1.5px solid ${hoveredCard === item.id ? item.color + "55" : item.color + "20"}`,
                cursor: "pointer",
                transform: hoveredCard === item.id ? "translateX(5px)" : "translateX(0)",
                transition: "all 0.2s ease",
                boxShadow: hoveredCard === item.id
                  ? `0 8px 28px ${item.color}25, 4px 0 0 ${item.color} inset`
                  : "0 2px 12px rgba(0,0,0,0.04)",
                animation: "cardIn 0.5s ease both",
                animationDelay: `${i * 0.08}s`,
                display: "flex", alignItems: "center", gap: 14,
                position: "relative", overflow: "hidden",
              }}
            >
              {/* 背景デコ */}
              <div style={{
                position: "absolute", right: -20, top: "50%",
                transform: "translateY(-50%)",
                width: hoveredCard === item.id ? 100 : 80,
                height: hoveredCard === item.id ? 100 : 80,
                borderRadius: "50%",
                background: `${item.color}08`,
                transition: "all 0.3s",
                pointerEvents: "none",
              }} />

              {/* アイコン */}
              <div style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: `linear-gradient(135deg, ${item.color}18, ${item.color}30)`,
                border: `1.5px solid ${item.color}28`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
                transition: "transform 0.2s",
                transform: hoveredCard === item.id ? "scale(1.1) rotate(-4deg)" : "scale(1)",
              }}>
                {item.icon}
              </div>

              {/* テキスト */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Kaisei Decol', serif",
                  fontSize: 16, fontWeight: 700,
                  color: hoveredCard === item.id ? item.color : "#2a1800",
                  marginBottom: 3, transition: "color 0.2s",
                }}>
                  {item.label}
                </div>
                <div style={{
                  fontSize: 10, color: "#bbb",
                  fontFamily: "'Kiwi Maru', serif", marginBottom: 7,
                }}>
                  {item.desc}
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {item.sub.map((s) => (
                    <span key={s} style={{
                      fontSize: 9, padding: "2px 8px", borderRadius: 99,
                      background: `${item.color}12`, color: item.color,
                      fontFamily: "'Kiwi Maru', serif",
                      border: `1px solid ${item.color}22`,
                    }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* 矢印 */}
              <div style={{
                fontSize: 20, color: `${item.color}70`, flexShrink: 0,
                transform: hoveredCard === item.id ? "translateX(4px)" : "translateX(0)",
                transition: "transform 0.2s",
              }}>
                ›
              </div>
            </div>
          ))}
        </div>

        {/* フッター */}
        <div style={{
          textAlign: "center", marginTop: 56,
          paddingTop: 28, borderTop: "1px solid rgba(255,140,0,0.12)",
        }}>
          <div onClick={handleFooterNanpenTap} style={{ display: "inline-block", cursor: "pointer" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={footerBounce}
              src="/nanpen.png"
              alt="なんぺん"
              style={{
                width: 52, height: "auto", opacity: 0.65, marginBottom: 10,
                filter: "drop-shadow(0 4px 8px rgba(255,140,0,0.2))",
                display: "block",
                animation: footerBounce > 0 ? "nanpenJump 0.65s cubic-bezier(0.34,1.2,0.64,1)" : undefined,
              }}
            />
          </div>
          <div style={{
            fontFamily: "'Kaisei Decol', serif",
            fontSize: 14, color: "#FF8C00", marginBottom: 4,
          }}>
            南高祭 2025
          </div>
          <div style={{ fontSize: 10, color: "#FFD0A0", letterSpacing: "0.15em" }}>
            南高等学校 文化祭実行委員会
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// ページエントリ（app/page.tsx として使用）
// ============================================================
export default function Page() {
  const router = useRouter();
  // SSR との一致のため初期値は false 固定
  const [loaded, setLoaded] = useState<boolean>(false);
  const [checked, setChecked] = useState<boolean>(false);

  // クライアントでのみ sessionStorage を確認
  useEffect(() => {
    const id = setTimeout(() => {
      if (sessionStorage.getItem('nanpen_loaded')) setLoaded(true)
      setChecked(true)
    }, 0)
    return () => clearTimeout(id)
  }, [])

  const handleComplete = () => {
    sessionStorage.setItem('nanpen_loaded', '1')
    setLoaded(true)
  }

  const handleNavigate = (dest: string) => {
    router.push(`${dest}`)
  };

  // sessionStorage 確認前は空白（ハイドレーションのズレを防ぐ）
  if (!checked) return null

  return (
    <>
      {!loaded && <NanpenLoader onComplete={handleComplete} />}
      {loaded && <TopPage onNavigate={handleNavigate} />}
    </>
  );
}