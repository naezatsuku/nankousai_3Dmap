'use client'

import PageLoader from '@/components/ui/PageLoader'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'
import MediaUpload, { isVideoUrl } from '@/components/ui/MediaUpload'
import { logActivity } from '@/lib/activity-log'

// ── 型 ────────────────────────────────────────────────────────
interface ExhibitOption { id: string; name: string; class_label: string | null }

interface MediaItem {
  id?:         string   // 既存 notice_media.id
  url:         string
  caption:     string
  type:        'image' | 'video'
  order_index: number
  key:         string   // React key（クライアント生成）
}

type NoticeStatus = 'pending' | 'approved' | 'rejected'

interface NoticeForm {
  exhibit_id:  string
  title:       string
  body:        string
  sender_name: string
  is_urgent:   boolean
}

const EMPTY_FORM: NoticeForm = {
  exhibit_id: '', title: '', body: '', sender_name: '', is_urgent: false,
}

// ── 共通スタイル ───────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background:'#fff', borderRadius:16, padding:'20px',
  boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9',
  marginBottom:16,
}
const labelStyle: React.CSSProperties = {
  fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6,
  fontFamily:"'Kiwi Maru',serif", display:'block',
}
const inputStyle: React.CSSProperties = {
  width:'100%', padding:'10px 12px', borderRadius:10,
  border:'1.5px solid #e2e8f0', fontSize:13, fontFamily:"'Kiwi Maru',serif",
  color:'#1e293b', background:'#fff', boxSizing:'border-box', outline:'none',
}

