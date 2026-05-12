'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFCMToken, subscribeToExhibit, unsubscribeFromExhibit, getLocalSubs } from '@/lib/push'

interface ExhibitItem {
  id:            string
  name:          string
  class_label:   string | null
  type:          string
  thumbnail_url: string | null
}

const TYPE_LABEL: Record<string, string> = {
  class: '展示', food: 'フード', band: '軽音楽部', special: 'スペシャル', cafeteria: '食堂',
}

export default function NotificationsPage() {
  const [exhibits, setExhibits]   = useState<ExhibitItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [subs, setSubs]           = useState<Set<string>>(new Set())
  const [perm, setPerm]           = useState<string>('default')
  const [toggling, setToggling]   = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setPerm(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
    setSubs(getLocalSubs())

    const supabase = createClient()
    supabase
      .from('exhibits')
      .select('id, name, class_label, type, thumbnail_url')
      .eq('is_active', true)
      .order('class_label', { nullsFirst: false })
      .then(({ data }) => {
        if (data) setExhibits(data as ExhibitItem[])
        setLoading(false)
      })
  }, [])

  const requestPerm = async () => {
    const p = await Notification.requestPermission()
    setPerm(p)
    if (p === 'granted') await getFCMToken()
  }

  const handleToggle = async (exhibitId: string) => {
    if (perm !== 'granted') {
      await requestPerm()
      if (Notification.permission !== 'granted') return
    }
    setToggling(exhibitId)
    if (subs.has(exhibitId)) {
      await unsubscribeFromExhibit(exhibitId)
    } else {
      await subscribeToExhibit(exhibitId)
    }
    setSubs(getLocalSubs())
    setToggling(null)
  }

  return (
    <div style={{ padding: '16px 16px 24px' }}>
      <h1 style={{
        fontFamily: "'Kaisei Decol',serif", fontSize: 20, fontWeight: 700,
        color: '#1a1a1a', marginBottom: 4,
      }}>
        通知設定
      </h1>
      <p style={{ fontSize: 11, color: '#999', fontFamily: "'Kiwi Maru',serif", marginBottom: 20 }}>
        催しが始まる30分前に通知が届きます
      </p>

      {/* 権限バナー */}
      {perm === 'default' && (
        <div style={{
          marginBottom: 20, padding: 16, borderRadius: 14,
          background: '#FFF8F0', border: '1px solid rgba(255,140,0,0.2)',
        }}>
          <p style={{ fontSize: 13, color: '#b36000', fontFamily: "'Kiwi Maru',serif", marginBottom: 12 }}>
            通知を受け取るには許可が必要です
          </p>
          <button onClick={requestPerm} style={{
            padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#FF6B00,#FFAA28)',
            color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: "'Kiwi Maru',serif",
          }}>
            通知を許可する
          </button>
        </div>
      )}

      {perm === 'denied' && (
        <div style={{
          marginBottom: 20, padding: 16, borderRadius: 14,
          background: '#FFF0F0', border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <p style={{ fontSize: 13, color: '#b91c1c', fontFamily: "'Kiwi Maru',serif" }}>
            通知がブロックされています。ブラウザの設定から許可してください。
          </p>
        </div>
      )}

      {perm === 'unsupported' && (
        <div style={{
          marginBottom: 20, padding: 16, borderRadius: 14,
          background: '#f8f9fa', border: '1px solid #e2e8f0',
        }}>
          <p style={{ fontSize: 13, color: '#64748b', fontFamily: "'Kiwi Maru',serif" }}>
            このブラウザは通知に対応していません。
          </p>
        </div>
      )}

      {/* 団体一覧 */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              height: 64, borderRadius: 14, background: '#f8f8f8',
              animation: 'pulse 1.5s ease infinite',
            }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {exhibits.map(ex => {
            const on = subs.has(ex.id)
            return (
              <div key={ex.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 14, background: '#fff',
                border: on ? '1px solid rgba(255,140,0,0.3)' : '1px solid #f0f0f0',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                transition: 'border-color 0.2s',
              }}>
                {/* サムネイル */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  overflow: 'hidden', background: 'linear-gradient(135deg,#FFD166,#FF8C00)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>
                  {ex.thumbnail_url
                    ? <img src={ex.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : '🎨'}
                </div>

                {/* テキスト */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: '#1a1a1a',
                    fontFamily: "'Kaisei Decol',serif",
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    marginBottom: 2,
                  }}>
                    {ex.class_label && (
                      <span style={{ fontSize: 11, color: '#aaa', marginRight: 6 }}>{ex.class_label}</span>
                    )}
                    {ex.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', fontFamily: "'Kiwi Maru',serif" }}>
                    {TYPE_LABEL[ex.type] ?? ex.type}
                  </div>
                </div>

                {/* トグル */}
                <button
                  onClick={() => handleToggle(ex.id)}
                  disabled={toggling === ex.id || perm === 'denied' || perm === 'unsupported'}
                  style={{
                    flexShrink: 0, padding: '6px 14px', borderRadius: 99, border: 'none',
                    cursor: (perm === 'denied' || perm === 'unsupported') ? 'default' : 'pointer',
                    background: on ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f0f0f0',
                    color: on ? '#fff' : '#999',
                    fontSize: 12, fontWeight: 700, fontFamily: "'Kiwi Maru',serif",
                    transition: 'background 0.2s',
                    minWidth: 72, textAlign: 'center',
                  }}
                >
                  {toggling === ex.id ? '…' : on ? '🔔 ON' : '🔕 OFF'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}
