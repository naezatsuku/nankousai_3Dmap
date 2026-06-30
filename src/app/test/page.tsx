"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  type MotionValue,
} from "framer-motion";

/* ============================================================
   南高祭 ヒストリー・スクロール（トップページ案・テスト）
   ------------------------------------------------------------
   ストーリー：これまでの歩み（ポスター）→ 当日 → 後夜祭
   スクロールが進むほど背景が朝→昼→夕→夜へ変化する。
   写真は public/history/ に置けば自動で差し替わる。
   未配置のうちはラベル付きプレースホルダーを表示。
   ============================================================ */

// ─── 写真スロット定義（順番は指定どおり）──────────────────
// src を public/history/ に置いたファイルパスにすると本番画像に差し替わる。
type Slot = { label: string; sub: string; src?: string };

const POSTERS: Slot[] = [
  // ↓ src は仮画像（picsum）。本番は "/history/poster-2024.jpg" 等に差し替える
  { label: "南高祭 2024", sub: "ポスター", src: "https://picsum.photos/seed/nankosai2024/600/800" },
  { label: "南高祭 2025", sub: "ポスター", src: "https://picsum.photos/seed/nankosai2025/600/800" },
  { label: "南高祭 2026", sub: "ポスター — そして、今年へ", src: "https://picsum.photos/seed/nankosai2026/600/800" },
];

// 3Dフライスルー用：ポスター＋年号＋ひとことを束ねたもの（順番＝奥→手前で登場）
const POSTER_ITEMS = [
  { slot: POSTERS[0], year: "2024", note: "はじまりの一枚" },
  { slot: POSTERS[1], year: "2025", note: "受け継がれていく" },
  { slot: POSTERS[2], year: "2026", note: "そして、今年へ —" },
];

const BAND_TRIO: Slot[] = [
  { label: "ライブ", sub: "軽音", src: "/history/day-live.jpg" },
  { label: "バンド", sub: "演奏", src: "/history/day-band.jpg" },
  { label: "吹奏楽", sub: "ステージ", src: "/history/day-brass.jpg" },
];

/* ============================================================
   背景：スクロール全体に同期して朝→昼→夕→夜へ
   ============================================================ */
function SkyBackground({ progress }: { progress: MotionValue<number> }) {
  // 空のベースカラー（backgroundColor は補間できる）
  const sky = useTransform(
    progress,
    [0, 0.2, 0.42, 0.62, 0.78, 1],
    ["#cfe9ff", "#a9d4ff", "#ffe0ad", "#ff9a76", "#5b4a86", "#070713"]
  );
  // 太陽の高さ・色・不透明度
  const sunY = useTransform(progress, [0, 0.5, 0.78], ["12vh", "30vh", "82vh"]);
  const sunColor = useTransform(
    progress,
    [0, 0.45, 0.65, 0.78],
    ["#fffbe6", "#fff0b8", "#ff9d5c", "#ff5e3a"]
  );
  const sunOpacity = useTransform(progress, [0, 0.7, 0.84], [0.95, 0.95, 0]);
  const sunGlow = useTransform(progress, [0, 0.55, 0.78], [40, 90, 160]);
  // 夕焼けグロー
  const duskOpacity = useTransform(progress, [0.5, 0.68, 0.85], [0, 0.7, 0]);
  // 星空
  const starOpacity = useTransform(progress, [0.72, 0.9], [0, 1]);

  return (
    <motion.div className="fixed inset-0 -z-10 overflow-hidden" style={{ backgroundColor: sky }}>
      {/* 夕焼けの地平線グロー */}
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[60vh]"
        style={{
          opacity: duskOpacity,
          background:
            "radial-gradient(120% 80% at 50% 120%, #ff7e5f 0%, #feb47b 30%, transparent 70%)",
        }}
      />
      {/* 太陽 */}
      <motion.div
        className="absolute left-1/2 h-40 w-40 -translate-x-1/2 rounded-full"
        style={{
          top: sunY,
          backgroundColor: sunColor,
          opacity: sunOpacity,
          boxShadow: useTransform(sunGlow, (g) => `0 0 ${g}px ${g / 2}px rgba(255,220,150,0.7)`),
        }}
      />
      {/* 星空 */}
      <motion.div className="absolute inset-0" style={{ opacity: starOpacity }}>
        <div className="stars" />
        <div className="stars stars--2" />
      </motion.div>
      {/* ふわふわ漂う粒子（紙吹雪 / 光） */}
      <div className="particles">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>
      {/* ビネット */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_40%,transparent_55%,rgba(0,0,0,0.28)_100%)]" />
    </motion.div>
  );
}

