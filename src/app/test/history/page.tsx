"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useReducedMotion,
  useMotionValue,
  useMotionTemplate,
  useAnimationFrame,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";

/* ============================================================
   南高祭 ヒストリー・ジャーニー（/test/history）
   ------------------------------------------------------------
   ※ このスクロール演出は「スマホ用」。
     PC でも全画面にせず、スマホの横幅のカラム幅で中央表示する
     （左右はレターボックス＝暗い余白）。
   ------------------------------------------------------------
   カード（=画像）1枚の動き（らせんではなく「カーブ」を描く流れ）：
     ① 画面「右端」から登場（z正方向への動きは微量＆ゆっくり / フェードイン）
     ② 画面中央（最大）→ 画面左端（最小）へ移動
     ③ 左端から「大きなカーブ」を描いて、画面中央の少し上部へ
        （このときには次の新しいカードがもう登場している）
     ④ 中央少し上部から、ゆっくりと「右上」へ消えていく
   ・複数カードが軌道上に残りながら、新しいカードが順に登場する。
   ・見せ終わった（カーブ以降の）カードは、常にゆらゆら揺れる。
   ------------------------------------------------------------
   画像：public/history/ に置けば自動で実画像に差し替わる。
        いまは placeholder（仮画像）のまま。
        枚数・年度（=ファイル名）は POSTERS 配列を直すだけ。
   ============================================================ */

type Poster = {
  year: string;
  note: string;
  src?: string;
  title?: string; // スティック時に表示するタイトル
  desc?: string;  // スティック時に表示する説明文
};

// ── 歴代ポスター（古い順＝旅の出発点が先頭）──────────────
//   src を "/history/poster-2019.jpg" 等に差し替えると本番画像になる。
const POSTERS: Poster[] = [
  { year: "2016", note: "すべての、はじまり。", src: "https://picsum.photos/seed/nankosai2016/600/800", desc: "記念すべき第一回。手探りのなかで、祭りのかたちが生まれた。" },
  { year: "2017", note: "灯をつなぐ。", src: "https://picsum.photos/seed/nankosai2017/600/800", desc: "先輩から受け取ったバトン。小さな灯を、次の年へとつないだ。" },
  { year: "2018", note: "工夫を、重ねて。", src: "https://picsum.photos/seed/nankosai2018/600/800", desc: "限られた中でできることを。アイデアと工夫で会場をいろどった。" },
  { year: "2019", note: "声が、ひびく。", src: "https://picsum.photos/seed/nankosai2019/600/800", desc: "ステージにあふれる歓声。ひとつになった一日が、記憶に残る。" },
  { year: "2020", note: "それでも、灯した。", src: "https://picsum.photos/seed/nankosai2020/600/800", desc: "かたちを変えながらも、止めなかった。想いだけは、絶やさずに。" },
  { year: "2021", note: "離れていても。", src: "https://picsum.photos/seed/nankosai2021/600/800", desc: "距離をこえてつながる工夫を。新しい祭りの在り方を探した年。" },
  { year: "2022", note: "声が、戻った。", src: "https://picsum.photos/seed/nankosai2022/600/800", desc: "にぎわいが帰ってきた。待ち望んだ笑顔が、校舎いっぱいに。" },
  { year: "2023", note: "受け継がれていく。", src: "https://picsum.photos/seed/nankosai2023/600/800", desc: "先輩たちの想いを胸に。あたらしい挑戦が、次々と花ひらいた。" },
  { year: "2024", note: "さらに、前へ。", src: "https://picsum.photos/seed/nankosai2024/600/800", desc: "立ち止まらない。過去をこえて、もっと大きな景色を目指した。" },
  { year: "2025", note: "そして、今へ —", src: "/poster/2025.png", desc: "受け継がれてきた想いが、今年もあたらしい景色を描く。一人ひとりの一歩が、この祭りを未来へつないでいく。" },
];

/* ── レイアウト / 3D空間のパラメータ ──────────────────────
   座標は「ステージ（スマホ幅カラム）」基準の px。
   x: 右が正 / y: 下が正 / z: 手前(カメラに近い)が正。              */
