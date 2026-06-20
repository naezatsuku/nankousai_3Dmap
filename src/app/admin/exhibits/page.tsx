'use client'

import PageLoader from '@/components/ui/PageLoader'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getRoomObjectNames } from '@/lib/roomObjects'
import type { Exhibit, ExhibitType, FloorNumber } from '@/types'

const TYPE_CONFIG: Record<ExhibitType, { label:string; color:string }> = {
  class:     { label:'展示',   color:'#6366f1' },
  food:      { label:'フード', color:'#f59e0b' },
  band:      { label:'軽音',   color:'#a855f7' },
  special:   { label:'特別',   color:'#0ea5e9' },
  cafeteria: { label:'食堂',   color:'#10b981' },
}

type FilterType = 'all' | 'high' | 'middle' | 'food' | 'special' | 'band' | 'cafeteria'

const FILTERS: { key: FilterType; label: string; color: string }[] = [
  { key: 'all',       label: 'すべて', color: '#64748b' },
  { key: 'high',      label: '高校',   color: '#FF6B00' },
  { key: 'middle',    label: '中学',   color: '#0284c7' },
  { key: 'food',      label: 'フード', color: '#f59e0b' },
  { key: 'special',   label: '特別',   color: '#0ea5e9' },
  { key: 'band',      label: '軽音',   color: '#a855f7' },
  { key: 'cafeteria', label: '食堂',   color: '#10b981' },
]

function applyFilter(list: Exhibit[], filter: FilterType): Exhibit[] {
  switch (filter) {
    case 'high':      return list.filter(e => e.type === 'class' && (e.class_label ?? '').startsWith('高'))
    case 'middle':    return list.filter(e => e.type === 'class' && (e.class_label ?? '').startsWith('中'))
    case 'food':      return list.filter(e => e.type === 'food')
    case 'special':   return list.filter(e => e.type === 'special')
    case 'band':      return list.filter(e => e.type === 'band')
    case 'cafeteria': return list.filter(e => e.type === 'cafeteria')
    default:          return list
  }
}

function sort50on(list: Exhibit[]): Exhibit[] {
  return [...list].sort((a, b) => {
    const ka = (a.class_label || a.name || '').normalize('NFC')
    const kb = (b.class_label || b.name || '').normalize('NFC')
    return ka.localeCompare(kb, 'ja', { sensitivity: 'base' })
  })
}

function getItemBadge(ex: Exhibit): { label: string; color: string } {
  if (ex.type === 'class') {
    if ((ex.class_label ?? '').startsWith('高')) return { label: '高校', color: '#FF6B00' }
    if ((ex.class_label ?? '').startsWith('中')) return { label: '中学', color: '#0284c7' }
  }
  return TYPE_CONFIG[ex.type]
}

