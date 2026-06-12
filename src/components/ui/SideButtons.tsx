'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { hasSubsOfType } from '@/lib/push'

const BUTTONS: { href: string; label: string; subType?: string; icon: React.ReactNode }[] = [
  {
    href: '/vote',
    label: '投票',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    href: '/band',
    label: '軽音',
    subType: 'band',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    href: '/food',
    label: 'フード',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    ),
  },
  {
    href: '/special',
    label: '催し',
    subType: 'special',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
]

export default function SideButtons() {
  const router = useRouter()
  const [subsMap] = useState<Record<string, boolean>>(() => ({
    band:    hasSubsOfType('band'),
    special: hasSubsOfType('special'),
  }))

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 sm:top-[100px] sm:translate-y-0 flex flex-col gap-2.5 z-20">
      {BUTTONS.map(({ href, label, subType, icon }) => {
        const subscribed = subType ? subsMap[subType] ?? false : false
        return (
          <button
            key={href}
            onClick={() => router.push(href)}
            aria-label={label}
            className="flex flex-col items-center gap-1 w-12 py-2.5 rounded-2xl active:scale-95 transition-transform"
            style={{
              background: subscribed ? 'rgba(255,107,0,0.12)' : 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: subscribed
                ? '0 2px 12px rgba(255,107,0,0.18)'
                : '0 2px 12px rgba(0,0,0,0.10)',
              color: subscribed ? '#FF6B00' : '#555',
              border: subscribed ? '1.5px solid rgba(255,107,0,0.3)' : '1.5px solid transparent',
            }}
          >
            {icon}
            <span
              className="text-[10px] leading-none"
              style={{ fontFamily: "'Kiwi Maru', sans-serif", color: subscribed ? '#FF6B00' : '#888' }}
            >
              {label}
            </span>
            {subscribed && (
              <span style={{
                fontSize: 7, lineHeight: 1, color: '#FF6B00',
                fontFamily: "'Kiwi Maru', sans-serif",
                fontWeight: 700,
              }}>
                📅登録済
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
