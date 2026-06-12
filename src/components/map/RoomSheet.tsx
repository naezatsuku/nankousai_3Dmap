'use client'

import { useState, useEffect, useRef } from 'react'
import Link         from 'next/link'
import { Exhibit }  from '@/types'
import NotifyButton from '@/components/ui/NotifyButton'

interface FeedbackState {
  likeCount:    number
  userLiked:    boolean
  userHasStamp: boolean
  showLikeCount: boolean
}

interface RoomSheetProps {
  exhibits:    Exhibit[]
  roomDisplay: string
  floor:       number
  onClose:     () => void
}

const WAIT_COLOR = (min: number): string => {
  if (min === 0)  return '#4ade80'
  if (min <= 10)  return '#facc15'
  if (min <= 25)  return '#fb923c'
  return '#f87171'
}

const TYPE_LABEL: Record<Exhibit['type'], string> = {
  class:     '展示',
  food:      'フード',
  band:      '軽音楽部',
  special:   'スペシャル',
  cafeteria: '食堂',
}

/** 待ち時間 → ラベルテキスト */
const waitLabel = (min: number) =>
  min === 0 ? '待ちなし' : `約 ${min} 分`

export default function RoomSheet({
  exhibits,
  roomDisplay,
  floor,
  onClose,
}: RoomSheetProps) {
  const open = exhibits.length > 0

  const [userId] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('stamp_user_id') ?? ''
  })
  const [feedbacks, setFeedbacks] = useState<Record<string, FeedbackState>>({})

  useEffect(() => {
    if (exhibits.length === 0) return
    exhibits.forEach(ex => {
      fetch(`/api/exhibit-feedback/${ex.id}?userId=${encodeURIComponent(userId)}&limit=0`)
        .then(r => r.json())
        .then((d: FeedbackState) => setFeedbacks(prev => ({ ...prev, [ex.id]: d })))
        .catch(() => {})
    })
  }, [exhibits, userId])

  const handleLike = async (exhibitId: string) => {
    const fb = feedbacks[exhibitId]
    if (!fb) return
    const nowLiked = !fb.userLiked
    // 楽観的更新: 先にUIへ反映し、応答で補正・失敗時は巻き戻す
    setFeedbacks(prev => ({
      ...prev,
      [exhibitId]: {
        ...prev[exhibitId],
        userLiked:  nowLiked,
        likeCount:  prev[exhibitId].likeCount + (nowLiked ? 1 : -1),
      },
    }))
    try {
      const res = await fetch('/api/exhibit-like', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exhibitId, userId }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json() as { liked: boolean; likeCount: number }
      setFeedbacks(prev => ({
        ...prev,
        [exhibitId]: { ...prev[exhibitId], userLiked: json.liked, likeCount: json.likeCount },
      }))
    } catch {
      setFeedbacks(prev => ({
        ...prev,
        [exhibitId]: {
          ...prev[exhibitId],
          userLiked:  !nowLiked,
          likeCount:  prev[exhibitId].likeCount + (nowLiked ? -1 : 1),
        },
      }))
    }
  }

  return (
    <>
      {/* ── オーバーレイ（背景暗幕） ── */}
      <div
        onClick={onClose}
        style={{
          position:       'absolute',
          inset:          0,
          zIndex:         60,
          background:     open ? 'rgba(0,0,0,0.25)' : 'transparent',
          backdropFilter: open ? 'blur(2px)' : 'none',
          WebkitBackdropFilter: open ? 'blur(2px)' : 'none',
          pointerEvents:  open ? 'auto' : 'none',
          transition:     'background 0.3s, backdrop-filter 0.3s',
        }}
      />

      {/* ── シート本体 ── */}
      <div
        style={{
          position:      'absolute',
          bottom:        0,
          left:          '50%',
          width:         'min(100%, 520px)',
          zIndex:        70,
          background:    '#fff',
          borderRadius:  '24px 24px 0 0',
          boxShadow:     '0 -10px 40px rgba(0,0,0,0.18)',
          transform:     open ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
          transition:    'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
          willChange:    'transform',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* ハンドル */}
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 8px' }}>
          <div style={{ width:40, height:6, borderRadius:99, background:'#f0f0f0' }} />
        </div>

        {open && (
          <div style={{ padding:'0 20px 32px' }}>

            {/* 閉じるボタン */}
            <button
              onClick={onClose}
              style={{
                position:'absolute', top:14, right:20,
                width:32, height:32, borderRadius:'50%',
                background:'#f8f8f8', border:'none',
                color:'#aaa', fontSize:14, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}
            >
              ✕
            </button>

            {/* 場所ヘッダー */}
            <p style={{ fontSize:12, color:'#aaa', marginBottom:12, marginTop:8, fontFamily:"'Kiwi Maru',sans-serif" }}>
              {roomDisplay} · {floor}F
            </p>

            {exhibits.length === 1
              ? <SingleExhibitView
                  exhibit={exhibits[0]}
                  feedback={feedbacks[exhibits[0].id] ?? null}
                  onLike={() => handleLike(exhibits[0].id)}
                />
              : <MultiExhibitView
                  exhibits={exhibits}
                  feedbacks={feedbacks}
                  onLike={handleLike}
                />
            }
          </div>
        )}
      </div>
    </>
  )
}

// ─── 1件表示 ──────────────────────────────────────────────────
function SingleExhibitView({ exhibit, feedback, onLike }: {
  exhibit:  Exhibit
  feedback: FeedbackState | null
  onLike:   () => void
}) {
  const [popping,  setPopping]  = useState(false)
  const [showHint, setShowHint] = useState(false)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleHeartClick = () => {
    if (!feedback) return
    if (feedback.userLiked) {
      onLike()
      return
    }
    if (!feedback.userHasStamp) {
      setShowHint(true)
      if (hintTimer.current) clearTimeout(hintTimer.current)
      hintTimer.current = setTimeout(() => setShowHint(false), 3500)
      return
    }
    setPopping(true)
    setTimeout(() => setPopping(false), 700)
    onLike()
  }

  return (
    <>
      <style>{`
        @keyframes rs-heart-pop {
          0%  { transform:scale(1); }
          20% { transform:scale(1.5); }
          40% { transform:scale(0.88); }
          60% { transform:scale(1.18); }
          80% { transform:scale(0.96); }
          100%{ transform:scale(1); }
        }
        @keyframes rs-hint-in {
          from{ opacity:0; transform:translateY(-4px); }
          to  { opacity:1; transform:translateY(0); }
        }
      `}</style>
      <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
        <div style={{
          width:72, height:72, borderRadius:16, flexShrink:0,
          overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
          background:'linear-gradient(135deg,#FFD166 0%,#FF8C00 100%)', fontSize:28,
        }}>
          {exhibit.thumbnail_url
            ? <img src={exhibit.thumbnail_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : '🎨'}
        </div>
        <div style={{ flex:1, minWidth:0, paddingTop:4 }}>
          <h3 style={{
            fontSize:20, fontWeight:700, color:'#1a1a1a',
            fontFamily:"'Kaisei Decol',serif",
            lineHeight:1.25, marginBottom:8,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          }}>
            {exhibit.name}
          </h3>
          <span style={{
            display:'inline-block', fontSize:11, padding:'3px 12px', borderRadius:99,
            background:'#FFF0E0', color:'#FF8C00', fontFamily:"'Kiwi Maru',sans-serif", fontWeight:700,
          }}>
            {TYPE_LABEL[exhibit.type]}
          </span>
        </div>
      </div>

      {exhibit.has_wait_time !== false && (
        <div style={{ marginTop:20, padding:16, borderRadius:16, background:'#fafafa', border:'1px solid #f0f0f0' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#888', fontFamily:"'Kiwi Maru',sans-serif" }}>混雑状況</span>
            <span style={{ fontSize:14, fontWeight:900, color:WAIT_COLOR(exhibit.wait_minutes), fontFamily:"'Kiwi Maru',sans-serif" }}>
              {waitLabel(exhibit.wait_minutes)}
            </span>
          </div>
          <div style={{ width:'100%', height:8, borderRadius:99, background:'#ececec', overflow:'hidden' }}>
            <div style={{
              height:'100%', borderRadius:99,
              width:`${Math.max(6, Math.min(exhibit.wait_minutes * 1.5, 100))}%`,
              background:`linear-gradient(90deg,#FFD166,${WAIT_COLOR(exhibit.wait_minutes)})`,
              transition:'width 0.8s ease',
            }} />
          </div>
        </div>
      )}

      {/* ── いいね ── */}
      {feedback && (
        <div style={{ marginTop:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button
              onClick={handleHeartClick}
              style={{
                background: feedback.userLiked ? '#fff0f3' : '#f8f9fa',
                border: `1.5px solid ${feedback.userLiked ? '#ff2d55' : '#e0e0e0'}`,
                borderRadius: 99,
                padding: '7px 14px 7px 10px',
                cursor: 'pointer',
                display:'flex', alignItems:'center', gap: 6,
                animation: popping ? 'rs-heart-pop 0.65s cubic-bezier(.36,.07,.19,.97)' : undefined,
                opacity: !feedback.userHasStamp ? 0.7 : 1,
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24"
                fill={feedback.userLiked ? '#ff2d55' : 'none'}
                stroke={feedback.userLiked ? '#ff2d55' : '#aaa'}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                style={{ transition:'fill 0.15s, stroke 0.15s', flexShrink:0 }}
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <span style={{
                fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                color: feedback.userLiked ? '#ff2d55' : '#aaa',
                transition:'color 0.2s',
              }}>
                {feedback.userLiked ? 'いいねを取り消す' : 'いいねする'}
              </span>
            </button>
            {feedback.showLikeCount && feedback.likeCount > 0 && (
              <span style={{
                fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700,
                color: feedback.userLiked ? '#ff2d55' : '#aaa',
              }}>
                {feedback.likeCount}
              </span>
            )}
          </div>
          {showHint && (
            <div style={{
              fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif",
              lineHeight:1.6, marginTop:6,
              animation:'rs-hint-in 0.2s ease',
            }}>
              この展示を訪れて QR コードを読み込むと<br />いいねができます
            </div>
          )}
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginTop:14 }}>
        <Link href={`/exhibit/${exhibit.id}`} style={{
          flex:1, display:'block', padding:'10px 0', borderRadius:12,
          background:'linear-gradient(100deg,#F07818,#FFAA28)',
          color:'#fff', fontSize:14, fontWeight:700, textAlign:'center',
          textDecoration:'none', fontFamily:"'Kaisei Decol',serif",
          boxShadow:'0 4px 14px rgba(240,120,24,0.25)',
        }}>
          詳細を見る →
        </Link>
        <NotifyButton exhibitId={exhibit.id} exhibitType={exhibit.type} variant="pill" />
      </div>
    </>
  )
}

// ─── 複数件リスト表示 ─────────────────────────────────────────
function MultiExhibitView({ exhibits, feedbacks, onLike }: {
  exhibits:  Exhibit[]
  feedbacks: Record<string, FeedbackState>
  onLike:    (id: string) => void
}) {
  return (
    <div>
      <p style={{ fontSize:12, color:'#aaa', marginBottom:14, fontFamily:"'Kiwi Maru',sans-serif" }}>
        {exhibits.length}つの展示があります
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {exhibits.map(exhibit => (
          <Link
            key={exhibit.id}
            href={`/exhibit/${exhibit.id}`}
            style={{
              display:'flex', alignItems:'center', gap:12,
              padding:'12px 14px', borderRadius:16,
              background:'#fafafa', border:'1px solid #f0f0f0',
              textDecoration:'none',
            }}
          >
            {/* サムネイル */}
            <div style={{
              width:48, height:48, borderRadius:12, flexShrink:0,
              overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
              background:'linear-gradient(135deg,#FFD166,#FF8C00)', fontSize:20,
            }}>
              {exhibit.thumbnail_url
                ? <img src={exhibit.thumbnail_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : '🎨'}
            </div>

            {/* テキスト */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{
                fontSize:15, fontWeight:700, color:'#1a1a1a',
                fontFamily:"'Kaisei Decol',serif",
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                marginBottom:4,
              }}>
                {exhibit.name}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{
                  fontSize:10, padding:'2px 8px', borderRadius:99,
                  background:'#FFF0E0', color:'#FF8C00',
                  fontFamily:"'Kiwi Maru',sans-serif", fontWeight:700,
                }}>
                  {TYPE_LABEL[exhibit.type]}
                </span>
                {exhibit.has_wait_time !== false && (
                  <span style={{
                    fontSize:11, fontWeight:700,
                    color:WAIT_COLOR(exhibit.wait_minutes),
                    fontFamily:"'Kiwi Maru',sans-serif",
                  }}>
                    {waitLabel(exhibit.wait_minutes)}
                  </span>
                )}
              </div>
            </div>

            {/* いいね */}
            {(() => {
              const fb = feedbacks[exhibit.id]
              if (!fb) return null
              return (
                <button
                  onClick={e => { e.preventDefault(); if (!fb.userLiked && fb.userHasStamp) onLike(exhibit.id) }}
                  style={{ background:'none', border:'none', padding:'4px 2px', cursor: fb.userLiked ? 'default' : 'pointer', flexShrink:0, display:'flex', alignItems:'center', gap:4 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24"
                    fill={fb.userLiked ? '#ff2d55' : 'none'}
                    stroke={fb.userLiked ? '#ff2d55' : '#ccc'}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition:'fill 0.15s' }}
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  {fb.showLikeCount && fb.likeCount > 0 && (
                    <span style={{ fontSize:11, fontWeight:700, color: fb.userLiked ? '#ff2d55' : '#ccc', fontFamily:"'Kaisei Decol',serif" }}>
                      {fb.likeCount}
                    </span>
                  )}
                </button>
              )
            })()}

            {/* 矢印 */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}
