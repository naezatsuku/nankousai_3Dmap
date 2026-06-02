'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface AnnouncementRow {
  id:         string
  body:       string
  is_urgent:  boolean
  is_active:  boolean
  created_at: string
}

export default function AnnouncementsPage() {
  const router = useRouter()
  const [rows, setRows]         = useState<AnnouncementRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [adding, setAdding]     = useState(false)
  const [newBody, setNewBody]   = useState('')
  const [newUrgent, setNewUrgent] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [notifyLog, setNotifyLog] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/admin/login'); return }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if ((p as { role: string } | null)?.role !== 'admin') { router.push('/admin'); return }
    })
    supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setRows(data as AnnouncementRow[])
        setLoading(false)
      })
  }, [])

  const handleAdd = async () => {
    if (!newBody.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('announcements')
      .insert({ body: newBody.trim(), is_urgent: newUrgent, is_active: true })
      .select().single()
    if (data) setRows(prev => [data as AnnouncementRow, ...prev])

    // プッシュ通知を全登録者に送信
    try {
      const res = await fetch('/api/announce-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newUrgent ? '🚨 南高祭 緊急お知らせ' : '📢 南高祭', body: newBody.trim() }),
      })
      const json = await res.json()
      setNotifyLog(`${res.status} ${JSON.stringify(json)}`)
    } catch (e) {
      setNotifyLog(`fetch error: ${e}`)
    }

    setNewBody('')
    setNewUrgent(false)
    setAdding(false)
    setSaving(false)
  }

  const toggleActive = async (id: string, current: boolean) => {
    const supabase = createClient()
    await supabase.from('announcements').update({ is_active: !current }).eq('id', id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, is_active: !current } : r))
  }

  const handleDelete = async (id: string, body: string) => {
    if (!confirm(`「${body.slice(0, 25)}」を削除しますか？`)) return
    const supabase = createClient()
    await supabase.from('announcements').delete().eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div style={{ maxWidth: 800 }}>
      {/* ヘッダー */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{
            fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700,
            color:'#1e293b', marginBottom:2,
          }}>
            アナウンス管理
          </h1>
          <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
            {loading ? '読み込み中…' : `${rows.length} 件 — ヘッダーのティッカーに流れます`}
          </div>
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          style={{
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'10px 20px', borderRadius:12, border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
            color:'#fff', fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
            boxShadow:'0 4px 14px rgba(255,107,0,0.3)',
          }}
        >
          ＋ 新規作成
        </button>
      </div>

      {/* 通知送信ログ */}
      {notifyLog && (
        <div style={{
          marginBottom:16, padding:'10px 14px', borderRadius:10,
          background: notifyLog.startsWith('200') ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${notifyLog.startsWith('200') ? '#86efac' : '#fca5a5'}`,
          fontSize:12, fontFamily:'monospace', color:'#334155',
          display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8,
        }}>
          <span style={{ wordBreak:'break-all' }}>{notifyLog}</span>
          <button onClick={() => setNotifyLog(null)} style={{ flexShrink:0, background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:14 }}>✕</button>
        </div>
      )}

      {/* 追加フォーム */}
      {adding && (
        <div style={{
          background:'#fff', borderRadius:16, padding:20, marginBottom:20,
          border:'2px solid rgba(255,140,0,0.25)',
          boxShadow:'0 4px 20px rgba(255,107,0,0.08)',
        }}>
          <div style={{
            fontSize:14, fontWeight:700, color:'#1e293b',
            fontFamily:"'Kaisei Decol',serif", marginBottom:14,
          }}>
            新しいアナウンス
          </div>

          <textarea
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            placeholder="ティッカーに表示するテキストを入力…"
            rows={3}
            style={{
              width:'100%', padding:'10px 14px', borderRadius:10,
              border:'1px solid #e2e8f0', fontSize:14,
              fontFamily:"'Kiwi Maru',serif", resize:'vertical',
              outline:'none', boxSizing:'border-box',
              lineHeight:1.6,
            }}
          />

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:12 }}>
            {/* 緊急トグル */}
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
              <div
                onClick={() => setNewUrgent(v => !v)}
                style={{
                  width:44, height:24, borderRadius:99,
                  background: newUrgent ? '#ef4444' : '#e2e8f0',
                  position:'relative', cursor:'pointer',
                  transition:'background 0.2s',
                }}
              >
                <div style={{
                  position:'absolute', top:2, left: newUrgent ? 22 : 2,
                  width:20, height:20, borderRadius:'50%', background:'#fff',
                  transition:'left 0.2s',
                  boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
              <span style={{
                fontSize:13, fontFamily:"'Kiwi Maru',serif",
                color: newUrgent ? '#ef4444' : '#64748b',
                fontWeight: newUrgent ? 700 : 400,
              }}>
                {newUrgent ? '🚨 緊急（赤表示）' : '通常'}
              </span>
            </label>

            <div style={{ display:'flex', gap:8 }}>
              <button
                onClick={() => { setAdding(false); setNewBody(''); setNewUrgent(false) }}
                style={{
                  padding:'8px 18px', borderRadius:10,
                  border:'1px solid #e2e8f0', background:'#fff', color:'#64748b',
                  cursor:'pointer', fontSize:13, fontFamily:"'Kiwi Maru',serif",
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleAdd}
                disabled={!newBody.trim() || saving}
                style={{
                  padding:'8px 18px', borderRadius:10, border:'none',
                  background: newBody.trim() ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#e2e8f0',
                  color: newBody.trim() ? '#fff' : '#aaa',
                  cursor: newBody.trim() ? 'pointer' : 'default',
                  fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                }}
              >
                {saving ? '送信中…' : '送信'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 一覧 */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{
              height:72, borderRadius:14, background:'#fff',
              border:'1px solid #f1f5f9',
              animation:'pulse 1.5s ease infinite',
            }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div style={{
          textAlign:'center', padding:'64px 0',
          color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif", fontSize:13,
        }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📢</div>
          アナウンスがありません
          <div style={{ marginTop:16 }}>
            <button
              onClick={() => setAdding(true)}
              style={{
                color:'#FF8C00', fontWeight:700, background:'none',
                border:'none', cursor:'pointer', fontSize:13,
                fontFamily:"'Kiwi Maru',serif",
              }}
            >
              最初のアナウンスを作成する →
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {rows.map(r => (
            <div key={r.id} style={{
              background:'#fff', borderRadius:14, padding:'14px 20px',
              boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9',
              display:'flex', alignItems:'center', gap:14,
              opacity: r.is_active ? 1 : 0.5,
              transition:'opacity 0.2s',
            }}>
              {/* アイコン */}
              <div style={{
                width:38, height:38, borderRadius:10, flexShrink:0,
                background: r.is_urgent
                  ? 'linear-gradient(135deg,#ef4444,#f87171)'
                  : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:16,
              }}>
                {r.is_urgent ? '🚨' : '📢'}
              </div>

              {/* テキスト */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                  {r.is_urgent && (
                    <span style={{
                      fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99,
                      background:'#fee2e2', color:'#ef4444',
                      fontFamily:"'Kiwi Maru',serif",
                    }}>緊急</span>
                  )}
                  {!r.is_active && (
                    <span style={{
                      fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99,
                      background:'#f1f5f9', color:'#94a3b8',
                      fontFamily:"'Kiwi Maru',serif",
                    }}>非表示</span>
                  )}
                </div>
                <div style={{
                  fontSize:13, color:'#334155', fontFamily:"'Kiwi Maru',serif",
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>
                  {r.body}
                </div>
                <div style={{ fontSize:10, color:'#94a3b8', marginTop:3, fontFamily:"'Kiwi Maru',serif" }}>
                  {new Date(r.created_at).toLocaleString('ja-JP', {
                    month:'numeric', day:'numeric',
                    hour:'2-digit', minute:'2-digit',
                  })}
                </div>
              </div>

              {/* ボタン */}
              <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                <button
                  onClick={() => toggleActive(r.id, r.is_active)}
                  style={{
                    padding:'6px 14px', borderRadius:8,
                    border: r.is_active ? '1px solid #e2e8f0' : '1px solid rgba(255,140,0,0.3)',
                    background: r.is_active ? '#fff' : 'rgba(255,140,0,0.05)',
                    color: r.is_active ? '#475569' : '#FF8C00',
                    fontSize:12, cursor:'pointer',
                    fontFamily:"'Kiwi Maru',serif", fontWeight:700,
                  }}
                >
                  {r.is_active ? '非表示' : '表示する'}
                </button>
                <button
                  onClick={() => handleDelete(r.id, r.body)}
                  style={{
                    padding:'6px 12px', borderRadius:8,
                    border:'1px solid #fee2e2', background:'#fff', color:'#ef4444',
                    fontSize:12, cursor:'pointer', fontFamily:"'Kiwi Maru',serif",
                  }}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}
