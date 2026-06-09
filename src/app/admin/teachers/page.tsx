'use client'

import PageLoader from '@/components/ui/PageLoader'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Role } from '@/types'

interface ExhibitOption { id: string; name: string; class_label: string | null }

interface AssignedEntry { exhibit_id: string; exhibit: ExhibitOption | null }
interface TeacherRow {
  id:               string
  email:            string
  name:             string
  role:             Role
  school_type:      string
  exhibit_editors:  AssignedEntry[]
}

// ── ヘルパー ──────────────────────────────────────────────────────
function RoleBadge({ role }: { role: Role }) {
  const cfg = role === 'admin'
    ? { bg:'rgba(255,107,0,0.15)',  color:'#FF6B00',  label:'ADMIN'   }
    : { bg:'rgba(14,165,233,0.15)', color:'#0ea5e9',  label:'TEACHER' }
  return (
    <span style={{
      fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
      background:cfg.bg, color:cfg.color, fontFamily:"'Kiwi Maru',serif",
    }}>
      {cfg.label}
    </span>
  )
}

// ── メインページ ───────────────────────────────────────────────────
export default function TeachersPage() {
  const [teachers,    setTeachers]    = useState<TeacherRow[]>([])
  const [candidates,  setCandidates]  = useState<TeacherRow[]>([])  // school_type='teacher' かつ role='student'
  const [allExhibits, setAllExhibits] = useState<ExhibitOption[]>([])
  const [loading,     setLoading]     = useState(true)
  const [myId,        setMyId]        = useState<string | null>(null)

  // 招待
  const [newEmail,   setNewEmail]   = useState('')
  const [inviting,   setInviting]   = useState(false)
  const [inviteMsg,  setInviteMsg]  = useState<{ ok: boolean; text: string } | null>(null)

  // 削除確認
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 担当クラス割り当てモーダル
  const [assignTarget, setAssignTarget] = useState<TeacherRow | null>(null)
  const [pendingIds,   setPendingIds]   = useState<Set<string>>(new Set())
  const [saving,       setSaving]       = useState(false)

  const loadTeachers = useCallback(() => {
    const supabase = createClient()
    // 承認済み先生（role = teacher または admin）
    const teacherQuery = supabase
      .from('profiles')
      .select('id, email, name, role, school_type, exhibit_editors(exhibit_id, exhibit:exhibits(id, name, class_label))')
      .in('role', ['teacher', 'admin'])
      .order('name')

    // 先生候補（school_type = 'teacher' かつ role = 'student'）
    const candidateQuery = supabase
      .from('profiles')
      .select('id, email, name, role, school_type, exhibit_editors(exhibit_id, exhibit:exhibits(id, name, class_label))')
      .eq('school_type', 'teacher')
      .eq('role', 'student')
      .order('name')

    Promise.all([teacherQuery, candidateQuery]).then(([tRes, cRes]) => {
      if (tRes.data) setTeachers(tRes.data as unknown as TeacherRow[])
      if (cRes.data) setCandidates(cRes.data as unknown as TeacherRow[])
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
    loadTeachers()
  }, [loadTeachers])

  // ── 招待 ──────────────────────────────────────────────────────────
  const invite = async () => {
    if (!newEmail.trim()) return
    setInviting(true); setInviteMsg(null)
    // デフォルト editor で招待 → 管理者が後から teacher に変更
    const res = await fetch('/api/admin/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail.trim() }),
    })
    if (res.ok) {
      setInviteMsg({ ok: true, text: `${newEmail} に招待メールを送信しました（初期ロール: editor → 先生に変更してください）` })
      setNewEmail('')
    } else {
      const json = await res.json().catch(() => ({}))
      setInviteMsg({ ok: false, text: json.error ?? '送信に失敗しました' })
    }
    setInviting(false)
  }

  // ── 先生候補を teacher に昇格 ─────────────────────────────────────
  const approveCandidate = async (candidate: TeacherRow) => {
    const res = await fetch('/api/admin/users/role', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: candidate.id, role: 'teacher' }),
    })
    if (res.ok) {
      setCandidates(cs => cs.filter(c => c.id !== candidate.id))
      setTeachers(ts => [...ts, { ...candidate, role: 'teacher' }])
    }
  }

  // ── 先生候補を却下（school_type を 'high' に戻す・アカウントは削除しない） ──
  const rejectCandidate = async (candidate: TeacherRow) => {
    const res = await fetch('/api/admin/users/school-type', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: candidate.id, schoolType: 'high' }),
    })
    if (res.ok) {
      setCandidates(cs => cs.filter(c => c.id !== candidate.id))
    }
  }

  // ── ロール変更（teacher ↔ admin） ─────────────────────────────────
  const toggleAdmin = async (teacher: TeacherRow) => {
    const next: Role = teacher.role === 'teacher' ? 'admin' : 'teacher'
    const res = await fetch('/api/admin/users/role', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: teacher.id, role: next }),
    })
    if (res.ok) setTeachers(ts => ts.map(t => t.id === teacher.id ? { ...t, role: next } : t))
  }

  // ── 削除 ──────────────────────────────────────────────────────────
  const remove = async (id: string) => {
    setDeleting(true)
    const res = await fetch('/api/admin/users/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })
    if (res.ok) {
      setTeachers(ts => ts.filter(t => t.id !== id))
      setCandidates(cs => cs.filter(c => c.id !== id))
    }
    setDeleteId(null); setDeleting(false)
  }

  // ── 担当クラスモーダルを開く ────────────────────────────────────
  const openAssign = (t: TeacherRow) => {
    setAssignTarget(t)
    setPendingIds(new Set(t.exhibit_editors.map(e => e.exhibit_id)))
  }

  const toggleExhibit = (id: string) => {
    setPendingIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const saveAssignments = async () => {
    if (!assignTarget) return
    setSaving(true)
    await fetch('/api/admin/users/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId:     assignTarget.id,
        exhibitIds: [...pendingIds],
        table:      'exhibit_editors',
      }),
    })
    setSaving(false)
    setAssignTarget(null)
    loadTeachers()
  }

  // ── レンダー ───────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily:"'Kaisei Decol',serif", fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
          先生管理
        </h2>
        <div style={{ fontSize: 12, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
          先生アカウントの招待・担当クラスの割り当てを管理します
        </div>
      </div>

      {/* ── 招待 ── */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: '18px', marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
      }}>
        <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
          ＋ 先生を招待
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom: 12 }}>
          招待後にロールを TEACHER に変更し、担当クラスを割り当ててください
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={newEmail} onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && invite()}
            placeholder="先生のメールアドレスを入力"
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
              fontSize: 13, fontFamily:"'Kiwi Maru',serif", color: '#1e293b',
            }}
          />
          <button onClick={invite} disabled={inviting || !newEmail.trim()} style={{
            padding: '9px 18px', borderRadius: 8, border: 'none', flexShrink: 0,
            background: newEmail.trim() ? 'linear-gradient(135deg,#0ea5e9,#38bdf8)' : '#f1f5f9',
            color: newEmail.trim() ? '#fff' : '#94a3b8',
            fontWeight: 700, fontSize: 13, cursor: newEmail.trim() ? 'pointer' : 'not-allowed',
            fontFamily:"'Kiwi Maru',serif",
          }}>
            {inviting ? '送信中…' : '招待する'}
          </button>
        </div>
        {inviteMsg && (
          <div style={{ marginTop: 8, fontSize: 12, fontFamily:"'Kiwi Maru',serif", color: inviteMsg.ok ? '#10b981' : '#ef4444', lineHeight: 1.6 }}>
            {inviteMsg.text}
          </div>
        )}
      </div>

      {/* ── 先生候補（承認待ち） ── */}
      {!loading && candidates.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
              承認待ち
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 99,
              background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
              fontFamily:"'Kiwi Maru',serif",
            }}>
              {candidates.length}件
            </span>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
              プロフィールで「先生」を選択したユーザー
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {candidates.map(c => (
              <div key={c.id} style={{
                background: '#fffbeb', borderRadius: 14, padding: '14px 18px',
                border: '1.5px solid #fde68a',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                {/* アバター */}
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg,#f59e0b,#fcd34d)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 700, color: '#fff',
                }}>
                  {c.name?.[0] ?? c.email[0].toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 1 }}>
                    <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize: 14, fontWeight: 700, color: '#92400e' }}>
                      {c.name || '（名前未設定）'}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                      background: 'rgba(245,158,11,0.2)', color: '#b45309',
                      fontFamily:"'Kiwi Maru',serif",
                    }}>
                      先生希望
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#92400e', opacity: 0.7, fontFamily:"'Kiwi Maru',serif", wordBreak: 'break-all' }}>
                    {c.email}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => approveCandidate(c)} style={{
                    padding: '6px 14px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)',
                    color: '#fff', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', fontFamily:"'Kiwi Maru',serif",
                  }}>
                    先生として承認
                  </button>
                  <button onClick={() => rejectCandidate(c)} style={{
                    padding: '6px 12px', borderRadius: 8,
                    border: '1px solid #fca5a5', background: '#fff',
                    fontSize: 11, color: '#ef4444',
                    cursor: 'pointer', fontFamily:"'Kiwi Maru',serif",
                  }}>
                    却下
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 先生一覧 ── */}
      {loading ? (
        <PageLoader />
      ) : teachers.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 16, padding: '48px 20px', textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>👩‍🏫</div>
          <div style={{ fontSize: 14, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
            先生アカウントがまだありません
          </div>
          <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4, fontFamily:"'Kiwi Maru',serif" }}>
            上の招待フォームから追加できます
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {teachers.map(t => {
            const assignedExhibits = t.exhibit_editors
              .map(e => e.exhibit)
              .filter(Boolean) as ExhibitOption[]

            return (
              <div key={t.id} style={{
                background: '#fff', borderRadius: 16, padding: '18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* アバター */}
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                    background: t.role === 'admin'
                      ? 'linear-gradient(135deg,#FF6B00,#FFAA28)'
                      : 'linear-gradient(135deg,#0ea5e9,#38bdf8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: '#fff',
                  }}>
                    {t.name?.[0] ?? t.email[0].toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* 名前・バッジ */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                      <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                        {t.name || '（名前未設定）'}
                      </span>
                      <RoleBadge role={t.role} />
                      {t.id === myId && (
                        <span style={{ fontSize: 10, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>（自分）</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif", wordBreak: 'break-all', marginBottom: 6 }}>
                      {t.email}
                    </div>

                    {/* 担当クラスチップ */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {assignedExhibits.length === 0 ? (
                        <span style={{
                          fontSize: 11, color: '#ef4444', fontFamily:"'Kiwi Maru',serif",
                          background: '#fef2f2', padding: '2px 8px', borderRadius: 99,
                          border: '1px solid #fecaca',
                        }}>
                          担当クラス未設定
                        </span>
                      ) : (
                        assignedExhibits.map(ex => (
                          <span key={ex.id} style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 99,
                            background: '#f0f9ff', color: '#0ea5e9',
                            border: '1px solid #7dd3fc',
                            fontFamily:"'Kiwi Maru',serif",
                          }}>
                            {ex.class_label ?? ex.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* アクションボタン */}
                {t.id !== myId && (
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 6,
                    justifyContent: 'flex-end', marginTop: 12,
                    paddingTop: 12, borderTop: '1px solid #f1f5f9',
                  }}>
                    {/* 担当クラス割り当て */}
                    <button onClick={() => openAssign(t)} style={{
                      padding: '6px 14px', borderRadius: 8,
                      border: '1px solid #7dd3fc', background: '#f0f9ff',
                      fontSize: 11, color: '#0ea5e9',
                      cursor: 'pointer', fontFamily:"'Kiwi Maru',serif", fontWeight: 700,
                    }}>
                      クラスを割り当て
                    </button>

                    {/* ADMIN 昇格 / TEACHER に戻す */}
                    <button onClick={() => toggleAdmin(t)} style={{
                      padding: '6px 14px', borderRadius: 8,
                      border: t.role === 'teacher' ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                      background: t.role === 'teacher' ? '#fff8f0' : '#fff',
                      fontSize: 11,
                      color: t.role === 'teacher' ? '#FF8C00' : '#64748b',
                      cursor: 'pointer', fontFamily:"'Kiwi Maru',serif",
                    }}>
                      {t.role === 'teacher' ? '→ ADMIN に昇格' : '→ TEACHER に戻す'}
                    </button>

                    {/* 削除 */}
                    <button onClick={() => setDeleteId(t.id)} style={{
                      padding: '6px 14px', borderRadius: 8,
                      border: '1px solid #fee2e2', background: '#fff',
                      fontSize: 11, color: '#ef4444',
                      cursor: 'pointer', fontFamily:"'Kiwi Maru',serif",
                    }}>
                      削除
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── 削除確認モーダル ── */}
      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 340 }}>
            <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
              本当に削除しますか？
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom: 20, lineHeight: 1.6 }}>
              「{[...teachers, ...candidates].find(t => t.id === deleteId)?.email}」のアカウントを削除します。この操作は取り消せません。
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteId(null)} style={{
                flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #e2e8f0',
                background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily:"'Kiwi Maru',serif", color: '#64748b',
              }}>
                キャンセル
              </button>
              <button onClick={() => remove(deleteId)} disabled={deleting} style={{
                flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
                background: deleting ? '#e2e8f0' : '#ef4444', color: deleting ? '#94a3b8' : '#fff',
                fontSize: 13, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer',
                fontFamily:"'Kiwi Maru',serif",
              }}>
                {deleting ? '削除中…' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 担当クラス割り当てモーダル ── */}
      {assignTarget && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) setAssignTarget(null) }}
        >
          <div style={{
            background: '#fff', borderRadius: 20, padding: '24px',
            width: '100%', maxWidth: 480,
            maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          }}>
            {/* ヘッダー */}
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize: 17, fontWeight: 700, color: '#1e293b' }}>
                担当クラスを設定
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif", marginTop: 2 }}>
                {assignTarget.name || assignTarget.email} · チェックしたクラスの変更ログ・編集が使えます
              </div>
            </div>

            {/* 現在の割り当て件数 */}
            <div style={{ display: 'flex', gap: 8, margin: '12px 0 8px' }}>
              <button
                onClick={() => setPendingIds(new Set(allExhibits.map(e => e.id)))}
                style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontFamily:"'Kiwi Maru',serif" }}
              >
                すべて選択
              </button>
              <button
                onClick={() => setPendingIds(new Set())}
                style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontFamily:"'Kiwi Maru',serif" }}
              >
                すべて解除
              </button>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif", alignSelf: 'center' }}>
                {pendingIds.size} 件選択中
              </span>
            </div>

            {/* 展示リスト */}
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {allExhibits.map(ex => {
                const checked = pendingIds.has(ex.id)
                return (
                  <div
                    key={ex.id}
                    onClick={() => toggleExhibit(ex.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      background: checked ? '#f0f9ff' : '#fafafa',
                      border: `1px solid ${checked ? '#7dd3fc' : '#f1f5f9'}`,
                      transition: 'all 0.12s',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, border: '2px solid',
                      borderColor: checked ? '#0ea5e9' : '#cbd5e1',
                      background: checked ? '#0ea5e9' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#fff', flexShrink: 0,
                      transition: 'all 0.12s',
                    }}>
                      {checked ? '✓' : ''}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: checked ? 700 : 400,
                        color: checked ? '#0c4a6e' : '#475569',
                        fontFamily:"'Kaisei Decol',serif",
                      }}>
                        {ex.class_label ? `${ex.class_label} ` : ''}{ex.name}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 保存ボタン */}
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={() => setAssignTarget(null)} style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                border: '1px solid #e2e8f0', background: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily:"'Kiwi Maru',serif", color: '#64748b',
              }}>
                キャンセル
              </button>
              <button onClick={saveAssignments} disabled={saving} style={{
                flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                background: saving ? '#e2e8f0' : 'linear-gradient(135deg,#0ea5e9,#38bdf8)',
                color: saving ? '#94a3b8' : '#fff',
                fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
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
