'use client'

import { usePathname, useRouter } from 'next/navigation'

const TABS = [
  { id: 'map',           href: '/map',           label: 'マップ' },
  { id: 'notifications', href: '/notifications', label: '通知' },
  { id: 'news',          href: '/news',           label: 'お知らせ', badge: true },
] as const

type TabId = typeof TABS[number]['id']

interface TabBarProps {
  unreadCount?: number
}

export default function TabBar({ unreadCount = 0 }: TabBarProps) {
  const pathname = usePathname()
  const router   = useRouter()

  const activeId: TabId =
    TABS.find((t) => pathname.startsWith(t.href))?.id ?? 'map'

  // インジケーターの left 位置 (タブ幅 33.3% × 3)
  const indicatorLeft = activeId === 'map' ? '4%' : activeId === 'notifications' ? '37%' : '70%'

  return (
    <>
      <style>{`
        @keyframes tabSlide {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <nav
        style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,140,0,0.10)',
          display: 'flex',
          alignItems: 'center',
          padding: `6px 0 max(6px, env(safe-area-inset-bottom))`,
          flexShrink: 0,
          zIndex: 50,
          position: 'relative',
        }}
      >
        {/* スライドインジケーター */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            height: 2.5,
            width: '26%',
            background: 'linear-gradient(90deg, #FF6B00, #FFB347)',
            borderRadius: '0 0 4px 4px',
            left: indicatorLeft,
            transition: 'left 0.32s cubic-bezier(0.34, 1.3, 0.64, 1)',
          }}
        />

        {TABS.map((tab) => {
          const active = activeId === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => router.push(tab.href)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 0',
                transition: 'transform 0.15s ease',
                transform: active ? 'translateY(-1px)' : 'translateY(0)',
              }}
              aria-label={tab.label}
            >
              {/* アイコン */}
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <TabIcon id={tab.id} active={active} />

                {/* 未読バッジ */}
                {'badge' in tab && tab.badge && unreadCount > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -7,
                      background: '#F44336',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 'bold',
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #fff',
                      fontFamily: 'sans-serif',
                      lineHeight: 1,
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
              </div>

              {/* ラベル */}
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "'Kiwi Maru', serif",
                  color: active ? '#FF6B00' : '#bbb',
                  fontWeight: active ? 'bold' : 'normal',
                  transition: 'color 0.2s',
                }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </nav>
    </>
  )
}

// ── アイコン ──────────────────────────────────────────
function TabIcon({ id, active }: { id: TabId; active: boolean }) {
  const c = active ? '#FF6B00' : '#bbb'
  const fill = active ? 'rgba(255,107,0,0.10)' : 'none'

  if (id === 'notifications') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
          stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill={fill}
        />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (id === 'map') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <polygon
          points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"
          stroke={c}
          strokeWidth="1.8"
          strokeLinejoin="round"
          fill={fill}
        />
        <line x1="9"  y1="3"  x2="9"  y2="18" stroke={c} strokeWidth="1.8" />
        <line x1="15" y1="6"  x2="15" y2="21" stroke={c} strokeWidth="1.8" />
      </svg>
    )
  }

  // news
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect
        x="3" y="5" width="18" height="14" rx="2"
        stroke={c} strokeWidth="1.8" fill={fill}
      />
      <path d="M3 9h18"       stroke={c} strokeWidth="1.8" />
      <path d="M7 13h4M7 16h6" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
