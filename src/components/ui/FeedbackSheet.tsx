'use client'

import { useState, useEffect } from 'react'

interface Comment { id: string; body: string; author_name?: string | null; created_at: string }

function fmtTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  const [comments,      setComments]      = useState<Comment[]>([])
  const [comment,       setComment]       = useState('')
  const [authorName,    setAuthorName]    = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [submitted,     setSubmitted]     = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/exhibit-feedback/${exhibitId}?userId=${userId}&limit=3`)
      .then(r => r.json())
      .then((d: { likeCount:number; userLiked:boolean; userHasStamp:boolean; showLikeCount:boolean; comments:Comment[] }) => {
        if (!alive) return
        setLikeCount(d.likeCount)
        setLiked(d.userLiked)
        setUserHasStamp(d.userHasStamp)
        setShowLikeCount(d.showLikeCount)
        setComments(d.comments)
      })
    return () => { alive = false }
  }, [exhibitId, userId])

  const handleLike = async () => {
    if (liked) return
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
    await fetch('/api/exhibit-comment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exhibitId, userId, body: comment.trim(), authorName: authorName.trim() || undefined }),
    })
    setSubmitting(false)
    setSubmitted(true)
    setComment('')
  }

  return (
    <>
      <style>{`@keyframes feedback-up { from { transform:translateY(100%) } to { transform:translateY(0) } }`}</style>

      {/* Overlay */}
      <div onClick={onClose} style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:250,
      }} />

      {/* Sheet */}
      <div style={{
        position:'fixed', bottom:0, left:0, right:0,
        background:'#fff', borderRadius:'24px 24px 0 0',
        zIndex:260, maxHeight:'85vh', overflowY:'auto',
        animation:'feedback-up 0.3s ease-out',
      }}>
        {/* Handle */}
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 0' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'#e2e8f0' }} />
        </div>

        <div style={{ padding:'16px 20px 48px' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'flex-start', marginBottom:20 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:3 }}>
                この展示はどうでしたか？
              </div>
              <div style={{
                fontFamily:"'Kaisei Decol',serif", fontSize:18, fontWeight:700, color:'#1a1a1a',
                lineHeight:1.3,
              }}>
                {exhibitName}
              </div>
            </div>
            <button onClick={onClose} type="button" style={{
              width:32, height:32, borderRadius:'50%', border:'none',
              background:'#f1f5f9', cursor:'pointer', flexShrink:0, marginLeft:12,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:14, color:'#94a3b8',
            }}>✕</button>
          </div>

          {/* Like button */}
          {userHasStamp ? (
            <button
              type="button"
              onClick={handleLike}
              disabled={liked}
              style={{
                width:'100%', padding:'14px', borderRadius:14, border:'none',
                cursor: liked ? 'default' : 'pointer',
                background: liked ? '#fef2f2' : '#fff',
                boxShadow: liked ? 'inset 0 0 0 1.5px #fca5a5' : 'inset 0 0 0 1.5px #e2e8f0',
                display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                marginBottom:16, transition:'all 0.2s',
              }}
            >
              <span style={{ fontSize:22 }}>{liked ? '❤️' : '🤍'}</span>
              <span style={{
                fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700,
                color: liked ? '#dc2626' : '#64748b',
              }}>
                {liked ? 'いいね済み！' : 'いいね！'}
                {showLikeCount && likeCount > 0 && (
                  <span style={{ marginLeft:6, fontSize:13, opacity:0.8 }}>({likeCount})</span>
                )}
              </span>
            </button>
          ) : (
            <div style={{ marginBottom:16 }}>
              <div style={{
                width:'100%', padding:'14px', borderRadius:14,
                boxShadow:'inset 0 0 0 1.5px #e2e8f0',
                display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                background:'#f8fafc', marginBottom:8,
              }}>
                <span style={{ fontSize:22, opacity:0.4 }}>🤍</span>
                <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#cbd5e1' }}>
                  いいね！
                </span>
              </div>
              <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", textAlign:'center', lineHeight:1.6 }}>
                この展示を訪れて QR コードを読み込むと<br />いいねができます
              </div>
            </div>
          )}

          {/* Comment */}
          {!submitted ? (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:8 }}>
                コメント（承認後に公開されます）
              </div>
              <input
                type="text"
                value={authorName}
                onChange={e => setAuthorName(e.target.value.slice(0, 50))}
                placeholder="名前（任意）"
                style={{
                  width:'100%', padding:'10px 12px', borderRadius:10,
                  border:'1px solid #e2e8f0', marginBottom:8,
                  fontSize:14, fontFamily:"'Kiwi Maru',serif",
                  color:'#1a1a1a', outline:'none', boxSizing:'border-box',
                  background:'#fafbfc',
                }}
              />
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value.slice(0, 200))}
                placeholder="感想を入力してください…"
                rows={3}
                style={{
                  width:'100%', padding:'12px', borderRadius:12,
                  border:'1px solid #e2e8f0', resize:'none',
                  fontSize:14, fontFamily:"'Kiwi Maru',serif",
                  color:'#1a1a1a', outline:'none', boxSizing:'border-box',
                  background:'#fafbfc',
                }}
              />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
                <span style={{
                  fontSize:11, fontFamily:"'Kiwi Maru',serif",
                  color: comment.length >= 180 ? '#f59e0b' : '#94a3b8',
                }}>
                  {comment.length}/200
                </span>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!comment.trim() || submitting}
                  style={{
                    padding:'10px 24px', borderRadius:10, border:'none', cursor:'pointer',
                    background: comment.trim() ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#e2e8f0',
                    color: comment.trim() ? '#fff' : '#94a3b8',
                    fontSize:13, fontWeight:700, fontFamily:"'Kaisei Decol',serif",
                    transition:'all 0.15s',
                  }}
                >
                  {submitting ? '送信中…' : '送信'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              padding:'14px', borderRadius:12,
              background:'#f0fdf4', boxShadow:'inset 0 0 0 1.5px #86efac',
              marginBottom:20, textAlign:'center',
            }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#16a34a', fontFamily:"'Kiwi Maru',serif", lineHeight:1.6 }}>
                ✓ コメントありがとうございます！<br />
                <span style={{ fontSize:11, fontWeight:400 }}>承認後に公開されます</span>
              </div>
            </div>
          )}

          {/* Recent comments */}
          {comments.length > 0 && (
            <div>
              <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:10 }}>
                最近の感想
              </div>
              {comments.map(c => (
                <div key={c.id} style={{
                  padding:'10px 14px', borderRadius:10,
                  background:'#f8fafc', marginBottom:8,
                  fontFamily:"'Kiwi Maru',serif",
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: c.author_name ? 2 : 4 }}>
                    {c.author_name
                      ? <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8' }}>{c.author_name}</span>
                      : <span />
                    }
                    <span style={{ fontSize:10, color:'#cbd5e1' }}>{fmtTime(c.created_at)}</span>
                  </div>
                  <div style={{ fontSize:13, color:'#374151', lineHeight:1.6 }}>{c.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
