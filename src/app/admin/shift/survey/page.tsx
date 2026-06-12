'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageLoader from '@/components/ui/PageLoader'
import NotificationBanner from '@/components/ui/NotificationBanner'

type PrefType = 'want' | 'neutral' | 'avoid'
interface Slot    { id: string; date: string; start_at: string; end_at: string }
interface Exhibit { id: string; name: string; class_label: string | null }

const PREF_CONFIG: Record<PrefType, { label: string; color: string; bg: string; border: string }> = {
  want:    { label: '入りたい',       color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  neutral: { label: 'どちらでもいい', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
  avoid:   { label: '入れない',       color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
}
const DATE_LABEL: Record<string, string> = { sat: '土曜日', sun: '日曜日' }

export default function ShiftSurveyPage() {
  const router = useRouter()
  const [myUserId,    setMyUserId]    = useState('')
  const [isAdmin,     setIsAdmin]     = useState(false)
  const [exhibits,    setExhibits]    = useState<Exhibit[]>([])
  const [exhibitId,   setExhibitId]   = useState<string | null>(null)
  const [slots,       setSlots]       = useState<Slot[]>([])
  const [answers,     setAnswers]     = useState<Record<string, PrefType>>({})
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [slotLoading, setSlotLoading] = useState(false)
  const [noExhibit,   setNoExhibit]   = useState(false)

  // admin 自己クラス設定モーダル
  const [showClassModal,  setShowClassModal]  = useState(false)
  const [allExhibits,     setAllExhibits]     = useState<Exhibit[]>([])
  const [pendingIds,      setPendingIds]      = useState<Set<string>>(new Set())
  const [classModalSaving,setClassModalSaving]= useState(false)

  // 初回: 担当クラス一覧を取得
  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      setMyUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const role = (profile as { role: string } | null)?.role
      if (role === 'admin') setIsAdmin(true)

      // editor は exhibit_editors、それ以外（student/admin）は student_exhibits
      const table = role === 'editor' ? 'exhibit_editors' : 'student_exhibits'

      // admin の場合は全展示（モーダル用）とリンクを並列取得
      const [{ data: links }, allExResult] = await Promise.all([
        supabase.from(table).select('exhibit_id, exhibits(id, name, class_label)').eq('user_id', user.id),
        role === 'admin'
          ? supabase.from('exhibits').select('id, name, class_label').order('class_label', { nullsFirst: false })
          : Promise.resolve({ data: null }),
      ])
      if (allExResult.data) setAllExhibits(allExResult.data as Exhibit[])

      type LinkRow = { exhibit_id: string; exhibits: Exhibit | null }
      const exs = ((links ?? []) as unknown as LinkRow[])
        .map(l => l.exhibits).filter(Boolean) as Exhibit[]

      if (exs.length === 0) { setNoExhibit(true); setLoading(false); return }
      setExhibits(exs)
      setExhibitId(exs[0].id)
      setLoading(false)
    }
    init()
  }, [router])

  // 展示が変わったらコマ・回答を再取得
  const loadSlots = useCallback(async (eid: string) => {
    setSlotLoading(true)
    const res = await fetch(`/api/shift/slots?exhibitId=${eid}`)
    const { slots: sl } = await res.json() as { slots: Slot[] }
    setSlots(sl ?? [])

    const prefRes = await fetch(`/api/shift/preferences?exhibitId=${eid}&mine=1`)
    const prefJson = prefRes.ok
      ? await prefRes.json() as { preferences: { slot_id: string; type: PrefType }[] }
      : { preferences: [] }

    const map: Record<string, PrefType> = {}
    for (const p of prefJson.preferences) map[p.slot_id] = p.type
    for (const s of (sl ?? [])) if (!map[s.id]) map[s.id] = 'neutral'
    setAnswers(map)
    setSlotLoading(false)
  }, [])

  useEffect(() => {
    if (!exhibitId) return
    const id = setTimeout(() => loadSlots(exhibitId), 0)
    return () => clearTimeout(id)
  }, [exhibitId, loadSlots])

  const handleSaveClass = async () => {
    setClassModalSaving(true)
    await fetch('/api/admin/users/assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: myUserId, exhibitIds: [...pendingIds], table: 'student_exhibits' }),
    })
    setClassModalSaving(false)
    setShowClassModal(false)
    // 再読み込み
    window.location.reload()
  }

  const handleSave = async () => {
    if (!exhibitId) return
    setSaving(true)
    const payload = slots.map(s => ({ slotId: s.id, type: answers[s.id] ?? 'neutral' }))
    await fetch('/api/shift/preferences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: payload }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const byDate = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    ;(acc[s.date] ??= []).push(s)
    return acc
  }, {})

  if (loading) return (
    <PageLoader />
  )

  if (noExhibit) return (
    <div style={{ maxWidth:600 }}>
      <h1 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#1e293b', marginBottom:8 }}>シフトアンケート</h1>
      {isAdmin ? (
        <>
          <p style={{ color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13, marginBottom:16 }}>
            シフト参加クラスが設定されていません。
          </p>
          <button onClick={() => { setPendingIds(new Set()); setShowClassModal(true) }} style={{
            padding:'10px 20px', borderRadius:10, border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
            color:'#fff', fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
          }}>
            クラスを設定する
          </button>
          {showClassModal && <ClassModal
            allExhibits={allExhibits} pendingIds={pendingIds} setPendingIds={setPendingIds}
            saving={classModalSaving} onSave={handleSaveClass} onClose={() => setShowClassModal(false)}
          />}
        </>
      ) : (
        <p style={{ color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
          クラスが割り当てられていません。管理者に連絡してください。
        </p>
      )}
    </div>
  )

  return (
    <div style={{ maxWidth:700 }}>
      <NotificationBanner />
      <div style={{ marginBottom:24, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
            📝 シフトアンケート
          </h1>
          <p style={{ fontSize:13, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
            各時間帯の希望を選択してください。後から変更できます。
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => { setPendingIds(new Set(exhibits.map(e => e.id))); setShowClassModal(true) }} style={{
            padding:'7px 14px', borderRadius:8, border:'1px solid #fed7aa',
            background:'#fff8f0', color:'#FF6B00', fontSize:11, fontWeight:700,
            fontFamily:"'Kiwi Maru',serif", cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
          }}>
            クラスを変更
          </button>
        )}
      </div>

      {showClassModal && <ClassModal
        allExhibits={allExhibits} pendingIds={pendingIds} setPendingIds={setPendingIds}
        saving={classModalSaving} onSave={handleSaveClass} onClose={() => setShowClassModal(false)}
      />}

      {/* クラス選択（複数の場合） */}
      {exhibits.length > 1 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>
            クラスを選択
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {exhibits.map(ex => (
              <button key={ex.id} onClick={() => setExhibitId(ex.id)} style={{
                padding:'6px 16px', borderRadius:99, border:'none', cursor:'pointer',
                background: exhibitId === ex.id ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f1f5f9',
                color: exhibitId === ex.id ? '#fff' : '#64748b',
                fontWeight:700, fontSize:12, fontFamily:"'Kiwi Maru',serif",
                transition:'all 0.15s',
              }}>
                {ex.class_label ?? ex.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {slotLoading ? (
        <PageLoader />
      ) : slots.length === 0 ? (
        <div style={{ padding:'20px 0', color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
          コマが設定されていません。担当の先生にコマの設定を依頼してください。
        </div>
      ) : (
        <>
          {/* 凡例 */}
          <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
            {(Object.entries(PREF_CONFIG) as [PrefType, typeof PREF_CONFIG[PrefType]][]).map(([k, v]) => (
              <div key={k} style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'4px 12px', borderRadius:99,
                background:v.bg, border:`1px solid ${v.border}`,
                fontSize:11, color:v.color, fontFamily:"'Kiwi Maru',serif", fontWeight:700,
              }}>
                {k === 'want' ? '◎' : k === 'neutral' ? '△' : '✕'} {v.label}
              </div>
            ))}
          </div>

          {(['sat','sun'] as const).filter(d => byDate[d]?.length).map(date => (
            <div key={date} style={{
              background:'#fff', borderRadius:16, marginBottom:20,
              boxShadow:'0 1px 4px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9', overflow:'hidden',
            }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#1e293b' }}>
                {DATE_LABEL[date]}
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    <th style={{ padding:'10px 16px', textAlign:'left', fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontWeight:700, width:110 }}>時間</th>
                    {(Object.entries(PREF_CONFIG) as [PrefType, typeof PREF_CONFIG[PrefType]][]).map(([k, v]) => (
                      <th key={k} style={{ padding:'10px 8px', textAlign:'center', fontSize:11, color:v.color, fontFamily:"'Kiwi Maru',serif", fontWeight:700 }}>
                        {k === 'want' ? '◎' : k === 'neutral' ? '△' : '✕'}<br />{v.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byDate[date].map((slot, i) => {
                    const cur = answers[slot.id] ?? 'neutral'
                    return (
                      <tr key={slot.id} style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
                        <td style={{ padding:'12px 16px', fontFamily:"'Kaisei Decol',serif", fontSize:13, fontWeight:700, color:'#1e293b', whiteSpace:'nowrap' }}>
                          {slot.start_at.slice(0,5)}〜{slot.end_at.slice(0,5)}
                        </td>
                        {(['want','neutral','avoid'] as PrefType[]).map(type => {
                          const cfg = PREF_CONFIG[type]
                          const selected = cur === type
                          return (
                            <td key={type} style={{ padding:'8px', textAlign:'center' }}>
                              <button
                                onClick={() => setAnswers(prev => ({ ...prev, [slot.id]: type }))}
                                style={{
                                  width:40, height:40, borderRadius:'50%', border:'none', cursor:'pointer',
                                  background: selected ? cfg.bg : 'transparent',
                                  boxShadow: selected ? `0 0 0 2px ${cfg.border}` : '0 0 0 1.5px #e2e8f0',
                                  fontSize:16, transition:'all 0.15s',
                                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                                }}
                              >
                                <span style={{ fontSize:15, color: selected ? cfg.color : '#cbd5e1' }}>
                                  {type === 'want' ? '◎' : type === 'neutral' ? '△' : '✕'}
                                </span>
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

          <button onClick={handleSave} disabled={saving} style={{
            padding:'14px 40px', borderRadius:12, border:'none', cursor: saving ? 'default' : 'pointer',
            background: saved ? '#10b981' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
            color:'#fff', fontSize:15, fontWeight:700, fontFamily:"'Kaisei Decol',serif",
            boxShadow: saved ? 'none' : '0 4px 16px rgba(255,107,0,0.3)', transition:'all 0.2s',
          }}>
            {saving ? '保存中…' : saved ? '✓ 保存しました' : '回答を保存する'}
          </button>
        </>
      )}
    </div>
  )
}

function ClassModal({ allExhibits, pendingIds, setPendingIds, saving, onSave, onClose }: {
  allExhibits:    Exhibit[]
  pendingIds:     Set<string>
  setPendingIds:  (fn: (prev: Set<string>) => Set<string>) => void
  saving:         boolean
  onSave:         () => void
  onClose:        () => void
}) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:200,
      background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background:'#fff', borderRadius:20, padding:24, width:'100%', maxWidth:440,
        maxHeight:'80vh', display:'flex', flexDirection:'column',
      }}>
        <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:17, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
          シフト参加クラスを設定
        </div>
        <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:16 }}>
          アンケート・シフト閲覧で使用するクラスを選択
        </div>

        <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:4, marginBottom:16 }}>
          {allExhibits.map(ex => {
            const checked = pendingIds.has(ex.id)
            return (
              <div key={ex.id} onClick={() => setPendingIds(prev => {
                const next = new Set(prev)
                checked ? next.delete(ex.id) : next.add(ex.id)
                return next
              })} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 12px', borderRadius:10, cursor:'pointer',
                background: checked ? '#fff8f0' : '#fafafa',
                border: `1px solid ${checked ? '#fed7aa' : '#f1f5f9'}`,
                transition:'all 0.12s',
              }}>
                <div style={{
                  width:18, height:18, borderRadius:5, border:'2px solid',
                  borderColor: checked ? '#FF6B00' : '#cbd5e1',
                  background: checked ? '#FF6B00' : '#fff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:10, color:'#fff', flexShrink:0, transition:'all 0.12s',
                }}>
                  {checked ? '✓' : ''}
                </div>
                <span style={{ fontSize:13, fontWeight: checked ? 700 : 400, color: checked ? '#FF6B00' : '#475569', fontFamily:"'Kaisei Decol',serif" }}>
                  {ex.class_label ? `${ex.class_label} ` : ''}{ex.name}
                </span>
              </div>
            )
          })}
        </div>

        <div style={{ display:'flex', gap:10, flexShrink:0 }}>
          <button onClick={onClose} style={{
            flex:1, padding:'11px 0', borderRadius:10, border:'1px solid #e2e8f0',
            background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
            fontFamily:"'Kiwi Maru',serif", color:'#64748b',
          }}>キャンセル</button>
          <button onClick={onSave} disabled={saving} style={{
            flex:2, padding:'11px 0', borderRadius:10, border:'none',
            background: saving ? '#e2e8f0' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
            color: saving ? '#94a3b8' : '#fff',
            fontSize:13, fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily:"'Kiwi Maru',serif",
          }}>
            {saving ? '保存中…' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  )
}
