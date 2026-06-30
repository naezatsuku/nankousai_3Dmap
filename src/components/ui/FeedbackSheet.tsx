'use client'

import { useState, useEffect } from 'react'

interface Comment { id: string; body: string; author_name?: string | null; created_at: string }

function relTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return `${diff}秒`
  if (diff < 3600)  return `${Math.floor(diff / 60)}分`
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間`
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function Avatar({ name, size = 40 }: { name?: string | null; size?: number }) {
  const ch = name?.trim().charAt(0) ?? null
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: ch ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#cfd9de',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.42), fontWeight: 700, color: '#fff',
      fontFamily: "'Kaisei Decol',serif",
    }}>
      {ch ?? (
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
        </svg>
      )}
    </div>
  )
}

interface Props {
  exhibitId:   string
  exhibitName: string
  userId:      string
  onClose:     () => void
}

export default function FeedbackSheet({ exhibitId, exhibitName, userId, onClose }: Props) {
  const [likeCount,     setLikeCount]     = useState(0)
  const [liked,         setLiked]         = useState(false)
  const [showLikeCount, setShowLikeCount] = useState(true)
  const [userHasStamp,  setUserHasStamp]  = useState(false)
  const [commentEnabled, setCommentEnabled] = useState(true)
  const [comments,      setComments]      = useState<Comment[]>([])
  const [comment,       setComment]       = useState('')
  const [authorName,    setAuthorName]    = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [submitted,     setSubmitted]     = useState(false)
  const [submitError,   setSubmitError]   = useState('')
  const [confirming,    setConfirming]    = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/exhibit-feedback/${exhibitId}?userId=${userId}&limit=3`)
      .then(r => r.json())
      .then((d: { likeCount: number; userLiked: boolean; userHasStamp: boolean; showLikeCount: boolean; commentEnabled: boolean; comments: Comment[] }) => {
        if (!alive) return
        setLikeCount(d.likeCount)
        setLiked(d.userLiked)
        setUserHasStamp(d.userHasStamp)
        setShowLikeCount(d.showLikeCount)
        setCommentEnabled(d.commentEnabled ?? true)
        setComments(d.comments)
      })
    return () => { alive = false }
  }, [exhibitId, userId])

  const handleLike = async () => {
    if (liked || !userHasStamp) return
    const res  = await fetch('/api/exhibit-like', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exhibitId, userId }),
    })
    const json = await res.json() as { liked: boolean; likeCount: number }
    setLiked(json.liked)
    setLikeCount(json.likeCount)
  }

  const handleSubmit = async () => {
    if (!comment.trim() || submitting || submitted) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res  = await fetch('/api/exhibit-comment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exhibitId, userId, body: comment.trim(), authorName: authorName.trim() || undefined }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setSubmitError(json.error ?? `エラー (${res.status})`)
        setSubmitting(false)
        return
      }
      setSubmitted(true)
      setComment('')
    } catch {
      setSubmitError('送信に失敗しました。通信を確認してください。')
    }
    setSubmitting(false)
  }

  return (
    <>
      <style>{`
        @keyframes feedback-up { from { transform:translateY(100%) } to { transform:translateY(0) } }
        @keyframes like-pop { 0%{transform:scale(1)} 40%{transform:scale(1.35)} 70%{transform:scale(0.9)} 100%{transform:scale(1)} }
        .fb-compose-input::placeholder { color:#536471; }
        .fb-compose-name::placeholder  { color:#aab8c2; }
        .fb-compose-input { caret-color:#FF6B00; }
        .fb-close-btn:hover { background:rgba(15,20,25,0.06) !important; }
      `}</style>

      {/* Overlay */}
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:250 }} />

      {/* Sheet */}
      <div style={{
        position:'fixed', bottom:0, left:0, right:0,
        background:'#fff', borderRadius:'16px 16px 0 0',
        zIndex:260, maxHeight:'88vh', display:'flex', flexDirection:'column',
        animation:'feedback-up 0.3s cubic-bezier(.22,.68,0,1.1)',
      }}>
        {/* Handle */}
        <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 0', flexShrink:0 }}>
          <div style={{ width:32, height:4, borderRadius:2, background:'#e7e9ea' }} />
        </div>

        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', padding:'10px 8px 10px 16px',
          borderBottom:'1px solid #eff3f4', flexShrink:0,
        }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, color:'#536471', fontFamily:"'Kiwi Maru',serif", marginBottom:1 }}>
              感想・いいね
            </div>
            <div style={{ fontSize:17, fontWeight:700, color:'#0f1419', fontFamily:"'Kaisei Decol',serif", lineHeight:1.3 }}>
              {exhibitName}
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="fb-close-btn"
            style={{
              width:36, height:36, borderRadius:'50%', border:'none',
              background:'transparent', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'background 0.15s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#536471">
              <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
            </svg>
          </button>
        </div>

        {/* Like row */}
        <div style={{
          padding:'10px 16px',
          borderBottom:'1px solid #eff3f4',
          display:'flex', alignItems:'center', gap:8, flexShrink:0,
        }}>
          <button
            type="button"
            onClick={handleLike}
            disabled={!userHasStamp || liked}
            style={{
              display:'flex', alignItems:'center', gap:5,
              background:'none', border:'none',
              cursor: (userHasStamp && !liked) ? 'pointer' : 'default',
              padding:'4px 8px 4px 0',
              animation: liked ? 'like-pop 0.35s ease' : undefined,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24"
              fill={liked ? '#f91880' : 'none'}
              stroke={liked ? '#f91880' : '#536471'}
              strokeWidth="1.8"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {showLikeCount && likeCount > 0 && (
              <span style={{
                fontSize:14, fontFamily:"'Kiwi Maru',serif",
                color: liked ? '#f91880' : '#536471',
              }}>
                {likeCount}
              </span>
            )}
          </button>

          {!userHasStamp && (
            <span style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
              QRを読み込むといいねできます
            </span>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1, overflowY:'auto' }}>

          {!commentEnabled && (
            <div style={{ padding:'24px 16px', textAlign:'center' }}>
              <div style={{ fontSize:13, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                現在コメント機能は停止中です
              </div>
            </div>
          )}

          {/* Compose */}
          {commentEnabled && (!submitted ? (
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #eff3f4' }}>
              <div style={{ display:'flex', gap:10 }}>
                <Avatar name={authorName || null} size={40} />
                <div style={{ flex:1, minWidth:0 }}>
                  <input
                    type="text"
                    value={authorName}
                    onChange={e => setAuthorName(e.target.value.slice(0, 50))}
                    placeholder="名前（任意）"
                    className="fb-compose-name"
                    style={{
                      width:'100%', border:'none', outline:'none',
                      fontSize:13, color:'#536471',
                      fontFamily:"'Kiwi Maru',serif",
                      background:'transparent', boxSizing:'border-box',
                      marginBottom:4,
                    }}
                  />
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value.slice(0, 200))}
                    placeholder="感想を書く..."
                    rows={3}
                    className="fb-compose-input"
                    style={{
                      width:'100%', border:'none', outline:'none', resize:'none',
                      fontSize:16, color:'#0f1419', lineHeight:1.55,
                      fontFamily:"'Kiwi Maru',serif",
                      background:'transparent', boxSizing:'border-box',
                    }}
                  />

                  {submitError && (
                    <div style={{
                      fontSize:12, color:'#f4212e', fontFamily:"'Kiwi Maru',serif",
                      marginBottom:6,
                    }}>
                      ⚠ {submitError}
                    </div>
                  )}

                  {/* 通常行：文字数 + 投稿ボタン */}
                  {!confirming && (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:12, marginTop:4 }}>
                      {comment.length > 0 && (
                        <span style={{
                          fontSize:12, fontFamily:"'Kiwi Maru',serif",
                          color: comment.length >= 180 ? '#f4212e' : '#536471',
                        }}>
                          {200 - comment.length}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => { if (comment.trim()) setConfirming(true) }}
                        disabled={!comment.trim()}
                        style={{
                          padding:'7px 18px', borderRadius:99, border:'none', cursor: comment.trim() ? 'pointer' : 'default',
                          background: comment.trim() ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#e7e9ea',
                          color: comment.trim() ? '#fff' : '#8b98a5',
                          fontSize:14, fontWeight:700, fontFamily:"'Kaisei Decol',serif",
                          transition:'background 0.15s, color 0.15s',
                        }}
                      >
                        投稿
                      </button>
                    </div>
                  )}

                  {/* 確認ステップ */}
                  {confirming && (
                    <div style={{
                      marginTop:10, padding:'12px 14px', borderRadius:12,
                      background:'#fff8f0', border:'1px solid rgba(255,140,0,0.25)',
                    }}>
                      <div style={{
                        fontSize:12, color:'#374151', fontFamily:"'Kiwi Maru',serif",
                        lineHeight:1.7, marginBottom:10,
                      }}>
                        コメントは運営が内容を確認してから公開されます。不適切な内容は非表示になる場合があります。
                      </div>
                      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => setConfirming(false)}
                          style={{
                            padding:'6px 16px', borderRadius:99,
                            border:'1px solid #e2e8f0', background:'#fff',
                            fontSize:13, fontWeight:700, fontFamily:"'Kaisei Decol',serif",
                            color:'#536471', cursor:'pointer',
                          }}
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConfirming(false); handleSubmit() }}
                          disabled={submitting}
                          style={{
                            padding:'6px 18px', borderRadius:99, border:'none',
                            background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
                            color:'#fff', fontSize:13, fontWeight:700,
                            fontFamily:"'Kaisei Decol',serif", cursor:'pointer',
                          }}
                        >
                          {submitting ? '送信中' : '送信する'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding:'16px', borderBottom:'1px solid #eff3f4' }}>
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <Avatar name={authorName || null} size={40} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#00ba7c', fontFamily:"'Kiwi Maru',serif" }}>
                    投稿ありがとうございます！
                  </div>
                  <div style={{ fontSize:13, color:'#536471', fontFamily:"'Kiwi Maru',serif", marginTop:2 }}>
                    承認後に公開されます
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Comments */}
          {commentEnabled && comments.map(c => (
            <div key={c.id} style={{
              padding:'12px 16px',
              borderBottom:'1px solid #eff3f4',
              display:'flex', gap:10,
            }}>
              <Avatar name={c.author_name} size={40} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:5, marginBottom:3, flexWrap:'wrap' }}>
                  <span style={{
                    fontSize:14, fontWeight:700, color:'#0f1419',
                    fontFamily:"'Kiwi Maru',serif",
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160,
                  }}>
                    {c.author_name?.trim() || '匿名'}
                  </span>
                  <span style={{ fontSize:13, color:'#536471', fontFamily:"'Kiwi Maru',serif", flexShrink:0 }}>
                    · {relTime(c.created_at)}
                  </span>
                </div>
                <div style={{ fontSize:14, color:'#0f1419', fontFamily:"'Kiwi Maru',serif", lineHeight:1.55 }}>
                  {c.body}
                </div>
              </div>
            </div>
          ))}

          <div style={{ height:40 }} />
        </div>
      </div>
    </>
  )
}
