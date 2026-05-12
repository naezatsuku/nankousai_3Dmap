'use client'

import { useState, useEffect } from 'react'
import { isSubscribed, subscribeToExhibit, unsubscribeFromExhibit, getFCMToken } from '@/lib/push'

interface Props {
  exhibitId: string
  variant?: 'icon' | 'pill'
}

export default function NotifyButton({ exhibitId, variant = 'icon' }: Props) {
  const [on, setOn]           = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { setOn(isSubscribed(exhibitId)) }, [exhibitId])

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
    if (on) {
      await unsubscribeFromExhibit(exhibitId)
      setOn(false)
    } else {
      const ok = await subscribeToExhibit(exhibitId)
      if (ok) setOn(true)
    }
    setLoading(false)
  }

  if (variant === 'pill') {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          padding: '8px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: on ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f4f4f4',
          color: on ? '#fff' : '#888',
          fontSize: 13, fontWeight: 700, fontFamily: "'Kiwi Maru',serif",
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'background 0.2s, color 0.2s',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 15 }}>{loading ? '⏳' : on ? '🔔' : '🔕'}</span>
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
