'use client'

import { useState, useRef, useEffect } from 'react'
import type { Exhibit } from '@/types'

interface Props {
  onSearch:   (q: string) => void
  onConfirm?: (q: string) => void
  onSelect?:  (exhibit: Exhibit) => void
  exhibits?:  Exhibit[]
}

export default function SearchBar({ onSearch, onConfirm, onSelect, exhibits = [] }: Props) {
  const [value, setValue] = useState('')
  const [open, setOpen]   = useState(false)
  const wrapRef           = useRef<HTMLDivElement>(null)

  const set = (v: string) => {
    setValue(v)
    onSearch(v)
    setOpen(v.trim().length > 0)
  }

  const q = value.trim().toLowerCase()
  const suggestions = q.length === 0 ? [] : exhibits
    .filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.class_label?.toLowerCase().includes(q) ?? false)
    )
    .slice(0, 6)

  const handleSelect = (exhibit: Exhibit) => {
    const label = [exhibit.class_label, exhibit.name].filter(Boolean).join(' ')
    setValue(label)
    onSearch(label)
    onSelect?.(exhibit)
    setOpen(false)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapRef} className="absolute top-3 left-3 right-3 sm:left-56 sm:right-16 z-20">
      {/* 入力バー */}
      <div
        className="flex items-center rounded-xl px-3 gap-2"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
          height: 36,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={e => set(e.target.value)}
          onFocus={() => value.trim().length > 0 && setOpen(true)}
          onKeyDown={e => { if (e.key === 'Enter') { setOpen(false); onConfirm?.(value) } }}
          placeholder="展示を検索…"
          className="flex-1 bg-transparent outline-none text-[16px] text-gray-700 placeholder-gray-400 min-w-0"
          style={{ fontFamily: "'Kiwi Maru', sans-serif" }}
        />
        {value && (
          <button
            onMouseDown={e => { e.preventDefault(); set(''); setOpen(false) }}
            className="text-gray-300 hover:text-gray-500 text-sm leading-none shrink-0"
          >✕</button>
        )}
      </div>

      {/* サジェストドロップダウン */}
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
          overflow: 'hidden',
        }}>
          {suggestions.map((ex, i) => (
            <button
              key={ex.id}
              onPointerDown={e => { e.preventDefault(); handleSelect(ex) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 14px',
                border: 'none', borderTop: i > 0 ? '1px solid #f1f5f9' : 'none',
                background: 'transparent', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                background: '#fff7ed', color: '#ea580c', flexShrink: 0,
                fontFamily: "'Kiwi Maru', serif",
              }}>
                {ex.floor}F
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: '#1e293b',
                  fontFamily: "'Kaisei Decol', serif",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {ex.class_label && (
                    <span style={{ fontWeight: 400, color: '#94a3b8', marginRight: 5, fontSize: 11 }}>
                      {ex.class_label}
                    </span>
                  )}
                  {ex.name}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: "'Kiwi Maru', serif", marginTop: 1 }}>
                  {ex.room_display || '場所未設定'}
                </div>
              </div>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
