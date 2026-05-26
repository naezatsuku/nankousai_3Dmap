'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Exhibit } from '@/types'

function relativeTime(iso: string) {
  const diff = new Date().getTime() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  const h    = Math.floor(min / 60)
  const d    = Math.floor(h / 24)
  if (d > 0)   return `${d}日前`
  if (h > 0)   return `${h}時間前`
  if (min > 0) return `${min}分前`
  return 'たった今'
}

interface Stats {
  total:    number
  active:   number
  avgWait:  number
  notices:  number
}

export default function AdminDashboard() {
  const [stats, setStats]     = useState<Stats | null>(null)
  const [topWait, setTopWait] = useState<Exhibit[]>([])
  const [recent, setRecent]   = useState<Exhibit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return

      // ロールと担当展示を取得
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const isEditor = (profile as { role: string } | null)?.role === 'editor'

      // editor の場合は担当展示のみ
      let exhibitsQuery = supabase.from('exhibits').select('*')
      if (isEditor) {
        const { data: assignments } = await supabase
          .from('exhibit_editors')
          .select('exhibit_id')
          .eq('user_id', user.id)
        const ids = (assignments ?? []).map((a: { exhibit_id: string }) => a.exhibit_id)
        if (ids.length === 0) {
          setStats({ total:0, active:0, avgWait:0, notices:0 })
          setLoading(false)
          return
        }
        exhibitsQuery = exhibitsQuery.in('id', ids)
      }

      const [{ data: exhibits }, { data: notices }] = await Promise.all([
        exhibitsQuery,
        supabase.from('notices').select('id').gte('created_at', new Date(Date.now() - 7 * 86400_000).toISOString()),
      ])

      const exs = (exhibits ?? []) as Exhibit[]
      const activeExs = exs.filter(e => e.is_active)
      const waitSum   = activeExs.reduce((s, e) => s + e.wait_minutes, 0)

      setStats({
        total:   exs.length,
        active:  activeExs.length,
        avgWait: activeExs.length > 0 ? Math.round(waitSum / activeExs.length) : 0,
        notices: notices?.length ?? 0,
      })

      setTopWait(
        [...exs]
          .filter(e => e.wait_minutes > 0)
          .sort((a, b) => b.wait_minutes - a.wait_minutes)
          .slice(0, 3)
      )

      setRecent(
        [...exs]
          .filter(e => e.updated_at)
          .sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime())
          .slice(0, 4)
      )

      setLoading(false)
    })
  }, [])

  const WAIT_COLOR = (w: number) =>
    w >= 30 ? '#ef4444' : w >= 15 ? '#f59e0b' : '#10b981'

  const statsCards = stats ? [
    { label:'展示団体数',   value: String(stats.total),             sub:'全フロア',              icon:'🏫', color:'#6366f1' },
    { label:'現在公開中',   value: String(stats.active),            sub:`${stats.total - stats.active}団体が非公開`, icon:'✅', color:'#10b981' },
    { label:'平均待ち時間', value: stats.avgWait > 0 ? `${stats.avgWait}分` : '−', sub:'公開中の全体平均', icon:'⏱', color:'#f59e0b' },
    { label:'お知らせ（7日）', value: `${stats.notices}件`,         sub:'直近7日間',              icon:'🔔', color:'#ef4444' },
  ] : []

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily:"'Kaisei Decol',serif", fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
          おはようございます 👋
        </h1>
        <div style={{ fontSize: 13, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
          南高祭 2025 · 管理ダッシュボード
        </div>
      </div>

      {/* ── 統計カード ── */}
      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16, marginBottom:28 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{
              background:'#fff', borderRadius:16, padding:'20px',
              boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9',
              height: 110, animation:'pulse 1.5s ease infinite',
            }} />
          ))}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16, marginBottom:28 }}>
          {statsCards.map(s => (
            <div key={s.label} style={{
              background:'#fff', borderRadius:16, padding:'20px 20px 16px',
              boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9',
            }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{
                  width:40, height:40, borderRadius:10,
                  background:`${s.color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
                }}>{s.icon}</div>
              </div>
              <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:26, fontWeight:700, color:'#1e293b', marginBottom:2 }}>
                {s.value}
              </div>
              <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>{s.label}</div>
              <div style={{ fontSize:10, color:'#cbd5e1', marginTop:2, fontFamily:"'Kiwi Maru',serif" }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── 2カラム ── */}
      <style>{`@media(max-width:640px){.admin-2col{grid-template-columns:1fr!important;}}`}</style>
      <div className="admin-2col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

        {/* 混雑TOP */}
        <div style={{ background:'#fff', borderRadius:16, padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9' }}>
          <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#1e293b', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
            ⏱ 現在の混雑TOP
            <Link href="/admin/edit" style={{ marginLeft:'auto', fontSize:11, color:'#FF8C00', textDecoration:'none', fontFamily:"'Kiwi Maru',serif" }}>
              すべて見る →
            </Link>
          </div>
          {loading ? (
            <div style={{ color:'#cbd5e1', fontSize:12, fontFamily:"'Kiwi Maru',serif" }}>読み込み中…</div>
          ) : topWait.length === 0 ? (
            <div style={{ color:'#cbd5e1', fontSize:12, fontFamily:"'Kiwi Maru',serif", textAlign:'center', padding:'20px 0' }}>
              待ち時間のデータがありません
            </div>
          ) : (
            topWait.map((w, i) => (
              <div key={w.id} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                <div style={{
                  width:28, height:28, borderRadius:'50%', flexShrink:0,
                  background: i===0?'#fef3c7':i===1?'#f1f5f9':'#f8fafc',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:13, fontWeight:700, color: i===0?'#f59e0b':'#94a3b8',
                }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1e293b', fontFamily:"'Kaisei Decol',serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {w.name}
                  </div>
                  <div style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                    {w.floor ? `${w.floor}F` : '—'} · {w.room_display || '場所未設定'}
                  </div>
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:WAIT_COLOR(w.wait_minutes), fontFamily:"'Kaisei Decol',serif", flexShrink:0 }}>
                  {w.wait_minutes}分
                </div>
              </div>
            ))
          )}
        </div>

        {/* 最近の更新 */}
        <div style={{ background:'#fff', borderRadius:16, padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9' }}>
          <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#1e293b', marginBottom:16 }}>
            🕐 最近の更新
          </div>
          {loading ? (
            <div style={{ color:'#cbd5e1', fontSize:12, fontFamily:"'Kiwi Maru',serif" }}>読み込み中…</div>
          ) : recent.length === 0 ? (
            <div style={{ color:'#cbd5e1', fontSize:12, fontFamily:"'Kiwi Maru',serif", textAlign:'center', padding:'20px 0' }}>
              更新履歴がありません
            </div>
          ) : (
            recent.map(e => (
              <Link key={e.id} href={`/admin/edit/${e.id}`} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, textDecoration:'none' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:'#6366f1' }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#1e293b', fontFamily:"'Kiwi Maru',serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {e.class_label ? `${e.class_label} ` : ''}{e.name}
                  </div>
                  <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                    {e.is_active ? '公開中' : '非公開'} · 待ち{e.wait_minutes > 0 ? `${e.wait_minutes}分` : '−'}
                  </div>
                </div>
                <div style={{ fontSize:10, color:'#cbd5e1', flexShrink:0, fontFamily:"'Kiwi Maru',serif" }}>
                  {relativeTime(e.updated_at!)}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* ── クイックアクセス ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginTop:20 }}>
        {[
          { href:'/admin/edit',     label:'展示を編集', icon:'✏', color:'#6366f1' },
          { href:'/admin/users',    label:'権限を管理', icon:'👥', color:'#10b981' },
          { href:'/admin/exhibits', label:'団体を追加', icon:'＋', color:'#f59e0b' },
          { href:'/admin/food',     label:'販売数管理', icon:'🍱', color:'#f97316' },
          { href:'/admin/votes',    label:'人気投票',   icon:'🗳', color:'#FF6B00' },
          { href:'/admin/settings', label:'サイト設定', icon:'⚙', color:'#64748b' },
          { href:'/map',            label:'マップを確認', icon:'🗺', color:'#0ea5e9' },
        ].map(a => (
          <Link key={a.href} href={a.href} style={{
            display:'flex', alignItems:'center', gap:10, padding:'14px 16px',
            background:'#fff', borderRadius:12, textDecoration:'none',
            border:`1px solid ${a.color}22`,
            boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              width:32, height:32, borderRadius:8, background:`${a.color}18`,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
            }}>{a.icon}</div>
            <span style={{ fontSize:12, fontWeight:700, color:'#1e293b', fontFamily:"'Kiwi Maru',serif" }}>{a.label}</span>
          </Link>
        ))}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}
