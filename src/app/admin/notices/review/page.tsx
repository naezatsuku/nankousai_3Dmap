'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type NoticeStatus = 'pending' | 'approved' | 'rejected'

interface PendingNotice {
  id:          string
  title:       string
  body:        string
  sender_name: string | null
  is_urgent:   boolean
  created_at:  string
  status:      NoticeStatus
  exhibit:     { id: string; name: string; class_label: string | null } | null
  _mediaCount: number
}

function fmtTime(iso: string) {
  const d   = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function NoticeReviewPage() {
  const router = useRouter()
  const [notices,  setNotices]  = useState<PendingNotice[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<'pending' | 'all'>('pending')
  // 却下コメント入力中の noticeId → コメント本文
  const [rejectingId,      setRejectingId]      = useState<string | null>(null)
  const [rejectComment,    setRejectComment]    = useState('')
  const [processingId,     setProcessingId]     = useState<string | null>(null)

  // 権限チェック（admin 以外はリダイレクト）
  useEffect(() => {
    createClient().auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/admin/login'); return }
      const { data: prof } = await createClient()
        .from('profiles').select('role').eq('id', user.id).single()
      const role = (prof as { role: string } | null)?.role
      if (role !== 'admin') { router.replace('/admin'); return }
    })
  }, [router])

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('notices')
      .select(`
        id, title, body, sender_name, is_urgent, created_at, status,
        exhibit:exhibits(id, name, class_label),
        notice_media(id)
      `)
      .order('created_at', { ascending: false })

    if (filter === 'pending') query = query.eq('status', 'pending')

    const { data } = await query
    if (data) {
      type Row = {
        id: string; title: string; body: string; sender_name: string|null
        is_urgent: boolean; created_at: string; status: NoticeStatus
        exhibit: { id:string; name:string; class_label:string|null } | null
        notice_media: { id:string }[]
      }
      setNotices((data as unknown as Row[]).map(r => ({
        ...r, _mediaCount: r.notice_media?.length ?? 0,
      })))
    }
    setLoading(false)
  }, [filter])

  useEffect(() => {
    const id = setTimeout(load, 0)
    return () => clearTimeout(id)
  }, [load])

  // 承認
  const approve = async (notice: PendingNotice) => {
    setProcessingId(notice.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('notices').update({
      status:      'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
      review_comment: null,
    }).eq('id', notice.id)

    // 承認後に購読者へ通知
    const senderName = notice.sender_name ?? notice.exhibit?.name ?? ''
    fetch('/api/notice-notify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        title:     notice.title,
        body:      notice.body,
        senderName,
        exhibitId: notice.exhibit?.id ?? '',
      }),
    }).catch(() => {})

    setNotices(prev => filter === 'pending'
      ? prev.filter(n => n.id !== notice.id)
      : prev.map(n => n.id === notice.id ? { ...n, status: 'approved' } : n)
    )
    setProcessingId(null)
  }

  // 却下確定
  const rejectConfirm = async (notice: PendingNotice) => {
    if (!rejectComment.trim()) return
    setProcessingId(notice.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('notices').update({
      status:         'rejected',
      review_comment: rejectComment.trim(),
      reviewed_at:    new Date().toISOString(),
      reviewed_by:    user?.id ?? null,
    }).eq('id', notice.id)

    // 担当 editor + teacher に却下を通知
    fetch('/api/push/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        exhibitId:  notice.exhibit?.id ?? '',
        actionType: 'notice_rejected',
        summary:    `「${notice.title}」が却下されました。理由: ${rejectComment.trim()}`,
      }),
    }).catch(() => {})

    setNotices(prev => filter === 'pending'
      ? prev.filter(n => n.id !== notice.id)
      : prev.map(n => n.id === notice.id ? { ...n, status: 'rejected' } : n)
    )
    setRejectingId(null)
    setRejectComment('')
    setProcessingId(null)
  }

  const pendingCount = notices.filter(n => n.status === 'pending').length

  return (
    <div style={{ maxWidth:860 }}>
      {/* ページヘッダー */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#1e293b', marginBottom:2 }}>
            お知らせ審査
          </h1>
          <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
            各団体から投稿されたお知らせを承認・却下します
          </div>
        </div>
        {pendingCount > 0 && (
          <div style={{
            marginLeft:'auto',
            background:'#fef9c3', border:'1px solid #fde68a',
            borderRadius:99, padding:'4px 12px',
            fontSize:12, fontWeight:700, color:'#92400e', fontFamily:"'Kiwi Maru',serif",
          }}>
            ⏳ 審査待ち {pendingCount} 件
          </div>
        )}
      </div>

      {/* フィルタータブ */}
      <div style={{ display:'flex', gap:4, marginBottom:20, background:'#f1f5f9', borderRadius:12, padding:4, width:'fit-content' }}>
        {(['pending', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:'8px 20px', borderRadius:9, border:'none', cursor:'pointer',
            background: filter===f ? '#fff' : 'transparent',
            color: filter===f ? '#1e293b' : '#94a3b8',
            fontWeight: filter===f ? 700 : 400,
            fontSize:12, fontFamily:"'Kiwi Maru',serif",
            boxShadow: filter===f ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition:'all 0.15s',
          }}>
            {f === 'pending' ? '⏳ 審査待ちのみ' : '📋 すべて'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
          読み込み中…
        </div>
      ) : notices.length === 0 ? (
        <div style={{
          textAlign:'center', padding:'60px 0',
          background:'#fff', borderRadius:16, border:'1px solid #f1f5f9',
          color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13,
        }}>
          {filter === 'pending' ? '審査待ちのお知らせはありません ✓' : 'お知らせがありません'}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {notices.map(notice => (
            <div key={notice.id} style={{
              background:'#fff', borderRadius:16, padding:'18px 20px',
              border:`1px solid ${
                notice.status === 'approved' ? '#f1f5f9' :
                notice.status === 'rejected' ? '#fecaca' : '#fde68a'}`,
              boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
            }}>
              {/* ヘッダー行 */}
              <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                    {/* ステータスバッジ */}
                    <span style={{
                      fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
                      fontFamily:"'Kiwi Maru',serif", flexShrink:0,
                      background:
                        notice.status === 'approved' ? '#dcfce7' :
                        notice.status === 'rejected' ? '#fee2e2' : '#fef9c3',
                      color:
                        notice.status === 'approved' ? '#16a34a' :
                        notice.status === 'rejected' ? '#dc2626' : '#92400e',
                    }}>
                      {notice.status === 'approved' ? '✓ 承認済み' :
                       notice.status === 'rejected' ? '✕ 却下' : '⏳ 審査待ち'}
                    </span>
                    {notice.is_urgent && (
                      <span style={{
                        fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
                        fontFamily:"'Kiwi Maru',serif",
                        background:'#fff7ed', color:'#ea580c',
                      }}>⚠️ 重要</span>
                    )}
                    <span style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                      {fmtTime(notice.created_at)}
                    </span>
                  </div>
                  <div style={{ fontSize:15, fontWeight:700, color:'#1e293b', fontFamily:"'Kiwi Maru',serif", marginBottom:3 }}>
                    {notice.title}
                  </div>
                  <div style={{ fontSize:12, color:'#64748b', fontFamily:"'Kiwi Maru',serif" }}>
                    {notice.exhibit
                      ? `${notice.exhibit.class_label ? notice.exhibit.class_label + ' ' : ''}${notice.exhibit.name}`
                      : '—'}
                    {notice.sender_name && ` · ${notice.sender_name}`}
                    {notice._mediaCount > 0 && (
                      <span style={{ marginLeft:6, color:'#0284c7' }}>🖼 {notice._mediaCount}</span>
                    )}
                  </div>
                </div>

                <Link href={`/admin/notices/${notice.id}`} style={{
                  padding:'6px 12px', borderRadius:8, border:'1px solid #e2e8f0',
                  background:'#f8fafc', color:'#64748b', textDecoration:'none',
                  fontSize:11, fontWeight:700, fontFamily:"'Kiwi Maru',serif", flexShrink:0,
                }}>
                  詳細
                </Link>
              </div>

              {/* 本文プレビュー */}
              {notice.body && (
                <div style={{
                  fontSize:12, color:'#475569', fontFamily:"'Kiwi Maru',serif",
                  lineHeight:1.7, marginBottom:12,
                  padding:'10px 12px', background:'#f8fafc', borderRadius:8,
                  maxHeight:80, overflow:'hidden',
                  WebkitMaskImage:'linear-gradient(to bottom, black 60%, transparent 100%)',
                }}>
                  {notice.body}
                </div>
              )}

              {/* 却下コメント表示 */}
              {notice.status === 'rejected' && (
                <div style={{
                  fontSize:12, color:'#dc2626', fontFamily:"'Kiwi Maru',serif",
                  padding:'8px 12px', background:'#fef2f2', borderRadius:8, marginBottom:10,
                }}>
                  却下理由: {/* review_comment は別途取得が必要なためリンクで確認案内 */}
                  <Link href={`/admin/notices/${notice.id}`} style={{ color:'#dc2626' }}>詳細ページで確認</Link>
                </div>
              )}

              {/* 却下コメント入力欄 */}
              {rejectingId === notice.id && (
                <div style={{ marginBottom:12, padding:'12px', background:'#fef2f2', borderRadius:10, border:'1px solid #fecaca' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#dc2626', fontFamily:"'Kiwi Maru',serif", marginBottom:6 }}>
                    却下理由（団体に通知されます）
                  </div>
                  <textarea
                    value={rejectComment}
                    onChange={e => setRejectComment(e.target.value)}
                    placeholder="例: 内容が不適切なため、修正のうえ再投稿してください"
                    rows={3}
                    style={{
                      width:'100%', padding:'10px 12px', borderRadius:8,
                      border:'1px solid #fca5a5', fontSize:12,
                      fontFamily:"'Kiwi Maru',serif", color:'#1e293b',
                      background:'#fff', boxSizing:'border-box', resize:'vertical',
                    }}
                    autoFocus
                  />
                  <div style={{ display:'flex', gap:8, marginTop:8 }}>
                    <button
                      onClick={() => rejectConfirm(notice)}
                      disabled={!rejectComment.trim() || processingId === notice.id}
                      style={{
                        padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer',
                        background: rejectComment.trim() ? '#dc2626' : '#e2e8f0',
                        color: rejectComment.trim() ? '#fff' : '#94a3b8',
                        fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                      }}
                    >
                      {processingId === notice.id ? '処理中…' : '却下を確定'}
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectComment('') }}
                      style={{
                        padding:'8px 14px', borderRadius:8,
                        border:'1px solid #e2e8f0', background:'#fff',
                        color:'#64748b', fontSize:12, cursor:'pointer',
                        fontFamily:"'Kiwi Maru',serif",
                      }}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              {/* アクションボタン（審査待ちのみ表示） */}
              {notice.status === 'pending' && rejectingId !== notice.id && (
                <div style={{ display:'flex', gap:8, marginTop:4 }}>
                  <button
                    onClick={() => approve(notice)}
                    disabled={processingId === notice.id}
                    style={{
                      flex:1, padding:'10px 0', borderRadius:10, border:'none',
                      cursor: processingId === notice.id ? 'not-allowed' : 'pointer',
                      background: processingId === notice.id ? '#e2e8f0' : '#16a34a',
                      color: processingId === notice.id ? '#94a3b8' : '#fff',
                      fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                      transition:'background 0.15s',
                    }}
                  >
                    {processingId === notice.id ? '処理中…' : '✓ 承認する'}
                  </button>
                  <button
                    onClick={() => { setRejectingId(notice.id); setRejectComment('') }}
                    disabled={processingId === notice.id}
                    style={{
                      flex:1, padding:'10px 0', borderRadius:10,
                      border:'1px solid #fca5a5', cursor:'pointer',
                      background:'#fff', color:'#dc2626',
                      fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                    }}
                  >
                    ✕ 却下する
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
