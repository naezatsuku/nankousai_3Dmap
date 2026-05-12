'use client'

import { useState, useEffect } from 'react'
import { BandSchedule } from '@/types'
import { DUMMY_BANDS, fetchBands } from '@/lib/bands'
import type { BandWithSchedules } from '@/types'
import BackButton from '@/components/ui/BackButton'

// ─── ユーティリティ ───────────────────────────────────────────
const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

type Status = 'live' | 'done' | 'upcoming'

const getStatus = (s: BandSchedule, nowMin: number): Status => {
  const st = toMin(s.start_at)
  const en = toMin(s.end_at)
  if (nowMin >= st && nowMin < en) return 'live'
  if (nowMin >= en) return 'done'
  return 'upcoming'
}

const duration = (s: BandSchedule) => toMin(s.end_at) - toMin(s.start_at)

// ─── サブコンポーネント ───────────────────────────────────────

/** Instagram ボタン */
function IGButton({ handle }: { handle?: string }) {
  if (!handle) return null
  return (
    <a
      href={`https://instagram.com/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: '#fdf0f5', borderRadius: 8, padding: '5px 10px',
        color: '#E1306C', fontSize: 11, fontWeight: 700, textDecoration: 'none',
        fontFamily: "'Kiwi Maru', serif",
      }}
    >
      <IGIcon />
      @{handle}
    </a>
  )
}

function IGIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#E1306C">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z" />
    </svg>
  )
}

/** NOW PLAYING / NEXT UP ヒーローカード */
function HeroCard({
  live, next,
}: {
  live: { band: BandWithSchedules; sch: BandSchedule } | null
  next: { band: BandWithSchedules; sch: BandSchedule } | null
}) {
  if (live) {
    return (
      <div style={{
        background: '#fff', borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(255,107,0,0.15)',
        border: '2px solid rgba(255,107,0,0.25)',
      }}>
        {/* LIVE バー */}
        <div style={{
          background: 'linear-gradient(135deg,#FF6B00,#FFAA28)',
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <LiveDot />
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>
            NOW PLAYING
          </span>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginLeft: 'auto' }}>
            {live.sch.start_at} – {live.sch.end_at}
          </span>
        </div>
        {/* コンテンツ */}
        <div style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'center' }}>
          <BandThumb band={live.band} size={68} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Kaisei Decol', serif", fontSize: 20, fontWeight: 700, color: '#1a1a1a',
            }}>
              {live.band.name}
            </div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2, marginBottom: 8 }}>
              {live.band.members.join(' · ')}
            </div>
            <IGButton handle={live.band.instagram} />
          </div>
        </div>
      </div>
    )
  }

  if (next) {
    return (
      <div style={{
        background: '#fff', borderRadius: 18, padding: 14,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <BandThumb band={next.band} size={52} />
        <div>
          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 2, fontFamily: "'Kiwi Maru', serif" }}>
            NEXT UP
          </div>
          <div style={{ fontFamily: "'Kaisei Decol', serif", fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>
            {next.band.name}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#FF8C00', fontFamily: "'Kaisei Decol', serif" }}>
            {next.sch.start_at}
          </div>
          <div style={{ fontSize: 10, color: '#aaa' }}>〜 {next.sch.end_at}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 18, padding: 16,
      textAlign: 'center', color: '#bbb', fontSize: 13,
      fontFamily: "'Kiwi Maru', serif",
    }}>
      本日の公演はすべて終了しました
    </div>
  )
}

/** バンドサムネイル（画像 or 絵文字フォールバック） */
const BAND_COLORS = ['#e11d48', '#7c3aed', '#059669', '#0284c7', '#334155', '#d97706']
function BandThumb({ band, size }: { band: BandWithSchedules; size: number }) {
  const idx = parseInt(band.id) - 1
  const color = BAND_COLORS[idx % BAND_COLORS.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.2,
      background: `${color}22`, border: `2px solid ${color}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, flexShrink: 0, overflow: 'hidden',
    }}>
      {band.thumbnail_url
        ? <img src={band.thumbnail_url} alt={band.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : '🎸'}
    </div>
  )
}

/** 点滅するLIVEドット */
function LiveDot() {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%', background: '#fff',
      animation: 'livePulse 1s ease-in-out infinite',
    }} />
  )
}