const MOBILE_W = 430;      // スマホ幅カラムの最大幅(px)
const PERSPECTIVE = 1100;  // 遠近の強さ（最後の集合演出でのみ使用）

/* ── 各セグメントの「スクロール時間の重み」──────────────
   この比率で u(0→1) を分配する。W_OUT を大きくするほど
   「④ 右上へ消える」だけがゆっくりになる（他は据え置き）。 */
const W_IN = 0.22;    // ① 右端 → 中央（素早く）
const W_DWELL = 1.0;  // ② 中央でスティック（下部テキストが出ている間）
const W_EXIT = 0.22;  // ③ 中央 → 左端へ（素早く）、縮みながら消える
const W_TOTAL = W_IN + W_DWELL + W_EXIT;

// u 上のセグメント境界
const SEG_A = W_IN / W_TOTAL;              // ①→②（中央に到達＝スティック開始）
const SEG_D = (W_IN + W_DWELL) / W_TOTAL;  // ②→③（スティック終了＝左へ消えはじめる）

// 重なり（同時表示数）＝1：常に画面に出ているカードは1枚だけ。
// 前のカードは左端外（不透明度0）、次は右端外（不透明度0）にいるので、絶対に重ならない。
const JOURNEY_OVERLAP = 1;

/* ── 後ろの履歴プール（カーブを終えたカードがたまる場所）──────
   見せ終わった直近の数枚を、画面の見える範囲に小さく並べて待機させる。 */
const BACK_POOL_MAX = 3;    // 後ろにためる最大枚数
const BACK_POOL_SCALE = 0.2; // プール内カードの大きさ（中央の約 1/5）

// セクション高さ＝「旅パート（枚数比例）」＋「スティックを見せる尺（固定）」。
// STICK_SCREENS を増やすほど、スティックされている期間が長くなる。
const TOTAL = POSTERS.length;
const JOURNEY_SCREENS = TOTAL + 2;   // 旅パートの高さ（画面数）
const STICK_SCREENS = 6;             // スティックの尺（画面数・固定）＝見せる期間
const TOTAL_SCREENS = JOURNEY_SCREENS + STICK_SCREENS;
// 最後のカードが中央に到達＝スティック開始のスクロール位置
const P_STICK = JOURNEY_SCREENS / TOTAL_SCREENS;

const SCALE_SHOW = 1.0;    // 画面中央＝最大
const SCALE_EDGE = 0.3;    // 中央以外（登場/退場中）＝小さく

/* ── 最後のスティック後の「集合 → 円を時計回りに公転」演出 ──
   この一連はスクロール連動ではなく、時間ベースのアニメーション。 */
const SCALE_STICK = 0.48;            // スティック中のカード（中央）が縮む大きさ
const SCALE_RING = SCALE_STICK / 3;  // 中央以外のカード＝中央の 1/3
const RING_FRAC = 0.34;              // 囲む円の半径（ステージ幅 W に対する比）
const ASSEMBLE_MS = 1800;            // 1枚が右端→円スロットに収まるまで(ms)
const STAGGER_MS = 200;              // カードごとの開始ずらし(ms)
const ORBIT_PERIOD_MS = 16000;       // 円が1周する時間(ms)＝時計回り
const MARQUEE_THRESHOLD = 10;        // この枚数以上は円ではなく平行移動（マーキー）
const MARQUEE_PERIOD_MS = 9000;      // 1枚が右端→左端を1周する時間(ms)
const MARQUEE_ROW_Y = 0.32;          // 上段/下段の中央からの距離（W 比）

