'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  DUMMY_NOTICES, getReadIds, markAllAsRead,
  formatDate, NoticeItem, fetchNotices,
} from '@/lib/notices'

export default function NewsPage() {
  const router   = useRouter()
  const [notices, setNotices] = useState<NoticeItem[]>(DUMMY_NOTICES)
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadIds())

  useEffect(() => {
    fetchNotices().then(data => {
      setNotices(data)
      // ページを開いた時点で全件既読にする
      markAllAsRead(data.map(n => n.id))
      setReadIds(new Set(data.map(n => n.id)))
    })
  }, [])

  const handleMarkAll = useCallback(() => {
    markAllAsRead(notices.map(n => n.id))
    setReadIds(new Set(notices.map((n) => n.id)))
  }, [notices])

  const unreadCount = notices.filter((n) => !readIds.has(n.id)).length

  // 新しい順
  const sorted = [...notices].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .notice-row { transition: background 0.15s; }
        .notice-row:active { background: #fff8f4 !important; }
      `}</style>

      <div style={{ height:'100%', overflowY:'auto', background:'#f5f3ef' }}>
        <div style={{ maxWidth:640, margin:'0 auto', background:'#fff', minHeight:'100%', boxShadow:'0 0 24px rgba(0,0,0,0.04)' }}>

        {/* ── ヘッダー ── */}
        <div style={{
          background:'rgba(255,255,255,0.95)',
          backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
          padding:'14px 16px 12px',
          borderBottom:'1px solid rgba(255,140,0,0.12)',
          position:'sticky', top:0, zIndex:40,
          display:'flex', alignItems:'center', gap:10,
        }}>
          <div style={{
            width:38, height:38, borderRadius:'50%',
            background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
          }}>🔔</div>
          <div>
            <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:19, fontWeight:700, background:'linear-gradient(90deg,#E85A00,#FF8C00)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              お知らせ
            </div>
            {unreadCount > 0 && (
              <div style={{ fontSize:10, color:'#FF6B00', fontFamily:"'Kiwi Maru',serif", fontWeight:700 }}>
                未読 {unreadCount} 件
              </div>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={handleMarkAll} style={{
              marginLeft:'auto', fontSize:11, padding:'5px 12px', borderRadius:20,
              background:'#f0f0f0', color:'#888', border:'none', cursor:'pointer',
              fontFamily:"'Kiwi Maru',serif", fontWeight:700,
            }}>
              すべて既読
            </button>
          )}
        </div>

        {/* ── 一覧 ── */}
        <div>
          {sorted.map((notice, i) => {
            const isRead  = readIds.has(notice.id)
            const hasMedia = notice.media.length > 0
            return (
              <button
                key={notice.id}
                className="notice-row"
                onClick={() => router.push(`/news/${notice.id}`)}
                style={{
                  width:'100%', background: isRead ? '#fff' : '#fffbf7',
                  border:'none', cursor:'pointer', textAlign:'left',
                  padding:'0',
                  borderBottom: i < sorted.length - 1 ? '1px solid #f5f5f5' : 'none',
                  display:'block',
                  animation:`fadeUp ${0.05 + i * 0.04}s ease both`,
                }}
              >
                <div style={{ display:'flex', gap:12, padding:'14px 16px', alignItems:'flex-start' }}>
                  {/* 送信者アバター */}
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <div style={{
                      width:42, height:42, borderRadius:'50%',
                      background: notice.is_urgent
                        ? 'linear-gradient(135deg,#FF6B00,#FFAA28)'
                        : 'linear-gradient(135deg,#e2e8f0,#cbd5e1)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:18, overflow:'hidden',
                    }}>
                      {notice.sender_thumbnail
                        ? <img src={notice.sender_thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : <SenderIcon sender={notice.sender} />
                      }
                    </div>
                    {/* 未読ドット */}
                    {!isRead && (
                      <div style={{
                        position:'absolute', bottom:1, right:1,
                        width:10, height:10, borderRadius:'50%',
                        background:'#FF6B00', border:'2px solid #fff',
                      }} />
                    )}
                  </div>

                  {/* 本文 */}
                  <div style={{ flex:1, minWidth:0 }}>
                    {/* 送信者 + 日時 */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{
                        fontSize:13, fontWeight: isRead ? 500 : 700,
                        color: isRead ? '#555' : '#1a1a1a',
                        fontFamily:"'Kiwi Maru',serif",
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                        maxWidth:'70%',
                      }}>
                        {notice.sender}
                      </span>
                      <span style={{ fontSize:11, color:'#bbb', flexShrink:0, fontFamily:"'Kiwi Maru',serif" }}>
                        {formatDate(notice.created_at)}
                      </span>
                    </div>

                    {/* 件名 */}
                    <div style={{
                      fontSize:14, fontWeight: isRead ? 500 : 700,
                      color: isRead ? '#555' : '#1a1a1a',
                      fontFamily:"'Kaisei Decol',serif",
                      marginBottom:3,
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      display:'flex', alignItems:'center', gap:5,
                    }}>
                      {notice.is_urgent && (
                        <span style={{
                          fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99,
                          background:'#FF6B00', color:'#fff', flexShrink:0,
                          fontFamily:"'Kiwi Maru',serif",
                        }}>重要</span>
                      )}
                      {notice.title}
                    </div>

                    {/* プレビュー + メディア枚数 */}
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{
                        fontSize:12, color:'#aaa', fontFamily:"'Kiwi Maru',serif",
                        flex:1, minWidth:0,
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      }}>
                        {extractPreview(notice)}
                      </span>
                      {hasMedia && (
                        <div style={{
                          display:'flex', alignItems:'center', gap:2,
                          fontSize:10, color:'#bbb', flexShrink:0, fontFamily:"'Kiwi Maru',serif",
                        }}>
                          📎 {notice.media.length}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        </div>
      </div>
    </>
  )
}

/** 本文からテキストプレビューを抽出 */
function extractPreview(notice: NoticeItem): string {
  const parts = notice.body
    .filter((s) => s.type === 'text')
    .map((s) => (s as { type:'text'; text:string }).text.replace(/\n/g, ' '))
    .join(' ')
  return parts.slice(0, 60) + (parts.length > 60 ? '…' : '')
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
  return <span style={{ fontSize:20 }}>{emoji}</span>
}
