'use client'

import { useState, useEffect } from 'react'

interface StampedExhibit { id: string; name: string; type: string; class_label: string | null }
interface RankEntry       { rank: number; exhibitId: string; exhibitName: string }
interface VoteData {
  userVote:        { exhibitId: string; exhibitName: string } | null
  stampedExhibits: StampedExhibit[]
  showRanking:     boolean
  ranking:         RankEntry[]
}

const MEDAL = ['🥇', '🥈', '🥉']

export default function VotePage() {
  const [data,       setData]       = useState<VoteData | null>(null)
  const [selected,   setSelected]   = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState('')

  const [userId] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    let uid = localStorage.getItem('stamp_user_id')
    if (!uid) {
      uid = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2))
      localStorage.setItem('stamp_user_id', uid)
    }
    return uid
  })

  useEffect(() => {
    if (!userId) return
    fetch(`/api/vote?userId=${userId}`)
      .then(r => r.json())
      .then((d: VoteData) => {
        setData(d)
        if (d.userVote) setSelected(d.userVote.exhibitId)
      })
  }, [userId])

  const handleVote = async () => {
    if (!selected || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res  = await fetch('/api/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, exhibitId: selected }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setError(json.error ?? `エラー (${res.status})`)
        setSubmitting(false)
        return
      }
      setDone(true)
      setData(prev => {
        if (!prev) return prev
        const name = prev.stampedExhibits.find(e => e.id === selected)?.name ?? ''
        return { ...prev, userVote: { exhibitId: selected!, exhibitName: name } }
      })
    } catch {
      setError('送信に失敗しました')
    }
    setSubmitting(false)
  }

  if (!data) {
    return (
      <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:"'Kiwi Maru',serif", fontSize:13, color:'#94a3b8' }}>
        読み込み中…
      </div>
    )
  }

  const hasVoted  = !!data.userVote
  const isChanged = selected !== data.userVote?.exhibitId
  const canSubmit = !!selected && !submitting && (!done || isChanged)

  return (
    <div style={{ paddingBottom:80 }}>
      <div style={{ maxWidth:520, margin:'0 auto' }}>

        {/* ── ヘッダー ── */}
        <div style={{ padding:'24px 16px 16px' }}>
          <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:24, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>
            🗳 人気投票
          </div>
          <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", lineHeight:1.7 }}>
            スタンプを集めた展示に1票投票できます。<br />
            投票先は後から変更できます。
          </div>
        </div>

        {/* ── ランキング ── */}
        <div style={{ padding:'0 16px 20px' }}>
          <div style={{
            fontSize:11, fontWeight:700, color:'#aaa', letterSpacing:'0.08em',
            fontFamily:"'Kiwi Maru',serif", marginBottom:12,
          }}>
            🏆 現在のランキング
          </div>

          {data.showRanking && data.ranking.length > 0 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {data.ranking.map(r => (
                <div key={r.exhibitId} style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'12px 16px', borderRadius:14,
                  background: r.rank === 1 ? 'linear-gradient(135deg,#fffbeb,#fef3c7)' : '#fff',
                  boxShadow: r.rank === 1 ? '0 2px 12px rgba(245,158,11,0.15)' : '0 1px 3px rgba(0,0,0,0.06)',
                  border: r.rank === 1 ? '1px solid #fde68a' : '1px solid #f1f5f9',
                }}>
                  <div style={{
                    width:34, height:34, borderRadius:'50%', flexShrink:0,
                    background: r.rank <= 3 ? (['#fef3c7','#f1f5f9','#fef3e2'] as const)[r.rank-1] : '#f8fafc',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize: r.rank <= 3 ? 18 : 12, fontWeight:700,
                    color: r.rank <= 3 ? (['#f59e0b','#64748b','#f97316'] as const)[r.rank-1] : '#94a3b8',
                  }}>
                    {r.rank <= 3 ? MEDAL[r.rank-1] : r.rank}
                  </div>
                  <div style={{
                    fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700,
                    color: r.rank === 1 ? '#92400e' : '#1e293b',
                  }}>
                    {r.exhibitName}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding:'20px 16px', borderRadius:14, textAlign:'center',
              background:'#f8fafc', border:'1px dashed #e2e8f0',
              fontFamily:"'Kiwi Maru',serif", fontSize:13, color:'#94a3b8', lineHeight:1.7,
            }}>
              おたのしみに
            </div>
          )}
        </div>

        {/* ── 現在の投票先 ── */}
        {hasVoted && (
          <div style={{ margin:'0 16px 16px', padding:'12px 16px', borderRadius:12,
            background:'#f0fdf4', boxShadow:'inset 0 0 0 1.5px #86efac' }}>
            <div style={{ fontSize:11, color:'#16a34a', fontFamily:"'Kiwi Maru',serif", fontWeight:700 }}>
              ✓ 現在の投票先
            </div>
            <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#15803d', marginTop:2 }}>
              {data.userVote!.exhibitName}
            </div>
          </div>
        )}

        {/* ── 展示リスト ── */}
        <div style={{ padding:'0 16px' }}>
          {data.stampedExhibits.length === 0 ? (
            <div style={{
              textAlign:'center', padding:'48px 16px',
              background:'#f8fafc', borderRadius:16,
              color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13, lineHeight:2,
            }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🎯</div>
              まだスタンプを集めていません。<br />
              展示を訪れて QR を読み込むと<br />投票できるようになります。
            </div>
          ) : (
            <>
              <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:12 }}>
                投票したい展示を選んでください
              </div>

              {(() => {
                const isFood = (type: string) => type === 'food' || type === 'cafeteria'
                const foodExhibits  = data.stampedExhibits.filter(e => isFood(e.type))
                const otherExhibits = data.stampedExhibits.filter(e => !isFood(e.type))

                const renderList = (list: StampedExhibit[]) => list.map(ex => {
                  const isSel = selected === ex.id
                  return (
                    <button
                      key={ex.id}
                      onClick={() => { setSelected(ex.id); setDone(false) }}
                      style={{
                        width:'100%', padding:'14px 16px', borderRadius:14, border:'none', cursor:'pointer',
                        display:'flex', alignItems:'center', gap:12, textAlign:'left',
                        background: isSel ? '#fff8f0' : '#f8fafc',
                        boxShadow: isSel ? 'inset 0 0 0 2px #FF6B00' : 'inset 0 0 0 1.5px #e2e8f0',
                        transition:'all 0.15s',
                      }}
                    >
                      <div style={{
                        width:22, height:22, borderRadius:'50%', flexShrink:0,
                        border: `2px solid ${isSel ? '#FF6B00' : '#cbd5e1'}`,
                        background: isSel ? '#FF6B00' : 'transparent',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        transition:'all 0.15s',
                      }}>
                        {isSel && <div style={{ width:8, height:8, borderRadius:'50%', background:'#fff' }} />}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        {ex.class_label && (
                          <div style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:2 }}>
                            {ex.class_label}
                          </div>
                        )}
                        <div style={{
                          fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700,
                          color: isSel ? '#FF6B00' : '#1e293b',
                        }}>
                          {ex.name}
                        </div>
                      </div>
                    </button>
                  )
                })

                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:20, marginBottom:16 }}>
                    {otherExhibits.length > 0 && (
                      <div>
                        <div style={{
                          fontSize:11, fontWeight:700, color:'#64748b',
                          fontFamily:"'Kiwi Maru',serif", marginBottom:8,
                          display:'flex', alignItems:'center', gap:6,
                        }}>
                          🏫 展示・催し
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          {renderList(otherExhibits)}
                        </div>
                      </div>
                    )}
                    {foodExhibits.length > 0 && (
                      <div>
                        <div style={{
                          fontSize:11, fontWeight:700, color:'#64748b',
                          fontFamily:"'Kiwi Maru',serif", marginBottom:8,
                          display:'flex', alignItems:'center', gap:6,
                        }}>
                          🍱 フード
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          {renderList(foodExhibits)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {error && (
                <div style={{ padding:'10px 14px', borderRadius:10, background:'#fef2f2', marginBottom:12,
                  fontSize:12, color:'#dc2626', fontFamily:"'Kiwi Maru',serif" }}>
                  ⚠ {error}
                </div>
              )}

              <button
                onClick={handleVote}
                disabled={!canSubmit}
                style={{
                  width:'100%', padding:'16px', borderRadius:14, border:'none', cursor: canSubmit ? 'pointer' : 'default',
                  background: done && !isChanged
                    ? '#10b981'
                    : !selected
                      ? '#e2e8f0'
                      : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
                  color: !selected ? '#94a3b8' : '#fff',
                  fontSize:16, fontWeight:700, fontFamily:"'Kaisei Decol',serif",
                  boxShadow: selected ? '0 4px 16px rgba(255,107,0,0.25)' : 'none',
                  transition:'all 0.2s',
                }}
              >
                {submitting
                  ? '送信中…'
                  : done && !isChanged
                    ? '✓ 投票しました！'
                    : hasVoted
                      ? '投票先を変更する'
                      : '投票する'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
