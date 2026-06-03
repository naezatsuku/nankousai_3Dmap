'use client'

import { useState } from 'react'

interface Props {
  title:      string
  date:       'sat' | 'sun'
  startTime:  string          // "10:00"
  endTime?:   string          // "11:00"
  location?:  string
  exhibitId?: string
  color?:     string
}

const NOTIFY_OPTIONS = [
  { label: 'なし',    value: null },
  { label: '5分前',  value: 5 },
  { label: '10分前', value: 10 },
  { label: '15分前', value: 15 },
  { label: '30分前', value: 30 },
  { label: '1時間前', value: 60 },
]

export default function AddToScheduleButton({
  title, date, startTime, endTime, location, exhibitId, color = '#FF6B00',
}: Props) {
  const [open,    setOpen]    = useState(false)
  const [notify,  setNotify]  = useState<number|null>(null)
  const [adding,  setAdding]  = useState(false)
  const [done,    setDone]    = useState(false)

  const getUserKey = () => {
    if (typeof window === 'undefined') return ''
    let k = localStorage.getItem('stamp_user_id')
    if (!k) { k = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2); localStorage.setItem('stamp_user_id', k) }
    return k
  }

  const handleSave = async () => {
    const userKey = getUserKey()
    if (!userKey) return
    setAdding(true)
    await fetch('/api/schedule', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-key': userKey },
      body: JSON.stringify({
        title, date, start_time: startTime, end_time: endTime ?? null,
        location: location ?? null, exhibit_id: exhibitId ?? null,
        notify_minutes: notify, color, type: 'visit',
      }),
    })
    setAdding(false); setDone(true); setOpen(false)
    setTimeout(() => setDone(false), 3000)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display:'inline-flex', alignItems:'center', gap:5,
          padding:'7px 14px', borderRadius:99, border:'none', cursor:'pointer',
          background: done ? '#10b981' : '#f1f5f9',
          color: done ? '#fff' : '#64748b',
          fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
          transition:'all 0.2s',
        }}
      >
        {done ? '✓ 追加済み' : '📅 予定に追加'}
      </button>

      {open && (
        <div style={{
          position:'fixed', inset:0, zIndex:300,
          background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'flex-end', justifyContent:'center',
        }} onClick={() => setOpen(false)}>
          <div style={{
            width:'100%', maxWidth:480, background:'#fff',
            borderRadius:'20px 20px 0 0', padding:'24px 20px 40px',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:16, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
              📅 予定に追加
            </div>
            <div style={{ fontSize:13, color:'#64748b', fontFamily:"'Kiwi Maru',serif", marginBottom:16, lineHeight:1.6 }}>
              <strong>{title}</strong><br />
              {date === 'sat' ? '土曜日' : '日曜日'} {startTime}{endTime ? `〜${endTime}` : ''}
              {location && ` · ${location}`}
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, fontFamily:"'Kiwi Maru',serif" }}>
                🔔 通知タイミング
              </label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {NOTIFY_OPTIONS.map(o => (
                  <button key={String(o.value)} onClick={() => setNotify(o.value)} style={{
                    padding:'5px 12px', borderRadius:99, border:'none', cursor:'pointer',
                    background: notify === o.value ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f1f5f9',
                    color: notify === o.value ? '#fff' : '#64748b',
                    fontSize:11, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                  }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setOpen(false)} style={{
                flex:1, padding:'11px', borderRadius:10, border:'1px solid #e2e8f0',
                background:'#fff', fontSize:13, fontWeight:700,
                cursor:'pointer', fontFamily:"'Kiwi Maru',serif", color:'#64748b',
              }}>キャンセル</button>
              <button onClick={handleSave} disabled={adding} style={{
                flex:2, padding:'11px', borderRadius:10, border:'none',
                background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
                color:'#fff', fontSize:13, fontWeight:700,
                cursor:'pointer', fontFamily:"'Kaisei Decol',serif",
              }}>
                {adding ? '追加中…' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
