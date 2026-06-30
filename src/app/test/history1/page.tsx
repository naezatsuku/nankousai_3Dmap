"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useReducedMotion,
  useMotionValueEvent,
  useInView,
  easeInOut,
  type MotionValue,
} from "framer-motion";

/* ============================================================
   南高祭 ヒストリー・小物パララックスギャラリー（/test/history1）
   ------------------------------------------------------------
   1枚のポスター画像の代わりに、各年度を表す3つの小物カードを
   帯の中に配置。帯ごとスクロールに合わせて右から左へ連続的に
   スライドさせる（停止・スナップ・拡大・キャプション表示なしの
   シンプルな横スクロール）。
   各小物カードは「奥行き比率」が異なり、帯の動きに対して
   それぞれ違う速さで余分にドリフトする（速度差パララックス）。
   背景色は、画面中央に最も近い年度に合わせてクロスフェードで切り替わる。
   ・画像は仮（色付きカード＋アイテム名＋説明文のプレースホルダー）
   ・prefers-reduced-motion では縦並びで静止表示
   ============================================================ */

// ===== 設定：ここだけ書き換える =====
// 基準スクロール量（vh／年度）。移動の速さの基準になる
const VH_PER_YEAR = 70;
// 最後の年度を通過したあと、次のコンテンツが下からせり上がってくる
// 「のりかえ用」のスクロール量(vh)。大きいほど重なり始めが遅くなる
const TRANSITION_VH = 160;
// ===================================

type YearItem = { label: string; desc: string; src?: string };
type YearEntry = { year: number; color: string; note: string; desc: string; items: YearItem[] };

// 2017は public/poster/2017 の実画像を使用。他の年度はまだ画像がないので仮の枠だけ用意（2020〜2022は省略）
// color を指定した年度はその色をそのまま使う（指定がなければ年度ごとの仮の色相を自動生成）
const YEAR_DATA: { year: number; note: string; desc: string; color?: string; items: YearItem[] }[] = [
  {
    year: 2017,
    note: "灯をつなぐ。",
    desc: "先輩から受け取ったバトン。小さな灯を、次の年へとつないだ。",
    color: "#014b57ff",
    items: [
      { label: "ポスター原画", desc: "その年の雰囲気を一枚に込めた、オリジナルデザイン。", src: "/poster/2017/poster.png" },
      { label: "黄色い花", desc: "ポスターを彩った、黄色い花のモチーフ。", src: "/poster/2017/花黄色.png" },
      { label: "赤い花", desc: "鮮やかな赤で、デザインに差し色を加えた。", src: "/poster/2017/花赤色.png" },
      { label: "泡の装飾", desc: "ふわりと舞う泡のイラストが、紙面に動きを添えた。", src: "/poster/2017/泡.png" },
    ],
  },
  {
    year: 2018,
    note: "工夫を、重ねて。",
    desc: "限られた中でできることを。アイデアと工夫で会場をいろどった。",
    items: [
      { label: "手作り装飾", desc: "教室にあるもので、工夫して飾り付けた。" },
      { label: "段ボール看板", desc: "予算の中で、知恵を絞った大道具。" },
      { label: "寄せ書きボード", desc: "みんなの一言を集めた、来場者参加型企画。" },
    ],
  },
  {
    year: 2019,
    note: "声が、ひびく。",
    desc: "ステージにあふれる歓声。ひとつになった一日が、記憶に残る。",
    items: [
      { label: "ライブチケット", desc: "並んでも見たい、人気企画になった年。" },
      { label: "応援うちわ", desc: "客席から飛び交った、手作りの応援グッズ。" },
      { label: "記念缶バッジ", desc: "お土産代わりに配られた、小さな記念品。" },
    ],
  },
  {
    year: 2023,
    note: "声が、戻った。",
    desc: "にぎわいが帰ってきた。待ち望んだ笑顔が、校舎いっぱいに。",
    items: [
      { label: "再開ポスター", desc: "数年ぶりに刷られた、賑わいを知らせる一枚。" },
      { label: "検温チェックシート", desc: "まだ気を抜けない、感染対策の名残。" },
      { label: "来場者アンケート", desc: "戻ってきた声を、ひとつひとつ集めた。" },
    ],
  },
  {
    year: 2024,
    note: "受け継がれていく。",
    desc: "先輩たちの想いを胸に。あたらしい挑戦が、次々と花ひらいた。",
    items: [
      { label: "新企画の企画書", desc: "新しい挑戦を、紙の上から始めた。" },
      { label: "SNS告知画像", desc: "校内だけでなく、外にも届けるための一枚。" },
      { label: "部活合同ステージ表", desc: "色んな部活が混ざり合う、タイムテーブル。" },
    ],
  },
  {
    year: 2025,
    note: "さらに、前へ。",
    desc: "立ち止まらない。過去をこえて、もっと大きな景色を目指した。",
    items: [
      { label: "最新パンフレット", desc: "これまでの積み重ねが詰まった一冊。" },
      { label: "デジタルマップ", desc: "紙だけじゃない、新しい案内のかたち。" },
      { label: "来場記念スタンプ", desc: "今年も、ここに来た証を残す。" },
    ],
  },
  {
    year: 2026,
    note: "そして、今へ —",
    desc: "受け継がれてきた想いが、今年もあたらしい景色を描く。",
    items: [
      { label: "最新ポスター", desc: "今年の祭りを、これから先に伝える一枚。" },
      { label: "公式アプリ画面", desc: "紙からデジタルへ。案内のかたちも進化する。" },
      { label: "来場者特典シール", desc: "来てくれたみんなに贈る、小さな記念。" },
    ],
  },
];

