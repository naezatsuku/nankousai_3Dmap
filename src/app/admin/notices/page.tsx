'use client'


import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/notices'

type NoticeStatus = 'pending' | 'approved' | 'rejected'

interface NoticeRow {
  id:             string
  title:          string
  is_urgent:      boolean
  created_at:     string
  sender_name:    string | null
  status:         NoticeStatus | null
  review_comment: string | null
  exhibit:        { name: string; class_label: string | null } | null
  notice_media:   { id: string }[]
}

export default function NoticesPage() {
  const [notices, setNotices]   = useState<NoticeRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const role = (profile as { role: string } | null)?.role
      const isEditorOrTeacher = role === 'editor' || role === 'teacher'

      let query = supabase
        .from('notices')
        .select('id, title, is_urgent, created_at, sender_name, status, review_comment, exhibit:exhibits(name, class_label), notice_media(id)')
        .order('created_at', { ascending: false })

      if (isEditorOrTeacher) {
        const { data: assignments } = await supabase
          .from('exhibit_editors').select('exhibit_id').eq('user_id', user.id)
        const ids = (assignments ?? []).map((a: { exhibit_id: string }) => a.exhibit_id)
        if (ids.length === 0) {
          setNotices([])
          setLoading(false)
          return
        }
        query = query.in('exhibit_id', ids)
      }

      const { data } = await query
      if (data) setNotices(data as unknown as NoticeRow[])
      setLoading(false)
    })
  }, [])

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`「${title}」を削除しますか？`)) return
    setDeleting(id)
    const supabase = createClient()
    await supabase.from('notices').delete().eq('id', id)
    setNotices(prev => prev.filter(n => n.id !== id))
    setDeleting(null)
  }

  return (
    <div style={{ maxWidth:900 }}>
      {/* ヘッダー */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#1e293b', marginBottom:2 }}>
            お知らせ管理
          </h1>
          <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
            {loading ? '読み込み中…' : `${notices.length} 件`}
          </div>
        </div>
        <Link href="/admin/notices/new" style={{
          display:'inline-flex', alignItems:'center', gap:6,
          padding:'10px 20px', borderRadius:12,
          background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
          color:'#fff', textDecoration:'none',
          fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
          boxShadow:'0 4px 14px rgba(255,107,0,0.3)',
        }}>
          ＋ 新規作成
        </Link>
      </div>

      {/* 一覧 */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{
              height:72, borderRadius:14, background:'#fff',
              border:'1px solid #f1f5f9', animation:'pulse 1.5s ease infinite',
            }} />
          ))}
        </div>
      ) : notices.length === 0 ? (
        <div style={{
          textAlign:'center', padding:'64px 0',
          color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif", fontSize:13,
        }}>
          <div style={{ fontSize:36, marginBottom:12 }}>🔔</div>
          お知らせがありません
          <div style={{ marginTop:16 }}>
            <Link href="/admin/notices/new" style={{
              color:'#FF8C00', fontWeight:700, textDecoration:'none', fontSize:13,
            }}>
              最初のお知らせを作成する →
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {notices.map(n => {
            const exhibitLabel = n.exhibit
              ? `${n.exhibit.class_label ? n.exhibit.class_label + ' ' : ''}${n.exhibit.name}`
              : '—'
            const senderLabel = n.sender_name ?? exhibitLabel

            return (
              <div key={n.id} style={{
                background: n.status === 'rejected' ? '#fff5f5' : '#fff',
                borderRadius:14, padding:'14px 20px',
                boxShadow:'0 1px 3px rgba(0,0,0,0.06)',
                border: n.status === 'rejected' ? '1px solid #fca5a5' : '1px solid #f1f5f9',
                display:'flex', alignItems:'center', gap:14,
              }}>
                {/* アイコン */}
                <div style={{
                  width:38, height:38, borderRadius:10, flexShrink:0,
                  background: n.is_urgent ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f1f5f9',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
                }}>
                  {n.is_urgent ? '⚠️' : '🔔'}
                </div>

                {/* テキスト */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                    {n.is_urgent && (
                      <span style={{
                        fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99,
                        background:'#fef3c7', color:'#d97706', fontFamily:"'Kiwi Maru',serif",
                      }}>重要</span>
                    )}
                    {n.status === 'pending' && (
                      <span style={{
                        fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99,
                        background:'#fef9c3', color:'#92400e', fontFamily:"'Kiwi Maru',serif",
                      }}>⏳ 審査待ち</span>
                    )}
                    {n.status === 'rejected' && (
                      <span style={{
                        fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99,
                        background:'#fee2e2', color:'#dc2626', fontFamily:"'Kiwi Maru',serif",
                      }}>✕ 却下</span>
                    )}
                    <div style={{
                      fontSize:14, fontWeight:700, color:'#1e293b',
                      fontFamily:"'Kaisei Decol',serif",
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    }}>
                      {n.title}
                    </div>
                  </div>
                  {n.status === 'rejected' && n.review_comment && (
                    <div style={{
                      fontSize:11, color:'#dc2626', fontFamily:"'Kiwi Maru',serif",
                      marginBottom:3,
                    }}>
                      却下理由: {n.review_comment}
                    </div>
                  )}
                  <div style={{
                    fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif",
                    display:'flex', alignItems:'center', gap:8,
                  }}>
                    <span>{senderLabel}</span>
                    {n.notice_media.length > 0 && (
                      <span style={{ color:'#cbd5e1' }}>📎 {n.notice_media.length}</span>
                    )}
                    <span style={{ color:'#cbd5e1' }}>{formatDate(n.created_at)}</span>
                  </div>
                </div>

                {/* ボタン */}
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  <Link href={`/admin/notices/${n.id}`} style={{
                    padding:'6px 14px', borderRadius:8, border:'1px solid #e2e8f0',
                    background:'#fff', color:'#475569', textDecoration:'none',
                    fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                  }}>
                    編集
                  </Link>
                  <button
                    onClick={() => handleDelete(n.id, n.title)}
                    disabled={deleting === n.id}
                    style={{
                      padding:'6px 12px', borderRadius:8,
                      border:'1px solid #fee2e2',
                      background:'#fff', color:'#ef4444',
                      fontSize:12, cursor:'pointer',
                      fontFamily:"'Kiwi Maru',serif",
                      opacity: deleting === n.id ? 0.5 : 1,
                    }}
                  >
                    {deleting === n.id ? '…' : '削除'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}
