'use client'

import { useState, useEffect, useMemo } from 'react'
import { PerformanceStatus, timeToMin, getPerformanceStatus } from '@/types'
import { DUMMY_GROUPS, fetchSpecialGroups } from '@/lib/special'
import type { SpecialGroup, SpecialSched } from '@/lib/special'
import BackButton from '@/components/ui/BackButton'
import AddToScheduleButton from '@/components/ui/AddToScheduleButton'

// ─── カテゴリー絵文字 ─────────────────────────────────────────
const CATEGORY_EMOJI: Record<string, string> = {
  'ダンス':   '💃',
  '演劇':     '🎭',
  '合唱':     '🎶',
  'マジック': '🪄',
  '音楽':     '🎵',
  'よさこい': '🎏',
}

// ─── ステータス設定 ───────────────────────────────────────────
const STATUS_CONFIG: Record<PerformanceStatus, { label: string; color: string; bg: string }> = {
  live:     { label: 'LIVE',  color: '#FF6B00', bg: 'rgba(255,107,0,0.1)' },
  upcoming: { label: 'まもなく', color: '#0284c7', bg: 'rgba(2,132,199,0.08)' },
  done:     { label: '終了',  color: '#bbb',    bg: '#f5f5f5' },
}

// ─── メインページ ──────────────────────────────────────────────
export default function SpecialPage() {
  const [day, setDay]           = useState<'sat' | 'sun'>('sat')
  const [nowMin, setNowMin]     = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [groups, setGroups]     = useState<SpecialGroup[]>(DUMMY_GROUPS)

  useEffect(() => {
    fetchSpecialGroups().then(setGroups)
    
  }, [])

  useEffect(() => {
    const update = () => {
      const d = new Date()
      setNowMin(d.getHours() * 60 + d.getMinutes())
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [])

  // 当日のスケジュールを時刻順にフラット化
  const timelineItems = useMemo(() => {
    const items: { group: SpecialGroup; sched: SpecialSched; status: PerformanceStatus }[] = []
    groups.forEach((group) => {
      group.schedules
        .filter((s) => s.day === day)
        .forEach((sched) => {
          items.push({ group, sched, status: getPerformanceStatus(sched, nowMin) })
        })
    })
    return items.sort((a, b) => timeToMin(a.sched.start_at) - timeToMin(b.sched.start_at))
  }, [groups, day, nowMin])

  // 当日に出演するグループのみ
  const activeGroups = useMemo(
    () => groups.filter((g) => g.schedules.some((s) => s.day === day)),
    [groups, day]
  )

  const liveItem = timelineItems.find((x) => x.status === 'live')

  return (
    <>
      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,107,0,0.4)} 60%{box-shadow:0 0 0 8px rgba(255,107,0,0)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .expand-enter { animation: fadeUp 0.2s ease both; }
      `}</style>

      <div style={{ height: '100%', overflowY: 'auto', background: '#f5f3ef', paddingBottom: 32 }}>

        {/* ── ページヘッダー ── */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          padding: '14px 16px 12px',
          borderBottom: '1px solid rgba(255,140,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 10,
          position: 'sticky', top: 0, zIndex: 40,
        }}>
          <BackButton fallbackHref="/map" />
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg,#FF6B00,#FFAA28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>⭐</div>
          <div>
            <div style={{
              fontFamily: "'Kaisei Decol', serif", fontSize: 19, fontWeight: 700,
              background: 'linear-gradient(90deg,#E85A00,#FF8C00)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>催し物</div>
            <div style={{ fontSize: 10, color: '#aaa', fontFamily: "'Kiwi Maru', serif" }}>
              Special Performances
            </div>
          </div>

          {/* 土/日 切替 */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {(['sat', 'sun'] as const).map((d) => (
              <button key={d} onClick={() => setDay(d)} style={{
                fontSize: 12, padding: '5px 14px', borderRadius: 20,
                background: day === d ? '#FF8C00' : '#f0f0f0',
                color: day === d ? '#fff' : '#999',
                fontWeight: 700, border: 'none', cursor: 'pointer',
                fontFamily: "'Kiwi Maru', serif", transition: 'all 0.2s',
              }}>
                {d === 'sat' ? '土' : '日'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '14px 14px 0' }}>

          {/* ── LIVE 中ヒーロー ── */}
          {liveItem && (
            <div style={{
              background: '#fff', borderRadius: 20, overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(255,107,0,0.15)',
              border: '2px solid rgba(255,107,0,0.25)',
              marginBottom: 16,
              animation: 'fadeUp 0.3s ease',
            }}>
              <div style={{
                background: 'linear-gradient(135deg,#FF6B00,#FFAA28)',
                padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'livePulse 1s infinite' }} />
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>NOW ON STAGE</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginLeft: 'auto' }}>
                  {liveItem.sched.start_at} – {liveItem.sched.end_at}
                </span>
              </div>
              <div style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 14, flexShrink: 0,
                  background: 'linear-gradient(135deg,#FFD166,#FF8C00)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                  overflow: 'hidden',
                }}>
                  {liveItem.group.thumbnail_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={liveItem.group.thumbnail_url} alt={liveItem.group.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (CATEGORY_EMOJI[liveItem.group.category] ?? '⭐')
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Kaisei Decol', serif", fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>
                    {liveItem.group.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2, fontFamily: "'Kiwi Maru', serif" }}>
                    📍 {liveItem.sched.location}
                    {liveItem.sched.note && ` · ${liveItem.sched.note}`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── タイムライン ── */}
          <SectionLabel emoji="📅" label="タイムライン" />
          <Timeline items={timelineItems} />

          {/* ── 団体一覧 ── */}
          <SectionLabel emoji="🎪" label="出演団体" topMargin={24} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeGroups.map((group) => {
              const schedules = group.schedules.filter((s) => s.day === day)
              const isExpanded = expandedId === group.id
              const anyLive = schedules.some((s) => getPerformanceStatus(s, nowMin) === 'live')

              return (
                <div key={group.id} style={{
                  background: '#fff', borderRadius: 20,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                  overflow: 'hidden',
                  border: anyLive ? '1.5px solid rgba(255,107,0,0.25)' : '1.5px solid transparent',
                }}>
                  {anyLive && (
                    <div style={{ height: 3, background: 'linear-gradient(90deg,#FF6B00,#FFAA28)' }} />
                  )}

                  {/* カードヘッダー（タップで展開）*/}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : group.id)}
                    style={{
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      padding: '14px 14px 10px', display: 'flex', gap: 12, alignItems: 'flex-start',
                      textAlign: 'left',
                    }}
                  >
                    {/* アイコン */}
                    <div style={{
                      width: 60, height: 60, borderRadius: 16, flexShrink: 0,
                      background: anyLive
                        ? 'linear-gradient(135deg,#FF6B00,#FFAA28)'
                        : 'linear-gradient(135deg,#f0f0f0,#e0e0e0)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                      overflow: 'hidden',
                    }}>
                      {group.thumbnail_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={group.thumbnail_url} alt={group.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (CATEGORY_EMOJI[group.category] ?? '⭐')
                      }
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* 名前 + ライブバッジ */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                        <span style={{ fontFamily: "'Kaisei Decol', serif", fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>
                          {group.name}
                        </span>
                        {anyLive && (
                          <span style={{
                            background: '#FF6B00', color: '#fff',
                            fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            animation: 'livePulse 1s infinite', fontFamily: "'Kiwi Maru', serif",
                          }}>LIVE</span>
                        )}
                        <CategoryTag label={group.category} />
                      </div>

                      {/* 説明（1行）*/}
                      <div style={{
                        fontSize: 11, color: '#aaa', marginBottom: 6,
                        fontFamily: "'Kiwi Maru', serif",
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {group.description}
                      </div>

                      {/* スケジュールピル */}
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {schedules.map((s) => {
                          const st = getPerformanceStatus(s, nowMin)
                          return (
                            <span key={s.id} style={{
                              fontSize: 10, fontWeight: 700,
                              padding: '3px 8px', borderRadius: 99,
                              background: STATUS_CONFIG[st].bg,
                              color: STATUS_CONFIG[st].color,
                              fontFamily: "'Kiwi Maru', serif",
                            }}>
                              {s.start_at}〜{s.end_at}
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    {/* 展開矢印 */}
                    <div style={{
                      fontSize: 14, color: '#ccc', flexShrink: 0, marginTop: 4,
                      transform: isExpanded ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s',
                    }}>
                      ▾
                    </div>
                  </button>

                  {/* 展開コンテンツ */}
                  {isExpanded && (
                    <div className="expand-enter" style={{ padding: '0 14px 14px' }}>
                      {/* 説明 */}
                      <div style={{
                        fontSize: 12, color: '#555', lineHeight: 1.7,
                        padding: '10px 12px', borderRadius: 12,
                        background: '#fafafa', marginBottom: 10,
                        fontFamily: "'Kiwi Maru', serif",
                      }}>
                        {group.description}
                      </div>

                      {/* 全スケジュール詳細 */}
                      {schedules.map((s) => {
                        const st = getPerformanceStatus(s, nowMin)
                        const cfg = STATUS_CONFIG[st]
                        return (
                          <div key={s.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 12px', borderRadius: 12,
                            background: cfg.bg, marginBottom: 6,
                          }}>
                            <div style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: cfg.color, flexShrink: 0,
                              ...(st === 'live' ? { animation: 'livePulse 1s infinite' } : {}),
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: "'Kaisei Decol', serif", fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
                                {s.start_at} – {s.end_at}
                                <span style={{ fontSize: 10, color: '#aaa', fontWeight: 400, marginLeft: 6, fontFamily: "'Kiwi Maru', serif" }}>
                                  ({timeToMin(s.end_at) - timeToMin(s.start_at)}分)
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: '#888', marginTop: 1, fontFamily: "'Kiwi Maru', serif" }}>
                                📍 {s.location}
                                {s.note && <span style={{ marginLeft: 6, color: '#aaa' }}>· {s.note}</span>}
                              </div>
                            </div>
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, fontFamily: "'Kiwi Maru', serif" }}>
                                {cfg.label}
                              </span>
                              <AddToScheduleButton
                                title={`${group.name}${s.note ? ` (${s.note})` : ''}`}
                                date={s.day}
                                startTime={s.start_at}
                                endTime={s.end_at}
                                location={s.location}
                                color="#f59e0b"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── タイムライン ────────────────────────────────────────────
function Timeline({
  items,
}: {
  items: { group: SpecialGroup; sched: SpecialSched; status: PerformanceStatus }[]
}) {
  if (items.length === 0) {
    return (
      <div style={{
        background: '#fff', borderRadius: 16, padding: 20,
        textAlign: 'center', color: '#bbb', fontSize: 13,
        fontFamily: "'Kiwi Maru', serif",
      }}>
        この日のイベントはありません
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map(({ group, sched, status }, i) => {
        const isLast = i === items.length - 1
        const isLive = status === 'live'
        const isDone = status === 'done'
        const cfg    = STATUS_CONFIG[status]
        const emoji  = CATEGORY_EMOJI[group.category] ?? '⭐'

        return (
          <div key={sched.id} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>

            {/* 時刻列 */}
            <div style={{ width: 48, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{
                fontSize: 12, fontWeight: 700, paddingTop: 10,
                color: isLive ? '#FF6B00' : isDone ? '#ccc' : '#555',
                fontFamily: "'Kaisei Decol', serif",
              }}>
                {sched.start_at}
              </span>
            </div>

            {/* ドット + 縦線 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12 }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: isLive ? '#FF6B00' : isDone ? '#d1d5db' : '#94a3b8',
                flexShrink: 0,
                ...(isLive ? { animation: 'glowPulse 1.5s infinite' } : {}),
              }} />
              {!isLast && (
                <div style={{ width: 2, flex: 1, minHeight: 16, margin: '4px 0', background: '#e5e7eb' }} />
              )}
            </div>

            {/* カード */}
            <div style={{ flex: 1, paddingBottom: 10, paddingTop: 4 }}>
              <div style={{
                background: isLive ? 'linear-gradient(135deg,#fff8f4,#fff)' : '#fff',
                borderRadius: 14, padding: '10px 12px',
                border: isLive ? '1.5px solid rgba(255,107,0,0.3)' : '1px solid #f0f0f0',
                opacity: isDone ? 0.55 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* アイコン */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: isLive ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f5f5f5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                    overflow: 'hidden',
                  }}>
                    {group.thumbnail_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={group.thumbnail_url} alt={group.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : emoji
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Kaisei Decol', serif", fontSize: 14, fontWeight: 700,
                      color: isDone ? '#bbb' : '#1a1a1a',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {group.name}
                      {sched.note && (
                        <span style={{ fontSize: 10, color: '#aaa', fontWeight: 400, marginLeft: 5, fontFamily: "'Kiwi Maru', serif" }}>
                          {sched.note}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#bbb', fontFamily: "'Kiwi Maru', serif" }}>
                      {sched.start_at}–{sched.end_at} · 📍 {sched.location}
                    </div>
                  </div>
                  {/* ステータス */}
                  {isLive && (
                    <div style={{
                      background: '#FF6B00', color: '#fff',
                      fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                      flexShrink: 0, animation: 'livePulse 1s infinite',
                      fontFamily: "'Kiwi Maru', serif",
                    }}>LIVE</div>
                  )}
                  {isDone && (
                    <div style={{ color: '#d1d5db', fontSize: 10, fontWeight: 700, flexShrink: 0, fontFamily: "'Kiwi Maru', serif" }}>
                      終了
                    </div>
                  )}
                  {!isDone && (
                    <AddToScheduleButton
                      title={`${group.name}${sched.note ? ` (${sched.note})` : ''}`}
                      date={sched.day}
                      startTime={sched.start_at}
                      endTime={sched.end_at}
                      location={sched.location}
                      color="#f59e0b"
                    />
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

// ─── カテゴリータグ ───────────────────────────────────────────
function CategoryTag({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700,
      padding: '2px 7px', borderRadius: 99,
      background: '#f0f0f0', color: '#888',
      fontFamily: "'Kiwi Maru', serif",
    }}>
      {label}
    </span>
  )
}

// ─── セクションラベル ─────────────────────────────────────────
function SectionLabel({ emoji, label, topMargin = 0 }: { emoji: string; label: string; topMargin?: number }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: '#aaa',
      letterSpacing: '0.08em', margin: `${topMargin}px 0 10px`,
      fontFamily: "'Kiwi Maru', serif",
    }}>
      {emoji} {label}
    </div>
  )
}