/* ── 数式ヘルパー ──────────────────────────────────────── */
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const bezier2 = (a: number, b: number, c: number, t: number) =>
  (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

type Pose = {
  x: number;
  y: number;
  z: number;
  scale: number;
  opacity: number;
  blur: number;
};

/* カードの生存区間：開始位置 start と長さ life。
   ------------------------------------------------------------
   枚数に依存しない設計：
   ・step（カード間隔）を、最後のカードが必ず P_STICK で中央に来るよう逆算。
   ・life = JOURNEY_OVERLAP * step とし、同時に見えるカード枚数（重なり）を
     枚数によらず一定に保つ（増やしても団子にならない）。
   ・セクション高さを枚数に比例させているので、見た目の速度もほぼ一定。
   ------------------------------------------------------------ */
function lifeSpan(index: number, total: number) {
  if (total <= 1) return { start: 0, life: P_STICK };
  // 最後のカード(index=total-1)が中央到達 = (total-1)*step + SEG_A*life = P_STICK
  const step = P_STICK / (total - 1 + SEG_A * JOURNEY_OVERLAP);
  const life = JOURNEY_OVERLAP * step;
  return { start: index * step, life };
}

/* ------------------------------------------------------------
   1枚のカードの「いまの姿」を、そのカードの生存進捗 u（0→1）から求める。
   u は JourneyPoster 側で（全体スクロール - 開始位置）/ life として算出。
   W：ステージ（スマホ幅カラム）の実幅(px)。位置はこれに比例。
   ------------------------------------------------------------ */
function poseAt(u: number, W: number): Pose {
  const rightX = W * 0.62;   // 画面右端の外（登場）
  const leftX = -W * 0.62;   // 画面左端の外（退場）

  const A = SEG_A;
  const D = SEG_D;

  if (u < A) {
    // ① 右 → 中央。単純に水平移動。小さく登場して中央で最大に。
    const t = easeOut(u / A);
    return {
      x: lerp(rightX, 0, t),
      y: 0,
      z: 0,
      scale: lerp(SCALE_EDGE, SCALE_SHOW, t),
      opacity: clamp01(t * 2.2),
      blur: 0,
    };
  }

  if (u < D) {
    // ② 中央でスティック（最大・下部テキスト表示）
    return { x: 0, y: 0, z: 0, scale: SCALE_SHOW, opacity: 1, blur: 0 };
  }

  // ③ 中央 → 左へ。単純に水平移動。小さくなりながらフェードアウト。
  const t = easeInOut((u - D) / (1 - D));
  return {
    x: lerp(0, leftX, t),
    y: 0,
    z: 0,
    scale: lerp(SCALE_SHOW, SCALE_EDGE, t), // 中央以外は小さく
    opacity: clamp01((1 - t) * 1.8),        // 終盤でフェードアウト
    blur: 0,
  };
}

/* ============================================================
   写真フレーム（プレースホルダー対応）
   ============================================================ */
function Photo({ poster }: { poster: Poster }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10">
      {poster.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster.src} alt={`南高祭 ${poster.year}`} className="h-full w-full object-cover" />
      ) : null}
      {/* 画像が無いとき用のプレースホルダー */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center"
        style={{
          background:
            "repeating-linear-gradient(45deg,rgba(255,255,255,0.05) 0 12px,rgba(255,255,255,0.1) 12px 24px), linear-gradient(135deg,#2b2b40,#15152a)",
          opacity: poster.src ? 0 : 1,
        }}
      >
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/45">POSTER</span>
        <span className="text-2xl font-bold text-white/90">{poster.year}</span>
      </div>
    </div>
  );
}

/* ============================================================
   旅するカード（ステージ内を移動する1枚）
   ------------------------------------------------------------
   スクロール由来のポーズ（poseAt）に、見せ終わった後（カーブ以降）は
   時間ベースの「揺れ」を合成する。毎フレーム useAnimationFrame で更新。
   ============================================================ */