const BLANK: Omit<Exhibit,'id'|'created_at'|'updated_at'> = {
  name:'', class_label:'', type:'class', room_object:[], room_display:'',
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
  const [editId, setEditId]     = useState<string|null>(null)
  const [editForm, setEditForm] = useState<{ room_object: string[]; room_display: string }>({ room_object:[], room_display:'' })
  const [picker, setPicker]     = useState<{ target:'add'|'edit'; floor:number } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('exhibits').select('*').then(({ data }) => {
      if (data) setExhibits(data as Exhibit[])
      setLoading(false)
    })
  }, [])

  const add = async () => {
    if (!form.class_label) return
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

  const startEdit = (ex: Exhibit) => {
    setEditId(ex.id)
    setEditForm({ room_object: ex.room_object ?? [], room_display: ex.room_display ?? '' })
  }

  const saveEdit = async (id: string) => {
    const supabase = createClient()
    await supabase.from('exhibits').update({
      room_object: editForm.room_object,
      room_display: editForm.room_display,
    }).eq('id', id)
    setExhibits(ex => ex.map(e => e.id===id ? {...e, room_object:editForm.room_object, room_display:editForm.room_display} : e))
    setEditId(null)
  }

  const visible = sort50on(applyFilter(exhibits, filterType))

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h2 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#1e293b', marginBottom:3 }}>団体管理</h2>
          <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>展示団体の追加・編集・削除・有効化</div>
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
            <Field label="展示名">
              <Input value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} placeholder="例: 高2-1 お化け屋敷" />
            </Field>
            <Field label="クラス名 *">
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
            <Field label="マップ上のオブジェクト名（複数可）">
              <TagInput values={form.room_object ?? []} onChange={v=>setForm(f=>({...f,room_object:v}))} placeholder="例: 201" />
              <button type="button" onClick={()=>setPicker({ target:'add', floor: form.floor ?? 1 })} style={pickerLinkStyle}>
                🗺 候補から選ぶ
              </button>
            </Field>
            <Field label="ユーザー向け表示名">
              <Input value={form.room_display ?? ''} onChange={v=>setForm(f=>({...f,room_display:v}))} placeholder="例: 201教室" />
            </Field>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>setAdding(false)} style={{ padding:'9px 18px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color:'#94a3b8', fontSize:13, cursor:'pointer', fontFamily:"'Kiwi Maru',serif" }}>
              キャンセル
            </button>
            <button onClick={add} disabled={!form.class_label} style={{
              padding:'9px 20px', borderRadius:8, border:'none', cursor:form.class_label?'pointer':'not-allowed',
              background: form.class_label ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f1f5f9',
              color: form.class_label ? '#fff' : '#94a3b8', fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
            }}>
              追加する
            </button>
          </div>
        </div>
      )}

      {/* ── フィルター ── */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
        {FILTERS.map(({ key, label, color }) => (
          <button key={key} onClick={() => setFilterType(key)} style={{
            padding:'5px 14px', borderRadius:99, border:'none', cursor:'pointer',
            background: filterType === key ? color : '#f1f5f9',
            color: filterType === key ? '#fff' : '#64748b',
            fontSize:11, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
            transition:'all 0.15s',
          }}>
            {label}
          </button>
        ))}
        <span style={{ fontSize:11, color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif", marginLeft:4 }}>
          {visible.length}件 · 50音順
        </span>
      </div>

      {/* ── 一覧 ── */}
      {loading ? (
        <PageLoader />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {visible.map(ex => {
            const tc = getItemBadge(ex)
            const isEditing = editId === ex.id
            return (
              <div key={ex.id} style={{
                display:'flex', alignItems:'center', gap:14,
                background:'#fff', borderRadius:14, padding:'14px 16px',
                boxShadow:'0 1px 3px rgba(0,0,0,0.04)', border: isEditing ? '1.5px solid rgba(255,107,0,0.3)' : '1px solid #f1f5f9',
                opacity: ex.is_active ? 1 : 0.5,
                flexWrap: isEditing ? 'wrap' : 'nowrap',
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
                  {isEditing ? (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
                      <Field label="マップ上のオブジェクト名（複数可）">
                        <TagInput values={editForm.room_object} onChange={v=>setEditForm(f=>({...f,room_object:v}))} placeholder="例: 201" />
                        <button type="button" onClick={()=>setPicker({ target:'edit', floor: ex.floor ?? 1 })} style={pickerLinkStyle}>
                          🗺 候補から選ぶ
                        </button>
                      </Field>
                      <Field label="ユーザー向け表示名">
                        <Input value={editForm.room_display} onChange={v=>setEditForm(f=>({...f,room_display:v}))} placeholder="例: 201教室" />
                      </Field>
                    </div>
                  ) : (
                    <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                      {ex.floor ? `${ex.floor}F` : '—'} · {ex.room_display || '場所未設定'}
                      {ex.room_object && ex.room_object.length > 0 && (
                        <span style={{ marginLeft:6, color:'#cbd5e1' }}>({ex.room_object.join('・')})</span>
                      )}
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                    <button onClick={()=>setEditId(null)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color:'#94a3b8', fontSize:12, cursor:'pointer', fontFamily:"'Kiwi Maru',serif" }}>
                      キャンセル
                    </button>
                    <button onClick={()=>saveEdit(ex.id)} style={{
                      padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer',
                      background:'linear-gradient(135deg,#FF6B00,#FFAA28)', color:'#fff',
                      fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                    }}>
                      保存
                    </button>
                  </div>
                ) : (
                  <>
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

                    <button onClick={()=>startEdit(ex)} style={{
                      width:30, height:30, borderRadius:8, border:'1px solid #e2e8f0', background:'#fff',
                      color:'#64748b', cursor:'pointer', fontSize:13,
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    }}>✎</button>

                    <button onClick={()=>setDeleteId(ex.id)} style={{
                      width:30, height:30, borderRadius:8, border:'1px solid #fee2e2', background:'#fff',
                      color:'#ef4444', cursor:'pointer', fontSize:14,
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    }}>🗑</button>
                  </>
                )}
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

      {/* ── オブジェクト候補ピッカー ── */}
      {picker && (
        <RoomObjectModal
          floor={picker.floor}
          values={picker.target === 'add' ? (form.room_object ?? []) : editForm.room_object}
          onChange={v => {
            if (picker.target === 'add') setForm(f => ({ ...f, room_object: v }))
            else setEditForm(f => ({ ...f, room_object: v }))
          }}
          onClose={() => setPicker(null)}
        />
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

function TagInput({ values, onChange, placeholder }:{ values:string[]; onChange:(v:string[])=>void; placeholder?:string }) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const v = draft.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setDraft('')
  }

  return (
    <div style={{ ...inputStyle, display:'flex', flexWrap:'wrap', alignItems:'center', gap:6, padding:'6px 8px' }}>
      {values.map(v => (
        <span key={v} style={{
          display:'flex', alignItems:'center', gap:4,
          background:'#fff1e6', color:'#FF6B00', borderRadius:6,
          padding:'3px 7px', fontSize:12, fontWeight:700, whiteSpace:'nowrap',
        }}>
          {v}
          <button type="button" onClick={()=>onChange(values.filter(x=>x!==v))} style={{
            border:'none', background:'none', color:'#FF6B00', cursor:'pointer',
            fontSize:13, padding:0, lineHeight:1,
          }}>×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={e=>setDraft(e.target.value)}
        onKeyDown={e=>{
          if (e.key==='Enter' || e.key===',') { e.preventDefault(); commit() }
          else if (e.key==='Backspace' && !draft && values.length) onChange(values.slice(0,-1))
        }}
        onBlur={commit}
        placeholder={values.length===0 ? placeholder : ''}
        style={{ border:'none', outline:'none', flex:1, minWidth:60, fontSize:13, fontFamily:"'Kiwi Maru',serif", background:'transparent' }}
      />
    </div>
  )
}

const pickerLinkStyle: React.CSSProperties = {
  display:'inline-flex', alignItems:'center', gap:4, marginTop:6,
  border:'none', background:'none', padding:0, cursor:'pointer',
  fontSize:11, fontWeight:700, color:'#FF6B00', fontFamily:"'Kiwi Maru',serif",
}

function RoomObjectModal({ floor, values, onChange, onClose }:{
  floor: number; values: string[]; onChange:(v:string[])=>void; onClose:()=>void
}) {
  const [floorSel, setFloorSel] = useState(floor)
  const [candidates, setCandidates] = useState<string[] | null>(null)

  useEffect(() => {
    setCandidates(null)
    getRoomObjectNames(floorSel)
      .then(setCandidates)
      .catch(() => setCandidates([]))
  }, [floorSel])

  const toggle = (name: string) => {
    onChange(values.includes(name) ? values.filter(v => v !== name) : [...values, name])
  }

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:100,
      background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20,
    }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:'24px', width:'100%', maxWidth:480, maxHeight:'80vh', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:16, fontWeight:700, color:'#1e293b' }}>
            マップオブジェクトを選択
          </div>
          <button onClick={onClose} style={{ border:'none', background:'none', color:'#94a3b8', fontSize:18, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
          {[1,2,3,4,5,6].map(f => (
            <button key={f} onClick={()=>setFloorSel(f)} style={{
              padding:'6px 14px', borderRadius:99, border:'none', cursor:'pointer',
              background: floorSel === f ? '#FF6B00' : '#f1f5f9',
              color: floorSel === f ? '#fff' : '#64748b',
              fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
            }}>
              {f}F
            </button>
          ))}
        </div>

        <div style={{ flex:1, overflowY:'auto', display:'flex', flexWrap:'wrap', gap:8, alignContent:'flex-start' }}>
          {candidates === null ? (
            <div style={{ fontSize:13, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>読み込み中…</div>
          ) : candidates.length === 0 ? (
            <div style={{ fontSize:13, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>このフロアにオブジェクトが見つかりませんでした</div>
          ) : (
            candidates.map(name => {
              const selected = values.includes(name)
              return (
                <button key={name} onClick={()=>toggle(name)} style={{
                  padding:'8px 14px', borderRadius:10, cursor:'pointer',
                  border: selected ? '1.5px solid #FF6B00' : '1px solid #e2e8f0',
                  background: selected ? '#fff1e6' : '#fff',
                  color: selected ? '#FF6B00' : '#1e293b',
                  fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                }}>
                  {selected ? '✓ ' : ''}{name}
                </button>
              )
            })
          )}
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:18 }}>
          <button onClick={onClose} style={{
            padding:'10px 22px', borderRadius:10, border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#FF6B00,#FFAA28)', color:'#fff',
            fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
          }}>
            完了（{values.length}件選択中）
          </button>
        </div>
      </div>
    </div>
  )
}
