'use client'

import { useState } from 'react'
import { isSubscribed, subscribeToExhibit, unsubscribeFromExhibit, getFCMToken } from '@/lib/push'

interface Props {
  exhibitId: string
  exhibitType?: string
  variant?: 'icon' | 'pill'
}

export default function NotifyButton({ exhibitId, exhibitType, variant = 'icon' }: Props) {
  const [on, setOn]           = useState(() => isSubscribed(exhibitId))
  const [loading, setLoading] = useState(false)
  const [prevId, setPrevId]   = useState(exhibitId)

  if (prevId !== exhibitId) {
    setPrevId(exhibitId)
    setOn(isSubscribed(exhibitId))
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return

    if (typeof Notification === 'undefined') {
      alert('このブラウザは通知に対応していません')
      return
    }
    if (Notification.permission === 'denied') {
      alert('通知がブロックされています。ブラウザの設定から許可してください。')
      return
    }
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return
      await getFCMToken()
    }

    setLoading(true)
    try {
      if (on) {
        await unsubscribeFromExhibit(exhibitId)
        setOn(false)
      } else {
        await subscribeToExhibit(exhibitId, exhibitType)
        setOn(true)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '通知の設定に失敗しました')
    }
    setLoading(false)
  }

  if (variant === 'pill') {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: on ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f0f0f0',
          color: on ? '#fff' : '#888',
          fontSize: 12, fontWeight: 700, fontFamily: "'Kiwi Maru',serif",
          display: 'flex', alignItems: 'center', gap: 5,
          transition: 'background 0.2s, color 0.2s',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: 14 }}>{loading ? '⏳' : on ? '📅' : '🔕'}</span>
        <span>{on ? '通知ON' : '通知OFF'}</span>
      </button>
    )
  }

  // icon variant — circular floating button
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={on ? '通知をオフにする' : '通知をオンにする'}
      style={{
        width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: on
          ? 'linear-gradient(135deg,#FF6B00,#FFAA28)'
          : 'rgba(0,0,0,0.32)',
        backdropFilter: on ? 'none' : 'blur(6px)',
        WebkitBackdropFilter: on ? 'none' : 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, transition: 'background 0.2s',
      }}
    >
      {loading ? '⏳' : on ? '🔔' : '🔕'}
    </button>
  )
}
