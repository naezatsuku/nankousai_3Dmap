'use client'

import Link from 'next/link'

const EXHIBITS = [
  { id:'1',   name:'お化け屋敷',   class_label:'高2-1', floor:2, room:'201', wait:15, type:'class',   active:true  },
  { id:'2',   name:'カフェ',       class_label:'高2-2', floor:2, room:'202', wait:5,  type:'class',   active:true  },
  { id:'3',   name:'縁日',         class_label:'高2-3', floor:2, room:'203', wait:40, type:'class',   active:true  },
  { id:'4',   name:'VR体験',       class_label:'高1-4', floor:1, room:'104', wait:25, type:'class',   active:true  },
  { id:'5',   name:'謎解き',       class_label:'高1-3', floor:1, room:'103', wait:5,  type:'class',   active:true  },
  { id:'food1', name:'焼きそば・フランクフルト', class_label:'高3-1', floor:1, room:'外A', wait:0, type:'food', active:true },
  { id:'band1', name:'軽音楽部',   class_label:'',      floor:2, room:'sub', wait:8,  type:'band',    active:true  },
]

const WAIT_COLOR = (w:number) =>
  w>=30?'#ef4444':w>=15?'#f59e0b':w>0?'#10b981':'#94a3b8'

const TYPE_CONFIG: Record<string,{label:string;color:string}> = {
  class:     { label:'展示',   color:'#6366f1' },
  food:      { label:'フード', color:'#f59e0b' },
  band:      { label:'軽音',   color:'#a855f7' },
  special:   { label:'特別',   color:'#0ea5e9' },
  cafeteria: { label:'食堂',   color:'#10b981' },
}

export default function EditListPage() {
  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h2 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#1e293b', marginBottom:3 }}>展示一覧</h2>
          <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>クリックして編集・待ち時間更新</div>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {EXHIBITS.map(ex => {
          const tc = TYPE_CONFIG[ex.type] ?? TYPE_CONFIG.class
          return (
            <Link key={ex.id} href={`/admin/edit/${ex.id}`} style={{
              display:'flex', alignItems:'center', gap:16,
              background:'#fff', borderRadius:14, padding:'14px 18px',
              textDecoration:'none', border:'1px solid #f1f5f9',
              boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
              transition:'box-shadow 0.15s',
            }}>
              {/* タイプバッジ */}
              <div style={{
                fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:99,
                background:`${tc.color}18`, color:tc.color,
                flexShrink:0, fontFamily:"'Kiwi Maru',serif",
              }}>
                {tc.label}
              </div>

              {/* 名前 */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#1e293b' }}>
                  {ex.class_label && <span style={{ color:'#94a3b8', fontWeight:400, marginRight:6, fontSize:13 }}>{ex.class_label}</span>}
                  {ex.name}
                </div>
                <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                  {ex.floor}F · {ex.room}
                </div>
              </div>

              {/* 待ち時間 */}
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{
                  fontSize:18, fontWeight:700, color:WAIT_COLOR(ex.wait),
                  fontFamily:"'Kaisei Decol',serif",
                }}>
                  {ex.wait > 0 ? `${ex.wait}分` : '−'}
                </div>
                <div style={{ fontSize:10, color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif" }}>待ち</div>
              </div>

              <div style={{ color:'#cbd5e1', fontSize:18, flexShrink:0 }}>›</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}