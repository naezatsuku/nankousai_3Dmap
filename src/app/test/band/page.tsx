'use client'

import { useState, useEffect, useRef } from 'react'

// ─── 仮データ ──────────────────────────────────────────────────
type Band = {
  name: string
  members: string
  /** カルーセル背景グラデーション（仮画像） */
  slideBg: string
  /** タイムラインのサムネ背景（仮画像） */
  thumbBg: string
  /** スライド中央のロゴ風表示 */
  overlay: { text?: string; icon?: string; style?: React.CSSProperties }
  /** サムネ内の表示 */
  thumb: { text?: string; icon?: string; style?: React.CSSProperties }
  time: string
  /** モーダル用 */
  instagram?: string
  message?: string
  /** 動画カード（仮） */
  video?: {
    bg: string
    title: string
    thanks: string
    next: string
    pov: string
  }
}

const BANDS: Band[] = [
  {
    name: 'ノーチラス',
    members: 'Gt./Vo._ ibu　　Dr._ johnny\nBa._ ryo　　　Key._ kanato\nGt._ hibiki',
    slideBg: 'linear-gradient(135deg, #c9a882 0%, #a07850 40%, #2a5c6a 100%)',
    thumbBg: 'linear-gradient(135deg, #c9a882, #2a5c6a)',
    overlay: { text: 'ノーチラス', style: {} },
    thumb: { text: '手書き' },
    time: '11:46 - 12:01',
    instagram: 'ノーチラス',
    message: 'みんな知ってる曲をやるので、ご飯前にぜひ来てください！！！！めっちゃ盛り上げます！！！！',
    video: {
      bg: 'linear-gradient(160deg, #d06820 0%, #b04010 60%, #803000 100%)',
      title: '舞台の部',
      thanks: 'ありがとうございました',
      next: '明日は11:38〜です！\nぜひきてね',
      pov: 'POV:@johnny303303',
    },
  },
  {
    name: 'Rush',
    members: 'Vo._ ???　　Gt._ ???\nBa._ ???　　Dr._ ???',
    slideBg: 'linear-gradient(135deg, #3a3a3a 0%, #8b6914 60%, #2a1a0a 100%)',
    thumbBg: 'linear-gradient(135deg, #c8a000, #3a2a00)',
    overlay: { text: 'Rush', style: { fontSize: 52, letterSpacing: 6, color: '#f0c040' } },
    thumb: { text: 'Rush', style: { fontSize: 22, fontWeight: 900, fontFamily: 'serif' } },
    time: '12:05 - 12:16',
  },
  {
    name: 'RAdit',
    members: 'Vo._ ???　　Gt._ ???\nBa._ ???　　Dr._ ???',
    slideBg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    thumbBg: '#111',
    overlay: { icon: '🎸' },
    thumb: { icon: '🎸', style: { fontSize: 28 } },
    time: '12:31 - 12:47',
  },
  {
    name: 'つばめびより。',
    members: 'Vo._ ???　　Gt._ ???\nBa._ ???　　Dr._ ???',
    slideBg: 'linear-gradient(135deg, #2d1b1b 0%, #8b2c2c 60%, #3d0000 100%)',
    thumbBg: '#111',
    overlay: { icon: '🎵' },
    thumb: { text: 'RAdit\n⭐', style: { fontSize: 10, color: '#aaa', padding: 4, textAlign: 'center' } },
    time: '12:51 - 13:08',
  },
  {
    name: 'Band 5',
    members: 'メンバー情報未定',
    slideBg: 'linear-gradient(135deg, #1a2a1a 0%, #2d5a27 50%, #0a1a0a 100%)',
    thumbBg: 'linear-gradient(135deg, #ffccdd, #ff88aa)',
    overlay: { icon: '🎤' },
    thumb: { icon: '🎀', style: { fontSize: 20 } },
    time: '14:10 - 14:28',
  },
  {
    name: 'Band 6',
    members: 'メンバー情報未定',
    slideBg: 'linear-gradient(135deg, #2a1a3e 0%, #6b2d8b 60%, #1a0a2a 100%)',
    thumbBg: 'linear-gradient(135deg, #334466, #99bbdd)',
    overlay: { icon: '🥁' },
    thumb: { icon: '🎵', style: { fontSize: 20 } },
    time: '14:35 - 14:52',
  },
  {
    name: 'Band 7',
    members: 'メンバー情報未定',
    slideBg: 'linear-gradient(135deg, #1a1818 0%, #4a3020 50%, #8b6030 100%)',
    thumbBg: 'linear-gradient(135deg, #223300, #66aa00)',
    overlay: { icon: '🎹' },
    thumb: { icon: '🎸', style: { fontSize: 20 } },
    time: '15:00 - 15:18',
  },
  {
    name: 'Band 8',
    members: 'メンバー情報未定',
    slideBg: 'linear-gradient(135deg, #0a2a3a 0%, #1a5a6a 50%, #0a3a4a 100%)',
    thumbBg: 'linear-gradient(135deg, #330033, #cc00cc)',
    overlay: { icon: '🎺' },
    thumb: { icon: '🎺', style: { fontSize: 20 } },
    time: '15:25 - 15:43',
  },
  {
    name: 'Band 9',
    members: 'メンバー情報未定',
    slideBg: 'linear-gradient(135deg, #3a2a0a 0%, #8b7020 60%, #4a3a10 100%)',
    thumbBg: 'linear-gradient(135deg, #442200, #cc6600)',
    overlay: { icon: '🎻' },
    thumb: { icon: '🥁', style: { fontSize: 20 } },
    time: '15:50 - 16:10',
  },
]