function JourneyPoster({
  poster,
  index,
  total,
  progress,
  W,
  finalRef,
}: {
  poster: Poster;
  index: number;
  total: number;
  progress: MotionValue<number>;
  W: number;
  finalRef: { current: { active: boolean; startMs: number } };
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const z = useMotionValue(0);
  const scale = useMotionValue(SCALE_EDGE);
  const opacity = useMotionValue(0);
  const rotateZ = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const blur = useMotionValue(0);
  const filter = useMotionTemplate`blur(${blur}px)`;

  const { start, life } = lifeSpan(index, total);
  const isLast = index === total - 1; // 最後のカードは中央でスティックして終わる

  useAnimationFrame((tMs) => {
    const p = progress.get();

    // ── 集合演出ゾーン（最後のカードが中央に到達した以降）──────
    // ここから先はスクロール連動ではなく「時間ベース」のアニメーション。
    // 入った瞬間の時刻を起点に、経過時間 elapsed で進める。
    if (p >= P_STICK) {
      if (!finalRef.current.active) {
        finalRef.current.active = true;
        finalRef.current.startMs = tMs;
      }
      const elapsed = tMs - finalRef.current.startMs;

      if (isLast) {
        // 中央でスティックしつつ、だんだん小さくなる（最前面）
        const t = easeInOut(clamp01(elapsed / ASSEMBLE_MS));
        x.set(0);
        y.set(0);
        z.set(40); // 後ろのカードより手前＝被られない
        scale.set(lerp(SCALE_SHOW, SCALE_STICK, t));
        opacity.set(1);
        rotateZ.set(0);
        rotateY.set(0);
        blur.set(0);
      } else if (total >= MARQUEE_THRESHOLD) {
        // 10枚以上：円ではなく、中央ポスターの上段/下段で
        // 右端 → 左端へ無限に平行移動（マーキー）。
        const nPast = total - 1;
        const row = index % 2; // 0=上段, 1=下段
        const cnt = Math.max(1, row === 0 ? Math.ceil(nPast / 2) : Math.floor(nPast / 2));
        const slot = Math.floor(index / 2);
        const span = W * 1.4; // 端の外〜外（ラップは画面外で起こる）
        const speed = span / MARQUEE_PERIOD_MS;
        // q は 0→span を周回。x は span/2 → -span/2（右→左）。ラップで右端へ戻る。
        const q = ((((slot / cnt) * span + elapsed * speed) % span) + span) % span;
        x.set(span / 2 - q);
        y.set(row === 0 ? -W * MARQUEE_ROW_Y : W * MARQUEE_ROW_Y);
        z.set(-40); // 中央のスティックカードより奥
        scale.set(SCALE_RING);
        opacity.set(clamp01(elapsed / 400)); // 開始時だけふわっと表示
        rotateZ.set(0);
        rotateY.set(0);
        blur.set(0);
      } else {
        // 円は時計回りに公転し続ける（y下向き座標では角度増加＝時計回り）
        const orbit = (elapsed / ORBIT_PERIOD_MS) * Math.PI * 2;
        const base = -Math.PI / 2 + (index / (total - 1)) * Math.PI * 2;
        const ang = base + orbit;
        const R = W * RING_FRAC;
        const ringX = Math.cos(ang) * R;
        const ringY = Math.sin(ang) * R;

        // 画面外の右端 →（中央ポスターの下＝下/裏を通る）→ 円スロット
        const ti = easeOut(clamp01((elapsed - index * STAGGER_MS) / ASSEMBLE_MS));
        const px = bezier2(W * 0.85, W * 0.05, ringX, ti); // 右外 → 中央下 → スロット
        const py = bezier2(W * 0.15, W * 0.5, ringY, ti);

        x.set(px);
        y.set(py);
        z.set(-40 - 220 * Math.sin(Math.PI * ti)); // 中央より奥。途中はさらに裏（下）を通る
        scale.set(lerp(SCALE_RING * 0.5, SCALE_RING, ti));
        opacity.set(clamp01(ti * 2));
        rotateZ.set(0);
        rotateY.set(0);
        blur.set(0);
      }
      return;
    }

    // ゾーンを出たら（上にスクロールで戻ったら）アニメをリセットして旅へ戻す
    if (finalRef.current.active) finalRef.current.active = false;

    const u = clamp01((p - start) / life); // このカードの生存進捗
    const pose = poseAt(u, W);

    x.set(pose.x);
    y.set(pose.y);
    z.set(pose.z);
    scale.set(pose.scale);
    opacity.set(pose.opacity);
    rotateZ.set(0);
    rotateY.set(0);
    blur.set(pose.blur);
  });

  return (
    <motion.div
      className="absolute flex flex-col items-center"
      style={{ x, y, z, scale, opacity, rotateZ, rotateY, filter, transformStyle: "preserve-3d" }}
    >
      <div className="aspect-3/4" style={{ width: W * 0.6 }}>
        <Photo poster={poster} />
      </div>
    </motion.div>
  );
}

/* ============================================================
   背景：いま画面中央（見せ場）にいるカードをブラーした背景。
   進捗に応じてクロスフェード（ステージ＝スマホ幅カラム内に表示）。
   ============================================================ */
function BlurBackdrop({
  poster,
  index,
  total,
  progress,
}: {
  poster: Poster;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const { start, life } = lifeSpan(index, total);
  // 背景もカードと一緒にスティックする：
  // 近づくにつれ現れ（①）、スティック中(②: SEG_A→SEG_D)は出しっぱなし、
  // カードが左へ消えるのに合わせて（③）フェードアウトする。
  const opacity = useTransform(progress, (p) => {
    const u = (p - start) / life;
    if (u < SEG_A) return clamp01(u / SEG_A);
    if (u <= SEG_D) return 1;
    return clamp01(1 - (u - SEG_D) / (1 - SEG_D));
  });

  return (
    <motion.div className="absolute inset-0" style={{ opacity }}>
      {poster.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster.src}
          alt=""
          aria-hidden
          className="h-full w-full scale-125 object-cover"
          style={{ filter: "blur(0px) brightness(0.85) saturate(1.1)" }}
        />
      ) : (
        <div className="h-full w-full bg-linear-to-br from-[#1a1a2e] to-[#0a0a16]" />
      )}
    </motion.div>
  );
}

