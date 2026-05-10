'use client'

import Link from 'next/link'

const STATS = [
  { label:'展示団体数', value:'32', sub:'全フロア', icon:'🏫', color:'#6366f1' },
  { label:'現在公開中', value:'28', sub:'4団体が非公開', icon:'✅', color:'#10b981' },
  { label:'平均待ち時間', value:'12分', sub:'全フロア平均', icon:'⏱', color:'#f59e0b' },
  { label:'未読お知らせ', value:'3件', sub:'新着あり', icon:'🔔', color:'#ef4444' },
]

const RECENT_EDITS = [
  { name:'高2-1 お化け屋敷', action:'待ち時間を更新', time:'5分前', type:'quick' },
  { name:'高3-2 焼きそば',   action:'メニュー在庫を更新', time:'12分前', type:'quick' },
  { name:'軽音楽部',         action:'スケジュールを編集', time:'1時間前', type:'edit' },
  { name:'高2-3 縁日',       action:'展示説明を更新', time:'2時間前', type:'edit' },
]

const WAITING_TOPS = [
  { name:'高2-3 縁日',       floor:2, wait:40 },
  { name:'メインアリーナ',   floor:2, wait:20 },
  { name:'高2-1 お化け屋敷', floor:2, wait:15 },
]

export default function AdminDashboard() {
  return (
    <div style={{ maxWidth:1100 }}>
      {/* ── ページタイトル ── */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:24, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
          おはようございます 👋
        </h1>
        <div style={{ fontSize:13, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
          南高祭 2025 · 2日目 · 管理ダッシュボード
        </div>
      </div>

      {/* ── 統計カード ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16, marginBottom:28 }}>
        {STATS.map(s => (
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

      {/* ── 2カラム ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

        {/* 混雑TOP */}
        <div style={{ background:'#fff', borderRadius:16, padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9' }}>
          <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#1e293b', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
            ⏱ 現在の混雑TOP
            <Link href="/admin/edit" style={{ marginLeft:'auto', fontSize:11, color:'#FF8C00', textDecoration:'none', fontFamily:"'Kiwi Maru',serif" }}>
              すべて見る →
            </Link>
          </div>
          {WAITING_TOPS.map((w, i) => (
            <div key={w.name} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <div style={{
                width:28, height:28, borderRadius:'50%', flexShrink:0,
                background: i===0?'#fef3c7':i===1?'#f1f5f9':'#f8fafc',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:13, fontWeight:700, color: i===0?'#f59e0b':'#94a3b8',
              }}>{i+1}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1e293b', fontFamily:"'Kaisei Decol',serif" }}>{w.name}</div>
                <div style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>{w.floor}F</div>
              </div>
              <div style={{
                fontSize:14, fontWeight:700, color:
                  w.wait>=30?'#ef4444':w.wait>=15?'#f59e0b':'#10b981',
                fontFamily:"'Kaisei Decol',serif",
              }}>
                {w.wait}分
              </div>
            </div>
          ))}
        </div>

        {/* 最近の編集 */}
        <div style={{ background:'#fff', borderRadius:16, padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9' }}>
          <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#1e293b', marginBottom:16 }}>
            🕐 最近の更新
          </div>
          {RECENT_EDITS.map((e, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div style={{
                width:8, height:8, borderRadius:'50%', flexShrink:0,
                background: e.type==='quick' ? '#f59e0b' : '#6366f1',
              }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#1e293b', fontFamily:"'Kiwi Maru',serif" }}>{e.name}</div>
                <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>{e.action}</div>
              </div>
              <div style={{ fontSize:10, color:'#cbd5e1', flexShrink:0, fontFamily:"'Kiwi Maru',serif" }}>{e.time}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── クイックアクセス ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginTop:20 }}>
        {[
          { href:'/admin/edit', label:'展示を編集', icon:'✏', color:'#6366f1' },
          { href:'/admin/users', label:'権限を管理', icon:'👥', color:'#10b981' },
          { href:'/admin/exhibits', label:'団体を追加', icon:'＋', color:'#f59e0b' },
          { href:'/map', label:'マップを確認', icon:'🗺', color:'#0ea5e9' },
        ].map(a => (
          <Link key={a.href} href={a.href} style={{
            display:'flex', alignItems:'center', gap:10, padding:'14px 16px',
            background:'#fff', borderRadius:12, textDecoration:'none',
            border:`1px solid ${a.color}22`,
            boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
            transition:'all 0.15s',
          }}>
            <div style={{
              width:32, height:32, borderRadius:8, background:`${a.color}18`,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
            }}>{a.icon}</div>
            <span style={{ fontSize:12, fontWeight:700, color:'#1e293b', fontFamily:"'Kiwi Maru',serif" }}>{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}