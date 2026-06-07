'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/ui/BackButton'
import {
  DUMMY_NOTICES, markAsRead, getReadIds,
  formatDate, BodySegment, NoticeMedia, NoticeItem, fetchNotice,
} from '@/lib/notices'

export default function NoticeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [notice, setNotice] = useState<NoticeItem | null>(
    DUMMY_NOTICES.find((n) => n.id === id) ?? null
  )

  const [activeMedia, setActiveMedia] = useState(0)
  const galleryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotice(id).then(data => { if (data) setNotice(data) })
  }, [id])

  // ── 開いたら既読にする ──
  useEffect(() => {
    if (notice) markAsRead(notice.id)
  }, [notice])

  if (!notice) {
    return (
      <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#bbb', fontFamily:"'Kiwi Maru',serif" }}>
        お知らせが見つかりませんでした
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .media-thumb { transition: transform 0.15s, opacity 0.15s; }
        .media-thumb:active { transform: scale(0.94); opacity: 0.8; }
      `}</style>

      <div style={{ height:'100%', overflowY:'auto', background:'#f5f3ef' }}>

        {/* ── ヘッダー ── */}
        <div style={{
          background:'rgba(255,255,255,0.95)',
          backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
          padding:'14px 16px 12px',
          borderBottom:'1px solid rgba(255,140,0,0.12)',
          position:'sticky', top:0, zIndex:40,
          display:'flex', alignItems:'center', gap:10,
        }}>
          <BackButton fallbackHref="/timeline" />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700,
              color:'#1a1a1a',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            }}>
              {notice.title}
            </div>
          </div>
        </div>

        {/* ── 本文カード ── */}
        <div style={{ padding:'14px 14px 0' }}>
          <div style={{
            background:'#fff', borderRadius:20, overflow:'hidden',
            boxShadow:'0 2px 16px rgba(0,0,0,0.06)',
            animation:'fadeIn 0.3s ease',
          }}>
            {/* 重要バナー */}
            {notice.is_urgent && (
              <div style={{
                background:'linear-gradient(90deg,#FF6B00,#FFAA28)',
                padding:'8px 16px',
                display:'flex', alignItems:'center', gap:6,
              }}>
                <span style={{ fontSize:12, color:'#fff', fontWeight:700, fontFamily:"'Kiwi Maru',serif" }}>
                  ⚠ 重要なお知らせ
                </span>
              </div>
            )}

            {/* 送信者・件名 */}
            <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid #f5f5f5' }}>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{
                  width:46, height:46, borderRadius:'50%', flexShrink:0,
                  background: notice.is_urgent
                    ? 'linear-gradient(135deg,#FF6B00,#FFAA28)'
                    : 'linear-gradient(135deg,#e2e8f0,#cbd5e1)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
                  overflow:'hidden',
                }}>
                  {notice.sender_thumbnail
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={notice.sender_thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <SenderIcon sender={notice.sender} />
                  }
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:3 }}>
                    {notice.title}
                  </div>
                  <div style={{ fontSize:12, color:'#aaa', fontFamily:"'Kiwi Maru',serif" }}>
                    {notice.sender} · {formatDate(notice.created_at)}
                  </div>
                </div>
              </div>
            </div>

            {/* 本文 */}
            <div style={{ padding:'16px', lineHeight:1.8 }}>
              <NoticeBody segments={notice.body} />
            </div>
          </div>

          {/* ── メディアギャラリー ── */}
          {notice.media.length > 0 && (
            <MediaGallery
              media={notice.media}
              active={activeMedia}
              onSelect={setActiveMedia}
              galleryRef={galleryRef}
            />
          )}

          <div style={{ height:24 }} />
        </div>
      </div>
    </>
  )
}

// ─── 本文レンダラー ───────────────────────────────────────────
function NoticeBody({ segments }: { segments: BodySegment[] }) {
  return (
    <div style={{ fontFamily:"'Kiwi Maru',serif", fontSize:14, color:'#333' }}>
      {segments.map((seg, i) => {
        if (seg.type === 'break') {
          return <div key={i} style={{ height:12 }} />
        }
        if (seg.type === 'text') {
          return (
            <span key={i} style={{ whiteSpace:'pre-wrap' }}>
              {seg.text}
            </span>
          )
        }
        if (seg.type === 'link') {
          return (
            <Link
              key={i}
              href={seg.href}
              style={{
                display:'inline-flex', alignItems:'center', gap:4,
                color:'#FF6B00', fontWeight:700, textDecoration:'none',
                background:'#fff8f4',
                border:'1px solid rgba(255,107,0,0.2)',
                borderRadius:99, padding:'3px 10px',
                fontSize:13,
                margin:'2px 0',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="#FF6B00" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              {seg.label}
            </Link>
          )
        }
        return null
      })}
    </div>
  )
}

// ─── メディアギャラリー ───────────────────────────────────────
function MediaGallery({
  media, active, onSelect, galleryRef,
}: {
  media:      NoticeMedia[]
  active:     number
  onSelect:   (i: number) => void
  galleryRef: React.RefObject<HTMLDivElement | null>
}) {
  const current = media[active]

  return (
    <div style={{ marginTop:14 }}>
      {/* メインビュー */}
      <div style={{
        background:'#111', borderRadius:18, overflow:'hidden',
        aspectRatio:'16/9',
        display:'flex', alignItems:'center', justifyContent:'center',
        position:'relative', boxShadow:'0 4px 20px rgba(0,0,0,0.15)',
      }}>
        {current.url ? (
          current.type === 'image'
            ? <img src={current.url} alt={current.caption} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <video src={current.url} controls style={{ width:'100%', height:'100%' }} />
        ) : (
          <PlaceholderMedia type={current.type} caption={current.caption} />
        )}

        {/* ページインジケーター */}
        {media.length > 1 && (
          <div style={{
            position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)',
            display:'flex', gap:4,
          }}>
            {media.map((_, i) => (
              <div key={i} style={{
                width: i === active ? 18 : 6,
                height:6, borderRadius:99,
                background: i === active ? '#fff' : 'rgba(255,255,255,0.4)',
                transition:'all 0.25s ease',
              }} />
            ))}
          </div>
        )}

        {/* 前後ボタン */}
        {active > 0 && (
          <button onClick={() => onSelect(active - 1)} style={{
            position:'absolute', left:8, top:'50%', transform:'translateY(-50%)',
            width:32, height:32, borderRadius:'50%', background:'rgba(0,0,0,0.4)',
            border:'none', color:'#fff', fontSize:16, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>‹</button>
        )}
        {active < media.length - 1 && (
          <button onClick={() => onSelect(active + 1)} style={{
            position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
            width:32, height:32, borderRadius:'50%', background:'rgba(0,0,0,0.4)',
            border:'none', color:'#fff', fontSize:16, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>›</button>
        )}
      </div>

      {/* キャプション */}
      {current.caption && (
        <div style={{ fontSize:12, color:'#aaa', textAlign:'center', marginTop:6, fontFamily:"'Kiwi Maru',serif" }}>
          {current.caption}
        </div>
      )}

      {/* サムネイル一覧（横スクロール）*/}
      {media.length > 1 && (
        <div ref={galleryRef} style={{
          display:'flex', gap:8, marginTop:10,
          overflowX:'auto', paddingBottom:4,
          scrollbarWidth:'none',
        }}>
          {media.map((m, i) => (
            <button
              key={m.id}
              className="media-thumb"
              onClick={() => onSelect(i)}
              style={{
                width:64, height:64, borderRadius:12, flexShrink:0,
                background:'#111', border:'none', cursor:'pointer',
                overflow:'hidden', padding:0,
                outline: i === active ? '2.5px solid #FF6B00' : '2.5px solid transparent',
                transition:'outline 0.15s',
              }}
            >
              {m.url ? (
                m.type === 'image'
                  ? <img src={m.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <ThumbVideo />
              ) : (
                <PlaceholderThumb type={m.type} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── プレースホルダー（画像未設定時）─────────────────────────
function PlaceholderMedia({ type, caption }: { type: 'image'|'video'; caption?: string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, color:'rgba(255,255,255,0.4)' }}>
      <span style={{ fontSize:48 }}>{type === 'video' ? '▶' : '🖼'}</span>
      <span style={{ fontSize:12, fontFamily:"'Kiwi Maru',serif" }}>{caption ?? (type === 'video' ? '動画' : '画像')}</span>
    </div>
  )
}
function PlaceholderThumb({ type }: { type: 'image'|'video' }) {
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'rgba(255,255,255,0.3)' }}>
      {type === 'video' ? '▶' : '🖼'}
    </div>
  )
}
function ThumbVideo() {
  return (
    <div style={{ width:'100%', height:'100%', background:'#222', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'rgba(255,255,255,0.5)' }}>
      ▶
    </div>
  )
}

/** 送信者名から絵文字アイコンを生成 */
function SenderIcon({ sender }: { sender: string }) {
  const emoji =
    sender.includes('軽音') ? '🎸' :
    sender.includes('ダンス') ? '💃' :
    sender.includes('演劇') ? '🎭' :
    sender.includes('食堂') ? '🍜' :
    sender.includes('高3') ? '🍳' :
    sender.includes('高2') ? '🎨' :
    sender.includes('高1') ? '📚' : '📣'
  return <span>{emoji}</span>
}
