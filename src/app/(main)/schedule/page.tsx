'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// ── 定数 ────────────────────────────────────────────────────────
const START_MIN = 8 * 60 + 30   // 8:30
const END_MIN   = 16 * 60 + 30  // 16:30
const TOTAL_MIN = END_MIN - START_MIN // 480分
const PX_PER_MIN = 2            // 1分 = 2px
const TIMELINE_H = TOTAL_MIN * PX_PER_MIN // 960px
const FESTIVAL_DATES: Record<'sat'|'sun', string> = {
  sat: '2025-09-13',
  sun: '2025-09-14',
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m ?? 0)
}
function minToY(min: number): number {
  return (min - START_MIN) * PX_PER_MIN
}
function fmtTime(t: string): string { return t.slice(0, 5) }

// ── 型 ────────────────────────────────────────────────────────
interface ScheduleItem {
  id:             string
  title:          string
  date:           'sat' | 'sun'
  start_time:     string
  end_time?:      string | null
  location?:      string | null
  exhibit_id?:    string | null
  notify_minutes?: number | null
  color:          string
  type:           'visit' | 'custom' | 'shift'
}

interface Column { item: ScheduleItem; col: number; totalCols: number }

// ── 重なり検出 → 列振り分け ─────────────────────────────────────
function layoutItems(items: ScheduleItem[]): Column[] {
  const sorted = [...items].sort((a, b) =>
    timeToMin(a.start_time) - timeToMin(b.start_time)
  )
  const cols: Column[] = []
  const active: Column[] = []

  for (const item of sorted) {
    const start = timeToMin(item.start_time)
    const end   = item.end_time ? timeToMin(item.end_time) : start + 60

    // 終わったものを除去
    const still = active.filter(c =>
      (c.item.end_time ? timeToMin(c.item.end_time) : timeToMin(c.item.start_time) + 60) > start
    )
    const usedCols = new Set(still.map(c => c.col))
    let col = 0
    while (usedCols.has(col)) col++

    const entry: Column = { item, col, totalCols: 1 }
    still.push(entry)
    active.length = 0
    active.push(...still)
    cols.push(entry)
  }

  // totalCols を同グループで揃える
  const maxCols = new Map<number, number>()
  for (const c of cols) {
    const key = timeToMin(c.item.start_time)
    maxCols.set(key, Math.max(maxCols.get(key) ?? 1, c.col + 1))
  }
  // 同時帯グループの totalCols を更新（簡易版：重なるもの同士）
  for (const c of cols) {
    const start = timeToMin(c.item.start_time)
    const end   = c.item.end_time ? timeToMin(c.item.end_time) : start + 60
    let maxCol = c.col
    for (const d of cols) {
      const ds = timeToMin(d.item.start_time)
      const de = d.item.end_time ? timeToMin(d.item.end_time) : ds + 60
      if (ds < end && de > start) maxCol = Math.max(maxCol, d.col)
    }
    c.totalCols = maxCol + 1
  }

  return cols
}

const NOTIFY_OPTIONS = [
  { label: 'なし',    value: null },
  { label: '5分前',  value: 5 },
  { label: '10分前', value: 10 },
  { label: '15分前', value: 15 },
  { label: '30分前', value: 30 },
  { label: '1時間前', value: 60 },
]

const TYPE_COLOR: Record<string, string> = {
  shift:  '#6366f1',
  visit:  '#FF6B00',
  custom: '#10b981',
}

// ── 通知スケジュール ────────────────────────────────────────────
function scheduleNotifications(items: ScheduleItem[], date: 'sat'|'sun') {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const festDate = FESTIVAL_DATES[date]
  for (const item of items) {
    if (!item.notify_minutes || item.date !== date) continue
    const [h, m] = item.start_time.split(':').map(Number)
    const notifyAt = new Date(`${festDate}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`)
    notifyAt.setMinutes(notifyAt.getMinutes() - item.notify_minutes)
    const ms = notifyAt.getTime() - Date.now()
    if (ms > 0 && ms < 12 * 60 * 60 * 1000) { // 12時間以内のもののみ
      setTimeout(() => {
        new Notification(`📅 ${item.notify_minutes}分後: ${item.title}`, {
          body: item.location ?? '',
          icon: '/nanpen.png',
        })
      }, ms)
    }
  }
}

