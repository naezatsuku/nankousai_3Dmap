'use client'

import { useRef, useEffect, useState } from 'react'

interface Props {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

// テキストがコンテナ幅を超える場合だけ横スクロールアニメーションを適用する
export default function MarqueeText({ children, style, className }: Props) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  const [scrollPx, setScrollPx] = useState(0)

  useEffect(() => {
    // @keyframes を一度だけ DOM に注入
    if (!document.getElementById('marquee-text-style')) {
      const s = document.createElement('style')
      s.id = 'marquee-text-style'
      s.textContent = `
        @keyframes marqueeText {
          0%, 15%  { transform: translateX(0); }
          80%, 100%{ transform: translateX(var(--marquee-scroll-px, 0px)); }
        }
      `
      document.head.appendChild(s)
    }
  }, [])

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    const diff = inner.scrollWidth - outer.clientWidth
    setScrollPx(diff > 0 ? diff : 0)
  }, [children])

  // スクロール距離に比例した速度（40px/s 基準、最低 3s）
  const duration = `${Math.max(3, scrollPx / 40).toFixed(1)}s`

  return (
    <div ref={outerRef} style={{ overflow: 'hidden', width: '100%', minWidth: 0, ...style }} className={className}>
      <span
        ref={innerRef}
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          ...(scrollPx > 0
            ? {
                animation: `marqueeText ${duration} ease-in-out infinite`,
                ['--marquee-scroll-px' as string]: `-${scrollPx}px`,
              }
            : {}),
        }}
      >
        {children}
      </span>
    </div>
  )
}
