'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

export default function AddToScheduleButton({
  title, date, startTime, endTime, location, exhibitId, color = '#FF6B00', label = '予定に追加',
}: Props) {
  const router = useRouter()
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
    <button
      onClick={() => {
        const params = new URLSearchParams({ add: '1', title, date, start: startTime })
        if (endTime) params.set('end', endTime)
        if (location) params.set('location', location)
        if (exhibitId) params.set('exhibitId', exhibitId)
        router.push(`/schedule?${params.toString()}`)
      }}
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
  )
}