/* ============================================================
   集合演出の背景：スティックされる（最後の）カードのブラー画像。
   P_STICK 直前でフェードインし、以降ずっと表示し続ける。
   ============================================================ */
function ConstellationBackground({
  poster,
  progress,
}: {
  poster: Poster;
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(progress, (p) => clamp01((p - (P_STICK - 0.04)) / 0.04));
  return (
    <motion.div className="absolute inset-0" style={{ opacity }}>
      {poster.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster.src}
          alt=""
          aria-hidden
          className="h-full w-full scale-125 object-cover"
          style={{ filter: "blur(0px) brightness(0.6) saturate(1.15)" }}
        />
      ) : (
        <div className="h-full w-full bg-linear-to-br from-[#1a1a2e] to-[#0a0a16]" />
      )}
    </motion.div>
  );
}

/* ============================================================
   スティック中に画面下部から現れるテキスト。
   年度／タイトル／説明文で、それぞれ別種の「おしゃれ」アニメ。
   show が true になった瞬間に登場（戻れば隠れて再生し直す）。
   ============================================================ */
const SMOOTH = [0.16, 1, 0.3, 1] as const; // ease-out-expo 風（おしゃれ）

function StickText({ poster, show }: { poster: Poster; show: boolean }) {
  const title = poster.title ?? poster.note;
  const desc = poster.desc ?? "";
  const titleChars = Array.from(title);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-linear-to-t from-black/85 via-black/45 to-transparent px-7 pb-10 pt-28 text-white">
      {/* 年度：マスクの下から せり上がる（+ ぼかし解除） */}
      <div className="overflow-hidden">
        <motion.div
          initial={{ y: "115%", opacity: 0, filter: "blur(10px)" }}
          animate={show ? { y: "0%", opacity: 1, filter: "blur(0px)" } : { y: "115%", opacity: 0, filter: "blur(10px)" }}
          transition={{ duration: 0.9, ease: SMOOTH, delay: 0.15 }}
          className="font-display text-6xl font-bold leading-none tracking-tight"
        >
          {poster.year}
        </motion.div>
      </div>

      {/* タイトル：1文字ずつ 3Dフリップで スタッガー登場 */}
      <motion.h3
        aria-label={title}
        className="mt-3 flex flex-wrap font-display text-2xl font-semibold"
        style={{ perspective: 600 }}
        initial="hidden"
        animate={show ? "show" : "hidden"}
        variants={{
          show: { transition: { staggerChildren: 0.045, delayChildren: 0.55 } },
          hidden: {},
        }}
      >
        {titleChars.map((c, i) => (
          <motion.span
            key={i}
            className="inline-block"
            style={{ transformOrigin: "bottom center" }}
            variants={{
              hidden: { y: "0.7em", opacity: 0, rotateX: -90 },
              show: { y: 0, opacity: 1, rotateX: 0 },
            }}
            transition={{ duration: 0.5, ease: SMOOTH }}
          >
            {c === " " ? " " : c}
          </motion.span>
        ))}
      </motion.h3>

      {/* 説明文：トラッキング（字間）を詰めながら フェードアップ（+ ぼかし解除） */}
      <motion.p
        initial={{ opacity: 0, y: 16, letterSpacing: "0.45em", filter: "blur(5px)" }}
        animate={
          show
            ? { opacity: 1, y: 0, letterSpacing: "0.02em", filter: "blur(0px)" }
            : { opacity: 0, y: 16, letterSpacing: "0.45em", filter: "blur(5px)" }
        }
        transition={{ duration: 1.1, ease: SMOOTH, delay: 1.15 }}
        className="mt-4 max-w-md text-sm leading-relaxed text-white/80"
      >
        {desc}
      </motion.p>
    </div>
  );
}

