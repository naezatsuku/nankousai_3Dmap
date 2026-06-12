'use client'

import { useState } from 'react'
import { getFCMToken, getStoredToken, unsubscribeFromGlobal } from '@/lib/push'

type PushState = 'unsupported' | 'denied' | 'off' | 'on'

function detectPushState(): PushState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return getStoredToken() ? 'on' : 'off'
}

export default function NotificationBanner() {
  const [pushState,  setPushState]  = useState<PushState>(detectPushState)
  const [working,    setWorking]    = useState(false)
  const [collapsed,  setCollapsed]  = useState(false)

  const enablePush = async () => {
    setWorking(true)
    try {
      await getFCMToken()
      setPushState('on')
      setCollapsed(false)
    } catch {
      if (Notification.permission === 'denied') setPushState('denied')
    } finally {
      setWorking(false)
    }
  }

  const disablePush = async () => {
    setWorking(true)
    try {
      await unsubscribeFromGlobal()
      localStorage.removeItem('fcm_token')
      setPushState('off')
    } finally {
      setWorking(false)
    }
  }

  if (pushState === 'unsupported') return null

  // ── 通知ON: コンパクトバー ──────────────────────────────────────
  if (pushState === 'on') {
    return (
      <div className="notification-banner" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: '#f0fdf4',
        borderBottom: '1px solid #bbf7d0', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: '#16a34a', fontFamily: "'Kiwi Maru',serif", display: 'flex', alignItems: 'center', gap: 4 }}>
          🔔 プッシュ通知 ON
        </span>
        <button
          onClick={disablePush}
          disabled={working}
          style={{
            fontSize: 11, color: '#64748b', background: 'none', border: '1px solid #cbd5e1',
            borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontFamily: "'Kiwi Maru',serif",
          }}
        >
          OFFにする
        </button>
      </div>
    )
  }

  // ── 通知DENIED: 警告バー ─────────────────────────────────────────
  if (pushState === 'denied') {
    if (collapsed) return (
      <div className="notification-banner" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: '#fef9c3',
        borderBottom: '1px solid #fde047', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: '#854d0e', fontFamily: "'Kiwi Maru',serif" }}>
          🔕 通知がブロックされています
        </span>
        <button onClick={() => setCollapsed(false)} style={{ fontSize: 11, color: '#854d0e', background: 'none', border: 'none', cursor: 'pointer' }}>
          詳細
        </button>
      </div>
    )
    return (
      <div className="notification-banner" style={{
        padding: '12px 16px', background: '#fef9c3',
        borderBottom: '1px solid #fde047', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#854d0e', fontFamily: "'Kiwi Maru',serif" }}>
            🔕 通知がブロックされています
          </span>
          <button onClick={() => setCollapsed(true)} style={{ fontSize: 16, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>
            ×
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#713f12', marginTop: 4, fontFamily: "'Kiwi Maru',serif" }}>
          ブラウザの設定から通知を「許可」に変更してください。
        </div>
      </div>
    )
  }

  // ── 通知OFF: プロンプトバナー ────────────────────────────────────
  if (collapsed) {
    return (
      <div className="notification-banner" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: '#fff7ed',
        borderBottom: '1px solid #fed7aa', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: '#9a3412', fontFamily: "'Kiwi Maru',serif" }}>
          🔕 通知OFF
        </span>
        <button
          onClick={enablePush}
          disabled={working}
          style={{
            fontSize: 11, color: '#fff', background: '#FF8C00',
            border: 'none', borderRadius: 6, padding: '3px 10px',
            cursor: 'pointer', fontFamily: "'Kiwi Maru',serif",
          }}
        >
          {working ? '...' : 'ONにする'}
        </button>
      </div>
    )
  }

  return (
    <div className="notification-banner" style={{
      padding: '12px 16px', background: '#fff7ed',
      borderBottom: '2px solid #FF8C00', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#c2410c', fontFamily: "'Kiwi Maru',serif" }}>
          🔔 通知をONにしませんか？
        </span>
        <button
          onClick={() => setCollapsed(true)}
          style={{ fontSize: 16, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 12, color: '#7c3019', marginTop: 4, marginBottom: 10, fontFamily: "'Kiwi Maru',serif" }}>
        イベント開始前にプッシュ通知を受け取れます。
      </div>
      <button
        onClick={enablePush}
        disabled={working}
        style={{
          fontSize: 13, color: '#fff', background: '#FF8C00',
          border: 'none', borderRadius: 8, padding: '7px 18px',
          cursor: 'pointer', fontWeight: 600, fontFamily: "'Kiwi Maru',serif",
          opacity: working ? 0.7 : 1,
        }}
      >
        {working ? '設定中...' : '通知をONにする'}
      </button>
    </div>
  )
}
