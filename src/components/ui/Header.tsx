'use client'

import { useEffect, useState } from 'react'

interface HeaderProps {
  announcements?: string[]
  onMenuClick?: () => void
}

export default function Header({
  announcements = [
    '🎉 南高祭へようこそ！楽しんでいってください',
    '📣 開会式は体育館にて9:30スタート！',
    '🌌 3年4組プラネタリウム 整理券配布中（3F）',
    '🎸 軽音部バンドライブ 第2部まもなく開始（4F）',
    '🍱 フードコート混雑中 — 待ち約20分',
  ],
  onMenuClick,
}: HeaderProps) {
  const [hh, setHh] = useState('--')
  const [mm, setMm] = useState('--')
  const [ss, setSs] = useState('--')
  const [colon, setColon] = useState(true)
  const [msgIndex, setMsgIndex] = useState(0)
  const [fade, setFade] = useState(true)

  // 0.5秒ごとにコロン点滅・秒更新
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setHh(String(d.getHours()).padStart(2, '0'))
      setMm(String(d.getMinutes()).padStart(2, '0'))
      setSs(String(d.getSeconds()).padStart(2, '0'))
      setColon((c) => !c)
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [])

  // アナウンスをフェードでローテーション
  useEffect(() => {
    if (announcements.length <= 1) return
    const id = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setMsgIndex((i) => (i + 1) % announcements.length)
        setFade(true)
      }, 350)
    }, 4000)
    return () => clearInterval(id)
  }, [announcements])

  return (
    <>
      <style>{`
        @keyframes headerShimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes tickerBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.25; }
        }
      `}</style>

      <header
        style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,140,0,0.15)',
          padding: '10px 16px',
          flexShrink: 0,
          zIndex: 50,
          position: 'relative',
        }}
      >
        {/* ── グラデーションシマーライン ── */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 3,
            background: 'linear-gradient(90deg, #FF6B00, #FFB347, #FF8C00, #FFD166, #FF6B00)',
            backgroundSize: '200% 100%',
            animation: 'headerShimmer 3s linear infinite',
          }}
        />

        {/* ── 1行目: タイトル + 時刻ピル ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 7,
          }}
        >
          {/* タイトル */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span
              style={{
                fontFamily: "'Kaisei Decol', serif",
                fontSize: 22,
                fontWeight: 700,
                background: 'linear-gradient(90deg, #E85A00, #FF8C00)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '0.04em',
                lineHeight: 1,
              }}
            >
              南高祭
            </span>
            <span
              style={{
                fontFamily: "'Kiwi Maru', serif",
                fontSize: 10,
                color: '#ccc',
                letterSpacing: '0.1em',
              }}
            >
              2025
            </span>
          </div>

          {/* 時刻ピル */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #fff8f0, #ffe8cc)',
              border: '1px solid rgba(255,140,0,0.2)',
              borderRadius: 9,
              padding: '4px 10px',
              gap: 2,
            }}
          >
            <span
              style={{
                fontFamily: "'Kaisei Decol', serif",
                fontSize: 17,
                fontWeight: 700,
                color: '#E85A00',
                letterSpacing: '0.05em',
              }}
            >
              {hh}
              <span style={{ opacity: colon ? 1 : 0.15, transition: 'opacity 0.1s' }}>:</span>
              {mm}
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 10,
                color: '#FFB347',
                marginLeft: 2,
              }}
            >
              {ss}
            </span>
          </div>
        </div>

        {/* ── 2行目: ティッカー ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background: 'linear-gradient(90deg, #fff8f0, #fffaf6)',
            borderRadius: 99,
            padding: '5px 12px 5px 10px',
            border: '1px solid rgba(255,140,0,0.13)',
            overflow: 'hidden',
          }}
        >
          {/* 点滅ドット */}
          <div
            style={{
              flexShrink: 0,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#FF6B00',
              animation: 'tickerBlink 1.2s ease-in-out infinite',
            }}
          />
          {/* メッセージ */}
          <div
            style={{
              flex: 1,
              overflow: 'hidden',
              position: 'relative',
              height: 18,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {/* 左フェードマスク */}
            <div
              style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 12,
                background: 'linear-gradient(to right, #fff8f0, transparent)',
                zIndex: 1,
              }}
            />
            <div
              style={{
                fontSize: 11,
                color: '#b36000',
                fontFamily: "'Kiwi Maru', serif",
                whiteSpace: 'nowrap',
                opacity: fade ? 1 : 0,
                transform: fade ? 'translateX(0)' : 'translateX(8px)',
                transition: 'opacity 0.35s ease, transform 0.35s ease',
                paddingLeft: 4,
              }}
            >
              {announcements[msgIndex]}
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