// ── メインページ ─────────────────────────────────────────────
export default function SchedulePage() {
  const [date,       setDate]       = useState<'sat'|'sun'>('sat')
  const [items,      setItems]      = useState<ScheduleItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [userKey,    setUserKey]    = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [role,       setRole]       = useState('')
  const [myUserId,   setMyUserId]   = useState('')

  // 新規追加モーダル
  const [showAdd,  setShowAdd]  = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newStart, setNewStart] = useState('10:00')
  const [newEnd,   setNewEnd]   = useState('11:00')
  const [newLoc,   setNewLoc]   = useState('')
  const [newDate,  setNewDate]  = useState<'sat'|'sun'>('sat')
  const [newNotify,setNewNotify]= useState<number|null>(null)
  const [adding,   setAdding]   = useState(false)

  // 初期化
  useEffect(() => {
    const key = (() => {
      let k = localStorage.getItem('stamp_user_id')
      if (!k) { k = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2); localStorage.setItem('stamp_user_id', k) }
      return k
    })()
    setUserKey(key)

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setIsLoggedIn(true)
        setMyUserId(user.id)
        supabase.from('profiles').select('role').eq('id', user.id).single()
          .then(({ data }) => setRole((data as { role: string } | null)?.role ?? ''))
      }
    })
  }, [])

  const fetchItems = useCallback(async () => {
    if (!userKey) return
    setLoading(true)
    const res = await fetch(`/api/schedule`, {
      headers: { 'x-user-key': userKey },
      cache: 'no-store',
    })
    const { items: raw } = await res.json() as { items: ScheduleItem[] }
    let all = raw ?? []

    // ログイン済みユーザーのシフトを取得してマージ
    if (isLoggedIn && myUserId && role && role !== '') {
      const table = role === 'editor' ? 'exhibit_editors' : 'student_exhibits'
      const supabase = createClient()
      const { data: links } = await supabase
        .from(table).select('exhibit_id').eq('user_id', myUserId)
      const eids = ((links ?? []) as { exhibit_id: string }[]).map(l => l.exhibit_id)

      for (const eid of eids) {
        for (const d of ['sat', 'sun'] as const) {
          const sr = await fetch(`/api/shift/assignments?exhibitId=${eid}&date=${d}`, { cache: 'no-store' })
          if (!sr.ok) continue
          const { slots, assignments } = await sr.json() as {
            slots: { id: string; start_at: string; end_at: string }[]
            assignments: { slot_id: string; user_id: string }[]
          }
          const mySlotIds = new Set(
            assignments.filter(a => a.user_id === myUserId).map(a => a.slot_id)
          )
          for (const slot of slots) {
            if (!mySlotIds.has(slot.id)) continue
            all.push({
              id:         `shift-${slot.id}`,
              title:      'シフト当番',
              date:       d,
              start_time: slot.start_at.slice(0,5),
              end_time:   slot.end_at.slice(0,5),
              color:      TYPE_COLOR.shift,
              type:       'shift',
            })
          }
        }
      }
    }

    setItems(all)
    setLoading(false)
    scheduleNotifications(all, date)
  }, [userKey, isLoggedIn, myUserId, role, date])

  useEffect(() => {
    if (userKey) fetchItems()
  }, [userKey, fetchItems])

  const handleAdd = async () => {
    if (!newTitle.trim() || !userKey) return
    setAdding(true)
    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-key': userKey },
      body: JSON.stringify({
        title:          newTitle,
        date:           newDate,
        start_time:     newStart,
        end_time:       newEnd || null,
        location:       newLoc || null,
        notify_minutes: newNotify,
        color:          TYPE_COLOR.custom,
        type:           'custom',
      }),
    })
    setAdding(false); setShowAdd(false)
    setNewTitle(''); setNewStart('10:00'); setNewEnd('11:00'); setNewLoc(''); setNewNotify(null)
    fetchItems()
  }

  const handleDelete = async (id: string) => {
    if (id.startsWith('shift-')) return // シフトは削除不可
    await fetch(`/api/schedule?id=${id}`, {
      method: 'DELETE', headers: { 'x-user-key': userKey },
    })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const filtered = items.filter(i => i.date === date)
  const columns  = layoutItems(filtered)

  // 時間マーカー（30分ごと）
  const markers: string[] = []
  for (let m = START_MIN; m <= END_MIN; m += 30) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    markers.push(`${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`)
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .sch-item { transition: opacity 0.2s; }
        .sch-item:active { opacity: 0.75; }
      `}</style>

      <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#fff', overflow:'hidden' }}>

        {/* ── ヘッダー ── */}
        <div style={{
          padding:'12px 16px 10px', flexShrink:0,
          borderBottom:'1px solid #f1e8dc', background:'#fff',
          display:'flex', alignItems:'center', justifyContent:'space-between',
        }}>
          <div>
            <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:18, fontWeight:700, color:'#1e293b' }}>
              📅 予定
            </div>
            <div style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginTop:1 }}>
              当日のスケジュールを管理
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {/* 日付切替 */}
            <div style={{ display:'flex', gap:4 }}>
              {(['sat','sun'] as const).map(d => (
                <button key={d} onClick={() => setDate(d)} style={{
                  padding:'5px 14px', borderRadius:99, border:'none', cursor:'pointer',
                  background: date === d ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f1f5f9',
                  color: date === d ? '#fff' : '#64748b',
                  fontWeight:700, fontSize:11, fontFamily:"'Kiwi Maru',serif",
                }}>
                  {d === 'sat' ? '土' : '日'}
                </button>
              ))}
            </div>
            {/* 追加ボタン */}
            <button onClick={() => { setNewDate(date); setShowAdd(true) }} style={{
              width:32, height:32, borderRadius:'50%', border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
              color:'#fff', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 2px 8px rgba(255,107,0,0.3)',
            }}>+</button>
          </div>
        </div>

        {/* 凡例 */}
        <div style={{ padding:'6px 16px', display:'flex', gap:10, flexShrink:0, borderBottom:'1px solid #f8fafc' }}>
          {[
            { color: TYPE_COLOR.visit,  label: '訪問予定' },
            { color: TYPE_COLOR.custom, label: '自作' },
            ...(isLoggedIn && role !== '' ? [{ color: TYPE_COLOR.shift, label: 'シフト' }] : []),
          ].map(l => (
            <div key={l.label} style={{ display:'flex', alignItems:'center', gap:4 }}>
              <div style={{ width:10, height:10, borderRadius:3, background:l.color }} />
              <span style={{ fontSize:10, color:'#64748b', fontFamily:"'Kiwi Maru',serif" }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* ── タイムライン ── */}
        {loading ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
            読み込み中…
          </div>
        ) : (
          <div style={{ flex:1, overflowY:'auto', padding:'0 16px 24px' }}>
            <div style={{ position:'relative', marginTop:8 }}>

              {/* 時間軸マーカー */}
              {markers.map(t => (
                <div key={t} style={{
                  position:'absolute', left:0, width:'100%',
                  top: minToY(timeToMin(t)),
                  display:'flex', alignItems:'center', gap:8,
                  pointerEvents:'none',
                }}>
                  <span style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kaisei Decol',serif", width:38, textAlign:'right', flexShrink:0 }}>
                    {t}
                  </span>
                  <div style={{ flex:1, height:1, background: t.endsWith(':00') ? '#e2e8f0' : '#f8fafc' }} />
                </div>
              ))}

              {/* イベントカード */}
              <div style={{ marginLeft:46, position:'relative', height: TIMELINE_H }}>
                {filtered.length === 0 && (
                  <div style={{
                    position:'absolute', top:'30%', left:0, right:0,
                    textAlign:'center', color:'#cbd5e1',
                    fontFamily:"'Kiwi Maru',serif", fontSize:13, lineHeight:2,
                  }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
                    予定がありません<br />
                    <span style={{ fontSize:11 }}>＋ボタンから追加できます</span>
                  </div>
                )}

                {columns.map(({ item, col, totalCols }) => {
                  const top  = minToY(timeToMin(item.start_time))
                  const endM = item.end_time ? timeToMin(item.end_time) : timeToMin(item.start_time) + 60
                  const h    = Math.max((endM - timeToMin(item.start_time)) * PX_PER_MIN, 28)
                  const W    = `calc((100% - ${(totalCols - 1) * 4}px) / ${totalCols})`
                  const L    = col === 0 ? '0px' : `calc(${col} * (100% + 4px) / ${totalCols})`

                  return (
                    <div
                      key={item.id}
                      className="sch-item"
                      onClick={() => {
                        if (!item.id.startsWith('shift-') && window.confirm(`「${item.title}」を削除しますか？`)) {
                          handleDelete(item.id)
                        }
                      }}
                      style={{
                        position:'absolute', top, left:L, width:W, height:h,
                        borderRadius:8, padding:'4px 7px', overflow:'hidden',
                        background:`${item.color}22`,
                        borderLeft:`3px solid ${item.color}`,
                        cursor: item.type === 'shift' ? 'default' : 'pointer',
                        boxSizing:'border-box',
                        animation:'fadeUp 0.2s ease',
                      }}
                    >
                      <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:11, fontWeight:700, color: item.color, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {item.title}
                      </div>
                      {h > 40 && item.location && (
                        <div style={{ fontSize:9, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          📍 {item.location}
                        </div>
                      )}
                      {h > 52 && (
                        <div style={{ fontSize:9, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                          {fmtTime(item.start_time)}{item.end_time ? `〜${fmtTime(item.end_time)}` : ''}
                        </div>
                      )}
                      {item.notify_minutes && (
                        <div style={{ fontSize:9, color: item.color, position:'absolute', bottom:3, right:5 }}>🔔</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 新規追加モーダル ── */}
      {showAdd && (
        <div style={{
          position:'fixed', inset:0, zIndex:200,
          background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'flex-end', justifyContent:'center',
        }} onClick={() => setShowAdd(false)}>
          <div style={{
            width:'100%', maxWidth:520, background:'#fff',
            borderRadius:'20px 20px 0 0', padding:'24px 20px 40px',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:17, fontWeight:700, color:'#1e293b', marginBottom:16 }}>
              ＋ 予定を追加
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <Field label="タイトル *">
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  placeholder="例: お化け屋敷を見に行く" style={inputS} />
              </Field>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <Field label="日付">
                  <select value={newDate} onChange={e => setNewDate(e.target.value as 'sat'|'sun')} style={inputS}>
                    <option value="sat">土曜日</option>
                    <option value="sun">日曜日</option>
                  </select>
                </Field>
                <Field label="場所">
                  <input value={newLoc} onChange={e => setNewLoc(e.target.value)}
                    placeholder="例: 201教室" style={inputS} />
                </Field>
                <Field label="開始時刻">
                  <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} style={inputS} />
                </Field>
                <Field label="終了時刻">
                  <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} style={inputS} />
                </Field>
              </div>
              <Field label="🔔 通知">
                <select value={newNotify ?? ''} onChange={e => setNewNotify(e.target.value ? Number(e.target.value) : null)} style={inputS}>
                  {NOTIFY_OPTIONS.map(o => (
                    <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <button onClick={handleAdd} disabled={!newTitle.trim() || adding} style={{
              marginTop:20, width:'100%', padding:'13px', borderRadius:12, border:'none',
              cursor: newTitle.trim() ? 'pointer' : 'default',
              background: newTitle.trim() ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#e2e8f0',
              color: newTitle.trim() ? '#fff' : '#94a3b8',
              fontSize:15, fontWeight:700, fontFamily:"'Kaisei Decol',serif",
            }}>
              {adding ? '追加中…' : '追加する'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4, fontFamily:"'Kiwi Maru',serif" }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputS: React.CSSProperties = {
  width:'100%', padding:'9px 12px', borderRadius:8,
  border:'1px solid #e2e8f0', fontSize:13, color:'#1e293b',
  fontFamily:"'Kiwi Maru',serif", boxSizing:'border-box', background:'#fff',
}
