'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getFCMToken, subscribeToExhibit, unsubscribeFromExhibit, getLocalSubs,
  isGlobalOn, subscribeToGlobal, unsubscribeFromGlobal,
} from '@/lib/push'

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
  const [exhibits, setExhibits]     = useState<ExhibitItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [subs, setSubs]             = useState<Set<string>>(new Set())
  const [perm, setPerm]             = useState<string>('default')
  const [toggling, setToggling]     = useState<string | null>(null)
  const [globalOn, setGlobalOn]     = useState(true)
  const [globalBusy, setGlobalBusy] = useState(false)
  const [subError, setSubError]     = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setPerm(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
    setSubs(getLocalSubs())
    setGlobalOn(isGlobalOn())

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

  // 許可リクエスト。付与された場合 true を返す
  const requestPerm = async (): Promise<boolean> => {
    const p = await Notification.requestPermission()
    setPerm(p)
    if (p === 'granted') {
      try {
        await getFCMToken()
        setGlobalOn(true)
      } catch (err) {
        setSubError(err instanceof Error ? err.message : '通知トークンの取得に失敗しました')
      }
    }
    return p === 'granted'
  }

  const handleGlobalToggle = async () => {
    setSubError(null)
    if (perm !== 'granted') {
      await requestPerm()
      return
    }
    setGlobalBusy(true)
    try {
      if (globalOn) {
        await unsubscribeFromGlobal()
        setGlobalOn(false)
      } else {
        await subscribeToGlobal()
        setGlobalOn(true)
      }
    } catch (err) {
      setSubError(err instanceof Error ? err.message : '操作に失敗しました')
    }
    setGlobalBusy(false)
  }

  const handleToggle = async (exhibitId: string) => {
    setSubError(null)
    if (perm !== 'granted') {
      const granted = await requestPerm()
      if (!granted) return
    }
    setToggling(exhibitId)
    try {
      if (subs.has(exhibitId)) {
        await unsubscribeFromExhibit(exhibitId)
      } else {
        await subscribeToExhibit(exhibitId)
      }
    } catch (err) {
      setSubError(err instanceof Error ? err.message : '購読の登録に失敗しました')
    }
    setSubs(getLocalSubs())
    setToggling(null)
  }

  const permGranted = perm === 'granted'

  return (
    <div style={{ padding: '16px 16px 32px' }}>
      <h1 style={{
        fontFamily: "'Kaisei Decol',serif", fontSize: 20, fontWeight: 700,
        color: '#1a1a1a', marginBottom: 4,
      }}>
        通知設定
      </h1>
      <p style={{ fontSize: 11, color: '#999', fontFamily: "'Kiwi Maru',serif", marginBottom: subError ? 12 : 24 }}>
        お知らせや催しの開始前に通知が届きます
      </p>

      {/* エラー表示 */}
      {subError && (
        <div style={{
          marginBottom: 20, padding: '10px 14px', borderRadius: 12,
          background: '#fff1f1', border: '1px solid #fca5a5',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
          <p style={{ fontSize: 12, color: '#b91c1c', fontFamily: "'Kiwi Maru',serif", margin: 0, lineHeight: 1.6 }}>
            {subError}
          </p>
          <button onClick={() => setSubError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: 16, flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* ── 全体のお知らせ ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", marginBottom: 10, letterSpacing: '0.05em' }}>
          全体のお知らせ
        </div>

        <div style={{
          padding: '14px 16px', borderRadius: 16,
          background: permGranted && globalOn
            ? 'linear-gradient(135deg,rgba(255,107,0,0.06),rgba(255,170,40,0.06))'
            : '#f8f9fa',
          border: permGranted && globalOn
            ? '1px solid rgba(255,140,0,0.25)'
            : '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', gap: 14,
          transition: 'background 0.3s, border-color 0.3s',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: permGranted && globalOn
              ? 'linear-gradient(135deg,#FF6B00,#FFAA28)'
              : '#e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, transition: 'background 0.3s',
          }}>
            📢
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 700,
              color: permGranted && globalOn ? '#1a1a1a' : '#94a3b8',
              fontFamily: "'Kaisei Decol',serif", marginBottom: 2,
            }}>
              南高祭 公式アナウンス
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>
              {permGranted
                ? globalOn ? '緊急連絡・全体お知らせが届きます' : '現在オフにしています'
                : '通知を許可すると受け取れます'}
            </div>
          </div>

          {/* トグルボタン */}
          <button
            onClick={perm === 'denied' || perm === 'unsupported' ? undefined : handleGlobalToggle}
            disabled={globalBusy || perm === 'denied' || perm === 'unsupported'}
            style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 99, border: 'none',
              cursor: (perm === 'denied' || perm === 'unsupported') ? 'default' : 'pointer',
              background: permGranted && globalOn
                ? 'linear-gradient(135deg,#FF6B00,#FFAA28)'
                : '#f0f0f0',
              color: permGranted && globalOn ? '#fff' : '#999',
              fontSize: 12, fontWeight: 700, fontFamily: "'Kiwi Maru',serif",
              transition: 'background 0.2s',
              minWidth: 72, textAlign: 'center',
            }}
          >
            {globalBusy
              ? '…'
              : perm === 'denied'
              ? 'ブロック中'
              : perm === 'unsupported'
              ? '非対応'
              : !permGranted
              ? '許可する'
              : globalOn ? '🔔 ON' : '🔕 OFF'}
          </button>
        </div>

        {perm === 'denied' && (
          <p style={{ fontSize: 11, color: '#ef4444', marginTop: 8, padding: '0 4px', fontFamily: "'Kiwi Maru',serif" }}>
            通知がブロックされています。ブラウザの設定から許可してください。
          </p>
        )}
        {perm === 'unsupported' && (
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, padding: '0 4px', fontFamily: "'Kiwi Maru',serif" }}>
            このブラウザは通知に対応していません。
          </p>
        )}
      </div>

      {/* ── 団体ごとの通知 ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", marginBottom: 10, letterSpacing: '0.05em' }}>
          団体ごとの通知
        </div>
        <p style={{ fontSize: 11, color: '#aaa', fontFamily: "'Kiwi Maru',serif", marginBottom: 12 }}>
          催しが始まる30分前に通知が届きます
        </p>

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
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    overflow: 'hidden', background: 'linear-gradient(135deg,#FFD166,#FF8C00)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>
                    {ex.thumbnail_url
                      ? <img src={ex.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : '🎨'}
                  </div>

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
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}