// ─── メインページ ──────────────────────────────────────────────
export default function BandPage() {
  const [day, setDay]       = useState<'sat' | 'sun'>('sat')
  const [nowMin, setNowMin] = useState<number>(0)
  const [bands, setBands]   = useState<BandWithSchedules[]>(DUMMY_BANDS)

  useEffect(() => {
    fetchBands().then(setBands)
  }, [])

  // 現在時刻を分で管理（1分ごとに更新）
  useEffect(() => {
    const update = () => {
      const d = new Date()
      setNowMin(d.getHours() * 60 + d.getMinutes())
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [])

  // 今日のスケジュール（時刻順）
  const todayItems = bands
    .flatMap((band) => {
      const sch = band.schedules.find((s) => s.day === day)
      if (!sch) return []
      return [{ band, sch, status: getStatus(sch, nowMin) }]
    })
    .sort((a, b) => toMin(a.sch.start_at) - toMin(b.sch.start_at))

  const liveItem = todayItems.find((x) => x.status === 'live') ?? null
  const nextItem = todayItems.find((x) => x.status === 'upcoming') ?? null

  return (
    <>
      
      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,107,0,0.45)} 50%{box-shadow:0 0 0 8px rgba(255,107,0,0)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:0%} 100%{background-position:200%} }
      `}</style>

      <div style={{ minHeight: '100%', background: '#f5f3ef', overflowY: 'auto', paddingBottom: 32 }}>

        {/* ── ページヘッダー ── */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          padding: '14px 16px 12px',
          borderBottom: '1px solid rgba(255,140,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <BackButton fallbackHref="/map" />
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg,#FF6B00,#FFAA28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🎸</div>
          <div>
            <div style={{ fontFamily: "'Kaisei Decol', serif", fontSize: 19, fontWeight: 700, background: 'linear-gradient(90deg,#E85A00,#FF8C00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              軽音楽部
            </div>
            <div style={{ fontSize: 10, color: '#aaa', fontFamily: "'Kiwi Maru', serif" }}>
              Light Music Club
            </div>
          </div>

          {/* 土/日 切替 */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {(['sat', 'sun'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                style={{
                  fontSize: 12, padding: '5px 14px', borderRadius: 20,
                  background: day === d ? '#FF8C00' : '#f0f0f0',
                  color: day === d ? '#fff' : '#999',
                  fontWeight: 700, border: 'none', cursor: 'pointer',
                  fontFamily: "'Kiwi Maru', serif",
                  transition: 'all 0.2s',
                }}
              >
                {d === 'sat' ? '土' : '日'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '14px 14px 0' }}>

          {/* ── NOW PLAYING / NEXT UP ── */}
          <HeroCard live={liveItem} next={nextItem} />

          {/* ── タイムライン ── */}
          <SectionLabel emoji="📅" label="本日のタイムライン" />
          <Timeline items={todayItems} />

          {/* ── バンド一覧 ── */}
          <SectionLabel emoji="🎵" label="バンド一覧" />
          <BandList bands={bands} day={day} nowMin={nowMin} />
        </div>
      </div>
    </>
  )
}

function SectionLabel({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: '#aaa',
      letterSpacing: '0.08em', margin: '20px 0 10px',
      fontFamily: "'Kiwi Maru', serif",
    }}>
      {emoji} {label}
    </div>
  )
}

// ─── タイムライン ────────────────────────────────────────────
function Timeline({
  items,
}: {
  items: { band: BandWithSchedules; sch: BandSchedule; status: Status }[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map(({ band, sch, status }, i) => {
        const isLast   = i === items.length - 1
        const isLive   = status === 'live'
        const isDone   = status === 'done'
        const dotColor = isLive ? '#FF6B00' : isDone ? '#d1d5db' : '#94a3b8'
        const bandColor = BAND_COLORS[i % BAND_COLORS.length]

        return (
          <div key={band.id} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>

            {/* 左: 時刻 */}
            <div style={{ width: 48, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{
                fontSize: 12, fontWeight: 700, paddingTop: 10,
                color: isLive ? '#FF6B00' : isDone ? '#ccc' : '#555',
                fontFamily: "'Kaisei Decol', serif",
              }}>
                {sch.start_at}
              </span>
            </div>

            {/* 中: ドット + 縦線 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12 }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: dotColor, flexShrink: 0,
                ...(isLive ? { animation: 'glowPulse 1.5s infinite', boxShadow: '0 0 0 3px rgba(255,107,0,0.2)' } : {}),
              }} />
              {!isLast && (
                <div style={{
                  width: 2, flex: 1, minHeight: 16, margin: '4px 0',
                  background: isDone ? '#e5e7eb' : '#e5e7eb',
                }} />
              )}
            </div>

            {/* 右: カード */}
            <div style={{ flex: 1, paddingBottom: 10, paddingTop: 4 }}>
              <div style={{
                background: isLive ? 'linear-gradient(135deg,#fff8f4,#fff)' : '#fff',
                borderRadius: 14, padding: '10px 12px',
                border: isLive ? '1.5px solid rgba(255,107,0,0.3)' : '1px solid #f0f0f0',
                opacity: isDone ? 0.55 : 1,
                transition: 'opacity 0.3s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* アイコン */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: `${bandColor}22`,
                    border: `1.5px solid ${bandColor}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, overflow: 'hidden',
                  }}>
                    {band.thumbnail_url
                      ? <img src={band.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : '🎸'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Kaisei Decol', serif", fontSize: 14, fontWeight: 700,
                      color: isDone ? '#bbb' : '#1a1a1a',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {band.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#bbb', fontFamily: "'Kiwi Maru', serif" }}>
                      {sch.start_at} – {sch.end_at}（{duration(sch)}分）
                    </div>
                  </div>

                  {/* ステータスバッジ */}
                  {isLive && (
                    <div style={{
                      background: '#FF6B00', color: '#fff',
                      fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                      flexShrink: 0, animation: 'livePulse 1s infinite',
                      fontFamily: "'Kiwi Maru', serif",
                    }}>
                      LIVE
                    </div>
                  )}
                  {isDone && (
                    <div style={{
                      color: '#d1d5db', fontSize: 10, fontWeight: 700, flexShrink: 0,
                      fontFamily: "'Kiwi Maru', serif",
                    }}>
                      終了
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── バンド一覧カード ──────────────────────────────────────────
function BandList({
  bands, day, nowMin,
}: {
  bands: BandWithSchedules[]
  day: 'sat' | 'sun'
  nowMin: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {bands.map((band, i) => {
        const sch    = band.schedules.find((s) => s.day === day)
        const status = sch ? getStatus(sch, nowMin) : null
        const color  = BAND_COLORS[i % BAND_COLORS.length]
        const isLive = status === 'live'
        const isDone = status === 'done'

        return (
          <div key={band.id} style={{
            background: '#fff', borderRadius: 20,
            boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
            overflow: 'hidden',
            border: isLive ? '1.5px solid rgba(255,107,0,0.25)' : '1.5px solid transparent',
            animation: isLive ? 'undefined' : undefined,
          }}>
            {/* ライブ中はトップバーを表示 */}
            {isLive && (
              <div style={{
                background: 'linear-gradient(90deg,#FF6B00,#FFAA28)',
                backgroundSize: '200%',
                animation: 'shimmer 2s linear infinite',
                height: 3,
              }} />
            )}

            <div style={{ padding: '14px 14px 10px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {/* サムネイル */}
              <div style={{
                width: 68, height: 68, borderRadius: 16, flexShrink: 0,
                background: `${color}22`, border: `2px solid ${color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, overflow: 'hidden',
              }}>
                {band.thumbnail_url
                  ? <img src={band.thumbnail_url} alt={band.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : '🎸'}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* バンド名 + ステータス */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{
                    fontFamily: "'Kaisei Decol', serif", fontSize: 17, fontWeight: 700, color: '#1a1a1a',
                  }}>
                    {band.name}
                  </span>
                  {isLive && (
                    <span style={{
                      background: '#FF6B00', color: '#fff',
                      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      animation: 'livePulse 1s infinite',
                      fontFamily: "'Kiwi Maru', serif",
                    }}>
                      LIVE
                    </span>
                  )}
                  {isDone && (
                    <span style={{
                      background: '#f0f0f0', color: '#bbb',
                      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      fontFamily: "'Kiwi Maru', serif",
                    }}>
                      終了
                    </span>
                  )}
                </div>

                {/* メンバー */}
                <div style={{
                  fontSize: 11, color: '#aaa', marginBottom: 7, lineHeight: 1.5,
                  fontFamily: "'Kiwi Maru', serif",
                }}>
                  {band.members.join('・')}
                </div>

                {/* 時刻ピル */}
                {sch && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: isLive ? '#fff8f4' : '#f8f9fa',
                    border: `1px solid ${isLive ? 'rgba(255,107,0,0.2)' : '#eee'}`,
                    borderRadius: 9, padding: '4px 10px',
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                      stroke={isLive ? '#FF6B00' : '#aaa'} strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                    </svg>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: isLive ? '#FF6B00' : '#888',
                      fontFamily: "'Kiwi Maru', serif",
                    }}>
                      {sch.start_at} – {sch.end_at}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Instagram ボタン */}
            <div style={{ padding: '0 14px 14px' }}>
              <IGButton handle={band.instagram} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