/* ============================================================
   写真フレーム（プレースホルダー対応）
   ============================================================ */
function Photo({
  slot,
  className = "",
  rounded = "rounded-2xl",
}: {
  slot: Slot;
  className?: string;
  rounded?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${rounded} ${className}`}>
      {slot.src ? (
        // 本番画像（ファイルが存在すれば表示。無ければ alt のプレースが見える）
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slot.src} alt={slot.label} className="h-full w-full object-cover" />
      ) : null}
      {/* プレースホルダー（画像が無いとき用の常時オーバーレイ） */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center"
        style={{
          background:
            "repeating-linear-gradient(45deg,rgba(255,255,255,0.06) 0 12px,rgba(255,255,255,0.12) 12px 24px), linear-gradient(135deg,#2b2b40,#1a1a2e)",
          opacity: slot.src ? 0 : 1,
        }}
      >
        <span className="text-xs uppercase tracking-[0.3em] text-white/50">PHOTO</span>
        <span className="px-4 text-lg font-semibold text-white/90">{slot.label}</span>
        <span className="text-xs text-white/40">{slot.sub}</span>
        {slot.src && (
          <span className="mt-1 text-[10px] text-white/30">{slot.src}</span>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   セクションタイトル（章見出し）
   ============================================================ */
function ChapterTitle({
  kicker,
  title,
  dark = false,
}: {
  kicker: string;
  title: string;
  dark?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  return (
    <div ref={ref} className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <motion.span
        initial={{ opacity: 0, letterSpacing: "0.1em" }}
        animate={inView ? { opacity: 1, letterSpacing: "0.5em" } : {}}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className={`mb-5 text-xs font-medium uppercase ${dark ? "text-white/60" : "text-black/50"}`}
      >
        {kicker}
      </motion.span>
      <motion.h2
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className={`font-display text-4xl leading-[1.15] sm:text-6xl ${dark ? "text-white" : "text-black"}`}
        style={{ fontFamily: "'Kaisei Decol', serif" }}
      >
        {title}
      </motion.h2>
    </div>
  );
}

/* ============================================================
   パララックス写真シーン（1枚どーんと見せる）
   ============================================================ */
function ParallaxScene({
  slot,
  caption,
  desc,
  dark = false,
  align = "left",
}: {
  slot: Slot;
  caption: string;
  desc: string;
  dark?: boolean;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["8%", "-8%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.15, 1, 1.15]);
  const rotate = useTransform(scrollYProgress, [0, 1], [align === "left" ? -3 : 3, 0]);
  const textX = useTransform(scrollYProgress, [0.2, 0.5], [align === "left" ? -60 : 60, 0]);
  const textOpacity = useTransform(scrollYProgress, [0.2, 0.45], [0, 1]);

  return (
    <div ref={ref} className="relative flex min-h-screen items-center justify-center px-5 py-24">
      <div
        className={`flex w-full max-w-6xl flex-col items-center gap-8 md:flex-row ${
          align === "right" ? "md:flex-row-reverse" : ""
        }`}
      >
        <motion.div style={{ y, rotate }} className="w-full md:w-3/5">
          <motion.div style={{ scale }} className="overflow-hidden rounded-3xl shadow-2xl">
            <Photo slot={slot} rounded="rounded-3xl" className="aspect-4/3 w-full" />
          </motion.div>
        </motion.div>
        <motion.div
          style={{ x: textX, opacity: textOpacity }}
          className={`w-full md:w-2/5 ${align === "right" ? "md:text-right" : ""}`}
        >
          <h3
            className={`mb-3 text-3xl font-bold sm:text-4xl ${dark ? "text-white" : "text-black"}`}
            style={{ fontFamily: "'Kaisei Decol', serif" }}
          >
            {caption}
          </h3>
          <p className={`text-base leading-relaxed ${dark ? "text-white/70" : "text-black/60"}`}>
            {desc}
          </p>
        </motion.div>
      </div>
    </div>
  );
}

/* ============================================================
   ポスター・3Dフライスルー（歴史）
   ------------------------------------------------------------
   ポスターが奥から手前へ「飛び込んで」きて、画面中央でその場で
   入れ替わっていく。スクロールでカメラが三次元空間を前進する感覚。
   ============================================================ */
const PERSPECTIVE = 1000; // px。小さいほど遠近が強く＝ダイナミックになる

// スクロール進捗の区切りを必ず [0,1] に収める（Motion は範囲外を受け付けない）
const cl = (n: number) => Math.min(1, Math.max(0, n));

function FlyingPoster({
  slot,
  year,
  note,
  index,
  total,
  progress,
}: {
  slot: Slot;
  year: string;
  note: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  // 各ポスターの担当スロット
  const half = 0.5 / total;             // スロットの半幅
  const center = (index + 0.5) / total; // 中央(Z=0)に来るスクロール位置
  const dwell = half * 0.5;             // 中央で静止して見せる長さ（その場で入れ替わる感）
  const reach = half * 1.6;             // 飛び込み/通過が届く範囲（隣とクロスフェード）
  const isFirst = index === 0;
  const isLast = index === total - 1;

  // 4点タイムライン：飛び込み → 中央で静止 → 通過。
  // 先頭は最初から中央で待機、末尾は最後まで中央で待機。
  const stops = [
    cl(center - reach),
    cl(center - dwell),
    cl(center + dwell),
    cl(center + reach),
  ];
  const z = useTransform(progress, stops, [isFirst ? 0 : -2200, 0, 0, isLast ? 0 : 820]);
  const opacity = useTransform(progress, stops, [isFirst ? 1 : 0, 1, 1, isLast ? 1 : 0]);
  const rotateY = useTransform(progress, stops, [isFirst ? 0 : -18, 0, 0, isLast ? 0 : 12]);
  const rotateX = useTransform(progress, stops, [isFirst ? 0 : 5, 0, 0, isLast ? 0 : -3]);

  // 遠いほどわずかにぼかして奥行きを強調
  const filter = useTransform(z, (v) => `blur(${Math.min(5, Math.max(0, -v) / 500)}px)`);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ z, rotateY, rotateX, opacity, filter, transformStyle: "preserve-3d" }}
    >
      {/* ポスターの奥に控える巨大な年号 */}
      <span className="pointer-events-none absolute inset-0 -z-10 flex select-none items-center justify-center text-[24vw] font-black leading-none text-black/10">
        {year}
      </span>
      <Photo
        slot={slot}
        rounded="rounded-2xl"
        className="aspect-3/4 w-[62vw] max-w-sm shadow-2xl ring-1 ring-black/5"
      />
      <p className="mt-5 text-sm tracking-widest text-black/60">{note}</p>
    </motion.div>
  );
}

function Poster3DGallery() {
  const ref = useRef<HTMLDivElement>(null);
  // セクション全体のスクロール量を 0→1 にマッピング（sticky で中身を固定）
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const total = POSTER_ITEMS.length;

  return (
    <section ref={ref} style={{ height: `${(total + 1.5) * 100}vh` }} className="relative">
      <div
        className="sticky top-0 flex h-screen items-center justify-center overflow-hidden"
        style={{ perspective: `${PERSPECTIVE}px` }}
      >
        <div
          className="relative flex h-full w-full items-center justify-center"
          style={{ transformStyle: "preserve-3d" }}
        >
          {POSTER_ITEMS.map((item, i) => (
            <FlyingPoster
              key={item.year}
              slot={item.slot}
              year={item.year}
              note={item.note}
              index={i}
              total={total}
              progress={scrollYProgress}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   バンド3枚同時シーン
   ============================================================ */
function BandTrioScene() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <div ref={ref} className="flex min-h-screen flex-col items-center justify-center gap-10 px-5 py-24">
      <motion.h3
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="text-center text-3xl font-bold text-black sm:text-5xl"
        style={{ fontFamily: "'Kaisei Decol', serif" }}
      >
        音楽が、響く。
      </motion.h3>
      <div className="flex w-full max-w-5xl flex-col items-stretch gap-5 md:flex-row">
        {BAND_TRIO.map((slot, i) => (
          <motion.div
            key={slot.label}
            initial={{ opacity: 0, y: 80, rotate: i === 0 ? -6 : i === 2 ? 6 : 0 }}
            animate={inView ? { opacity: 1, y: 0, rotate: i === 0 ? -3 : i === 2 ? 3 : 0 } : {}}
            transition={{ duration: 0.9, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1"
          >
            <Photo slot={slot} className="aspect-3/4 w-full shadow-xl" />
            <p className="mt-3 text-center text-sm font-medium text-black/70">{slot.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   花火シーン（クライマックス）
   ============================================================ */
function FireworksScene() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-30%" });
  return (
    <div ref={ref} className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      {inView && (
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="firework"
              style={
                {
                  left: `${10 + i * 15}%`,
                  top: `${20 + (i % 3) * 18}%`,
                  "--delay": `${i * 0.6}s`,
                  "--hue": `${i * 55}`,
                } as React.CSSProperties
              }
            >
              {Array.from({ length: 12 }).map((__, j) => (
                <span key={j} style={{ "--a": `${j * 30}deg` } as React.CSSProperties} />
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="relative z-10 flex flex-col items-center text-center">
        <Photo
          slot={{ label: "花火", sub: "後夜祭フィナーレ", src: "/history/night-hanabi.jpg" }}
          rounded="rounded-3xl"
          className="aspect-video w-[88vw] max-w-3xl shadow-2xl"
        />
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, delay: 0.3 }}
          className="mt-8 text-2xl font-bold text-white sm:text-4xl"
          style={{ fontFamily: "'Kaisei Decol', serif" }}
        >
          夜空に、今年が咲く。
        </motion.p>
      </div>
    </div>
  );
}

/* ============================================================
   ページ本体
   ============================================================ */
export default function HistoryTopPage() {
  const { scrollYProgress } = useScroll();
  const barScaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <main className="relative w-full overflow-x-hidden">
      <StyleBlock />
      <SkyBackground progress={scrollYProgress} />

      {/* 上部プログレスバー */}
      <motion.div
        style={{ scaleX: barScaleX }}
        className="fixed inset-x-0 top-0 z-50 h-1 origin-left bg-linear-to-r from-amber-400 via-orange-500 to-violet-600"
      />

      {/* ── ヒーロー ───────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="mb-4 text-sm tracking-[0.4em] text-black/50"
        >
          NANKOSAI — A STORY
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl leading-[1.2] text-black sm:text-7xl"
          style={{ fontFamily: "'Kaisei Decol', serif" }}
        >
          これまでが、
          <br />
          今をつくる。
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-6 max-w-md text-base leading-relaxed text-black/60"
        >
          受け継がれてきた南高祭の歩み。<br />スクロールして、その物語をたどる。
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 10, 0] }}
          transition={{ opacity: { delay: 1.2 }, y: { repeat: Infinity, duration: 1.8 } }}
          className="absolute bottom-10 text-xs tracking-[0.3em] text-black/40"
        >
          SCROLL ↓
        </motion.div>
      </section>

      {/* ── 第1章：これまでの歩み（ポスター）──── */}
      <ChapterTitle kicker="Chapter 1 — History" title="これまでの、歩み。" />
      <Poster3DGallery />

      {/* ── 第2章：文化祭当日 ───────────────── */}
      <ChapterTitle kicker="Chapter 2 — The Day" title="そして、当日。" />
      <ParallaxScene
        slot={{ label: "ホラー", sub: "展示", src: "/history/day-horror.jpg" }}
        caption="闇に、悲鳴。"
        desc="ひんやりとした廊下の先。ホラー展示は今年も長い行列をつくった。"
        align="left"
      />
      <ParallaxScene
        slot={{ label: "アトラクション 1", sub: "展示", src: "/history/day-attraction1.jpg" }}
        caption="夢中に、なる。"
        desc="教室がまるごと遊び場に。手づくりのアトラクションに歓声があがる。"
        align="right"
      />
      <BandTrioScene />
      <ParallaxScene
        slot={{ label: "アトラクション 2", sub: "展示", src: "/history/day-attraction2.jpg" }}
        caption="まだまだ、続く。"
        desc="次のアトラクションへ。一日では回りきれないほどの企画が並ぶ。"
        align="left"
      />
      <ParallaxScene
        slot={{ label: "新聞展示", sub: "展示", src: "/history/day-news.jpg" }}
        caption="言葉を、のこす。"
        desc="一年の活動を一枚の紙面に。新聞展示には想いが詰まっている。"
        align="right"
      />
      <ParallaxScene
        slot={{ label: "書道パフォーマンス", sub: "ステージ", src: "/history/day-shodo.jpg" }}
        caption="一筆に、すべてを。"
        desc="音楽に合わせ、大きな紙に一気に書き上げる。会場が息をのむ瞬間。"
        align="left"
      />

      {/* ── 第3章：後夜祭 ───────────────────── */}
      <ChapterTitle kicker="Chapter 3 — After Festival" title="夜は、まだ終わらない。" dark />
      <ParallaxScene
        slot={{ label: "軽音ライブ", sub: "後夜祭", src: "/history/night-live.jpg" }}
        caption="熱を、放て。"
        desc="日が落ちて、ステージに灯がともる。軽音ライブが後夜祭の幕を開ける。"
        dark
        align="right"
      />
      <ParallaxScene
        slot={{ label: "盆踊り", sub: "後夜祭", src: "/history/night-bon.jpg" }}
        caption="輪に、なって。"
        desc="やぐらを囲んで、みんなで踊る。世代をこえて受け継がれてきた時間。"
        dark
        align="left"
      />
      <FireworksScene />

      {/* ── エンディング ─────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2 }}
          className="text-4xl leading-[1.3] text-white sm:text-6xl"
          style={{ fontFamily: "'Kaisei Decol', serif" }}
        >
          また、来年。
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-6 text-sm tracking-[0.3em] text-white/50"
        >
          NANKOSAI · ありがとうございました
        </motion.p>
      </section>
    </main>
  );
}

/* ============================================================
   アニメーション用 CSS（星・粒子・花火）
   ============================================================ */
function StyleBlock() {
  return (
    <style>{`
      .stars, .stars--2 {
        position: absolute; inset: 0;
        background-image:
          radial-gradient(1px 1px at 20% 30%, #fff, transparent),
          radial-gradient(1px 1px at 50% 60%, #fff, transparent),
          radial-gradient(1.5px 1.5px at 80% 20%, #fff, transparent),
          radial-gradient(1px 1px at 35% 80%, #fff, transparent),
          radial-gradient(1.5px 1.5px at 65% 40%, #fff, transparent),
          radial-gradient(1px 1px at 90% 70%, #fff, transparent),
          radial-gradient(1px 1px at 10% 55%, #fff, transparent);
        background-repeat: repeat;
        background-size: 100% 100%;
        animation: twinkle 4s ease-in-out infinite;
      }
      .stars--2 { animation-delay: 2s; opacity: 0.6; transform: scale(1.4); }
      @keyframes twinkle { 0%,100%{opacity:.5} 50%{opacity:1} }

      .particles { position:absolute; inset:0; pointer-events:none; }
      .particles span {
        position:absolute; top:-5%;
        left: calc(var(--i) * 7%);
        width:6px; height:6px; border-radius:9999px;
        background: rgba(255,255,255,0.5);
        animation: floatDown calc(9s + var(--i) * 1s) linear infinite;
        animation-delay: calc(var(--i) * -0.8s);
      }
      @keyframes floatDown {
        0%   { transform: translateY(-10vh) translateX(0) rotate(0deg); opacity:0; }
        10%  { opacity:.8; }
        90%  { opacity:.8; }
        100% { transform: translateY(110vh) translateX(40px) rotate(360deg); opacity:0; }
      }

      .firework { position:absolute; width:6px; height:6px; }
      .firework span {
        position:absolute; left:0; top:0;
        width:4px; height:4px; border-radius:9999px;
        background: hsl(var(--hue), 90%, 65%);
        box-shadow: 0 0 8px 2px hsl(var(--hue), 90%, 65%);
        transform: rotate(var(--a)) translateY(0);
        animation: burst 1.6s ease-out infinite;
        animation-delay: var(--delay);
      }
      @keyframes burst {
        0%   { transform: rotate(var(--a)) translateY(0); opacity:0; }
        10%  { opacity:1; }
        100% { transform: rotate(var(--a)) translateY(90px); opacity:0; }
      }

      .font-display { font-family: 'Kaisei Decol', serif; }
    `}</style>
  );
}
