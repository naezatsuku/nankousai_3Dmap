'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Role } from '@/types'

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading]   = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [myId, setMyId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setMyId(data.user.id)
    })
    supabase
      .from('profiles')
      .select('*')
      .order('role')
      .then(({ data }) => {
        if (data) setProfiles(data as Profile[])
        setLoading(false)
      })
  }, [])

  const toggleRole = async (profile: Profile) => {
    const next: Role = profile.role === 'admin' ? 'editor' : 'admin'
    const supabase = createClient()
    await supabase.from('profiles').update({ role: next }).eq('id', profile.id)
    setProfiles(ps => ps.map(p => p.id === profile.id ? { ...p, role: next } : p))
  }

  const remove = async (id: string) => {
    const res = await fetch('/api/admin/users/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })
    if (res.ok) {
      setProfiles(ps => ps.filter(p => p.id !== id))
    }
    setDeleteId(null)
  }

  const invite = async () => {
    if (!newEmail.trim()) return
    setInviting(true)
    setInviteMsg(null)
    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>権限管理</h2>
        <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>編集権限の付与・剥奪を管理します</div>
      </div>

      {/* ── 招待 ── */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '18px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
        <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          ＋ ユーザーを招待
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && invite()}
            placeholder="メールアドレスを入力"
            style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, fontFamily: "'Kiwi Maru',serif", color: '#1e293b' }}
          />
          <button
            onClick={invite}
            disabled={inviting || !newEmail.trim()}
            style={{
              padding: '9px 18px', borderRadius: 8, border: 'none', flexShrink: 0,
              background: newEmail.trim() ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f1f5f9',
              color: newEmail.trim() ? '#fff' : '#94a3b8',
              fontWeight: 700, fontSize: 13, cursor: newEmail.trim() ? 'pointer' : 'not-allowed',
              fontFamily: "'Kiwi Maru',serif",
            }}
          >
            {inviting ? '送信中…' : '招待する'}
          </button>
        </div>
        {inviteMsg && (
          <div style={{ marginTop: 8, fontSize: 12, fontFamily: "'Kiwi Maru',serif", color: inviteMsg.ok ? '#10b981' : '#ef4444' }}>
            {inviteMsg.text}
          </div>
        )}
      </div>

      {/* ── 一覧 ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", fontSize: 13 }}>読み込み中…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {profiles.map(p => (
            <div key={p.id} style={{ background: '#fff', borderRadius: 16, padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* アバター */}
                <div style={{
                  width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                  background: p.role === 'admin'
                    ? 'linear-gradient(135deg,#FF6B00,#FFAA28)'
                    : 'linear-gradient(135deg,#6366f1,#818cf8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: '#fff',
                }}>
                  {p.name?.[0] ?? p.email[0].toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                    <span style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                      {p.name || '（名前未設定）'}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: p.role === 'admin' ? 'rgba(255,107,0,0.15)' : 'rgba(99,102,241,0.12)',
                      color: p.role === 'admin' ? '#FF6B00' : '#6366f1',
                      fontFamily: "'Kiwi Maru',serif",
                    }}>
                      {p.role.toUpperCase()}
                    </span>
                    {p.id === myId && (
                      <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>（自分）</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>{p.email}</div>
                </div>

                {/* アクション（自分には表示しない）*/}
                {p.id !== myId && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => toggleRole(p)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 11, color: '#64748b', cursor: 'pointer', fontFamily: "'Kiwi Maru',serif" }}
                    >
                      {p.role === 'admin' ? 'editorに変更' : 'adminに昇格'}
                    </button>
                    <button
                      onClick={() => setDeleteId(p.id)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #fee2e2', background: '#fff', fontSize: 11, color: '#ef4444', cursor: 'pointer', fontFamily: "'Kiwi Maru',serif" }}
                    >
                      削除
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {profiles.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", fontSize: 13 }}>
              ユーザーが見つかりませんでした
            </div>
          )}
        </div>
      )}

      {/* ── 削除確認 ── */}
      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 340 }}>
            <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
              本当に削除しますか？
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", marginBottom: 20, lineHeight: 1.6 }}>
              「{profiles.find(p => p.id === deleteId)?.email}」のアカウントを削除します。この操作は取り消せません。
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Kiwi Maru',serif", color: '#64748b' }}>
                キャンセル
              </button>
              <button onClick={() => remove(deleteId)} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Kiwi Maru',serif" }}>
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
