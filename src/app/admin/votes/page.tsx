'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface VoteCount { exhibitId: string; exhibitName: string; count: number }

export default function AdminVotesPage() {
  const router = useRouter()
  const [showRanking, setShowRanking] = useState(false)
  const [voteCounts,  setVoteCounts]  = useState<VoteCount[]>([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/admin/login'); return }

    const [{ data: settings }, { data: votes }] = await Promise.all([
      supabase.from('vote_settings').select('show_ranking').single(),
      supabase.from('votes').select('exhibit_id'),
    ])

    setShowRanking(settings?.show_ranking ?? false)

    if (votes && votes.length > 0) {
      setTotal(votes.length)

      const counts: Record<string, number> = {}
      for (const v of votes) counts[v.exhibit_id] = (counts[v.exhibit_id] ?? 0) + 1

      const ids = Object.keys(counts)
      const { data: exs } = await supabase.from('exhibits').select('id, name').in('id', ids)
      const nameMap: Record<string, string> = {}
      for (const e of exs ?? []) nameMap[e.id] = e.name

      setVoteCounts(
        Object.entries(counts)
          .map(([id, count]) => ({ exhibitId: id, exhibitName: nameMap[id] ?? '（不明）', count }))
          .sort((a, b) => b.count - a.count)
      )
    }

    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const saveSettings = async () => {
    setSaving(true)
    await createClient().from('vote_settings').update({ show_ranking: showRanking }).eq('singleton', true)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const MEDAL   = ['🥇', '🥈', '🥉']
  const maxVote = voteCounts[0]?.count ?? 1

  return (
    <div style={{ maxWidth:700 }}>

      {/* ── ヘッダー ── */}
      <div style={{ marginBottom:24 }}>
        <Link href="/admin" style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", textDecoration:'none' }}>
          ← ダッシュボード
        </Link>
        <h1 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#1e293b', marginTop:8, marginBottom:4 }}>
          🗳 人気投票
        </h1>
        <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
          総投票数: <strong>{total}</strong> 票
        </div>
      </div>

      {/* ── ランキング公開設定 ── */}
      <div style={{ background:'#fff', borderRadius:16, padding:'20px',
        boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9', marginBottom:20 }}>
        <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700, color:'#1e293b', marginBottom:14 }}>
          ランキング公開設定
        </div>
        <button
          onClick={() => setShowRanking(v => !v)}
          style={{
            width:'100%', padding:'13px 16px', borderRadius:12, border:'none', cursor:'pointer',
            display:'flex', alignItems:'center', gap:12, marginBottom:12,
            background: showRanking ? '#f0fdf4' : '#f8fafc',
            boxShadow: showRanking ? 'inset 0 0 0 1.5px #86efac' : 'inset 0 0 0 1.5px #e2e8f0',
            transition:'all 0.15s',
          }}
        >
          <div style={{
            width:44, height:24, borderRadius:99, flexShrink:0, position:'relative',
            background: showRanking ? '#22c55e' : '#cbd5e1', transition:'background 0.2s',
          }}>
            <div style={{
              position:'absolute', top:3, borderRadius:'50%', width:18, height:18, background:'#fff',
              left: showRanking ? 23 : 3, transition:'left 0.2s',
              boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
          <span style={{ fontSize:14, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
            color: showRanking ? '#16a34a' : '#94a3b8' }}>
            {showRanking ? 'ランキングを一般公開中' : 'ランキングを非公開'}
          </span>
        </button>
        <button
          onClick={saveSettings}
          disabled={saving}
          style={{
            width:'100%', padding:'13px', borderRadius:12, border:'none', cursor:'pointer',
            background: saved ? '#10b981' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
            color:'#fff', fontSize:14, fontWeight:700, fontFamily:"'Kaisei Decol',serif",
            boxShadow:'0 4px 14px rgba(255,107,0,0.25)', transition:'background 0.3s',
          }}
        >
          {saving ? '保存中…' : saved ? '✓ 保存しました' : '保存する'}
        </button>
      </div>

      {/* ── 投票結果 ── */}
      <div style={{ background:'#fff', borderRadius:16, padding:'20px',
        boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9' }}>
        <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700, color:'#1e293b', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          投票結果
          <button onClick={load} style={{ fontSize:11, color:'#94a3b8', background:'none', border:'none', cursor:'pointer', fontFamily:"'Kiwi Maru',serif" }}>
            ↻ 更新
          </button>
        </div>

        {loading ? (
          <div style={{ color:'#94a3b8', fontSize:12, fontFamily:"'Kiwi Maru',serif" }}>読み込み中…</div>
        ) : voteCounts.length === 0 ? (
          <div style={{ textAlign:'center', padding:'24px 0', color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
            まだ投票がありません
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {voteCounts.map((v, i) => (
              <div key={v.exhibitId} style={{ display:'flex', alignItems:'center', gap:12 }}>
                {/* 順位 */}
                <div style={{
                  width:32, height:32, borderRadius:'50%', flexShrink:0,
                  background: i < 3 ? (['#fef3c7','#f1f5f9','#fef3e2'] as const)[i] : '#f8fafc',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize: i < 3 ? 16 : 11, fontWeight:700,
                  color: i < 3 ? (['#f59e0b','#64748b','#f97316'] as const)[i] : '#94a3b8',
                }}>
                  {i < 3 ? MEDAL[i] : i + 1}
                </div>

                {/* 名前 + バー */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:5 }}>
                    <span style={{
                      fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700, color:'#1e293b',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'78%',
                    }}>
                      {v.exhibitName}
                    </span>
                    <span style={{ fontSize:13, fontWeight:700, color:'#FF6B00', fontFamily:"'Kaisei Decol',serif", flexShrink:0 }}>
                      {v.count}票
                    </span>
                  </div>
                  <div style={{ height:6, borderRadius:99, background:'#f1f5f9', overflow:'hidden' }}>
                    <div style={{
                      height:'100%', borderRadius:99,
                      width:`${(v.count / maxVote) * 100}%`,
                      background: i === 0 ? 'linear-gradient(90deg,#FF6B00,#FFAA28)' : i === 1 ? '#94a3b8' : '#cbd5e1',
                      transition:'width 0.5s ease',
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
