'use client'

import { useState, useEffect } from 'react'
import { getLocalSubs } from '@/lib/push'

interface Props {
  title:      string
  date:       'sat' | 'sun'
  startTime:  string
  endTime?:   string
  location?:  string
  exhibitId?: string
  color?:     string
  /** ボタンの文言（両日開催で土・日ボタンが並ぶときに区別する用） */
  label?:     string
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
  title, date, startTime, endTime, location, exhibitId, color = '#FF6B00', label = '予定に追加',
}: Props) {
  const [open,          setOpen]         = useState(false)
  const [notify,        setNotify]       = useState<number|null>(null)
  const [adding,        setAdding]       = useState(false)
  const [registered,    setRegistered]   = useState(false)
  const [itemId,        setItemId]       = useState<string|null>(null)
  const [deleting,      setDeleting]     = useState(false)
  const [alreadySubbed] = useState(() => {
    if (!exhibitId) return false
    try { return getLocalSubs().has(exhibitId) } catch { return false }
  })

  const getUserKey = () => {
    if (typeof window === 'undefined') return ''
    let k = localStorage.getItem('stamp_user_id')
    if (!k) { k = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2); localStorage.setItem('stamp_user_id', k) }
    return k
  }

  // マウント時に既存登録 & 通知購読を確認
  useEffect(() => {
    const userKey = getUserKey()
    if (!userKey) return
    fetch(`/api/schedule?date=${date}`, { headers: { 'x-user-key': userKey }, cache: 'no-store' })
      .then(r => r.json())
      .then(({ items }) => {
        const found = (items ?? []).find((i: { id: string; title: string; start_time: string; date: string }) =>
          i.title === title && i.date === date && i.start_time.slice(0,5) === startTime.slice(0,5)
        )
        if (found) { setRegistered(true); setItemId(found.id) }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    const userKey = getUserKey()
    if (!userKey) return
    setAdding(true)
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-key': userKey },
      body: JSON.stringify({
        title, date, start_time: startTime, end_time: endTime ?? null,
        location: location ?? null, exhibit_id: exhibitId ?? null,
        notify_minutes: notify, color, type: 'visit',
      }),
    })
    const { item } = await res.json() as { item?: { id: string } }
    setAdding(false)
    setRegistered(true)
    if (item?.id) setItemId(item.id)
    setOpen(false)
  }

  const handleDelete = async () => {
    if (!itemId) return
    const userKey = getUserKey()
    if (!userKey) return
    setDeleting(true)
    await fetch(`/api/schedule?id=${itemId}`, { method: 'DELETE', headers: { 'x-user-key': userKey } })
    setDeleting(false)
    setRegistered(false)
    setItemId(null)
  }

  // 購読由来で登録済み（手動削除不可）
  if (alreadySubbed && !registered) {
    return (
      <span style={{
        display:'inline-flex', alignItems:'center', gap:5,
        padding:'6px 12px', borderRadius:99,
        background:'#f0fdf4', boxShadow:'inset 0 0 0 1.5px #86efac',
        fontSize:12, fontWeight:700, color:'#16a34a', fontFamily:"'Kiwi Maru',serif",
      }}>
        📅 予定に追加済み
      </span>
    )
  }

  // 手動登録済みの場合
  if (registered) {
    return (
      <div style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:5,
          padding:'6px 12px', borderRadius:99,
          background:'#f0fdf4', boxShadow:'inset 0 0 0 1.5px #86efac',
          fontSize:12, fontWeight:700, color:'#16a34a', fontFamily:"'Kiwi Maru',serif",
        }}>
          ✓ 予定に登録済み
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="予定から削除"
          style={{
            width:24, height:24, borderRadius:'50%', border:'1px solid #fca5a5',
            background:'#fff', cursor: deleting ? 'default' : 'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:11, color:'#ef4444', flexShrink:0,
          }}
        >
          {deleting ? '…' : '✕'}
        </button>
      </div>
    )
  }

  // 未登録の場合
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display:'inline-flex', alignItems:'center', gap:5,
          padding:'7px 14px', borderRadius:99, border:'none', cursor:'pointer',
          background:'#f1f5f9', color:'#64748b',
          fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
          transition:'all 0.2s',
        }}
      >
        📅 {label}
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

            {alreadySubbed ? (
              <div style={{
                padding:'10px 14px', borderRadius:10, marginBottom:16,
                background:'#f0fdf4', border:'1px solid #86efac',
                fontSize:11, color:'#16a34a', fontFamily:"'Kiwi Maru',serif",
              }}>
                ✅ このクラスの通知がONのため、リマインダーは設定できません。<br />
                <span style={{ color:'#94a3b8' }}>お知らせが届いたときに通知が来ます。</span>
              </div>
            ) : (
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, fontFamily:"'Kiwi Maru',serif" }}>
                  🔔 開始リマインダー
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
            )}

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