// ─── ページ ────────────────────────────────────────────────────
export default function TestBandPage() {
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startXRef = useRef(0)
  const carouselRef = useRef<HTMLDivElement>(null)
  const total = BANDS.length

  // モーダル：開いているバンドの index（null で非表示）
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  // 現在中央にあるカードの index（背景画像・右側パネルの切り替えに使用）
  const [centerIdx, setCenterIdx] = useState(0)

  // カルーセル（固定エリア）の高さ。右側パネルの縦中央位置の計算に使う
  const [carouselHeight, setCarouselHeight] = useState(0)
  useEffect(() => {
    const update = () => setCarouselHeight(carouselRef.current?.getBoundingClientRect().height ?? 0)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const startAuto = () => {
    stopAuto()
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % total)
    }, 3000)
  }
  const stopAuto = () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }

  useEffect(() => {
    startAuto()
    return stopAuto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goTo = (idx: number) => setCurrent(Math.max(0, Math.min(idx, total - 1)))

  return (
    <div
      style={{
        position: 'relative',
        fontFamily: "'Kiwi Maru', serif",
        maxWidth: 430,
        margin: '0 auto',
        minHeight: '100vh',
      }}
    >
      <style>{`@keyframes none {}`}</style>

      {/* ── 中央カードの画像を反映する背面背景（ブラーなし／上下を暗く） ── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          maxWidth: 430,
          margin: '0 auto',
          zIndex: -1,
          background: BANDS[centerIdx].slideBg,
          transition: 'background 0.4s ease',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.6) 100%)',
          }}
        />
      </div>

      {/* ── カルーセル＋直下の余白バー（ひとまとまりで固定表示。下のカードリストだけがスクロールする） ── */}
      <div
        ref={carouselRef}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          width: '100%',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            overflow: 'hidden',
            background: '#222',
          }}
          onTouchStart={(e) => {
            startXRef.current = e.touches[0].clientX
            stopAuto()
          }}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - startXRef.current
            if (dx < -40) goTo(current + 1)
            else if (dx > 40) goTo(current - 1)
            startAuto()
          }}
        >
          <div
            style={{
              display: 'flex',
            width: '100%',
            height: '100%',
            transition: 'transform 0.5s cubic-bezier(.4,0,.2,1)',
            transform: `translateX(-${current * 100}%)`,
          }}
        >
          {BANDS.map((band, i) => (
            <div
              key={i}
              onClick={() => setOpenIdx(i)}
              style={{
                minWidth: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'flex-end',
                background: band.slideBg,
                cursor: 'pointer',
              }}
            >
              {/* 中央オーバーレイ（仮ロゴ） */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {band.overlay.icon ? (
                  <span style={{ fontSize: 56, opacity: 0.7 }}>{band.overlay.icon}</span>
                ) : (
                  <span
                    style={{
                      fontFamily: "'Courier New', monospace",
                      color: 'rgba(30,30,60,0.85)',
                      fontSize: 42,
                      fontWeight: 700,
                      letterSpacing: 4,
                      transform: 'rotate(-5deg)',
                      textShadow: '2px 2px 0 rgba(0,0,0,0.1)',
                      ...band.overlay.style,
                    }}
                  >
                    {band.overlay.text}
                  </span>
                )}
              </div>

              {/* 下部情報 */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '20px 16px 16px',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
                  color: '#fff',
                }}
              >
                <div style={{ fontFamily: "'Kaisei Decol', serif", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{band.name}</div>
                <div
                  style={{
                    fontSize: 11,
                    lineHeight: 1.7,
                    opacity: 0.9,
                    fontStyle: 'italic',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {band.members}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ドット */}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            right: 12,
            display: 'flex',
            gap: 5,
          }}
        >
          {BANDS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: i === current ? '#fff' : 'rgba(255,255,255,0.4)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>
        </div>
      </div>

      {/* ── 新しい固定ブロック（画面下部に固定。高さ30vh。モーダルの画像・動画以外の情報を表示） ── */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          maxWidth: 430,
          margin: '0 auto',
          zIndex: 4,
          width: '100%',
          height: '30vh',
          background: 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
          overflowY: 'auto',
          padding: '10px 20px 20px',
          boxSizing: 'border-box',
        }}
      >
        {/* ハンドル（装飾） */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 10px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.15)' }} />
        </div>

        {/* バンド名 */}
        <div
          style={{
            fontFamily: "'Kaisei Decol', serif",
            fontSize: 19,
            fontWeight: 700,
            color: '#1a1a1a',
            marginBottom: 4,
          }}
        >
          {BANDS[centerIdx].name}
        </div>

        {/* 時間 */}
        <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
          9/13　{BANDS[centerIdx].time}
        </div>

        {/* Instagram */}
        {BANDS[centerIdx].instagram && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
              <defs>
                <radialGradient id="ig-grad-bottom" cx="30%" cy="107%">
                  <stop offset="0%" stopColor="#fdf497" />
                  <stop offset="5%" stopColor="#fdf497" />
                  <stop offset="45%" stopColor="#fd5949" />
                  <stop offset="60%" stopColor="#d6249f" />
                  <stop offset="90%" stopColor="#285AEB" />
                </radialGradient>
              </defs>
              <rect width="24" height="24" rx="6" fill="url(#ig-grad-bottom)" />
              <circle cx="12" cy="12" r="4.5" fill="none" stroke="white" strokeWidth="2" />
              <circle cx="17.5" cy="6.5" r="1.5" fill="white" />
            </svg>
            <span style={{ fontSize: 12, color: '#555', fontWeight: 600 }}>
              {BANDS[centerIdx].instagram}
            </span>
          </div>
        )}

        {/* 区切り線 */}
        {(BANDS[centerIdx].instagram || BANDS[centerIdx].message) && (
          <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '0 0 12px' }} />
        )}

        {/* メッセージ */}
        {BANDS[centerIdx].message && (
          <p style={{ fontSize: 13, lineHeight: 1.8, color: '#222', margin: 0 }}>
            {BANDS[centerIdx].message}
          </p>
        )}
      </div>

      {/* ── カード一覧（音ゲー選曲風 / スクロール連動フォーカス） ── */}
      <FocusCardList
        bands={BANDS}
        onSelect={(i) => setOpenIdx(i)}
        fixedTopRef={carouselRef}
        onCenterChange={setCenterIdx}
      />

      {/* ── 右側パネル（音ゲーの選曲情報のように、中央カードに対応する情報を常時表示） ── */}
      <div
        style={{
          position: 'fixed',
          top: carouselHeight,
          left: 0,
          right: 0,
          bottom: 30,
          maxWidth: 430,
          margin: '0 auto',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        {/* すりガラスの枠（あらかじめ確保された表示エリア） */}
        <div
          style={{
            position: 'absolute',
            top: '33%',
            right: 14,
            transform: 'translateY(-50%)',
            width: '46%',
            pointerEvents: 'auto',
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: 16,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* 画像（仮） */}
          <div
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              borderRadius: 10,
              overflow: 'hidden',
              background: BANDS[centerIdx].thumbBg,
              border: '1px solid rgba(255,255,255,0.25)',
              boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: BANDS[centerIdx].thumb.icon ? 46 : 13,
              fontWeight: 700,
              color: '#fff',
              textAlign: 'center',
              whiteSpace: 'pre-line',
              transition: 'background 0.3s ease',
            }}
          >
            {BANDS[centerIdx].thumb.icon ?? BANDS[centerIdx].thumb.text}
          </div>

          {/* バンド名 */}
          <div
            style={{
              fontFamily: "'Kaisei Decol', serif",
              fontSize: 14,
              fontWeight: 700,
              color: '#1a1a1a',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            {BANDS[centerIdx].name}
          </div>

          {/* 時間 */}
          <div style={{ fontSize: 11, color: '#444', textAlign: 'center' }}>
            {BANDS[centerIdx].time}
          </div>
        </div>
      </div>

      {/* ── モーダル ── */}
      {openIdx !== null && (
        <BandModal band={BANDS[openIdx]} onClose={() => setOpenIdx(null)} />
      )}
    </div>
  )
}

// ─── 音ゲー選曲風 / スクロール連動フォーカスリスト ─────────────────
function FocusCardList({
  bands, onSelect, fixedTopRef, onCenterChange,
}: {
  bands: Band[]
  onSelect: (i: number) => void
  /** sticky 表示される固定エリア（カルーセル）の参照。これより下を「表示領域」として中心を計算する */
  fixedTopRef: React.RefObject<HTMLDivElement | null>
  /** 現在中央に最も近いカードの index が変わったときに呼ばれる */
  onCenterChange?: (idx: number) => void
}) {
  const N = bands.length
  // 無限スクロール用に3セット分（前/現在/次）を並べてレンダリングする
  const loopBands = [...bands, ...bands, ...bands]

  const refs = useRef<(HTMLDivElement | null)[]>([])
  // 各カードのフォーカス度（0=遠い, 1=画面中央）
  const [focus, setFocus] = useState<number[]>(() => loopBands.map(() => 0))
  const lastCenterRef = useRef(-1)
  const initializedRef = useRef(false)

  useEffect(() => {
    let raf = 0
    let snapTimer: ReturnType<typeof setTimeout> | null = null
    let snapping = false

    const getCenterY = () => {
      const fixedHeight = fixedTopRef.current?.getBoundingClientRect().height ?? 0
      return fixedHeight + (window.innerHeight - fixedHeight) *0.3
    }

    // 中央のセット（インデックス N〜2N-1）の開始位置に、見た目を変えずに瞬間移動する
    const initialScroll = () => {
      const startEl = refs.current[N]
      if (!startEl) return
      const fixedHeight = fixedTopRef.current?.getBoundingClientRect().height ?? 0
      const r = startEl.getBoundingClientRect()
      window.scrollTo({ top: window.scrollY + r.top - fixedHeight, behavior: 'auto' })
    }

    // セット1つ分の高さ（カード+gap）。先頭セットと中央セットの同じ位置のカードの差分から算出
    const getOneSetHeight = () => {
      const a = refs.current[0]
      const b = refs.current[N]
      if (!a || !b) return 0
      return b.getBoundingClientRect().top - a.getBoundingClientRect().top
    }

    const update = () => {
      const fixedHeight = fixedTopRef.current?.getBoundingClientRect().height ?? 0
      const centerY = getCenterY()
      const threshold = (window.innerHeight - fixedHeight) * 0.5
      let bestIdx = -1
      let bestFocus = -1
      const next = refs.current.map((el, i) => {
        if (!el) return 0
        const r = el.getBoundingClientRect()
        const cardCenter = r.top + r.height / 2
        const dist = Math.abs(cardCenter - centerY)
        const f = Math.max(0, 1 - dist / threshold)
        if (f > bestFocus) {
          bestFocus = f
          bestIdx = i
        }
        return f
      })

      // 中央のカードが前/次セットに入ったら、同じ見た目のまま中央セットへ瞬間移動
      if (bestIdx !== -1 && (bestIdx < N || bestIdx >= N * 2)) {
        const oneSetHeight = getOneSetHeight()
        if (oneSetHeight > 0) {
          const dir = bestIdx < N ? 1 : -1
          window.scrollTo({ top: window.scrollY + dir * oneSetHeight, behavior: 'auto' })
          return
        }
      }

      setFocus(next)
      if (bestIdx !== -1) {
        const realIdx = bestIdx % N
        if (realIdx !== lastCenterRef.current) {
          lastCenterRef.current = realIdx
          onCenterChange?.(realIdx)
        }
      }
    }

    // スクロール停止後、最も近いカードを中央へスナップ
    const snapToNearest = () => {
      const centerY = getCenterY()
      let nearestEl: HTMLDivElement | null = null
      let nearestDist = Infinity
      // 中央セット（コピー1: N〜2N-1）だけを対象にする。前後コピーは見た目が同じ重複のため対象外
      for (let i = N; i < N * 2; i++) {
        const el = refs.current[i]
        if (!el) continue
        const r = el.getBoundingClientRect()
        const dist = Math.abs(r.top + r.height / 2 - centerY)
        if (dist < nearestDist) {
          nearestDist = dist
          nearestEl = el
        }
      }
      if (!nearestEl || nearestDist < 1) return
      const r = (nearestEl as HTMLDivElement).getBoundingClientRect()
      const delta = r.top + r.height / 2 - centerY
      snapping = true
      window.scrollBy({ top: delta, behavior: 'smooth' })
      // smooth スクロール完了の目安でフラグを戻す
      setTimeout(() => { snapping = false }, 400)
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)

      if (snapping) return
      if (snapTimer) clearTimeout(snapTimer)
      snapTimer = setTimeout(snapToNearest, 140)
    }

    if (!initializedRef.current) {
      initializedRef.current = true
      initialScroll()
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
      if (snapTimer) clearTimeout(snapTimer)
    }
  }, [N, fixedTopRef, onCenterChange])

  return (
    <div
      style={{
        // 上下に固定の余白（情報パネルの余白と統一）
        // 左に20pxの余白 → 中央フォーカス時はここを基準にカード全体が見える
        padding: '30px 0 30px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        overflowX: 'hidden',
      }}
    >
      {loopBands.map((band, i) => {
        const t = focus[i] ?? 0
        // 円柱の側面感：中央から離れるほど縮小し、左へ沈み込んで端が隠れる
        const scale = 0.7 + t * 0.3
        const op = 0.45 + t * 0.55
        const sink = (1 - t) * 20 // 0(中央)〜20%(端) ぶん左へ沈み込む

        return (
          <div
            key={i}
            ref={(el) => { refs.current[i] = el }}
            onClick={() => onSelect(i % N)}
            style={{
              width: '46%',
              alignSelf: 'flex-start',
              transformOrigin: 'left center',
              transform: `translateX(-${sink}%) scale(${scale})`,
              opacity: op,
              transition: 'transform 0.18s ease-out, opacity 0.18s ease-out',
              cursor: 'pointer',
              willChange: 'transform',
            }}
          >
            <div
              style={{
                background: t > 0.6
                  ? 'linear-gradient(135deg,#1a1a1a,#3a3a3a)'
                  : '#fff',
                color: t > 0.6 ? '#fff' : '#1a1a1a',
                border: t > 0.6 ? '1px solid #1a1a1a' : '1px solid #e6e6e6',
                boxShadow: t > 0.6
                  ? '0 8px 24px rgba(0,0,0,0.28)'
                  : '0 2px 8px rgba(0,0,0,0.06)',
                padding: '10px 12px',
                transition: 'all 0.2s ease-out',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  marginBottom: 3,
                  letterSpacing: 0.5,
                  color: t > 0.6 ? 'rgba(255,255,255,0.7)' : '#999',
                }}
              >
                {band.time}
              </div>
              <div
                style={{
                  fontFamily: "'Kaisei Decol', serif",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                {band.name}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── モーダル ──────────────────────────────────────────────────
function BandModal({ band, onClose }: { band: Band; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          width: 360,
          maxWidth: '100%',
          overflow: 'hidden',
          border: '0.5px solid #e0e0e0',
        }}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: '16px 16px 12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            borderBottom: '0.5px solid #e8e8e8',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Kaisei Decol', serif", fontSize: 20, fontWeight: 600, color: '#111', marginBottom: 2 }}>
              {band.name}
            </div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>9/13　{band.time}</div>
            {band.instagram && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                  <defs>
                    <radialGradient id="ig-grad" cx="30%" cy="107%">
                      <stop offset="0%" stopColor="#fdf497" />
                      <stop offset="5%" stopColor="#fdf497" />
                      <stop offset="45%" stopColor="#fd5949" />
                      <stop offset="60%" stopColor="#d6249f" />
                      <stop offset="90%" stopColor="#285AEB" />
                    </radialGradient>
                  </defs>
                  <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
                  <circle cx="12" cy="12" r="4.5" fill="none" stroke="white" strokeWidth="2" />
                  <circle cx="17.5" cy="6.5" r="1.5" fill="white" />
                </svg>
                <span style={{ fontSize: 12, color: '#555' }}>{band.instagram}</span>
              </div>
            )}
          </div>

          {/* バンドロゴ（仮画像） */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 10,
              background: band.thumbBg,
              flexShrink: 0,
              border: '0.5px solid #ddd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              fontSize: band.thumb.icon ? 28 : 11,
              fontWeight: 700,
              color: '#fff',
              textAlign: 'center',
              whiteSpace: 'pre-line',
            }}
          >
            {band.thumb.icon ?? band.thumb.text}
          </div>
        </div>

        {/* 本文 */}
        <div style={{ padding: '14px 16px 16px' }}>
          {band.message && (
            <p style={{ fontSize: 15, lineHeight: 1.75, color: '#111', marginBottom: 14 }}>
              {band.message}
            </p>
          )}

          {band.video ? (
            <div style={{ borderRadius: 12, overflow: 'hidden', background: '#c05010' }}>
              {/* 動画サムネ（仮） */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16 / 10',
                  background: band.video.bg,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* 再生ボタン */}
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderTop: '12px solid transparent',
                      borderBottom: '12px solid transparent',
                      borderLeft: '20px solid rgba(255,255,255,0.75)',
                      marginLeft: 4,
                    }}
                  />
                </div>

                {/* 下部テキストオーバーレイ */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '10px 12px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ color: '#fff', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
                    {band.video.title}
                  </p>
                  <p style={{ color: '#fff', fontSize: 12, marginBottom: 6 }}>{band.video.thanks}</p>
                  <p
                    style={{
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: 11,
                      marginBottom: 4,
                      lineHeight: 1.5,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {band.video.next}
                  </p>
                  <p style={{ color: '#f0a000', fontSize: 11, fontWeight: 600 }}>{band.video.pov}</p>
                </div>
              </div>

              {/* ドットインジケーター（仮で4枚目を選択） */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 0 10px',
                  background: 'rgba(180,70,10,0.3)',
                }}
              >
                {[0, 1, 2, 3, 4, 5].map((d) => (
                  <span
                    key={d}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: d === 3 ? '#fff' : 'rgba(255,255,255,0.4)',
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#999', textAlign: 'center', padding: '12px 0' }}>
              準備中です
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
