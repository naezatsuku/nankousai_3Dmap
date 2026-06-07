'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const TABS = [
  { id: 'map'           as const, href: '/map',           label: 'マップ' },
  { id: 'notifications' as const, href: '/notifications', label: '通知' },
  { id: 'news'          as const, href: '/timeline',       label: 'お知らせ', badge: true },
  { id: 'stamp'         as const, href: '/stamp',          label: 'スタンプ' },
]

type TabId = 'map' | 'notifications' | 'news' | 'stamp'

interface Props { unreadCount?: number }

export default function DesktopNav({ unreadCount = 0 }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const [faded, setFaded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeId: TabId = TABS.find(t => pathname.startsWith(t.href))?.id ?? 'map'

  const wakeUp = useCallback(() => {
    setFaded(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setFaded(true), 3000)
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setFaded(true), 3000)
    window.addEventListener('mousemove',  wakeUp, { passive: true })
    window.addEventListener('pointerdown', wakeUp, { passive: true })
    window.addEventListener('keydown',    wakeUp, { passive: true })
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      window.removeEventListener('mousemove',  wakeUp)
      window.removeEventListener('pointerdown', wakeUp)
      window.removeEventListener('keydown',    wakeUp)
    }
  }, [wakeUp])

  return (
    <div
      className="hidden sm:flex"
      style={{
        position:      'fixed',
        bottom:        20,
        right:         16,
        zIndex:        50,
        flexDirection: 'column',
        gap:           8,
        opacity:       faded ? 0.2 : 1,
        transition:    'opacity 0.6s ease',
      }}
    >
      {TABS.map(tab => {
        const active = activeId === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => { router.push(tab.href); wakeUp() }}
            title={tab.label}
            style={{
              position:        'relative',
              display:         'flex',
              flexDirection:   'column',
              alignItems:      'center',
              justifyContent:  'center',
              gap:             2,
              width:           52,
              height:          52,
              background:      active ? '#FF6B00' : 'rgba(255,255,255,0.92)',
              backdropFilter:  'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border:          'none',
              borderRadius:    14,
              cursor:          'pointer',
              boxShadow:       active
                ? '0 4px 16px rgba(255,107,0,0.38)'
                : '0 2px 10px rgba(0,0,0,0.13)',
              transition:      'all 0.2s ease',
            }}
          >
            <NavIcon id={tab.id} active={active} />
            <span style={{
              fontSize:   9,
              fontFamily: "'Kiwi Maru', serif",
              color:      active ? '#fff' : '#999',
              fontWeight: active ? 700 : 400,
              lineHeight: 1,
            }}>
              {tab.label}
            </span>

            {'badge' in tab && tab.badge && unreadCount > 0 && (
              <div style={{
                position:       'absolute',
                top: -4, right: -4,
                background:     '#F44336',
                color:          '#fff',
                fontSize:       9,
                fontWeight:     700,
                minWidth:       16,
                height:         16,
                borderRadius:   8,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                border:         '2px solid #fff',
                padding:        '0 3px',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

function NavIcon({ id, active }: { id: TabId; active: boolean }) {
  const c    = active ? '#fff' : '#bbb'
  const fill = active ? 'rgba(255,255,255,0.18)' : 'none'

  if (id === 'map') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"
          stroke={c} strokeWidth="1.8" strokeLinejoin="round" fill={fill} />
        <line x1="9"  y1="3"  x2="9"  y2="18" stroke={c} strokeWidth="1.8" />
        <line x1="15" y1="6"  x2="15" y2="21" stroke={c} strokeWidth="1.8" />
      </svg>
    )
  }

  if (id === 'notifications') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
          stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill={fill} />
        <path d="M13.73 21a2 2 0 0 1-3.46 0"
          stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (id === 'news') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke={c} strokeWidth="1.8" fill={fill} />
        <path d="M3 9h18"        stroke={c} strokeWidth="1.8" />
        <path d="M7 13h4M7 16h6" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  // stamp
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9"  stroke={c} strokeWidth="1.8" fill={fill} />
      <circle cx="12" cy="12" r="4"  stroke={c} strokeWidth="1.5" />
      <line x1="12" y1="3"  x2="12" y2="1"  stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="23" x2="12" y2="21" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="3"  y1="12" x2="1"  y2="12" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="23" y1="12" x2="21" y2="12" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
