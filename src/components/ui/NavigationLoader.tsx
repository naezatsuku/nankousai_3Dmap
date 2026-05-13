'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function NavigationLoader() {
  const pathname              = usePathname()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible]   = useState(false)
  const [done, setDone]         = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevPath = useRef(pathname)

  // ── リンク/ボタンのクリックでローダー開始 ─────────────────────
  useEffect(() => {
    const start = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return
      const href = target.getAttribute('href')
      // 外部リンク・アンカー・同一パスはスキップ
      if (!href || href.startsWith('http') || href.startsWith('#')) return
      if (href === pathname) return

      setDone(false)
      setProgress(0)
      setVisible(true)

      // 疑似プログレス：最大 85% までゆっくり進む
      let p = 0
      timerRef.current = setInterval(() => {
        p += p < 50 ? 6 : p < 75 ? 2.5 : 0.5
        if (p >= 85) { clearInterval(timerRef.current!); p = 85 }
        setProgress(p)
      }, 80)
    }

    document.addEventListener('click', start)
    return () => document.removeEventListener('click', start)
  }, [pathname])

  // ── pathname 変化 → 完了アニメ ────────────────────────────────
  useEffect(() => {
    if (pathname === prevPath.current) return
    prevPath.current = pathname

    if (timerRef.current) clearInterval(timerRef.current)
    setProgress(100)
    setDone(true)

    const t = setTimeout(() => {
      setVisible(false)
      setProgress(0)
      setDone(false)
    }, 500)
    return () => clearTimeout(t)
  }, [pathname])

  if (!visible) return null

  const nanpenX = `${Math.min(progress, 99)}%`

  return (
    <>
      <style>{`
        @keyframes nl-bounce {
          0%,100% { transform: translateY(0) scaleY(1); }
          40%      { transform: translateY(-5px) scaleY(1.05); }
          70%      { transform: translateY(0) scaleY(0.95); }
        }
        @keyframes nl-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes nl-pop {
          0%   { transform: scale(0.5); opacity: 0; }
          60%  { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes nl-dot {
          0%,80%,100% { opacity: 0.2; transform: scale(0.8); }
          40%          { opacity: 1;   transform: scale(1); }
        }
      `}</style>

      {/* ── 上部プログレスバー ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 3, zIndex: 9999, pointerEvents: 'none',
      }}>
        {/* バー本体 */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: `${progress}%`,
          height: '100%',
          background: 'linear-gradient(90deg,#FF6B00,#FFB347,#FF8C00)',
          backgroundSize: '200% 100%',
          transition: done ? 'width 0.25s ease-out' : 'width 0.08s linear',
          boxShadow: '0 0 8px rgba(255,107,0,0.6)',
        }} />

      </div>

      {/* ── 中央を走るnanpen ── */}
      {!done && progress > 2 && (
        <div style={{
          position: 'fixed',
          top: '45%',
          left: nanpenX,
          transform: 'translateX(-50%) translateY(-50%)',
          zIndex: 9998,
          pointerEvents: 'none',
          animation: 'nl-bounce 0.45s ease infinite',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.18))',
          transition: 'left 0.08s linear',
        }}>
          <img
            src="/nanpen.png"
            alt=""
            style={{ width: 52, height: 52, objectFit: 'contain' }}
          />
        </div>
      )}

      {/* ── 右下ミニnanpen ── */}
      <div style={{
        position: 'fixed',
        bottom: 80, right: 16,
        zIndex: 9998,
        pointerEvents: 'none',
        animation: 'nl-pop 0.3s cubic-bezier(0.34,1.3,0.64,1) forwards',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: '50%',
          background: 'rgba(255,255,255,0.95)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1.5px solid rgba(255,140,0,0.2)',
        }}>
          <img
            src="/nanpen.png"
            alt=""
            style={{
              width: 30, height: 30, objectFit: 'contain',
              animation: done ? 'none' : 'nl-spin 1s linear infinite',
            }}
          />
        </div>
        <div style={{
          display: 'flex', gap: 3, alignItems: 'center',
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#FF8C00',
              animation: `nl-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </>
  )
}