/* ============================================================
   後ろの履歴プール：カーブを終えて見せ終わった直近のカードを、
   画面の見える範囲に小さく（中央の約1/5）並べて待機させる。
   ・最大 BACK_POOL_MAX 枚。新しい1枚が入ると、古い1枚が抜ける。
   ・登場は opacity 0.3 → 1。退場はフェードアウト。
   ・activeIndex（いま中央のカード）の手前の数枚を表示する。
   ============================================================ */
function BackPool({ activeIndex, W }: { activeIndex: number; W: number }) {
  // 直近に見せ終わった数枚（古い→新しい順）。activeIndex 自身は今中央なので含めない。
  const slots: number[] = [];
  for (let k = BACK_POOL_MAX; k >= 1; k--) {
    const idx = activeIndex - k;
    if (idx >= 0) slots.push(idx);
  }
  const size = W * 0.6 * BACK_POOL_SCALE; // 中央カード幅(W*0.6)の約1/5

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[15%] z-10 flex items-end justify-center gap-3">
      <AnimatePresence mode="popLayout">
        {slots.map((idx) => (
          <motion.div
            key={POSTERS[idx].year}
            layout
            initial={{ opacity: 0.3, scale: 0.7, y: -14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.4 } }}
            transition={{ duration: 0.6, ease: SMOOTH }}
            style={{ width: size }}
          >
            <div className="aspect-3/4">
              <Photo poster={POSTERS[idx]} />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
   reduced-motion 用フォールバック（アニメ無効・全部静止表示）
   ============================================================ */
function ReducedFallback() {
  return (
    <main className="min-h-screen bg-[#0a0a16] px-6 py-20 text-white">
      <h1 className="mb-12 text-center font-display text-3xl">これまでの、歩み。</h1>
      <div className="mx-auto grid max-w-md grid-cols-2 gap-6">
        {POSTERS.map((poster) => (
          <div key={poster.year}>
            <div className="aspect-3/4 w-full">
              <Photo poster={poster} />
            </div>
            <p className="mt-2 text-center text-sm font-bold">{poster.year}</p>
            <p className="text-center text-xs text-white/60">{poster.note}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

/* ============================================================
   ページ本体
   ============================================================ */
export default function HistoryJourneyPage() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const barScaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.04], [1, 0]);

  // 集合演出（時間ベース）の共有状態。ゾーンに入った瞬間の時刻を保持する。
  const finalRef = useRef({ active: false, startMs: 0 });

  // いま画面中央に来ている（=見せ場の）カードの index。下部キャプションに使う。
  // 年度が変わるたびに同じ演出でテキストを出し直す（key で remount）。
  const [activeIndex, setActiveIndex] = useState(0);
  const [inFinal, setInFinal] = useState(false); // 最後の集合演出中か（プールは隠す）
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setInFinal(v >= P_STICK);
    if (v >= P_STICK) {
      setActiveIndex(TOTAL - 1); // スティック以降は最後のカードで固定
      return;
    }
    // スティック中央(u=(SEG_A+SEG_D)/2)に最も近いカードを選ぶ
    const step = TOTAL > 1 ? P_STICK / (TOTAL - 1 + SEG_A * JOURNEY_OVERLAP) : 1;
    const centerMid = ((SEG_A + SEG_D) / 2) * JOURNEY_OVERLAP;
    const idx = Math.round(v / step - centerMid);
    setActiveIndex(Math.max(0, Math.min(TOTAL - 1, idx)));
  });

  // ステージ（スマホ幅カラム）の実幅。PC でもこの幅を超えない。
  const [W, setW] = useState(MOBILE_W);
  useEffect(() => {
    const update = () => setW(Math.min(window.innerWidth, MOBILE_W));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (reduce) return <ReducedFallback />;

  const total = POSTERS.length;

  return (
    <main ref={ref} className="relative w-full bg-[#b3deeb]" style={{ height: `${TOTAL_SCREENS * 100}vh` }}>
      <StyleBlock />

      {/* 上部プログレスバー */}
      <motion.div
        style={{ scaleX: barScaleX }}
        className="fixed inset-x-0 top-0 z-50 h-1 origin-left bg-linear-to-r from-amber-400 via-rose-500 to-violet-600"
      />

      {/* sticky：全幅は #b3deeb（レターボックス）、中身はスマホ幅カラムを中央寄せ */}
      <div className="sticky top-0 flex h-screen w-full items-stretch justify-center bg-[#b3deeb]">
        <div
          className="relative h-full overflow-hidden bg-[#0a0a16]"
          style={{
            width: `min(100vw, ${MOBILE_W}px)`,
            perspective: `${PERSPECTIVE}px`,
            // PC ではレターボックス（#b3deeb）の中で中央カラムを際立たせる影。
            // スマホではカラムが画面端まで広がるため、影は画面外になり無害。
            boxShadow:
              "0 30px 80px rgba(0,0,0,0.45), 0 10px 30px rgba(0,0,0,0.35)",
          }}
        >
          {/* 背景（中央ポスターのブラー） */}
          <div className="absolute inset-0 bg-[#0a0a16]">
            {POSTERS.map((poster, i) => (
              <BlurBackdrop key={poster.year} poster={poster} index={i} total={total} progress={scrollYProgress} />
            ))}
            {/* 集合演出中の背景＝スティックされる最後のカードのブラー */}
            <ConstellationBackground poster={POSTERS[total - 1]} progress={scrollYProgress} />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_45%,transparent_45%,rgba(0,0,0,0.7)_100%)]" />
          </div>

          {/* ポスター群 */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ transformStyle: "preserve-3d" }}
          >
            {POSTERS.map((poster, i) => (
              <JourneyPoster
                key={poster.year}
                poster={poster}
                index={i}
                total={total}
                progress={scrollYProgress}
                W={W}
                finalRef={finalRef}
              />
            ))}
          </div>

          {/* 後ろの履歴プール（カーブを終えた直近カードを小さく待機）。集合演出中は隠す */}
          {!inFinal && <BackPool activeIndex={activeIndex} W={W} />}

          {/* 画面下部の 年度／タイトル／説明文。中央のカードに追従し、
              年度が変わるたびに key で remount して同じ演出を再生する。 */}
          <StickText key={activeIndex} poster={POSTERS[activeIndex]} show />

          {/* 見出し */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center pt-8 text-center">
            <p className="text-[11px] tracking-[0.4em] text-white/50">NANKOSAI — HISTORY</p>
            <h1 className="mt-2 font-display text-2xl text-white/90">これまでの、歩み。</h1>
          </div>

          {/* スクロールヒント */}
          <motion.div
            style={{ opacity: hintOpacity }}
            className="pointer-events-none absolute inset-x-0 bottom-8 z-10 text-center text-xs tracking-[0.3em] text-white/50"
          >
            SCROLL ↓
          </motion.div>
        </div>
      </div>
    </main>
  );
}

/* ============================================================
   フォント等
   ============================================================ */
function StyleBlock() {
  return (
    <style>{`
      .font-display { font-family: 'Kaisei Decol', serif; }
    `}</style>
  );
}
