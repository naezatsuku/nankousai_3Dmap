'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ── 型 ────────────────────────────────────────────────────────
type BodySegment =
  | { type:'text'; text:string }
  | { type:'link'; label:string; href:string }
  | { type:'break' }

interface Section { id:string; heading:string; body:BodySegment[]; order:number }

interface ExhibitFormState {
  name:string; catch_copy:string; description:string
  cover_url:string; thumbnail_url:string
  room_display:string; floor:number
  sections:Section[]
  time_per_group:number
  queue_count:number
  type:'class'|'food'|'band'|'special'|'cafeteria'
}

const INIT: ExhibitFormState = {
  name:'', catch_copy:'', description:'',
  cover_url:'', thumbnail_url:'', room_display:'', floor:1,
  sections:[], time_per_group:5, queue_count:0, type:'class',
}

const calcWait = (tpg:number, qc:number) => Math.max(0, tpg * qc)

// ── メインページ ───────────────────────────────────────────────
export default function ExhibitEditPage() {
  const { id } = useParams<{ id:string }>()
  const [form, setForm]         = useState<ExhibitFormState>(INIT)
  const [tab, setTab]           = useState<'basic'|'quick'>('basic')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [noticeText, setNoticeText]     = useState('')
  const [noticeUrgent, setNoticeUrgent] = useState(false)
  const [posting, setPosting]           = useState(false)

  // ── データ読み込み ────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('exhibits')
      .select('*, sections:exhibit_sections(id, heading, body, order_index)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          const waitMin = data.wait_minutes ?? 0
          const tpg     = 5
          setForm({
            name:          data.name ?? '',
            catch_copy:    data.catch_copy ?? '',
            description:   data.description ?? '',
            cover_url:     data.cover_url ?? '',
            thumbnail_url: data.thumbnail_url ?? '',
            room_display:  data.room_display ?? '',
            floor:         data.floor ?? 1,
            sections: ((data.sections as {id:string;heading:string;body:BodySegment[];order_index:number}[]) ?? [])
              .sort((a,b) => a.order_index - b.order_index)
              .map(s => ({ id:s.id, heading:s.heading, body:s.body ?? [], order:s.order_index })),
            time_per_group: tpg,
            queue_count:    Math.round(waitMin / tpg),
            type:           data.type,
          })
        }
        setLoading(false)
      })
  }, [id])

  const set = useCallback(<K extends keyof ExhibitFormState>(key:K, val:ExhibitFormState[K]) => {
    setForm(f => ({ ...f, [key]:val }))
  }, [])

  // ── 保存 ────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()

    await supabase.from('exhibits').update({
      name:          form.name,
      catch_copy:    form.catch_copy,
      description:   form.description,
      cover_url:     form.cover_url,
      thumbnail_url: form.thumbnail_url,
      room_display:  form.room_display,
      floor:         form.floor,
      wait_minutes:  waitMin,
    }).eq('id', id)

    // セクションを全削除して再挿入
    await supabase.from('exhibit_sections').delete().eq('exhibit_id', id)
    if (form.sections.length > 0) {
      await supabase.from('exhibit_sections').insert(
        form.sections.map(s => ({
          exhibit_id:  id,
          heading:     s.heading,
          body:        s.body,
          order_index: s.order,
        }))
      )
    }

    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── お知らせ投稿 ──────────────────────────────────────────────
  const handlePostNotice = async () => {
    if (!noticeText.trim()) return
    setPosting(true)
    const supabase = createClient()
    await supabase.from('notices').insert({
      exhibit_id: id,
      title:      noticeText.split('\n')[0].slice(0, 60) || 'お知らせ',
      body:       noticeText,
      is_urgent:  noticeUrgent,
    })
    setNoticeText(''); setNoticeUrgent(false); setPosting(false)
  }

  const waitMin = calcWait(form.time_per_group, form.queue_count)

  if (loading) {
    return (
      <div style={{ maxWidth:1200, textAlign:'center', padding:'60px 0', color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
        読み込み中…
      </div>
    )
  }

  return (
    <>
      <style>{`
        @media (min-width:900px){ .edit-mobile-tabs{display:none!important;} .edit-layout{display:grid!important;} .edit-left,.edit-right{display:block!important;} }
        @media (max-width:899px){ .edit-layout{display:block!important;} .edit-left[data-tab="basic"]{display:block!important;} .edit-left[data-tab="quick"]{display:none!important;} .edit-right[data-tab="basic"]{display:none!important;} .edit-right[data-tab="quick"]{display:block!important;} }
        .field-input:focus{ outline:2px solid #FF8C00; outline-offset:0; border-color:#FF8C00!important; }
        textarea.field-input:focus{ outline:2px solid #FF8C00; }
      `}</style>

      <div style={{ maxWidth:1200 }}>
        {/* ── ページヘッダー ── */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <Link href="/admin/edit" style={{ color:'#94a3b8', textDecoration:'none', fontSize:20 }}>←</Link>
          <div>
            <h2 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#1e293b', marginBottom:2 }}>
              {form.name || '（名前未設定）'}
              <span style={{ fontSize:13, fontWeight:400, color:'#94a3b8', marginLeft:10, fontFamily:"'Kiwi Maru',serif" }}>
                {form.room_display}{form.floor ? ` · ${form.floor}F` : ''}
              </span>
            </h2>
          </div>
          <button onClick={handleSave} disabled={saving} style={{
            marginLeft:'auto', padding:'9px 22px', borderRadius:10, border:'none', cursor:'pointer',
            background: saved ? '#10b981' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
            color:'#fff', fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
            transition:'background 0.3s',
          }}>
            {saving ? '保存中…' : saved ? '✓ 保存しました' : '保存する'}
          </button>
        </div>

        {/* ── モバイル用タブ ── */}
        <div className="edit-mobile-tabs" style={{ display:'flex', gap:0, marginBottom:20, background:'#f1f5f9', borderRadius:12, padding:4 }}>
          {([['basic','📝 基本情報'],['quick','⚡ クイック更新']] as const).map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              flex:1, padding:'9px 0', borderRadius:9, border:'none', cursor:'pointer',
              background: tab===t ? '#fff' : 'transparent',
              color: tab===t ? '#1e293b' : '#94a3b8',
              fontWeight: tab===t ? 700 : 400, fontSize:13,
              fontFamily:"'Kiwi Maru',serif",
              boxShadow: tab===t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition:'all 0.15s',
            }}>{label}</button>
          ))}
        </div>

        {/* ── レイアウト ── */}
        <div className="edit-layout" style={{ gridTemplateColumns:'1fr 340px', gap:20, alignItems:'start' }}>

          {/* ────────────── 左エリア ────────────── */}
          <div className="edit-left" data-tab={tab === 'basic' ? 'basic' : 'quick'}>

            <Card title="基本情報" icon="📋">
              <FormField label="展示名">
                <Input value={form.name} onChange={v=>set('name',v)} />
              </FormField>
              <FormField label="キャッチコピー" hint="詳細ページの帯に表示されます">
                <Input value={form.catch_copy} onChange={v=>set('catch_copy',v)} placeholder="例: この夏だけの、恐怖を。" />
              </FormField>
              <FormField label="説明文（概要）">
                <Textarea value={form.description} onChange={v=>set('description',v)} rows={3} />
              </FormField>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <FormField label="展示場所">
                  <Input value={form.room_display} onChange={v=>set('room_display',v)} />
                </FormField>
                <FormField label="フロア">
                  <select value={form.floor} onChange={e=>set('floor',Number(e.target.value))}
                    className="field-input" style={inputStyle}>
                    {[1,2,3,4,5,6].map(f=><option key={f} value={f}>{f}F</option>)}
                  </select>
                </FormField>
              </div>
            </Card>

            <Card title="写真・画像" icon="🖼" style={{ marginTop:16 }}>
              <FormField label="カバー写真URL">
                <Input value={form.cover_url} onChange={v=>set('cover_url',v)} placeholder="https://..." />
              </FormField>
              <FormField label="宣材写真URL（正方形）">
                <Input value={form.thumbnail_url} onChange={v=>set('thumbnail_url',v)} placeholder="https://..." />
              </FormField>
            </Card>

            <Card title="本文セクション" icon="📖" style={{ marginTop:16 }}>
              <SectionsEditor sections={form.sections} onChange={v=>set('sections',v)} />
            </Card>
          </div>

          {/* ────────────── 右エリア ────────────── */}
          <div className="edit-right" data-tab={tab === 'quick' ? 'quick' : 'basic'}>

            <Card title="⚡ 待ち時間" icon="" accent style={{ marginBottom:16 }}>
              <div style={{
                background:'linear-gradient(135deg,#0f172a,#1e293b)',
                borderRadius:14, padding:'20px', textAlign:'center', marginBottom:18,
              }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>現在の待ち時間</div>
                <div style={{
                  fontFamily:"'Kaisei Decol',serif", fontSize:48, fontWeight:700,
                  color: waitMin>=30?'#fca5a5':waitMin>=15?'#fcd34d':'#86efac', lineHeight:1,
                }}>{waitMin}</div>
                <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', marginTop:4, fontFamily:"'Kiwi Maru',serif" }}>分</div>
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f8fafc', borderRadius:12, padding:'14px', marginBottom:16 }}>
                {[
                  { label:'1組あたり', val:form.time_per_group, key:'time_per_group' as const, unit:'分', min:1 },
                  { label:'待ち組数',   val:form.queue_count,   key:'queue_count'   as const, unit:'組', min:0 },
                ].map((item, idx) => (
                  <>
                    {idx > 0 && <div key={`op${idx}`} style={{ fontSize:20, color:'#cbd5e1', fontWeight:700, flexShrink:0 }}>×</div>}
                    <div key={item.key} style={{ flex:1, textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'#94a3b8', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>{item.label}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'center' }}>
                        <button onClick={()=>set(item.key, Math.max(item.min, item.val-1))} style={calcBtnStyle}>−</button>
                        <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#1e293b', minWidth:36, textAlign:'center' }}>{item.val}</span>
                        <button onClick={()=>set(item.key, item.val+1)} style={calcBtnStyle}>＋</button>
                      </div>
                      <div style={{ fontSize:10, color:'#94a3b8', marginTop:4, fontFamily:"'Kiwi Maru',serif" }}>{item.unit}</div>
                    </div>
                  </>
                ))}
                <div style={{ fontSize:20, color:'#cbd5e1', fontWeight:700, flexShrink:0 }}>=</div>
                <div style={{ flex:1, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#94a3b8', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>待ち時間</div>
                  <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#FF6B00' }}>{waitMin}分</div>
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, color:'#94a3b8', display:'block', marginBottom:4, fontFamily:"'Kiwi Maru',serif" }}>または直接入力</label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="number" min={0} value={form.queue_count}
                    onChange={e=>set('queue_count',Number(e.target.value))}
                    className="field-input" style={{ ...inputStyle, flex:1 }} placeholder="待ち組数を入力" />
                  <span style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", flexShrink:0 }}>組</span>
                </div>
              </div>

              <button onClick={handleSave} disabled={saving} style={{
                width:'100%', padding:'12px 0', borderRadius:10, border:'none', cursor:'pointer',
                background: saved ? '#10b981' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
                color:'#fff', fontSize:14, fontWeight:700,
                fontFamily:"'Kaisei Decol',serif", transition:'background 0.3s',
              }}>
                {saving ? '更新中…' : saved ? '✓ 更新しました' : '待ち時間を更新する'}
              </button>
            </Card>

            {/* お知らせ投稿 */}
            <Card title="お知らせを投稿" icon="📣">
              <Textarea placeholder="内容を入力…" rows={3} value={noticeText} onChange={setNoticeText} />
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10 }}>
                <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#64748b', cursor:'pointer', fontFamily:"'Kiwi Maru',serif" }}>
                  <input type="checkbox" checked={noticeUrgent} onChange={e=>setNoticeUrgent(e.target.checked)} style={{ accentColor:'#FF6B00' }} />
                  重要マークをつける
                </label>
                <button onClick={handlePostNotice} disabled={posting || !noticeText.trim()} style={{
                  marginLeft:'auto', padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer',
                  background: noticeText.trim() ? '#1e293b' : '#e2e8f0',
                  color: noticeText.trim() ? '#fff' : '#94a3b8',
                  fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                }}>
                  {posting ? '投稿中…' : '投稿する'}
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── セクション編集 ────────────────────────────────────────────
function SectionsEditor({ sections, onChange }:{sections:Section[];onChange:(v:Section[])=>void}) {
  const sorted = [...sections].sort((a,b)=>a.order-b.order)

  const addSection = () => {
    const newSec:Section = { id:`new_${Date.now()}`, heading:'', body:[{type:'text',text:''}], order: sections.length+1 }
    onChange([...sections, newSec])
  }
  const removeSection = (id:string) => onChange(sections.filter(s=>s.id!==id))
  const moveUp   = (i:number) => { if(i===0)return; const a=[...sorted]; [a[i-1],a[i]]=[a[i],a[i-1]]; onChange(a.map((s,idx)=>({...s,order:idx+1}))) }
  const moveDown = (i:number) => { if(i===sorted.length-1)return; const a=[...sorted]; [a[i],a[i+1]]=[a[i+1],a[i]]; onChange(a.map((s,idx)=>({...s,order:idx+1}))) }
  const updateHeading = (id:string, v:string) => onChange(sections.map(s=>s.id===id?{...s,heading:v}:s))
  const updateText    = (id:string, v:string) => onChange(sections.map(s=>s.id===id?{...s,body:[{type:'text',text:v}]}:s))

  return (
    <div>
      {sorted.map((sec,i)=>(
        <div key={sec.id} style={{ border:'1px solid #e2e8f0', borderRadius:12, padding:'14px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>セクション {i+1}</div>
            <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
              <ToolBtn onClick={()=>moveUp(i)} disabled={i===0}>↑</ToolBtn>
              <ToolBtn onClick={()=>moveDown(i)} disabled={i===sorted.length-1}>↓</ToolBtn>
              <ToolBtn onClick={()=>removeSection(sec.id)} danger>🗑</ToolBtn>
            </div>
          </div>
          <FormField label="見出し">
            <Input value={sec.heading} onChange={v=>updateHeading(sec.id,v)} placeholder="例: 展示内容について" />
          </FormField>
          <FormField label="本文">
            <Textarea value={sec.body.find(b=>b.type==='text') ? (sec.body.find(b=>b.type==='text') as {type:'text';text:string}).text : ''} onChange={v=>updateText(sec.id,v)} rows={4} />
          </FormField>
        </div>
      ))}
      <button onClick={addSection} style={{
        width:'100%', padding:'11px', borderRadius:10, border:'1.5px dashed #e2e8f0',
        background:'#fafafa', cursor:'pointer', fontSize:13, color:'#94a3b8',
        fontFamily:"'Kiwi Maru',serif", fontWeight:700,
      }}>
        ＋ セクションを追加
      </button>
    </div>
  )
}

// ─── UIパーツ ─────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width:'100%', padding:'9px 12px', borderRadius:8,
  border:'1px solid #e2e8f0', background:'#fff',
  fontSize:13, color:'#1e293b', fontFamily:"'Kiwi Maru',serif",
  boxSizing:'border-box',
}

function Card({ title,icon,children,accent=false,style }:{
  title:string; icon:string; children:React.ReactNode; accent?:boolean; style?:React.CSSProperties
}) {
  return (
    <div style={{
      background:'#fff', borderRadius:16, padding:'20px',
      boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:`1px solid ${accent?'rgba(255,107,0,0.2)':'#f1f5f9'}`,
      ...style,
    }}>
      <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700, color:'#1e293b', marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
        {icon && <span>{icon}</span>} {title}
      </div>
      {children}
    </div>
  )
}

function FormField({ label,hint,children }:{label:string;hint?:string;children:React.ReactNode}) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, fontFamily:"'Kiwi Maru',serif" }}>
        {label}
        {hint && <span style={{ fontWeight:400, color:'#94a3b8', marginLeft:6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ value,onChange,placeholder }:{value:string;onChange:(v:string)=>void;placeholder?:string}) {
  return (
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      className="field-input" style={inputStyle} />
  )
}

function Textarea({ value,onChange,rows=3,placeholder }:{value:string;onChange:(v:string)=>void;rows?:number;placeholder?:string}) {
  return (
    <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} placeholder={placeholder}
      className="field-input" style={{ ...inputStyle, resize:'vertical', lineHeight:1.6 }} />
  )
}

function ToolBtn({ onClick,disabled,danger,children }:{onClick:()=>void;disabled?:boolean;danger?:boolean;children:React.ReactNode}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:28, height:28, borderRadius:6, border:'1px solid #e2e8f0',
      background: disabled?'#f8fafc':danger?'#fef2f2':'#fff',
      color: disabled?'#cbd5e1':danger?'#ef4444':'#64748b',
      cursor: disabled?'not-allowed':'pointer', fontSize:12,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>{children}</button>
  )
}

const calcBtnStyle: React.CSSProperties = {
  width:30, height:30, borderRadius:8, border:'1px solid #e2e8f0',
  background:'#fff', cursor:'pointer', fontSize:16, color:'#64748b',
  display:'flex', alignItems:'center', justifyContent:'center',
  flexShrink:0,
}