const years: YearEntry[] = YEAR_DATA.map(({ year, note, desc, color, items }, i) => {
  const hue = (i * 50) % 360; // 年度ごとに色相をずらす
  return {
    year,
    color: color ?? `hsl(${hue} 55% 14%)`, // 指定があればそのまま、なければ仮の地色を自動生成
    note,
    desc,
    items,
  };
});
const YEAR_COUNT = years.length;

// 小物（画像素材）の配置パターン（画面内での位置・大きさ・奥行き比率）
// 左から右へ向かって、上(top)→下(bottom)→上→下…と交互にジグザグ配置する
// depthRatio: 1.0 が帯と同じ速さ。小さいほど奥（遅い）、大きいほど手前（速い）
// items配列の順番 [poster, 花黄色, 花赤色, 泡] に対応
const ITEM_LAYOUT = [
  // poster.png：画面上部・左寄り
  { top: "10%", left: "6%", width: "clamp(150px, 22vw, 220px)", height: "clamp(150px, 22vw, 220px)", depthRatio: 0.7, z: 2 },
  // 花黄色：画面下部・中央左寄り
  { bottom: "10%", left: "30%", width: "clamp(130px, 20vw, 200px)", height: "clamp(130px, 20vw, 200px)", depthRatio: 1.0, z: 1 },
  // 花赤色：画面上部・中央右寄り
  { top: "10%", left: "54%", width: "clamp(160px, 24vw, 240px)", height: "clamp(160px, 24vw, 240px)", depthRatio: 1.2, z: 2 },
  // 泡：画面下部・右寄り
  { bottom: "10%", left: "76%", width: "clamp(120px, 18vw, 190px)", height: "clamp(150px, 22vw, 220px)", depthRatio: 0.85, z: 1 },
] as const;

const SMOOTH = [0.16, 1, 0.3, 1] as const; // ease-out-expo 風（/test/history と同じ質感）

