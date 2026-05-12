'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Role } from '@/types'

interface ExhibitOption { id: string; name: string; class_label: string | null }

interface AssignedEntry { exhibit_id: string; exhibit: ExhibitOption | null }
interface ProfileRow extends Profile { exhibit_editors: AssignedEntry[] }

export default function UsersPage() {
  const [profiles, setProfiles]   = useState<ProfileRow[]>([])
  const [allExhibits, setAllExhibits] = useState<ExhibitOption[]>([])
  const [loading, setLoading]     = useState(true)
  const [myId, setMyId]           = useState<string | null>(null)

  // 招待
  const [newEmail, setNewEmail]   = useState('')
  const [inviting, setInviting]   = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // 削除確認
  const [deleteId, setDeleteId]   = useState<string | null>(null)

  // 展示割り当てモーダル
  const [assignTarget, setAssignTarget] = useState<ProfileRow | null>(null)
  const [pendingIds, setPendingIds]     = useState<Set<string>>(new Set())
  const [saving, setSaving]             = useState(false)

  const loadProfiles = useCallback(() => {
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('*, exhibit_editors(exhibit_id, exhibit:exhibits(id, name, class_label))')
      .order('role')
      .then(({ data }) => {
        if (data) setProfiles(data as unknown as ProfileRow[])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setMyId(data.user.id)
    })
    supabase.from('exhibits').select('id, name, class_label').order('class_label')
      .then(({ data }) => { if (data) setAllExhibits(data as ExhibitOption[]) })
    loadProfiles()
  }, [loadProfiles])

  // ── 招待 ──────────────────────────────────────────────────────
  const invite = async () => {
    if (!newEmail.trim()) return
    setInviting(true); setInviteMsg(null)
    const res = await fetch('/api/admin/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail.trim() }),
    })
    if (res.ok) {
      setInviteMsg({ ok: true, text: `${newEmail} に招待メールを送信しました` })
      setNewEmail('')
    } else {
      const json = await res.json().catch(() => ({}))
      setInviteMsg({ ok: false, text: json.error ?? '送信に失敗しました' })
    }
    setInviting(false)
  }

  // ── ロール切り替え ────────────────────────────────────────────
  const toggleRole = async (profile: ProfileRow) => {
    const next: Role = profile.role === 'admin' ? 'editor' : 'admin'
    const supabase = createClient()
    await supabase.from('profiles').update({ role: next }).eq('id', profile.id)
    setProfiles(ps => ps.map(p => p.id === profile.id ? { ...p, role: next } : p))
  }

  // ── 削除 ──────────────────────────────────────────────────────
  const remove = async (id: string) => {
    const res = await fetch('/api/admin/users/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })
    if (res.ok) setProfiles(ps => ps.filter(p => p.id !== id))
    setDeleteId(null)
  }

  // ── 割り当てモーダルを開く ─────────────────────────────────
  const openAssign = (p: ProfileRow) => {
    setAssignTarget(p)
    setPendingIds(new Set(p.exhibit_editors.map(e => e.exhibit_id)))
  }

  const toggleExhibit = (id: string) => {
    setPendingIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  // ── 割り当てを保存 ────────────────────────────────────────────
  const saveAssignments = async () => {
    if (!assignTarget) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('exhibit_editors').delete().eq('user_id', assignTarget.id)
    if (pendingIds.size > 0) {
      await supabase.from('exhibit_editors').insert(
        [...pendingIds].map(exhibit_id => ({ user_id: assignTarget.id, exhibit_id }))
      )
    }
    setSaving(false)
    setAssignTarget(null)
    loadProfiles()
  }

  // ── レンダー ──────────────────────────────────────────────────
  return (
    <div style={{ maxWidth:820 }}>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
          権限管理
        </h2>
        <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
          編集権限の付与・担当展示の割り当てを管理します
        </div>
      </div>

      {/* ── 招待 ── */}
      <div style={{ background:'#fff', borderRadius:16, padding:'18px', marginBottom:20, boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9' }}>
        <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700, color:'#1e293b', marginBottom:12 }}>
          ＋ ユーザーを招待
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <input
            value={newEmail} onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && invite()}
            placeholder="メールアドレスを入力"
            style={{ flex:1, padding:'9px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, fontFamily:"'Kiwi Maru',serif", color:'#1e293b' }}
          />
          <button onClick={invite} disabled={inviting || !newEmail.trim()} style={{
            padding:'9px 18px', borderRadius:8, border:'none', flexShrink:0,
            background: newEmail.trim() ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f1f5f9',
            color: newEmail.trim() ? '#fff' : '#94a3b8',
            fontWeight:700, fontSize:13, cursor: newEmail.trim() ? 'pointer' : 'not-allowed',
            fontFamily:"'Kiwi Maru',serif",
          }}>
            {inviting ? '送信中…' : '招待する'}
          </button>
        </div>
        {inviteMsg && (
          <div style={{ marginTop:8, fontSize:12, fontFamily:"'Kiwi Maru',serif", color: inviteMsg.ok ? '#10b981' : '#ef4444' }}>
            {inviteMsg.text}
          </div>
        )}
      </div>

      {/* ── ユーザー一覧 ── */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
          読み込み中…
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {profiles.map(p => {
            const assignedExhibits = p.exhibit_editors
              .map(e => e.exhibit)
              .filter(Boolean) as ExhibitOption[]

            return (
              <div key={p.id} style={{ background:'#fff', borderRadius:16, padding:'18px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                  {/* アバター */}
                  <div style={{
                    width:42, height:42, borderRadius:'50%', flexShrink:0,
                    background: p.role === 'admin'
                      ? 'linear-gradient(135deg,#FF6B00,#FFAA28)'
                      : 'linear-gradient(135deg,#6366f1,#818cf8)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:16, fontWeight:700, color:'#fff',
                  }}>
                    {p.name?.[0] ?? p.email[0].toUpperCase()}
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    {/* 名前・バッジ */}
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:2 }}>
                      <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#1e293b' }}>
                        {p.name || '（名前未設定）'}
                      </span>
                      <span style={{
                        fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
                        background: p.role === 'admin' ? 'rgba(255,107,0,0.15)' : 'rgba(99,102,241,0.12)',
                        color: p.role === 'admin' ? '#FF6B00' : '#6366f1',
                        fontFamily:"'Kiwi Maru',serif",
                      }}>
                        {p.role.toUpperCase()}
                      </span>
                      {p.id === myId && (
                        <span style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>（自分）</span>
                      )}
                    </div>
                    <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom: assignedExhibits.length > 0 ? 8 : 0 }}>
                      {p.email}
                    </div>

                    {/* 担当展示チップ */}
                    {p.role === 'editor' && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                        {assignedExhibits.length === 0 ? (
                          <span style={{ fontSize:11, color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif" }}>
                            担当展示なし（編集不可）
                          </span>
                        ) : (
                          assignedExhibits.map(ex => (
                            <span key={ex.id} style={{
                              fontSize:10, padding:'2px 8px', borderRadius:99,
                              background:'#f0f9ff', color:'#0284c7', border:'1px solid #bae6fd',
                              fontFamily:"'Kiwi Maru',serif",
                            }}>
                              {ex.class_label ?? ex.name}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                    {p.role === 'admin' && (
                      <div style={{ marginTop:4 }}>
                        <span style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                          すべての展示を編集できます
                        </span>
                      </div>
                    )}
                  </div>

                  {/* アクション */}
                  {p.id !== myId && (
                    <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0, alignItems:'flex-end' }}>
                      {p.role === 'editor' && (
                        <button onClick={() => openAssign(p)} style={{
                          padding:'6px 12px', borderRadius:8,
                          border:'1px solid #bae6fd', background:'#f0f9ff',
                          fontSize:11, color:'#0284c7', cursor:'pointer',
                          fontFamily:"'Kiwi Maru',serif", fontWeight:700,
                        }}>
                          展示を割り当て
                        </button>
                      )}
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => toggleRole(p)} style={{
                          padding:'6px 12px', borderRadius:8, border:'1px solid #e2e8f0',
                          background:'#fff', fontSize:11, color:'#64748b',
                          cursor:'pointer', fontFamily:"'Kiwi Maru',serif",
                        }}>
                          {p.role === 'admin' ? 'editorに変更' : 'adminに昇格'}
                        </button>
                        <button onClick={() => setDeleteId(p.id)} style={{
                          padding:'6px 12px', borderRadius:8, border:'1px solid #fee2e2',
                          background:'#fff', fontSize:11, color:'#ef4444',
                          cursor:'pointer', fontFamily:"'Kiwi Maru',serif",
                        }}>
                          削除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {profiles.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
              ユーザーが見つかりませんでした
            </div>
          )}
        </div>
      )}

      {/* ── 削除確認モーダル ── */}
      {deleteId && (
        <div style={{
          position:'fixed', inset:0, zIndex:100,
          background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }}>
          <div style={{ background:'#fff', borderRadius:20, padding:'28px 24px', width:'100%', maxWidth:340 }}>
            <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:18, fontWeight:700, color:'#1e293b', marginBottom:8 }}>
              本当に削除しますか？
            </div>
            <div style={{ fontSize:13, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:20, lineHeight:1.6 }}>
              「{profiles.find(p => p.id === deleteId)?.email}」のアカウントを削除します。この操作は取り消せません。
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDeleteId(null)} style={{ flex:1, padding:'11px 0', borderRadius:10, border:'1px solid #e2e8f0', background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Kiwi Maru',serif", color:'#64748b' }}>
                キャンセル
              </button>
              <button onClick={() => remove(deleteId)} style={{ flex:1, padding:'11px 0', borderRadius:10, border:'none', background:'#ef4444', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Kiwi Maru',serif" }}>
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 展示割り当てモーダル ── */}
      {assignTarget && (
        <div style={{
          position:'fixed', inset:0, zIndex:100,
          background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }}
          onClick={e => { if (e.target === e.currentTarget) setAssignTarget(null) }}
        >
          <div style={{
            background:'#fff', borderRadius:20, padding:'24px',
            width:'100%', maxWidth:480,
            maxHeight:'80vh', display:'flex', flexDirection:'column',
          }}>
            <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:17, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
              担当展示を設定
            </div>
            <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:16 }}>
              {assignTarget.name || assignTarget.email} · チェックした展示のみ編集できます
            </div>

            {/* 全選択/解除 */}
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              <button
                onClick={() => setPendingIds(new Set(allExhibits.map(e => e.id)))}
                style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid #e2e8f0', background:'#fff', color:'#64748b', cursor:'pointer', fontFamily:"'Kiwi Maru',serif" }}
              >
                すべて選択
              </button>
              <button
                onClick={() => setPendingIds(new Set())}
                style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid #e2e8f0', background:'#fff', color:'#64748b', cursor:'pointer', fontFamily:"'Kiwi Maru',serif" }}
              >
                すべて解除
              </button>
              <span style={{ marginLeft:'auto', fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", alignSelf:'center' }}>
                {pendingIds.size} 件選択中
              </span>
            </div>

            {/* 展示リスト */}
            <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:4, marginBottom:16 }}>
              {allExhibits.map(ex => {
                const checked = pendingIds.has(ex.id)
                return (
                  <div
                    key={ex.id}
                    onClick={() => toggleExhibit(ex.id)}
                    style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'10px 12px', borderRadius:10, cursor:'pointer',
                      background: checked ? '#f0f9ff' : '#fafafa',
                      border: `1px solid ${checked ? '#bae6fd' : '#f1f5f9'}`,
                      transition:'all 0.12s',
                    }}
                  >
                    <div style={{
                      width:18, height:18, borderRadius:5, border:'2px solid',
                      borderColor: checked ? '#0284c7' : '#cbd5e1',
                      background: checked ? '#0284c7' : '#fff',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:10, color:'#fff', flexShrink:0,
                      transition:'all 0.12s',
                    }}>
                      {checked ? '✓' : ''}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight: checked ? 700 : 400, color: checked ? '#0c4a6e' : '#475569', fontFamily:"'Kaisei Decol',serif" }}>
                        {ex.class_label ? `${ex.class_label} ` : ''}{ex.name}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ボタン */}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setAssignTarget(null)} style={{
                flex:1, padding:'11px 0', borderRadius:10,
                border:'1px solid #e2e8f0', background:'#fff',
                fontSize:13, fontWeight:700, cursor:'pointer',
                fontFamily:"'Kiwi Maru',serif", color:'#64748b',
              }}>
                キャンセル
              </button>
              <button onClick={saveAssignments} disabled={saving} style={{
                flex:2, padding:'11px 0', borderRadius:10, border:'none',
                background: saving ? '#e2e8f0' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
                color: saving ? '#94a3b8' : '#fff',
                fontSize:13, fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily:"'Kiwi Maru',serif",
              }}>
                {saving ? '保存中…' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
