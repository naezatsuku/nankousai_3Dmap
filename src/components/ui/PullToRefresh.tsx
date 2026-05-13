'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

const THRESHOLD = 72

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [pullY, setPullYState] = useState(0)
  const [loading, setLoading]  = useState(false)
  const outerRef   = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const startY     = useRef<number | null>(null)
  const pullYRef   = useRef(0)

  const setPullY = useCallback((v: number) => {
    pullYRef.current = v
    setPullYState(v)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setPullY(0)
    window.dispatchEvent(new Event('app-refresh'))
    await new Promise(r => setTimeout(r, 800))
    setLoading(false)
  }, [setPullY])

  useEffect(() => {
    const outer   = outerRef.current
    const content = contentRef.current
    if (!outer || !content) return

    const onTouchStart = (e: TouchEvent) => {
      if (content.scrollTop === 0) startY.current = e.touches[0].clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return
      if (content.scrollTop > 0) { startY.current = null; return }
      const delta = e.touches[0].clientY - startY.current
      if (delta <= 0) { startY.current = null; return }
      e.preventDefault()
      setPullY(Math.min(delta * 0.5, THRESHOLD))
    }

    const onTouchEnd = () => {
      if (pullYRef.current >= THRESHOLD) {
        refresh()
      } else {
        setPullY(0)
      }
      startY.current = null
    }

    outer.addEventListener('touchstart', onTouchStart, { passive: true })
    outer.addEventListener('touchmove',  onTouchMove,  { passive: false })
    outer.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      outer.removeEventListener('touchstart', onTouchStart)
      outer.removeEventListener('touchmove',  onTouchMove)
      outer.removeEventListener('touchend',   onTouchEnd)
    }
  }, [refresh, setPullY])

  const translateY = loading ? 44 : pullY
  const show       = loading || pullY > 4
  const progress   = Math.min(pullY / THRESHOLD, 1)

  return (
    <div ref={outerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

      {/* インジケーター — outer div に対して absolute */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: translateY,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, pointerEvents: 'none',
        overflow: 'hidden',
        transition: loading ? 'height 0.2s' : 'none',
      }}>
        {show && (
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: `scale(${0.6 + progress * 0.4})`,
          }}>
            {loading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                style={{ animation: 'ptr-spin 0.8s linear infinite' }}>
                <circle cx="12" cy="12" r="9" stroke="#FF8C00" strokeWidth="2.5"
                  strokeDasharray="40" strokeDashoffset="10" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                style={{ transform: `rotate(${progress * 180}deg)` }}>
                <path d="M12 5v14M5 12l7 7 7-7" stroke="#FF8C00" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        )}
      </div>

      {/* コンテンツ
          height:100% が必須 — transform により containing block になるため、
          マップページの absolute inset-0 がこの高さを基準に展開される */}
      <div
        ref={contentRef}
        style={{
          height: '100%',
          overflowY: 'auto',
          transform: `translateY(${translateY}px)`,
          transition: (pullY === 0 || loading) ? 'transform 0.3s' : 'none',
        }}
      >
        {children}
      </div>

      <style>{`@keyframes ptr-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