export default function NoticeEditPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const isNew   = id === 'new'

  // 新規作成時は UUID を事前生成（ストレージパスに使用）
  const [noticeId] = useState<string>(() => isNew ? crypto.randomUUID() : id)

  const [exhibits, setExhibits]     = useState<ExhibitOption[]>([])
  const [form, setForm]             = useState<NoticeForm>(EMPTY_FORM)
  const [media, setMedia]           = useState<MediaItem[]>([])
  const [loading, setLoading]       = useState(!isNew)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState('')
  const [userRole, setUserRole]     = useState<string>('')
  const [status, setStatus]         = useState<NoticeStatus>('pending')
  const [reviewComment, setReviewComment] = useState<string>('')

  // 展示一覧取得（editor は担当展示のみ）
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const role = (profile as { role: string } | null)?.role
      setUserRole(role ?? '')
      const isEditorOrTeacher = role === 'editor' || role === 'teacher'

      let query = supabase.from('exhibits').select('id, name, class_label').order('class_label')
      if (isEditorOrTeacher) {
        const { data: assignments } = await supabase
          .from('exhibit_editors').select('exhibit_id').eq('user_id', user.id)
        const ids = (assignments ?? []).map((a: { exhibit_id: string }) => a.exhibit_id)
        if (ids.length === 0) { setExhibits([]); return }
        query = query.in('id', ids)
      }
      const { data } = await query
      if (data) setExhibits(data as ExhibitOption[])
    })
  }, [])

  // 既存お知らせ読み込み（editor は担当外はリダイレクト）
  useEffect(() => {
    if (isNew) return
    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const role2 = (profile as { role: string } | null)?.role
      const isEditor = role2 === 'editor' || role2 === 'teacher'

      type NoticeRow = {
        id: string; exhibit_id: string; title: string; body: string
        sender_name: string; is_urgent: boolean
        status: NoticeStatus; review_comment: string | null
        notice_media: { id: string; url: string | null; type: 'image' | 'video' | null; caption: string | null; order_index: number }[]
      }
      const { data } = await supabase
        .from('notices')
        .select('id, exhibit_id, title, body, sender_name, is_urgent, status, review_comment, notice_media(id, url, type, caption, order_index)')
        .eq('id', id)
        .single()

      if (!data) { setLoading(false); return }
      const row = data as unknown as NoticeRow

      if (isEditor) {
        const { data: assignment } = await supabase
          .from('exhibit_editors')
          .select('exhibit_id')
          .eq('user_id', user.id)
          .eq('exhibit_id', row.exhibit_id)
          .single()
        if (!assignment) { router.push('/admin/notices'); return }
      }

      setForm({
        exhibit_id:  row.exhibit_id  ?? '',
        title:       row.title        ?? '',
        body:        row.body         ?? '',
        sender_name: row.sender_name  ?? '',
        is_urgent:   row.is_urgent    ?? false,
      })
      setStatus((row.status ?? 'approved') as NoticeStatus)
      setReviewComment(row.review_comment ?? '')
      const raw = row.notice_media ?? []
      setMedia(
        raw
          .sort((a, b) => a.order_index - b.order_index)
          .map((m, i) => ({
            id:          m.id,
            url:         m.url         ?? '',
            caption:     m.caption     ?? '',
            type:        m.type ?? 'image',
            order_index: i,
            key:         m.id,
          }))
      )
      setLoading(false)
    })
  }, [id, isNew, router])

  const set = useCallback(
    (k: keyof NoticeForm, v: string | boolean) => setForm(f => ({ ...f, [k]: v })),
    []
  )

  // メディア操作
  const addMedia = () => {
    setMedia(prev => [...prev, {
      url:'', caption:'', type:'image',
      order_index: prev.length,
      key: crypto.randomUUID(),
    }])
  }

  const removeMedia = (key: string) => {
    setMedia(prev =>
      prev.filter(m => m.key !== key).map((m, i) => ({ ...m, order_index: i }))
    )
  }

  const updateMedia = (key: string, patch: Partial<MediaItem>) => {
    setMedia(prev => prev.map(m => m.key === key ? { ...m, ...patch } : m))
  }

  const moveMedia = (key: string, dir: -1 | 1) => {
    setMedia(prev => {
      const idx = prev.findIndex(m => m.key === key)
      if (idx < 0) return prev
      const next = idx + dir
      if (next < 0 || next >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr.map((m, i) => ({ ...m, order_index: i }))
    })
  }

  // 保存
  const handleSave = async () => {
    if (!form.exhibit_id) { setError('展示を選択してください'); return }
    if (!form.title.trim()) { setError('タイトルを入力してください'); return }

    setSaving(true)
    setError('')
    const supabase = createClient()
    const nid = noticeId

    try {
      // admin が作成 → 即承認、editor/teacher → 審査待ち
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', currentUser!.id).single()
      const role = (prof as { role: string } | null)?.role ?? ''
      const isAdmin = role === 'admin'
      const newStatus: NoticeStatus = isNew
        ? (isAdmin ? 'approved' : 'pending')
        : (status === 'rejected' && !isAdmin ? 'pending' : status)

      if (isNew) {
        const { error: e } = await supabase.from('notices').insert({
          id:          nid,
          exhibit_id:  form.exhibit_id,
          title:       form.title.trim(),
          body:        form.body.trim(),
          sender_name: form.sender_name.trim() || null,
          is_urgent:   form.is_urgent,
          status:      newStatus,
        })
        if (e) throw e
      } else {
        const updatePayload: Record<string, unknown> = {
          exhibit_id:  form.exhibit_id,
          title:       form.title.trim(),
          body:        form.body.trim(),
          sender_name: form.sender_name.trim() || null,
          is_urgent:   form.is_urgent,
        }
        // 却下済みを非 admin が再保存 → 審査待ちに戻す
        if (status === 'rejected' && !isAdmin) {
          updatePayload.status         = 'pending'
          updatePayload.review_comment = null
          updatePayload.reviewed_at    = null
          updatePayload.reviewed_by    = null
        }
        const { error: e } = await supabase.from('notices').update(updatePayload).eq('id', nid)
        if (e) throw e
        // 既存メディアを一括削除してから再挿入
        await supabase.from('notice_media').delete().eq('notice_id', nid)
      }

      // メディア挿入
      const validMedia = media.filter(m => m.url)
      if (validMedia.length > 0) {
        const { error: e } = await supabase.from('notice_media').insert(
          validMedia.map((m, i) => ({
            notice_id:   nid,
            url:         m.url,
            type:        m.type,
            caption:     m.caption.trim() || null,
            order_index: i,
          }))
        )
        if (e) throw e
      }

      // admin の新規作成時のみ即時通知（審査待ちの場合は承認時に通知）
      if (isNew && isAdmin) {
        const senderName =
          form.sender_name.trim() ||
          exhibits.find(e => e.id === form.exhibit_id)?.name ||
          ''
        fetch('/api/notice-notify', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            title:      form.title.trim(),
            body:       form.body.trim(),
            senderName,
            exhibitId:  form.exhibit_id,
          }),
        }).catch(() => {})
      }

      setStatus(newStatus)
      if (newStatus === 'pending' && status === 'rejected') setReviewComment('')

      // 変更ログを記録（先生への通知用）
      if (currentUser) {
        const actionType = isNew ? 'notice_posted' : 'notice_edited'
        const label = isNew ? 'お知らせを投稿' : 'お知らせを編集'
        logActivity(form.exhibit_id, currentUser.id, actionType, `「${form.title.trim()}」を${label}しました`).catch(() => {})
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      if (isNew) router.push(`/admin/notices/${nid}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <PageLoader />
    )
  }

  return (
    <div style={{ maxWidth:760 }}>
      {/* ページヘッダー */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <button onClick={() => router.push('/admin/notices')} style={{
          width:34, height:34, borderRadius:'50%', background:'#f1f5f9',
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'#475569', fontSize:16, flexShrink:0,
          border:'none', cursor:'pointer',
        }}>←</button>
        <div>
          <h1 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#1e293b', marginBottom:0 }}>
            {isNew ? 'お知らせを作成' : 'お知らせを編集'}
          </h1>
        </div>
      </div>

      {/* ── ステータスバッジ（新規以外 or 保存後） ── */}
      {(!isNew || status !== 'pending') && (
        <div style={{
          marginBottom:16, padding:'10px 16px', borderRadius:10,
          display:'flex', alignItems:'center', gap:10,
          background:
            status === 'approved' ? '#f0fdf4' :
            status === 'rejected' ? '#fef2f2' : '#fffbeb',
          border:`1px solid ${
            status === 'approved' ? '#86efac' :
            status === 'rejected' ? '#fca5a5' : '#fde68a'}`,
        }}>
          <span style={{
            fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:99,
            fontFamily:"'Kiwi Maru',serif",
            background:
              status === 'approved' ? '#dcfce7' :
              status === 'rejected' ? '#fee2e2' : '#fef9c3',
            color:
              status === 'approved' ? '#16a34a' :
              status === 'rejected' ? '#dc2626' : '#92400e',
          }}>
            {status === 'approved' ? '✓ 承認済み' :
             status === 'rejected' ? '✕ 却下' : '⏳ 審査待ち'}
          </span>
          {status === 'rejected' && reviewComment && (
            <span style={{ fontSize:12, color:'#dc2626', fontFamily:"'Kiwi Maru',serif" }}>
              理由: {reviewComment}
            </span>
          )}
          {status === 'pending' && (
            <span style={{ fontSize:11, color:'#92400e', fontFamily:"'Kiwi Maru',serif" }}>
              管理者が審査中です。承認されるまで一般公開されません。
            </span>
          )}
        </div>
      )}

      {/* ── 基本情報カード ── */}
      <div style={cardStyle}>
        <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#1e293b', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          🔔 基本情報
        </div>

        {/* 展示選択 */}
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>展示（必須）</label>
          <select
            value={form.exhibit_id}
            onChange={e => set('exhibit_id', e.target.value)}
            style={{ ...inputStyle, color: form.exhibit_id ? '#1e293b' : '#94a3b8' }}
          >
            <option value="">— 展示を選択 —</option>
            {exhibits.map(ex => (
              <option key={ex.id} value={ex.id}>
                {ex.class_label ? `${ex.class_label} ` : ''}{ex.name}
              </option>
            ))}
          </select>
        </div>

        {/* タイトル */}
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>タイトル（必須）</label>
          <input
            type="text"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="例：本日のランチメニューのお知らせ"
            style={inputStyle}
          />
        </div>

        {/* 本文 */}
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>本文</label>
          <textarea
            value={form.body}
            onChange={e => set('body', e.target.value)}
            placeholder="お知らせの内容を入力してください"
            rows={5}
            style={{ ...inputStyle, resize:'vertical', lineHeight:1.7 }}
          />
        </div>

        {/* 送信者名 */}
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>送信者名（省略すると展示名が使われます）</label>
          <input
            type="text"
            value={form.sender_name}
            onChange={e => set('sender_name', e.target.value)}
            placeholder="例：高2-3（縁日）"
            style={inputStyle}
          />
        </div>

        {/* 重要フラグ */}
        <div
          onClick={() => set('is_urgent', !form.is_urgent)}
          style={{
            display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
            borderRadius:10, border:`1.5px solid ${form.is_urgent ? '#FF8C00' : '#e2e8f0'}`,
            background: form.is_urgent ? '#fff8f4' : '#fafafa',
            cursor:'pointer', userSelect:'none',
          }}
        >
          <div style={{
            width:20, height:20, borderRadius:6, border:'2px solid',
            borderColor: form.is_urgent ? '#FF8C00' : '#cbd5e1',
            background: form.is_urgent ? '#FF8C00' : '#fff',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:11, color:'#fff', flexShrink:0,
            transition:'all 0.15s',
          }}>
            {form.is_urgent ? '✓' : ''}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color: form.is_urgent ? '#FF8C00' : '#475569', fontFamily:"'Kiwi Maru',serif" }}>
              ⚠️ 重要なお知らせ
            </div>
            <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginTop:2 }}>
              一覧で強調表示されます
            </div>
          </div>
        </div>
      </div>

      {/* ── メディアカード ── */}
      <div style={cardStyle}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#1e293b', display:'flex', alignItems:'center', gap:8 }}>
            🖼 メディア
            {media.length > 0 && (
              <span style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontWeight:400 }}>
                {media.length} 件
              </span>
            )}
          </div>
          <button
            onClick={addMedia}
            style={{
              padding:'6px 14px', borderRadius:8,
              border:'1.5px dashed #e2e8f0',
              background:'#fafafa', color:'#64748b',
              fontSize:12, cursor:'pointer',
              fontFamily:"'Kiwi Maru',serif", fontWeight:700,
            }}
          >
            ＋ 追加
          </button>
        </div>

        {media.length === 0 ? (
          <div style={{
            textAlign:'center', padding:'28px 0',
            color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif", fontSize:12,
            border:'2px dashed #f1f5f9', borderRadius:12,
          }}>
            「＋ 追加」から画像または動画を添付できます
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {media.map((item, i) => (
              <div key={item.key} style={{
                padding:16, borderRadius:12,
                border:'1px solid #f1f5f9', background:'#fafafa',
              }}>
                {/* ヘッダー */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{
                      fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99,
                      background: item.type === 'video' ? '#e0f2fe' : '#f0fdf4',
                      color:      item.type === 'video' ? '#0284c7' : '#16a34a',
                      fontFamily:"'Kiwi Maru',serif",
                    }}>
                      {item.type === 'video' ? '🎬 動画' : '🖼 画像'}
                    </span>
                    <span style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                      #{i + 1}
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={() => moveMedia(item.key, -1)} disabled={i === 0}
                      style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #e2e8f0', background:'#fff', color:'#94a3b8', fontSize:11, cursor: i===0 ? 'not-allowed' : 'pointer' }}>
                      ↑
                    </button>
                    <button onClick={() => moveMedia(item.key, 1)} disabled={i === media.length - 1}
                      style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #e2e8f0', background:'#fff', color:'#94a3b8', fontSize:11, cursor: i===media.length-1 ? 'not-allowed' : 'pointer' }}>
                      ↓
                    </button>
                    <button onClick={() => removeMedia(item.key)}
                      style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #fee2e2', background:'#fff', color:'#ef4444', fontSize:11, cursor:'pointer' }}>
                      削除
                    </button>
                  </div>
                </div>

                {/* アップロードエリア */}
                <MediaUpload
                  value={item.url}
                  storagePath={`notices/${noticeId}/${item.key}`}
                  accept="any"
                  onChange={url => updateMedia(item.key, {
                    url,
                    type: url ? (isVideoUrl(url) ? 'video' : 'image') : item.type,
                  })}
                />

                {/* キャプション */}
                <div style={{ marginTop:10 }}>
                  <input
                    type="text"
                    value={item.caption}
                    onChange={e => updateMedia(item.key, { caption: e.target.value })}
                    placeholder="キャプション（任意）"
                    style={{
                      width:'100%', padding:'8px 12px', borderRadius:8,
                      border:'1px solid #e2e8f0', fontSize:12,
                      fontFamily:"'Kiwi Maru',serif", color:'#475569',
                      background:'#fff', boxSizing:'border-box',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 保存ボタン ── */}
      {error && (
        <div style={{
          marginBottom:12, padding:'10px 16px', borderRadius:10,
          background:'#fef2f2', border:'1px solid #fecaca',
          fontSize:12, color:'#ef4444', fontFamily:"'Kiwi Maru',serif",
        }}>
          {error}
        </div>
      )}

      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex:1, padding:'14px 0', borderRadius:12,
            background: saving ? '#e2e8f0' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
            color: saving ? '#94a3b8' : '#fff',
            fontSize:14, fontWeight:700, border:'none', cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily:"'Kiwi Maru',serif",
            boxShadow: saving ? 'none' : '0 4px 14px rgba(255,107,0,0.3)',
            transition:'all 0.2s',
          }}
        >
          {saving ? '保存中…'
            : saved ? '✓ 保存しました'
            : isNew ? '作成する'
            : (status === 'rejected' && userRole !== 'admin') ? '修正して再提出する'
            : '変更を保存'}
        </button>

        <button onClick={() => router.push('/admin/notices')} style={{
          padding:'14px 20px', borderRadius:12,
          border:'1px solid #e2e8f0', background:'#fff',
          color:'#64748b',
          fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
          cursor:'pointer',
        }}>
          キャンセル
        </button>
      </div>
    </div>
  )
}