export default function History1Page() {
  const reduce = useReducedMotion();
  const pageRef = useRef<HTMLElement | null>(null);
  const sceneRef = useRef<HTMLElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const centersRef = useRef<number[]>([]);
  const viewportCenterRef = useRef(0);

  const [travel, setTravel] = useState({ start: 0, end: -1, vh: YEAR_COUNT * VH_PER_YEAR });
  // 今、画面中央に最も近い年度のindex（背景色に使う）
  const [activeIndex, setActiveIndex] = useState(0);
  // ページ自体の実際の表示幅（PCではmax-w-3xlで画面幅より狭くなるため、
  // window.innerWidth ではなくこちらを「画面の横幅」として扱う）
  const [pageWidth, setPageWidth] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ["start start", "end end"],
  });

  // useLayoutEffect：描画前に正しい高さを確定させ、初期表示直後に
  // 仮の高さから実際の高さへ変化する「ジャンプ」を防ぐ
  useLayoutEffect(() => {
    let lastWidth = window.innerWidth;

    function measure() {
      const rowWidth = rowRef.current?.scrollWidth ?? 0;
      // PCではmax-w-3xlでページ自体が画面幅より狭くなるため、
      // window.innerWidth ではなくページ自身の実際の幅を「画面の横幅」として使う
      const vw = pageRef.current?.clientWidth ?? window.innerWidth;
      setPageWidth(vw);
      viewportCenterRef.current = vw / 2;
      centersRef.current = slotRefs.current.map(
        (el) => (el ? el.offsetLeft + el.offsetWidth / 2 : 0)
      );

      const start = vw; // 帯が画面右の外にある状態
      const end = -(rowWidth - vw / 2); // 最後の年度が画面中央に来る状態
      setTravel({ start, end, vh: YEAR_COUNT * VH_PER_YEAR });
    }

    function onResize() {
      const vw = window.innerWidth;
      if (vw === lastWidth) return; // 高さだけの変化（アドレスバー等）は無視
      lastWidth = vw;
      measure();
    }

    measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 停止区間なし。スクロールに対して帯のx位置を直線的に変化させるだけ
  const totalVh = travel.vh + TRANSITION_VH;
  const transitionPoint = travel.vh / totalVh;
  const x = useTransform(
    scrollYProgress,
    [0, transitionPoint, 1],
    [travel.start, travel.end, travel.end],
    { ease: easeInOut }
  );

  // 画面中央に最も近い年度を背景色用に追跡
  useMotionValueEvent(x, "change", (latestX) => {
    let bestIdx = 0;
    let bestDist = Infinity;
    centersRef.current.forEach((c, i) => {
      const dist = Math.abs(c + latestX - viewportCenterRef.current);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    });
    setActiveIndex(bestIdx);
  });

  if (reduce) {
    return (
      <main style={{ background: "#0b0d12", color: "#fff", padding: "8vh 5vw" }}>
        <h1 style={{ fontSize: 28, marginBottom: "4vh" }}>南高祭 ポスターの歩み</h1>
        <div style={{ display: "grid", gap: 40, maxWidth: 480, margin: "0 auto" }}>
          {years.map((y) => (
            <div key={y.year}>
              <p style={{ fontWeight: 700, fontSize: 22, marginBottom: 8 }}>{y.year}</p>
              <div style={{ display: "grid", gap: 10 }}>
                {y.items.map((it) => (
                  <div key={it.label}>
                    {it.src && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.src}
                        alt={it.label}
                        style={{ width: 120, height: 120, objectFit: "contain", marginBottom: 6 }}
                      />
                    )}
                    <p style={{ fontWeight: 700 }}>{it.label}</p>
                    <p style={{ fontSize: 13, opacity: 0.75 }}>{it.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main
      ref={pageRef}
      className="md:mx-auto md:max-w-3xl"
      style={{ position: "relative", background: "#0b0d12", color: "#fff" }}
    >
      <section
        ref={sceneRef}
        style={{
          position: "relative",
          // vh はブラウザによってアドレスバーの収縮中に値が変化することがあり、
          // その瞬間にこのセクションの高さ（＝スクロール量の基準）が動いて
          // ページがガクッとずれて見える。lvh は常にアドレスバーが収縮した
          // 状態の高さで固定されているため、スクロール中に値が変わらない
          height: `${travel.vh + TRANSITION_VH}lvh`,
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            // 100vh ではなく 100dvh：スマホはスクロール開始時にアドレスバーが
            // 収縮して表示領域(高さ)が変わるため、100vh のままだと
            // その瞬間に画面がガクッと動く。dvh は常に実際の表示領域に追従する
            height: "100dvh",
            width: "100%",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* 背景：画面中央に最も近い年度の色にクロスフェード */}
          <motion.div
            key={activeIndex}
            className="absolute inset-0"
            style={{ zIndex: 0, background: years[activeIndex].color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
          />
          {/* 切り替わり中も背面に前の色を残しておく土台（黒） */}
          <div className="absolute inset-0" style={{ zIndex: -1, background: "#0b0d12" }} />

          <motion.div
            ref={rowRef}
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              height: "100%",
              gap: 0,
              x,
              willChange: "transform",
            }}
          >
            {years.map((y, i) => (
              <YearCluster
                key={y.year}
                year={y.year}
                items={y.items}
                x={x}
                pageWidth={pageWidth}
                setRef={(el) => {
                  slotRefs.current[i] = el;
                }}
              />
            ))}
          </motion.div>

          {/* キャプション：PCでは画面左側、スマホでは画面中央に表示。
              現在の年度に合わせてふわっと浮き上がって現れ、浮き上がりながら消えていく */}
          <YearCaption entry={years[activeIndex]} />
        </div>
      </section>

      {/* 次のコンテンツ（/test の Chapter 2 を参考にした「当日」セクション）：
          最後の年度を通過したあとのスクロールで下からせり上がり、
          History のセクションに重なるように覆う。marginTop の負値ぶん
          （TRANSITION_VHのスクロール）だけ、History がまだ画面に残っている
          状態に重なって出てくる。 */}
      <section
        style={{
          position: "relative",
          zIndex: 10,
          marginTop: `-${TRANSITION_VH}lvh`,
          background: "#fdf6e9",
          color: "#1a1a1a",
          boxShadow: "0 -30px 60px rgba(0,0,0,0.35)",
        }}
      >
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
        <ParallaxScene
          slot={{ label: "アトラクション 2", sub: "展示", src: "/history/day-attraction2.jpg" }}
          caption="まだまだ、続く。"
          desc="次のアトラクションへ。一日では回りきれないほどの企画が並ぶ。"
          align="left"
        />
      </section>

      {/* 背面のレイヤー（ライブ・軽音・吹奏楽部）：スクロール順としてはChapter2の直後に
          続くが、z-indexはChapter2より低くして背面に置く。marginTop の負値ぶん
          （MUSIC_TRANSITION_VHのスクロール）だけ早めにスティッキー開始させ、
          Chapter2の終盤がこのセクションの手前を覆ったまま過ぎ去っていく。 */}
      <MusicTrioGallery />

      {/* 夜の部（新聞展示・書道パフォーマンス） */}
      <section style={{ position: "relative", background: "#fdf6e9", color: "#1a1a1a" }}>
        <ChapterTitle kicker="Chapter 3 — The Night" title="そして、夜へ。" />
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
      </section>
    </main>
  );
}

/* ============================================================
   次のコンテンツ：/test/page.tsx の Chapter 2 を参考にしたパーツ
   ============================================================ */
type Slot = { label: string; sub: string; src?: string };

function Photo({ slot, className = "" }: { slot: Slot; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl ${className}`}>
      {slot.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slot.src} alt={slot.label} className="h-full w-full object-cover" />
      ) : null}
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
      </div>
    </div>
  );
}

function ChapterTitle({ kicker, title }: { kicker: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  return (
    <div ref={ref} className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <motion.span
        initial={{ opacity: 0, letterSpacing: "0.1em" }}
        animate={inView ? { opacity: 1, letterSpacing: "0.5em" } : {}}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className="mb-5 text-xs font-medium uppercase text-black/50"
      >
        {kicker}
      </motion.span>
      <motion.h2
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="text-4xl leading-[1.15] text-black sm:text-6xl"
        style={{ fontFamily: "'Kaisei Decol', serif" }}
      >
        {title}
      </motion.h2>
    </div>
  );
}

function ParallaxScene({
  slot,
  caption,
  desc,
  align = "left",
}: {
  slot: Slot;
  caption: string;
  desc: string;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const yMv = useTransform(scrollYProgress, [0, 1], ["8%", "-8%"]);
  const scaleMv = useTransform(scrollYProgress, [0, 0.5, 1], [1.15, 1, 1.15]);
  const rotateMv = useTransform(scrollYProgress, [0, 1], [align === "left" ? -3 : 3, 0]);
  // テキストは画像と反対側から出現する（画像が左なら右から、右なら左から）。
  // 画像側は退場アニメーションを持たず自然なスクロールで画面外へ出ていくだけなので、
  // テキストにも退場アニメーションは付けない（付けると画像とズレて見える）
  const textOffset = align === "left" ? 60 : -60;
  const textX = useTransform(scrollYProgress, [0.2, 0.5], [textOffset, 0]);
  const textOpacity = useTransform(scrollYProgress, [0.2, 0.45], [0, 1]);

  return (
    <div ref={ref} className="relative flex min-h-screen items-center justify-center px-5 py-24">
      <div
        className={`flex w-full max-w-6xl flex-col items-center gap-8 md:flex-row ${
          align === "right" ? "md:flex-row-reverse" : ""
        }`}
      >
        <motion.div style={{ y: yMv, rotate: rotateMv }} className="w-full md:w-3/5">
          <motion.div style={{ scale: scaleMv }} className="overflow-hidden rounded-3xl shadow-2xl">
            <Photo slot={slot} className="aspect-4/3 w-full" />
          </motion.div>
        </motion.div>
        <motion.div
          style={{ x: textX, opacity: textOpacity }}
          className={`w-full md:w-2/5 ${align === "right" ? "md:text-right" : ""}`}
        >
          <h3
            className="mb-3 text-3xl font-bold text-black sm:text-4xl"
            style={{ fontFamily: "'Kaisei Decol', serif" }}
          >
            {caption}
          </h3>
          <p className="text-base leading-relaxed text-black/60">{desc}</p>
        </motion.div>
      </div>
    </div>
  );
}

/* ============================================================
   音楽系（ライブ・バンド・吹奏楽）：ParallaxScene と同じ
   「写真＋キャプション/説明文」の2カラムレイアウトのまま、
   画面をスティッキーで固定し、スクロールに合わせて3枚をクロスフェードで切り替える。
   Chapter2 の直後（スクロール順としては最後）に配置するが、z-indexは
   Chapter2より低くして「背面」にする。マイナスmarginTopで少し早めに
   スティッキー開始させることで、Chapter2の終盤がこのセクションの手前を
   覆ったまま過ぎ去っていき、Chapter2がスクロールしきったところで
   このセクションが奥から現れるように見せる。
   ============================================================ */
// Chapter2の終盤と重なり始める量（負のmarginTopとして使う(vh)）。大きいほど重なり始めが遅くなる
const MUSIC_TRANSITION_VH = 160;
// スライド1枚あたりのスクロール量(vh)。大きいほどゆっくり切り替わる
const MUSIC_VH_PER_SLIDE = 160;

type MusicSlide = Slot & { caption: string; desc: string; align: "left" | "right" };

const MUSIC_TRIO: MusicSlide[] = [
  {
    label: "ライブ",
    sub: "軽音",
    caption: "熱を、浴びる。",
    desc: "軽音ライブのステージは、いつも熱気に包まれる。観客も一緒に声をあげる。",
    align: "left",
  },
  {
    label: "バンド",
    sub: "演奏",
    caption: "音を、重ねる。",
    desc: "練習を重ねたぶんだけ、息のあった演奏になる。バンドの音が会場を満たす。",
    align: "right",
  },
  {
    label: "吹奏楽",
    sub: "ステージ",
    caption: "息を、ひとつに。",
    desc: "管楽器の音が重なり合い、ひとつの旋律になる。吹奏楽部のステージ。",
    align: "left",
  },
];

function MusicTrioGallery() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const total = MUSIC_TRIO.length;
  const [activeIndex, setActiveIndex] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const idx = Math.min(total - 1, Math.floor(p * total));
    setActiveIndex(idx);
  });

  // 背面の写真だけ、スクロールに対してゆっくりドリフトさせる（速度差パララックス）
  const bgY = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  const slide = MUSIC_TRIO[activeIndex];

  return (
    <section
      ref={ref}
      style={{
        position: "relative",
        zIndex: 1,
        marginTop: `-${MUSIC_TRANSITION_VH}lvh`,
        height: `${total * MUSIC_VH_PER_SLIDE}vh`,
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100dvh",
          width: "100%",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* ── 背面：全面の写真。クロスフェード＋ゆっくりドリフト ── */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden" }}>
          <AnimatePresence mode="sync">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: "easeInOut" }}
              style={{ position: "absolute", inset: "-8% 0", y: bgY }}
            >
              <Photo slot={slide} className="h-full w-full" />
            </motion.div>
          </AnimatePresence>
          {/* 上下だけ少し暗く（中央はそのまま、文字を読みやすくする） */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 28%, transparent 62%, rgba(0,0,0,0.65) 100%)",
            }}
          />
        </div>

        {/* ── 前面：キャプション・説明文・ドット（背景より速く・はっきり動く） ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.8, ease: SMOOTH }}
            className={`relative z-10 w-full max-w-xl px-7 text-white ${
              slide.align === "right" ? "text-right" : "text-left"
            }`}
            style={{
              marginLeft: slide.align === "right" ? "auto" : undefined,
              marginRight: slide.align === "right" ? undefined : "auto",
            }}
          >
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-white/60">
              {slide.sub}
            </span>
            <h3
              className="mt-3 text-3xl font-bold sm:text-4xl"
              style={{ fontFamily: "'Kaisei Decol', serif" }}
            >
              {slide.caption}
            </h3>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/75">{slide.desc}</p>
            <div
              className={`mt-5 flex gap-2 ${
                slide.align === "right" ? "justify-end" : "justify-start"
              }`}
            >
              {MUSIC_TRIO.map((_, i) => (
                <span
                  key={i}
                  className="h-1 w-8 rounded-full transition-colors"
                  style={{ background: i === activeIndex ? "#fff" : "rgba(255,255,255,0.3)" }}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

/* ---- キャプション：現在の年度の見出し／説明文。
   PCでは画面左側、スマホでは画面中央に表示。
   年度が変わるたびに、ふわっと浮き上がって現れ、さらに浮き上がりながら消えていく ---- */
function YearCaption({ entry }: { entry: YearEntry }) {
  return (
    <div
      className="absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 px-6 text-center
                 md:inset-x-auto md:left-[6%] md:w-[38%] md:px-0 md:text-left"
    >
      <AnimatePresence mode="popLayout">
        <motion.div
          key={entry.year}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.8, ease: SMOOTH }}
        >
          <div
            style={{
              fontSize: "clamp(36px, 7vw, 64px)",
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1,
            }}
          >
            {entry.year}
          </div>
          <h3
            style={{
              fontFamily: "'Kaisei Decol', serif",
              fontSize: "clamp(20px, 4vw, 30px)",
              fontWeight: 700,
              color: "#fff",
              marginTop: 10,
            }}
          >
            {entry.note}
          </h3>
          <p
            className="mx-auto md:mx-0"
            style={{
              maxWidth: 320,
              marginTop: 10,
              fontSize: 14,
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.75)",
            }}
          >
            {entry.desc}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ---- 1年度分：3つの小物カードを散らして配置し、それぞれ違う速さでドリフトさせる
   （帯の動き x に対する追加オフセット = x * (depthRatio - 1) で速度差を作る） ---- */
function YearCluster({
  year,
  items,
  x,
  pageWidth,
  setRef,
}: {
  year: number;
  items: YearItem[];
  x: MotionValue<number>;
  pageWidth: number;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={setRef}
      style={{
        position: "relative",
        flex: "0 0 auto",
        width: "100%",
        height: "100%",
      }}
    >
      {/* 年度ラベル */}
      <span
        style={{
          position: "absolute",
          top: "8%",
          left: "7%",
          fontSize: "clamp(40px, 9vw, 88px)",
          fontWeight: 700,
          color: "rgba(255,255,255,0.85)",
          letterSpacing: "0.02em",
        }}
      >
        {year}
      </span>

      {items.map((item, i) => {
        const layout = ITEM_LAYOUT[i % ITEM_LAYOUT.length];
        return (
          <ItemCard key={item.label} item={item} layout={layout} x={x} pageWidth={pageWidth} />
        );
      })}
    </div>
  );
}

// 画面上の実際のx位置(screenX)から不透明度を求める。
// 画面中央(vw/2)で20%、左端(0)で0%になるよう、区間ごとに直線補間する
function opacityFromScreenX(screenX: number, vw: number) {
  const half = vw / 2;
  if (half <= 0) return 1;
  if (screenX >= half) {
    const t = Math.min(1, (screenX - half) / half); // 0(中央)→1(右端)
    return 0.2 + 0.8 * t;
  }
  const t2 = Math.max(0, screenX / half); // 0(左端)→1(中央)
  return 0.2 * t2;
}

/* ---- 小物カード本体。layout.depthRatio に応じて帯本体より速く/遅くドリフトする
   また、画面上の実際の位置に応じて不透明度を変化させる（中央で20%、左端で0%） ---- */
function ItemCard({
  item,
  layout,
  x,
  pageWidth,
}: {
  item: YearItem;
  layout: (typeof ITEM_LAYOUT)[number];
  x: MotionValue<number>;
  pageWidth: number;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  // 「x=0のときのこの要素の画面上の中心位置」を保持（CSSの transform には影響されない基準値）
  const baselineRef = useRef(0);
  // 自分が属するクラスタ（年度）の中心位置（帯のローカル座標）
  const clusterCenterRef = useRef(0);

  useLayoutEffect(() => {
    let lastWidth = window.innerWidth;

    function measure() {
      const el = elRef.current;
      if (!el) return;
      // offsetLeft は CSS の transform に影響されないレイアウト上の位置なので、
      // x（帯の現在の移動量）の値に関係なく、いつ計測しても正しい基準位置が取れる
      const clusterEl = el.offsetParent as HTMLElement | null;
      const clusterLeft = clusterEl ? clusterEl.offsetLeft : 0;
      const clusterWidth = clusterEl ? clusterEl.offsetWidth : 0;
      baselineRef.current = clusterLeft + el.offsetLeft + el.offsetWidth / 2;
      clusterCenterRef.current = clusterLeft + clusterWidth / 2;
    }

    function onResize() {
      const vw = window.innerWidth;
      if (vw === lastWidth) return;
      lastWidth = vw;
      measure();
    }

    measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 帯の動き(x)に対する追加オフセット。
  // 「このクラスタ（年度）が画面中央に来るときのx位置」からどれだけ離れているか、を
  // 基準にすることで、奥行きのズレが年度を重ねるごとに際限なく蓄積しないようにする
  const extraX = useTransform(x, (latestX) => {
    const clusterRestX = pageWidth / 2 - clusterCenterRef.current;
    return (latestX - clusterRestX) * (layout.depthRatio - 1);
  });

  const opacity = useTransform(x, (latestX) => {
    if (!pageWidth) return 1;
    const clusterRestX = pageWidth / 2 - clusterCenterRef.current;
    const screenX = baselineRef.current + latestX + (latestX - clusterRestX) * (layout.depthRatio - 1);
    return opacityFromScreenX(screenX, pageWidth);
  });

  return (
    <motion.div
      ref={elRef}
      style={{
        position: "absolute",
        top: "top" in layout ? layout.top : undefined,
        bottom: "bottom" in layout ? layout.bottom : undefined,
        left: "left" in layout ? layout.left : undefined,
        right: "right" in layout ? layout.right : undefined,
        width: layout.width,
        height: layout.height,
        zIndex: layout.z,
        x: extraX,
        opacity,
      }}
    >
      {item.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.src}
          alt={item.label}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 14,
            background:
              "repeating-linear-gradient(45deg,rgba(255,255,255,0.05) 0 10px,rgba(255,255,255,0.1) 10px 20px), linear-gradient(150deg,#2b2b40,#1a1a2e)",
          }}
        />
      )}
    </motion.div>
  );
}
