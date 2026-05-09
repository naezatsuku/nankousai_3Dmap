'use client'

import { useState } from 'react'

export default function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
  const [value, setValue] = useState('')

  const set = (v: string) => {
    setValue(v)
    onSearch(v)
  }

  return (
    <div
      className="absolute top-3 right-16 left-56 z-20 flex items-center rounded-xl px-3 gap-2"
      style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        height: '36px',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder="展示を検索…"
        className="flex-1 bg-transparent outline-none text-[12px] text-gray-700 placeholder-gray-400 min-w-0"
        style={{ fontFamily: "'Kiwi Maru', sans-serif" }}
      />
      {value && (
        <button onClick={() => set('')} className="text-gray-300 text-sm leading-none shrink-0">✕</button>
      )}
    </div>
  )
}
