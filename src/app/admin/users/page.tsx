'use client'

import PageLoader from '@/components/ui/PageLoader'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Role } from '@/types'

interface ExhibitOption { id: string; name: string; class_label: string | null }

interface AssignedEntry { exhibit_id: string; exhibit: ExhibitOption | null }
interface ProfileRow extends Profile {
  exhibit_editors:  AssignedEntry[]
  student_exhibits: AssignedEntry[]
}

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
      .select('*, exhibit_editors(exhibit_id, exhibit:exhibits(id, name, class_label)), student_exhibits(exhibit_id, exhibit:exhibits(id, name, class_label))')
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

  // ── ロール切り替え（admin→editor→student→admin） ────────────
  const cycleRole = async (profile: ProfileRow) => {
    const cycle: Role[] = ['admin', 'editor', 'student']
    const next = cycle[(cycle.indexOf(profile.role) + 1) % cycle.length]
    const res = await fetch('/api/admin/users/role', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.id, role: next }),
    })
    if (res.ok) {
      setProfiles(ps => ps.map(p => p.id === profile.id ? { ...p, role: next } : p))
    }
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
    const ids = p.role === 'editor'
      ? p.exhibit_editors.map(e => e.exhibit_id)
      : p.student_exhibits.map(e => e.exhibit_id) // student / admin 共通
    setPendingIds(new Set(ids))
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
    const table = assignTarget.role === 'student' ? 'student_exhibits' : 'exhibit_editors'
    await fetch('/api/admin/users/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId:     assignTarget.id,
        exhibitIds: [...pendingIds],
        table,
      }),
    })
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
        <PageLoader />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {profiles.map(p => {
            const assignedExhibits = (p.role === 'student'
              ? p.student_exhibits : p.exhibit_editors
            ).map(e => e.exhibit).filter(Boolean) as ExhibitOption[]

            const roleColor = p.role === 'admin' ? '#FF6B00'
              : p.role === 'editor' ? '#6366f1' : '#10b981'
            const roleBg = p.role === 'admin' ? 'rgba(255,107,0,0.15)'
              : p.role === 'editor' ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.12)'
            const avatarBg = p.role === 'admin'
              ? 'linear-gradient(135deg,#FF6B00,#FFAA28)'
              : p.role === 'editor' ? 'linear-gradient(135deg,#6366f1,#818cf8)'
              : 'linear-gradient(135deg,#10b981,#34d399)'

            const nextRole: Role = p.role === 'admin' ? 'editor'
              : p.role === 'editor' ? 'student' : 'admin'

            return (
              <div key={p.id} style={{ background:'#fff', borderRadius:16, padding:'18px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                  <div style={{
                    width:42, height:42, borderRadius:'50%', flexShrink:0,
                    background: avatarBg,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:16, fontWeight:700, color:'#fff',
                  }}>
                    {p.name?.[0] ?? p.email[0].toUpperCase()}
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:2 }}>
                      <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#1e293b' }}>
                        {p.name || '（名前未設定）'}
                      </span>
                      <span style={{
                        fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
                        background: roleBg, color: roleColor, fontFamily:"'Kiwi Maru',serif",
                      }}>
                        {p.role.toUpperCase()}
                      </span>
                      {p.id === myId && (
                        <span style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>（自分）</span>
                      )}
                    </div>
                    <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", wordBreak:'break-all' }}>
                      {p.email}
                    </div>

                    {/* 担当展示/クラスチップ */}
                    {(p.role === 'editor' || p.role === 'student') && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                        {assignedExhibits.length === 0 ? (
                          <span style={{ fontSize:11, color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif" }}>
                            {p.role === 'student' ? 'クラス未設定' : '担当展示なし（編集不可）'}
                          </span>
                        ) : (
                          assignedExhibits.map(ex => (
                            <span key={ex.id} style={{
                              fontSize:10, padding:'2px 8px', borderRadius:99,
                              background: p.role === 'student' ? '#f0fdf4' : '#f0f9ff',
                              color: p.role === 'student' ? '#16a34a' : '#0284c7',
                              border: `1px solid ${p.role === 'student' ? '#86efac' : '#bae6fd'}`,
                              fontFamily:"'Kiwi Maru',serif",
                            }}>
                              {ex.class_label ?? ex.name}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                    {p.role === 'admin' && (
                      <div style={{ marginTop:6 }}>
                        <div style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:4 }}>
                          すべての展示を管理できます
                        </div>
                        {/* シフト用クラス割り当て */}
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                          {p.student_exhibits.length === 0 ? (
                            <span style={{ fontSize:10, color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif" }}>
                              シフト参加クラス未設定
                            </span>
                          ) : (
                            p.student_exhibits.map(e => e.exhibit).filter(Boolean).map(ex => (
                              <span key={ex!.id} style={{
                                fontSize:10, padding:'2px 8px', borderRadius:99,
                                background:'#fff8f0', color:'#FF6B00', border:'1px solid #fed7aa',
                                fontFamily:"'Kiwi Maru',serif",
                              }}>
                                {ex!.class_label ?? ex!.name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {p.id !== myId && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'flex-end', marginTop:12, paddingTop:12, borderTop:'1px solid #f1f5f9' }}>
                    {(p.role === 'editor' || p.role === 'student') && (
                      <button onClick={() => openAssign(p)} style={{
                        padding:'6px 12px', borderRadius:8,
                        border: `1px solid ${p.role === 'student' ? '#86efac' : '#bae6fd'}`,
                        background: p.role === 'student' ? '#f0fdf4' : '#f0f9ff',
                        fontSize:11, color: p.role === 'student' ? '#16a34a' : '#0284c7',
                        cursor:'pointer', fontFamily:"'Kiwi Maru',serif", fontWeight:700,
                      }}>
                        {p.role === 'student' ? 'クラスを割り当て' : '展示を割り当て'}
                      </button>
                    )}
                    {p.role === 'admin' && (
                      <button onClick={() => openAssign(p)} style={{
                        padding:'6px 12px', borderRadius:8,
                        border:'1px solid #fed7aa', background:'#fff8f0',
                        fontSize:11, color:'#FF6B00',
                        cursor:'pointer', fontFamily:"'Kiwi Maru',serif", fontWeight:700,
                      }}>
                        シフト参加クラスを設定
                      </button>
                    )}
                    <button onClick={() => cycleRole(p)} style={{
                      padding:'6px 12px', borderRadius:8, border:'1px solid #e2e8f0',
                      background:'#fff', fontSize:11, color:'#64748b',
                      cursor:'pointer', fontFamily:"'Kiwi Maru',serif",
                    }}>
                      → {nextRole.toUpperCase()} に変更
                    </button>
                    <button onClick={() => setDeleteId(p.id)} style={{
                      padding:'6px 12px', borderRadius:8, border:'1px solid #fee2e2',
                      background:'#fff', fontSize:11, color:'#ef4444',
                      cursor:'pointer', fontFamily:"'Kiwi Maru',serif",
                    }}>
                      削除
                    </button>
                  </div>
                )}
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
              {assignTarget.role === 'editor' ? '担当展示を設定' : assignTarget.role === 'admin' ? 'シフト参加クラスを設定' : 'クラスを設定'}
            </div>
            <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:16 }}>
              {assignTarget.name || assignTarget.email} ·{' '}
              {assignTarget.role === 'editor'
                ? 'チェックした展示のみ編集できます'
                : assignTarget.role === 'admin'
                ? 'シフトアンケート・閲覧で使用するクラスです'
                : 'チェックしたクラスのシフトを閲覧できます'}
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
            <div style={{ display:'flex', gap:10, flexShrink:0 }}>
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
