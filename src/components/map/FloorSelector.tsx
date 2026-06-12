'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const FLOORS = [1, 2, 3, 4, 5, 6] as const

interface FloorSelectorProps {
  current: number
  onChange: (floor: number) => void
}

export default function FloorSelector({ current, onChange }: FloorSelectorProps) {
  const [isIdle, setIsIdle] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startIdleTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setIsIdle(true)
    }, 3000)
  }, [])

  const wakeUp = useCallback(() => {
    setIsIdle(false)
    startIdleTimer()
  }, [startIdleTimer])

  useEffect(() => {
    startIdleTimer()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [startIdleTimer])

  return (
    <div
      onMouseEnter={wakeUp}
      onPointerDown={wakeUp}
      className="absolute top-25 left-3 z-60 flex flex-col gap-2 p-1.5 rounded-2xl transition-all duration-700 ease-in-out"
      style={{
        background: isIdle ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.85)',
        backdropFilter: isIdle ? 'blur(4px)' : 'blur(16px)',
        WebkitBackdropFilter: isIdle ? 'blur(4px)' : 'blur(16px)',
        boxShadow: isIdle ? '0 4px 10px rgba(0,0,0,0.02)' : '0 8px 20px rgba(0,0,0,0.1)',
        border: isIdle ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0.6)',
        opacity: isIdle ? 0.4 : 1,
      }}
    >
      {FLOORS.slice().reverse().map((f) => (
        <button
          key={f}
          onClick={(e) => {
            e.stopPropagation()
            wakeUp()
            onChange(f)
          }}
          className="w-10 h-10 rounded-xl transition-all duration-500 active:scale-90 flex items-center justify-center"
          style={{
            // フォントを Kaisei Decol に変更
            fontFamily: "'Kaisei Decol', serif",
            fontSize: '18px',
            fontWeight: 700,
            background: current === f ? (isIdle ? '#FF8C00aa' : '#FF8C00') : 'transparent',
            color: current === f ? '#fff' : (isIdle ? 'transparent' : '#666'),
            boxShadow: current === f && !isIdle ? '0 4px 12px rgba(255,140,0,0.4)' : 'none',
          }}
        >
          {f}<span style={{ fontSize: '10px', marginLeft: '1px' }}>F</span>
        </button>
      ))}
    </div>
  )
}