'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageLoader from '@/components/ui/PageLoader'
import NotificationBanner from '@/components/ui/NotificationBanner'

type PrefType = 'want' | 'neutral' | 'avoid'
interface Slot    { id: string; date: string; start_at: string; end_at: string; required_count: number; order_index: number }
interface Member  { user_id: string; profiles: { id: string; name: string } | null }
interface Assign  { slot_id: string; user_id: string }
interface PrefRow { user_id: string; slot_id: string; type: PrefType }

const DATE_LABEL: Record<string, string> = { sat: '土曜日', sun: '日曜日' }
const PREF_ICON:  Record<PrefType, string> = { want: '◎', neutral: '△', avoid: '✕' }
const PREF_COLOR: Record<PrefType, string> = { want: '#16a34a', neutral: '#94a3b8', avoid: '#dc2626' }

export default function ShiftEditPage() {
  const router = useRouter()
  const [exhibits,    setExhibits]    = useState<{ id: string; name: string; class_label: string | null }[]>([])
  const [exhibitId,   setExhibitId]   = useState<string | null>(null)
  const [myUserId,    setMyUserId]    = useState('')
  const [tab,         setTab]         = useState<'settings'|'survey'|'assign'>('settings')
  const [date,        setDate]        = useState<'sat'|'sun'>('sat')

  // 設定フォーム
  const [startTime,   setStartTime]   = useState('09:00')
  const [endTime,     setEndTime]     = useState('17:00')
  const [interval,    setInterval]    = useState(30)
  const [defRequired, setDefRequired] = useState(2)
  const [generating,  setGenerating]  = useState(false)
  const [genMsg,      setGenMsg]      = useState('')

  // コマ・メンバー・割当・アンケート
  const [slots,   setSlots]   = useState<Slot[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [assigns, setAssigns] = useState<Map<string, Set<string>>>(new Map())
  const [prefs,   setPrefs]   = useState<Map<string, PrefType>>(new Map()) // `userId:slotId`
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [autoMsg, setAutoMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [intervalWarn,    setIntervalWarn]    = useState(false)
  const [defRequiredWarn, setDefRequiredWarn] = useState(false)
  const [slotWarn,        setSlotWarn]        = useState<Record<string, boolean>>({})

  // メンバーピッカーモーダル
  const [pickerSlot,    setPickerSlot]    = useState<Slot | null>(null)
  const [pickerFilter,  setPickerFilter]  = useState<PrefType | 'all'>('all')
  // 割当済みメンバー一覧モーダル（オーバーフロー用）
  const [overflowSlot,  setOverflowSlot]  = useState<Slot | null>(null)

  const MAX_ASSIGN_AVATARS = 5

  const fetchSlotData = useCallback(async (eid: string, d: 'sat'|'sun') => {
    const nc = { cache: 'no-store' as const }
    const [slotsRes, assignRes, prefRes] = await Promise.all([
      fetch(`/api/shift/slots?exhibitId=${eid}&date=${d}`, nc).then(r => r.json()) as Promise<{ slots: Slot[] }>,
      fetch(`/api/shift/assignments?exhibitId=${eid}&date=${d}`, nc).then(r => r.json()) as Promise<{ slots: Slot[]; members: Member[]; assignments: Assign[] }>,
      fetch(`/api/shift/preferences?exhibitId=${eid}`, nc).then(r => r.json()) as Promise<{ preferences: PrefRow[] }>,
    ])

    setSlots(slotsRes.slots ?? [])
    setMembers(assignRes.members ?? [])

    console.log('[fetchSlotData] assignments:', assignRes.assignments)
    console.log('[fetchSlotData] members:', assignRes.members)

    const aMap = new Map<string, Set<string>>()
    for (const a of (assignRes.assignments ?? [])) {
      if (!aMap.has(a.slot_id)) aMap.set(a.slot_id, new Set())
      aMap.get(a.slot_id)!.add(a.user_id)
    }
    setAssigns(aMap)

    const pMap = new Map<string, PrefType>()
    for (const p of (prefRes.preferences ?? [])) {
      pMap.set(`${p.user_id}:${p.slot_id}`, p.type)
    }
    setPrefs(pMap)
  }, [])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      setMyUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const role = (profile as { role: string } | null)?.role
      if (role === 'student') { router.push('/admin/shift/view'); return }

      type ExhibitInfo = { id: string; name: string; class_label: string | null }
      type LinkRow = { exhibit_id: string; exhibits: ExhibitInfo | null }
      let exs: ExhibitInfo[] = []

      if (role === 'admin') {
        // admin: 全展示を取得（シフト管理はすべてのクラスを操作可能）
        const { data: allEx } = await supabase
          .from('exhibits')
          .select('id, name, class_label')
          .order('class_label', { nullsFirst: false })
        exs = (allEx ?? []) as ExhibitInfo[]
      } else {
        // editor: exhibit_editors
        const { data: links } = await supabase
          .from('exhibit_editors')
          .select('exhibit_id, exhibits(id, name, class_label)')
          .eq('user_id', user.id)
        exs = ((links ?? []) as unknown as LinkRow[])
          .map(l => l.exhibits).filter(Boolean) as ExhibitInfo[]
      }

      if (exs.length === 0) { setLoading(false); return }
      setExhibits(exs)
      const eid = exs[0].id
      setExhibitId(eid)

      // 既存設定があれば読込
      const settingsRes = await fetch(`/api/shift/settings?exhibitId=${eid}`)
      const { settings } = await settingsRes.json() as { settings: { date: string; start_time: string; end_time: string; interval_minutes: number; default_required: number }[] }
      const cur = settings.find(s => s.date === 'sat')
      if (cur) {
        setStartTime(cur.start_time.slice(0,5))
        setEndTime(cur.end_time.slice(0,5))
        setInterval(cur.interval_minutes)
        setDefRequired(cur.default_required)
      }

      await fetchSlotData(eid, 'sat')
      setLoading(false)
    }
    init()
  }, [router, fetchSlotData])

  useEffect(() => {
    if (!exhibitId) return
    // クラスが変わったら設定も再読み込み
    fetch(`/api/shift/settings?exhibitId=${exhibitId}`)
      .then(r => r.json())
      .then(({ settings }: { settings: { date: string; start_time: string; end_time: string; interval_minutes: number; default_required: number }[] }) => {
        const cur = settings.find(s => s.date === date)
        if (cur) {
          setStartTime(cur.start_time.slice(0,5))
          setEndTime(cur.end_time.slice(0,5))
          setInterval(cur.interval_minutes)
          setDefRequired(cur.default_required)
        }
      })
    const tid = setTimeout(() => fetchSlotData(exhibitId, date), 0)
    return () => clearTimeout(tid)
  }, [date, exhibitId, fetchSlotData])

  const handleGenerate = async () => {
    if (!exhibitId) return
    setGenerating(true); setGenMsg('')
    const res  = await fetch('/api/shift/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exhibitId, date, startTime, endTime, intervalMinutes: interval, defaultRequired: defRequired }),
    })
    const json = await res.json() as { ok: boolean; slotCount: number }
    setGenMsg(`✓ ${json.slotCount} コマを生成しました`)
    await fetchSlotData(exhibitId, date)
    setGenerating(false)
  }

  const toggleAssign = (slotId: string, userId: string) => {
    setAssigns(prev => {
      const next = new Map(prev)
      const set  = new Set(next.get(slotId) ?? [])
      set.has(userId) ? set.delete(userId) : set.add(userId)
      next.set(slotId, set)
      return next
    })
  }

  const handleSaveAssign = async () => {
    if (!exhibitId) return
    setSaving(true)
    const payload = slots.map(s => ({
      slotId:  s.id,
      userIds: [...(assigns.get(s.id) ?? [])],
    }))
    const res = await fetch('/api/shift/assignments', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exhibitId, date, assignments: payload }),
    })
    const json = await res.json() as { ok?: boolean; error?: string }
    if (!res.ok || !json.ok) {
      alert(`保存エラー: ${json.error ?? res.status}`)
      setSaving(false)
      return
    }
    // 保存後にデータ再読み込み
    await fetchSlotData(exhibitId, date)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleAutoAssign = async () => {
    if (!exhibitId) return
    setSaving(true); setAutoMsg('')
    const res  = await fetch('/api/shift/assignments/auto', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exhibitId, date }),
    })
    const json = await res.json() as {
      ok?: boolean; error?: string
      assigned?: number; warnings?: string[]
      overloaded?: { name: string; count: number }[]
      baseTarget?: number
    }
    if (!res.ok || !json.ok) {
      alert(`自動割当エラー: ${json.error ?? res.status}`)
      setSaving(false)
      return
    }
    await fetchSlotData(exhibitId, date)
    setSaving(false)

    const parts: string[] = [`✓ ${json.assigned ?? 0}件割当完了`]
    if ((json.warnings?.length ?? 0) > 0)
      parts.push(`⚠ 人数不足${json.warnings!.length}コマ`)
    if ((json.overloaded?.length ?? 0) > 0) {
      const names = json.overloaded!.map(o => `${o.name}(${o.count}コマ)`).join('・')
      parts.push(`📌 基準より多め: ${names}`)
    }
    setAutoMsg(parts.join('　'))
  }

  const handleSlotRequired = async (slotId: string, count: number) => {
    await fetch('/api/shift/slots', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, requiredCount: count }),
    })
    setSlots(prev => prev.map(s => s.id === slotId ? { ...s, required_count: count } : s))
  }

  if (loading) return (
    <PageLoader />
  )

  const currentExhibit = exhibits.find(e => e.id === exhibitId)

  const tabStyle = (t: string): React.CSSProperties => ({
    padding:'8px clamp(6px, 2vw, 18px)', borderRadius:99, border:'none', cursor:'pointer',
    background: tab === t ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f1f5f9',
    color: tab === t ? '#fff' : '#64748b',
    fontWeight:700, fontSize:12, fontFamily:"'Kiwi Maru',serif",
    whiteSpace:'nowrap', transition:'all 0.15s',
  })

  const cardStyle: React.CSSProperties = {
    background:'#fff', borderRadius:16, padding:20,
    boxShadow:'0 1px 4px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9', marginBottom:16,
  }

  return (
    <div style={{ maxWidth:1000 }}>
      <NotificationBanner />
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
          ✏ シフト編集
        </h1>
        <div style={{ fontSize:13, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
          {currentExhibit?.class_label ?? currentExhibit?.name}
        </div>
      </div>

      {/* クラス選択（複数の場合） */}
      {exhibits.length > 1 && (
        <div style={{ marginBottom:16, display:'flex', gap:6, flexWrap:'wrap' }}>
          {exhibits.map(ex => (
            <button key={ex.id} onClick={() => setExhibitId(ex.id)} style={{
              padding:'6px 16px', borderRadius:99, border:'none', cursor:'pointer',
              background: exhibitId === ex.id ? '#1e293b' : '#f1f5f9',
              color: exhibitId === ex.id ? '#fff' : '#64748b',
              fontWeight:700, fontSize:12, fontFamily:"'Kiwi Maru',serif", transition:'all 0.15s',
            }}>
              {ex.class_label ?? ex.name}
            </button>
          ))}
        </div>
      )}

      {/* タブ */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        <button style={tabStyle('settings')} onClick={() => setTab('settings')}>① 時間設定</button>
        <button style={tabStyle('survey')}   onClick={() => setTab('survey')}>② アンケート確認</button>
        <button style={tabStyle('assign')}   onClick={() => setTab('assign')}>③ シフト割当</button>
      </div>

      {/* 日付切替（設定以外） */}
      {tab !== 'settings' && (
        <div style={{ display:'flex', gap:6, marginBottom:16 }}>
          {(['sat','sun'] as const).map(d => (
            <button key={d} onClick={() => setDate(d)} style={{
              padding:'6px 16px', borderRadius:99, border:'none', cursor:'pointer',
              background: date === d ? '#1e293b' : '#f1f5f9',
              color: date === d ? '#fff' : '#64748b',
              fontWeight:700, fontSize:11, fontFamily:"'Kiwi Maru',serif",
            }}>
              {d === 'sat' ? '土曜' : '日曜'}
            </button>
          ))}
        </div>
      )}

      {/* ── タブ①: 時間設定 ── */}
      {tab === 'settings' && (
        <>
          <div style={{ display:'flex', gap:6, marginBottom:16 }}>
            {(['sat','sun'] as const).map(d => (
              <button key={d} onClick={() => setDate(d)} style={{
                padding:'6px 16px', borderRadius:99, border:'none', cursor:'pointer',
                background: date === d ? '#1e293b' : '#f1f5f9',
                color: date === d ? '#fff' : '#64748b',
                fontWeight:700, fontSize:11, fontFamily:"'Kiwi Maru',serif",
              }}>
                {DATE_LABEL[d]}
              </button>
            ))}
          </div>
          <div style={cardStyle}>
            <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700, color:'#1e293b', marginBottom:16 }}>
              {DATE_LABEL[date]} の設定
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:16 }}>
              {/* 開始・終了を横並び */}
              <div style={{ display:'flex', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <Field label="開始時刻">
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} />
                  </Field>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <Field label="終了時刻">
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
                  </Field>
                </div>
              </div>
              {/* コマ長さ・必要人数を横並び */}
              <div style={{ display:'flex', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <Field label="コマの長さ（分）">
                    <input type="text" inputMode="numeric" value={interval}
                      onChange={e => {
                        const v = e.target.value
                        if (/[^\x00-\x7F]/.test(v)) { setIntervalWarn(true); return }
                        setIntervalWarn(false)
                        if (!/^\d*$/.test(v)) return
                        setInterval(Number(v))
                      }}
                      style={inputStyle} />
                    {intervalWarn && (
                      <div style={{ fontSize:11, color:'#ef4444', fontFamily:"'Kiwi Maru',serif", marginTop:4 }}>半角数字で入力してください</div>
                    )}
                  </Field>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <Field label="必要人数（一括）">
                    <input type="text" inputMode="numeric" value={defRequired}
                      onChange={e => {
                        const v = e.target.value
                        if (/[^\x00-\x7F]/.test(v)) { setDefRequiredWarn(true); return }
                        setDefRequiredWarn(false)
                        if (!/^\d*$/.test(v)) return
                        setDefRequired(Number(v))
                      }}
                      style={inputStyle} />
                    {defRequiredWarn && (
                      <div style={{ fontSize:11, color:'#ef4444', fontFamily:"'Kiwi Maru',serif", marginTop:4 }}>半角数字で入力してください</div>
                    )}
                  </Field>
                </div>
              </div>
            </div>
            <button onClick={handleGenerate} disabled={generating} style={{
              padding:'10px 24px', borderRadius:10, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#6366f1,#818cf8)',
              color:'#fff', fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
            }}>
              {generating ? '生成中…' : 'コマを生成する'}
            </button>
            {genMsg && <div style={{ marginTop:10, fontSize:12, color:'#10b981', fontFamily:"'Kiwi Maru',serif" }}>{genMsg}</div>}
          </div>

          {/* コマごと必要人数 */}
          {slots.filter(s => s.date === date).length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700, color:'#1e293b', marginBottom:14 }}>
                コマごとの必要人数（個別上書き）
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {slots.filter(s => s.date === date).map(slot => (
                  <div key={slot.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ flex:1, fontFamily:"'Kaisei Decol',serif", fontSize:13, fontWeight:700, color:'#1e293b', whiteSpace:'nowrap' }}>
                      {slot.start_at.slice(0,5)}〜{slot.end_at.slice(0,5)}
                    </span>
                    <div>
                      <input
                        type="text" inputMode="numeric" value={slot.required_count}
                        onChange={e => {
                          const v = e.target.value
                          if (/[^\x00-\x7F]/.test(v)) { setSlotWarn(w => ({ ...w, [slot.id]: true })); return }
                          setSlotWarn(w => ({ ...w, [slot.id]: false }))
                          if (!/^\d*$/.test(v)) return
                          handleSlotRequired(slot.id, Number(v))
                        }}
                        style={{ ...inputStyle, width:72, textAlign:'center' }}
                      />
                      {slotWarn[slot.id] && (
                        <div style={{ fontSize:10, color:'#ef4444', fontFamily:"'Kiwi Maru',serif", marginTop:2 }}>半角数字で入力</div>
                      )}
                    </div>
                    <span style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", flexShrink:0 }}>人</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── タブ②: アンケート確認 ── */}
      {tab === 'survey' && (
        <div style={cardStyle}>
          {members.length === 0 ? (
            <div style={{ color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
              メンバーが登録されていません。
            </div>
          ) : slots.filter(s => s.date === date).length === 0 ? (
            <div style={{ color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
              コマが設定されていません。先に「時間設定」でコマを生成してください。
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>時間</th>
                    {members.map(m => (
                      <th key={m.user_id} style={thStyle}>{m.profiles?.name ?? '?'}</th>
                    ))}
                    <th style={thStyle}>◎</th>
                    <th style={thStyle}>✕</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.filter(s => s.date === date).map((slot, i) => {
                    const wantCount  = members.filter(m => prefs.get(`${m.user_id}:${slot.id}`) === 'want').length
                    const avoidCount = members.filter(m => prefs.get(`${m.user_id}:${slot.id}`) === 'avoid').length
                    return (
                      <tr key={slot.id} style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
                        <td style={tdStyle}>{slot.start_at.slice(0,5)}〜{slot.end_at.slice(0,5)}</td>
                        {members.map(m => {
                          const pref = prefs.get(`${m.user_id}:${slot.id}`) ?? 'neutral'
                          return (
                            <td key={m.user_id} style={{ ...tdStyle, textAlign:'center', background:
                              pref === 'want' ? '#f0fdf4' : pref === 'avoid' ? '#fef2f2' : '#fff' }}>
                              <span style={{ fontSize:15, color: PREF_COLOR[pref] }}>
                                {PREF_ICON[pref]}
                              </span>
                            </td>
                          )
                        })}
                        <td style={{ ...tdStyle, textAlign:'center', fontWeight:700, color:'#16a34a', fontFamily:"'Kaisei Decol',serif" }}>{wantCount}</td>
                        <td style={{ ...tdStyle, textAlign:'center', fontWeight:700, color:'#dc2626', fontFamily:"'Kaisei Decol',serif" }}>{avoidCount}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── タブ③: シフト割当 ── */}
      {tab === 'assign' && (
        <>
          <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
            <button onClick={handleAutoAssign} disabled={saving} style={{
              padding:'10px 20px', borderRadius:10, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#6366f1,#818cf8)',
              color:'#fff', fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
            }}>
              🤖 自動割当
            </button>
            <button onClick={handleSaveAssign} disabled={saving} style={{
              padding:'10px 20px', borderRadius:10, border:'none', cursor:'pointer',
              background: saved ? '#10b981' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
              color:'#fff', fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
            }}>
              {saving ? '保存中…' : saved ? '✓ 保存しました' : '💾 割当を保存'}
            </button>
            {autoMsg && (
              <div style={{
                padding:'8px 14px', borderRadius:10, marginTop:4,
                background: autoMsg.includes('⚠') || autoMsg.includes('📌') ? '#fffbeb' : '#f0fdf4',
                border: `1px solid ${autoMsg.includes('⚠') || autoMsg.includes('📌') ? '#fde68a' : '#86efac'}`,
                fontSize:12, color:'#374151', fontFamily:"'Kiwi Maru',serif", lineHeight:1.7,
                whiteSpace:'pre-wrap',
              }}>
                {autoMsg.split('　').map((line, i) => <div key={i}>{line}</div>)}
              </div>
            )}
          </div>

          {members.length === 0 || slots.filter(s => s.date === date).length === 0 ? (
            <div style={{ color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
              コマまたはメンバーが設定されていません。
            </div>
          ) : (
            <>
              <style>{`
                @media (min-width: 640px) {
                  .assign-cards { display: none !important; }
                }
                @media (max-width: 639px) {
                  .assign-table { display: none !important; }
                }
              `}</style>

              {/* ── デスクトップ: テーブル ── */}
              <table className="assign-table" style={{ borderCollapse:'collapse', width:'100%', maxWidth:700 }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width:120 }}>時間</th>
                    <th style={thStyle}>割当メンバー</th>
                    <th style={{ ...thStyle, width:70, textAlign:'center' }}>人数</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.filter(s => s.date === date).map((slot, i) => {
                    const slotAssigns  = assigns.get(slot.id) ?? new Set()
                    const filled       = slotAssigns.size
                    const short        = filled < slot.required_count
                    const assignedList = members.filter(m => slotAssigns.has(m.user_id))
                    return (
                      <tr key={slot.id} style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
                        <td style={{ ...tdStyle, verticalAlign:'middle', whiteSpace:'nowrap' }}>
                          {slot.start_at.slice(0,5)}〜{slot.end_at.slice(0,5)}
                        </td>
                        <td style={{ padding:'8px 10px', border:'1px solid #f1f5f9', verticalAlign:'middle' }}>
                          <AvatarRow slot={slot} assignedList={assignedList} prefs={prefs}
                            maxAvatars={MAX_ASSIGN_AVATARS}
                            onToggle={uid => toggleAssign(slot.id, uid)}
                            onOverflow={() => setOverflowSlot(slot)}
                            onAdd={() => { setPickerSlot(slot); setPickerFilter('all') }} />
                        </td>
                        <td style={{ ...tdStyle, textAlign:'center', fontWeight:700, fontFamily:"'Kaisei Decol',serif", color: short ? '#dc2626' : '#16a34a', background: short ? '#fef2f2' : '#f0fdf4', verticalAlign:'middle' }}>
                          {filled}/{slot.required_count}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* ── モバイル: カードリスト（2段） ── */}
              <div className="assign-cards" style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {slots.filter(s => s.date === date).map(slot => {
                  const slotAssigns  = assigns.get(slot.id) ?? new Set()
                  const filled       = slotAssigns.size
                  const short        = filled < slot.required_count
                  const assignedList = members.filter(m => slotAssigns.has(m.user_id))
                  return (
                    <div key={slot.id} style={{
                      background:'#fff', borderRadius:12,
                      border: short ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                      overflow:'hidden',
                    }}>
                      {/* 1段目: 時間 + 人数 */}
                      <div style={{
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'8px 12px',
                        background: short ? '#fef2f2' : '#f8fafc',
                        borderBottom:'1px solid #f1f5f9',
                      }}>
                        <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:13, fontWeight:700, color:'#1e293b' }}>
                          {slot.start_at.slice(0,5)}〜{slot.end_at.slice(0,5)}
                        </span>
                        <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:13, fontWeight:700, color: short ? '#dc2626' : '#16a34a' }}>
                          {filled}/{slot.required_count}人
                        </span>
                      </div>
                      {/* 2段目: アバター（横幅フル） */}
                      <div style={{ padding:'8px 12px' }}>
                        <AvatarRow slot={slot} assignedList={assignedList} prefs={prefs}
                          maxAvatars={MAX_ASSIGN_AVATARS}
                          onToggle={uid => toggleAssign(slot.id, uid)}
                          onOverflow={() => setOverflowSlot(slot)}
                          onAdd={() => { setPickerSlot(slot); setPickerFilter('all') }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* メンバーピッカーモーダル */}
              {pickerSlot && (() => {
                const slotAssigns = assigns.get(pickerSlot.id) ?? new Set()
                // 各メンバーのこの日の割当済みコマ数
                const assignedCount = new Map<string, number>()
                for (const s of slots.filter(s => s.date === date)) {
                  for (const uid of (assigns.get(s.id) ?? [])) {
                    assignedCount.set(uid, (assignedCount.get(uid) ?? 0) + 1)
                  }
                }
                const filtered = members.filter(m => {
                  if (pickerFilter === 'all') return true
                  return (prefs.get(`${m.user_id}:${pickerSlot.id}`) ?? 'neutral') === pickerFilter
                }).sort((a, b) =>
                  (a.profiles?.name ?? '').localeCompare(b.profiles?.name ?? '', 'ja')
                )
                return (
                  <div style={{
                    position:'fixed', inset:0, zIndex:200,
                    background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)',
                    display:'flex', alignItems:'center', justifyContent:'center', padding:20,
                  }} onClick={() => setPickerSlot(null)}>
                    <div style={{
                      background:'#fff', borderRadius:20, padding:24,
                      width:'100%', maxWidth:400, maxHeight:'80vh', display:'flex', flexDirection:'column',
                    }} onClick={e => e.stopPropagation()}>
                      <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:16, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
                        {pickerSlot.start_at.slice(0,5)}〜{pickerSlot.end_at.slice(0,5)} に割り当てる
                      </div>

                      {/* フィルタータブ */}
                      <div style={{ display:'flex', gap:5, marginBottom:14, flexWrap:'wrap' }}>
                        {([
                          { key:'all',     label:'すべて' },
                          { key:'want',    label:'◎入りたい' },
                          { key:'neutral', label:'△どちらでも' },
                          { key:'avoid',   label:'✕入れない' },
                        ] as { key: PrefType | 'all'; label: string }[]).map(f => (
                          <button key={f.key} onClick={() => setPickerFilter(f.key)} style={{
                            padding:'4px 10px', borderRadius:99, border:'none', cursor:'pointer',
                            background: pickerFilter === f.key ? '#1e293b' : '#f1f5f9',
                            color: pickerFilter === f.key ? '#fff' : '#64748b',
                            fontSize:11, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                            whiteSpace:'nowrap',
                          }}>{f.label}</button>
                        ))}
                      </div>

                      <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                        {filtered.map(m => {
                          const inSlot  = slotAssigns.has(m.user_id)
                          const pref    = prefs.get(`${m.user_id}:${pickerSlot.id}`) ?? 'neutral'
                          const cnt     = assignedCount.get(m.user_id) ?? 0
                          return (
                            <div key={m.user_id} onClick={() => toggleAssign(pickerSlot.id, m.user_id)} style={{
                              display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                              borderRadius:10, cursor:'pointer', transition:'all 0.12s',
                              background: inSlot ? '#f0fdf4' : '#fafafa',
                              border: `1px solid ${inSlot ? '#86efac' : '#f1f5f9'}`,
                            }}>
                              <div style={{
                                width:20, height:20, borderRadius:5, border:'2px solid',
                                borderColor: inSlot ? '#10b981' : '#cbd5e1',
                                background: inSlot ? '#10b981' : '#fff',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:11, color:'#fff', flexShrink:0,
                              }}>{inSlot ? '✓' : ''}</div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:13, fontWeight: inSlot ? 700 : 400, color: inSlot ? '#16a34a' : '#1e293b' }}>
                                  {m.profiles?.name ?? '?'}
                                </span>
                                {cnt > 0 && (
                                  <span style={{ marginLeft:6, fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                                    すでに{cnt}コマ
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize:14, color: PREF_COLOR[pref], fontWeight:700, flexShrink:0 }}>
                                {PREF_ICON[pref]}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      <button onClick={() => setPickerSlot(null)} style={{
                        marginTop:14, width:'100%', padding:'11px', borderRadius:10, border:'none',
                        background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
                        color:'#fff', fontSize:13, fontWeight:700,
                        cursor:'pointer', fontFamily:"'Kaisei Decol',serif",
                      }}>完了</button>
                    </div>
                  </div>
                )
              })()}
            </>
          )}
          <div style={{ marginTop:12, fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
            アバターをタップで解除 / ＋で追加。右下の小アイコンはアンケート回答（◎△✕）。
          </div>
        </>
      )}

      {/* オーバーフロー：割当済み全員モーダル */}
      {overflowSlot && (() => {
        const slotAssigns  = assigns.get(overflowSlot.id) ?? new Set()
        const assignedList = members.filter(m => slotAssigns.has(m.user_id))
        return (
          <div style={{
            position:'fixed', inset:0, zIndex:200,
            background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:20,
          }} onClick={() => setOverflowSlot(null)}>
            <div style={{
              background:'#fff', borderRadius:20, padding:24,
              width:'100%', maxWidth:360, maxHeight:'75vh', display:'flex', flexDirection:'column',
            }} onClick={e => e.stopPropagation()}>
              <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:16, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
                {overflowSlot.start_at.slice(0,5)}〜{overflowSlot.end_at.slice(0,5)} の割当メンバー
              </div>
              <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:14 }}>
                タップで解除
              </div>
              <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                {assignedList.map(m => {
                  const pref = prefs.get(`${m.user_id}:${overflowSlot.id}`) ?? 'neutral'
                  const name = m.profiles?.name ?? '?'
                  return (
                    <div key={m.user_id} onClick={() => { toggleAssign(overflowSlot.id, m.user_id); setOverflowSlot(null) }} style={{
                      display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                      borderRadius:10, cursor:'pointer', background:'#f0fdf4',
                      border:'1px solid #86efac',
                    }}>
                      <div style={{
                        width:30, height:30, borderRadius:'50%', background:'#10b981', flexShrink:0,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:13, fontWeight:700, color:'#fff',
                      }}>{name[0]}</div>
                      <span style={{ flex:1, fontFamily:"'Kiwi Maru',serif", fontSize:13, color:'#1e293b' }}>{name}</span>
                      <span style={{ fontSize:14, color: PREF_COLOR[pref] }}>{PREF_ICON[pref]}</span>
                      <span style={{ fontSize:11, color:'#94a3b8' }}>✕ 解除</span>
                    </div>
                  )
                })}
              </div>
              <button onClick={() => setOverflowSlot(null)} style={{
                marginTop:14, width:'100%', padding:'11px', borderRadius:10, border:'none',
                background:'#f1f5f9', color:'#64748b', fontSize:13, fontWeight:700,
                cursor:'pointer', fontFamily:"'Kiwi Maru',serif",
              }}>閉じる</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width:'100%', minWidth:0, padding:'9px 12px', borderRadius:8,
  border:'1px solid #e2e8f0', background:'#fff',
  fontSize:13, color:'#1e293b', fontFamily:"'Kiwi Maru',serif", boxSizing:'border-box',
}
const thStyle: React.CSSProperties = {
  padding:'10px 12px', background:'#f8fafc', border:'1px solid #e2e8f0',
  fontFamily:"'Kiwi Maru',serif", fontSize:11, color:'#64748b', fontWeight:700,
  textAlign:'left', whiteSpace:'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding:'10px 12px', border:'1px solid #f1f5f9',
  fontFamily:"'Kaisei Decol',serif", fontSize:13, fontWeight:700, color:'#1e293b', whiteSpace:'nowrap',
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, fontFamily:"'Kiwi Maru',serif" }}>
        {label}
      </label>
      {children}
    </div>
  )
}

type PrefType2 = 'want' | 'neutral' | 'avoid'
const PREF_COLOR2: Record<PrefType2, string> = { want:'#16a34a', neutral:'#94a3b8', avoid:'#dc2626' }
const PREF_ICON2:  Record<PrefType2, string> = { want:'◎', neutral:'△', avoid:'✕' }

function AvatarRow({ slot, assignedList, prefs, maxAvatars, onToggle, onOverflow, onAdd }: {
  slot:         { id: string }
  assignedList: { user_id: string; profiles: { id: string; name: string } | null }[]
  prefs:        Map<string, PrefType2>
  maxAvatars:   number
  onToggle:     (uid: string) => void
  onOverflow:   () => void
  onAdd:        () => void
}) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
      {assignedList.slice(0, maxAvatars).map(m => {
        const pref = prefs.get(`${m.user_id}:${slot.id}`) ?? 'neutral'
        const name = m.profiles?.name ?? '?'
        return (
          <div key={m.user_id} onClick={() => onToggle(m.user_id)}
            title={`${name} — タップで解除`}
            style={{
              width:30, height:30, borderRadius:'50%', flexShrink:0,
              background:'#10b981', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:12, fontWeight:700, color:'#fff', position:'relative',
            }}
          >
            {name[0]}
            <span style={{
              position:'absolute', bottom:-2, right:-2,
              fontSize:8, background:'#fff', borderRadius:'50%',
              width:12, height:12, display:'flex', alignItems:'center', justifyContent:'center',
              color: PREF_COLOR2[pref as PrefType2], lineHeight:1,
            }}>
              {PREF_ICON2[pref as PrefType2]}
            </span>
          </div>
        )
      })}
      {assignedList.length > maxAvatars && (
        <button onClick={onOverflow} style={{
          width:30, height:30, borderRadius:'50%', flexShrink:0,
          background:'#f1f5f9', border:'none', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:10, fontWeight:700, color:'#64748b',
        }}>
          +{assignedList.length - maxAvatars}
        </button>
      )}
      <button onClick={onAdd} style={{
        width:28, height:28, borderRadius:'50%', border:'2px dashed #cbd5e1',
        background:'#f8fafc', cursor:'pointer', color:'#94a3b8',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:18, lineHeight:1, flexShrink:0,
      }}>+</button>
    </div>
  )
}
