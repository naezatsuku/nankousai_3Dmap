'use client'

import PageLoader from '@/components/ui/PageLoader'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Exhibit, ExhibitType, FloorNumber } from '@/types'

const TYPE_CONFIG: Record<ExhibitType, { label:string; color:string }> = {
  class:     { label:'展示',   color:'#6366f1' },
  food:      { label:'フード', color:'#f59e0b' },
  band:      { label:'軽音',   color:'#a855f7' },
  special:   { label:'特別',   color:'#0ea5e9' },
  cafeteria: { label:'食堂',   color:'#10b981' },
}

type FilterType = ExhibitType | 'all'

const BLANK: Omit<Exhibit,'id'|'created_at'|'updated_at'> = {
  name:'', class_label:'', type:'class', room_object:'', room_display:'',
  floor:1, description:'', thumbnail_url:'', cover_url:'',
  wait_minutes:0, is_active:true, day:'both',
}

export default function ExhibitsPage() {
  const [exhibits, setExhibits] = useState<Exhibit[]>([])
  const [loading, setLoading]   = useState(true)
  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState({ ...BLANK })
  const [deleteId, setDeleteId] = useState<string|null>(null)
  const [filterType, setFilterType] = useState<FilterType>('all')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('exhibits').select('*').order('floor').then(({ data }) => {
      if (data) setExhibits(data as Exhibit[])
      setLoading(false)
    })
  }, [])

  const add = async () => {
    if (!form.name) return
    const supabase = createClient()
    const { data } = await supabase
      .from('exhibits')
      .insert({ ...form, stamp_secret: crypto.randomUUID() })
      .select()
      .single()
    if (data) setExhibits(ex => [...ex, data as Exhibit])
    setForm({ ...BLANK })
    setAdding(false)
  }

  const remove = async (id: string) => {
    const supabase = createClient()
    await supabase.from('exhibits').delete().eq('id', id)
    setExhibits(ex => ex.filter(e => e.id !== id))
    setDeleteId(null)
  }

  const toggle = async (id: string, current: boolean) => {
    const supabase = createClient()
    await supabase.from('exhibits').update({ is_active: !current }).eq('id', id)
    setExhibits(ex => ex.map(e => e.id===id ? {...e, is_active:!current} : e))
  }

  const visible = filterType === 'all' ? exhibits : exhibits.filter(e => e.type === filterType)

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h2 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#1e293b', marginBottom:3 }}>団体管理</h2>
          <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>展示団体の追加・削除・有効化</div>
        </div>
        <button onClick={()=>setAdding(v=>!v)} style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'9px 18px', borderRadius:10, border:'none', cursor:'pointer',
          background: adding ? '#f1f5f9' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
          color: adding ? '#94a3b8' : '#fff',
          fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
        }}>
          {adding ? '✕ キャンセル' : '＋ 団体を追加'}
        </button>
      </div>

      {/* ── 追加フォーム ── */}
      {adding && (
        <div style={{
          background:'#fff', borderRadius:16, padding:'20px', marginBottom:20,
          boxShadow:'0 1px 8px rgba(0,0,0,0.08)', border:'1.5px solid rgba(255,107,0,0.2)',
        }}>
          <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700, color:'#1e293b', marginBottom:16 }}>
            新しい展示団体
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <Field label="展示名 *">
              <Input value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} placeholder="例: 高2-1 お化け屋敷" />
            </Field>
            <Field label="クラス名">
              <Input value={form.class_label ?? ''} onChange={v=>setForm(f=>({...f,class_label:v}))} placeholder="例: 高2-1" />
            </Field>
            <Field label="種別 *">
              <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value as ExhibitType}))}
                style={inputStyle}>
                {Object.entries(TYPE_CONFIG).map(([k,v])=>(
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </Field>
            <Field label="フロア">
              <select value={form.floor ?? 1} onChange={e=>setForm(f=>({...f,floor:Number(e.target.value) as FloorNumber}))}
                style={inputStyle}>
                {[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}F</option>)}
              </select>
            </Field>
            <Field label="マップ上のオブジェクト名">
              <Input value={form.room_object ?? ''} onChange={v=>setForm(f=>({...f,room_object:v}))} placeholder="例: 201" />
            </Field>
            <Field label="ユーザー向け表示名">
              <Input value={form.room_display ?? ''} onChange={v=>setForm(f=>({...f,room_display:v}))} placeholder="例: 201教室" />
            </Field>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>setAdding(false)} style={{ padding:'9px 18px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color:'#94a3b8', fontSize:13, cursor:'pointer', fontFamily:"'Kiwi Maru',serif" }}>
              キャンセル
            </button>
            <button onClick={add} disabled={!form.name} style={{
              padding:'9px 20px', borderRadius:8, border:'none', cursor:form.name?'pointer':'not-allowed',
              background: form.name ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f1f5f9',
              color: form.name ? '#fff' : '#94a3b8', fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
            }}>
              追加する
            </button>
          </div>
        </div>
      )}

      {/* ── フィルター ── */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
        {([['all','すべて','#64748b']] as [FilterType,string,string][]).concat(
          Object.entries(TYPE_CONFIG).map(([k,v])=>[k as ExhibitType,v.label,v.color])
        ).map(([t,label,color])=>(
          <button key={t} onClick={()=>setFilterType(t)} style={{
            padding:'5px 14px', borderRadius:99, border:'none', cursor:'pointer',
            background: filterType===t ? color : '#f1f5f9',
            color: filterType===t ? '#fff' : '#64748b',
            fontSize:11, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
            transition:'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {/* ── 一覧 ── */}
      {loading ? (
        <PageLoader />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {visible.map(ex => {
            const tc = TYPE_CONFIG[ex.type]
            return (
              <div key={ex.id} style={{
                display:'flex', alignItems:'center', gap:14,
                background:'#fff', borderRadius:14, padding:'14px 16px',
                boxShadow:'0 1px 3px rgba(0,0,0,0.04)', border:'1px solid #f1f5f9',
                opacity: ex.is_active ? 1 : 0.5,
              }}>
                <div style={{
                  fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:99,
                  background:`${tc.color}18`, color:tc.color, flexShrink:0, fontFamily:"'Kiwi Maru',serif",
                }}>
                  {tc.label}
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700, color:'#1e293b' }}>
                    {ex.class_label && <span style={{ color:'#94a3b8', fontWeight:400, marginRight:6, fontSize:12 }}>{ex.class_label}</span>}
                    {ex.name}
                  </div>
                  <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                    {ex.floor ? `${ex.floor}F` : '—'} · {ex.room_display || '場所未設定'}
                    {ex.room_object && <span style={{ marginLeft:6, color:'#cbd5e1' }}>({ex.room_object})</span>}
                  </div>
                </div>

                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  <span style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                    {ex.is_active ? '公開' : '非公開'}
                  </span>
                  <button onClick={()=>toggle(ex.id, ex.is_active)} style={{
                    width:42, height:24, borderRadius:99, border:'none', cursor:'pointer',
                    background: ex.is_active ? '#FF8C00' : '#e2e8f0',
                    position:'relative', transition:'background 0.2s', flexShrink:0,
                  }}>
                    <div style={{
                      position:'absolute', top:3,
                      left: ex.is_active ? 'calc(100% - 21px)' : 3,
                      width:18, height:18, borderRadius:'50%', background:'#fff',
                      boxShadow:'0 1px 3px rgba(0,0,0,0.2)', transition:'left 0.2s',
                    }} />
                  </button>
                </div>

                <button onClick={()=>setDeleteId(ex.id)} style={{
                  width:30, height:30, borderRadius:8, border:'1px solid #fee2e2', background:'#fff',
                  color:'#ef4444', cursor:'pointer', fontSize:14,
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                }}>🗑</button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 削除確認 ── */}
      {deleteId && (
        <div style={{
          position:'fixed', inset:0, zIndex:100,
          background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }}>
          <div style={{ background:'#fff', borderRadius:20, padding:'28px 24px', width:'100%', maxWidth:360 }}>
            <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:18, fontWeight:700, color:'#1e293b', marginBottom:8 }}>
              本当に削除しますか？
            </div>
            <div style={{ fontSize:13, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:20, lineHeight:1.6 }}>
              「{exhibits.find(e=>e.id===deleteId)?.name}」を削除します。この操作は取り消せません。
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setDeleteId(null)} style={{
                flex:1, padding:'11px 0', borderRadius:10, border:'1px solid #e2e8f0',
                background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Kiwi Maru',serif", color:'#64748b',
              }}>キャンセル</button>
              <button onClick={()=>remove(deleteId)} style={{
                flex:1, padding:'11px 0', borderRadius:10, border:'none',
                background:'#ef4444', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Kiwi Maru',serif",
              }}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'9px 12px', borderRadius:8,
  border:'1px solid #e2e8f0', background:'#fff',
  fontSize:13, color:'#1e293b', fontFamily:"'Kiwi Maru',serif",
  boxSizing:'border-box',
}

function Field({ label,children }:{ label:string; children:React.ReactNode }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, fontFamily:"'Kiwi Maru',serif" }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Input({ value,onChange,placeholder }:{ value:string; onChange:(v:string)=>void; placeholder?:string }) {
  return (
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
  )
}
