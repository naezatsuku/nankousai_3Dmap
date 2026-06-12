'use client'

import PageLoader from '@/components/ui/PageLoader'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getFCMToken, getStoredToken } from '@/lib/push'
import { ACTION_LABELS, ACTION_ICONS } from '@/lib/activity-log'
import type { ActionType } from '@/lib/activity-log'

interface Exhibit { id: string; name: string; class_label: string | null }

interface Setting {
  exhibit_id:              string
  notify_notice_posted:    boolean
  notify_notice_edited:    boolean
  notify_notice_rejected:  boolean
  notify_content_edited:   boolean
  notify_basic_edited:     boolean
  notify_wait_updated:     boolean
  notify_status_changed:   boolean
  notify_sales_updated:    boolean
}

type SettingKey = keyof Omit<Setting, 'exhibit_id'>

const SETTING_ROWS: { key: SettingKey; action: ActionType; description: string }[] = [
  { key:'notify_notice_posted',    action:'notice_posted',    description:'新しいお知らせが投稿されたとき' },
  { key:'notify_notice_edited',    action:'notice_edited',    description:'既存のお知らせが編集されたとき' },
  { key:'notify_notice_rejected',  action:'notice_rejected',  description:'投稿したお知らせが管理者に却下されたとき' },
  { key:'notify_content_edited',   action:'content_edited',   description:'詳細ページのコンテンツが編集されたとき' },
  { key:'notify_basic_edited',     action:'basic_edited',     description:'展示名・説明など基本情報が変更されたとき' },
  { key:'notify_wait_updated',     action:'wait_updated',     description:'待ち時間・来場者数が更新されたとき' },
  { key:'notify_status_changed',   action:'status_changed',   description:'公開 / 非公開の状態が変わったとき' },
  { key:'notify_sales_updated',    action:'sales_updated',    description:'フード販売数が変わったとき' },
]

const DEFAULT_SETTING = (exhibitId: string): Setting => ({
  exhibit_id:              exhibitId,
  notify_notice_posted:    true,
  notify_notice_edited:    false,
  notify_notice_rejected:  true,
  notify_content_edited:   true,
  notify_basic_edited:     false,
  notify_wait_updated:     false,
  notify_status_changed:   true,
  notify_sales_updated:    false,
})

export default function TeacherNotifySettingsPage() {
  const router  = useRouter()
  const [userId,    setUserId]    = useState<string | null>(null)
  const [exhibits,  setExhibits]  = useState<Exhibit[]>([])
  const [settings,  setSettings]  = useState<Record<string, Setting>>({})
  const [loading,   setLoading]   = useState(true)
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set()) // exhibit_id
  const [savedKeys,  setSavedKeys]  = useState<Set<string>>(new Set())

  // プッシュ通知状態
  type PushState = 'checking' | 'unsupported' | 'denied' | 'off' | 'on'
  const [pushState,  setPushState]  = useState<PushState>('checking')
  const [pushWorking, setPushWorking] = useState(false)

  // プッシュ通知の現在の状態を確認
  useEffect(() => {
    const id = setTimeout(() => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setPushState('unsupported'); return
      }
      if (Notification.permission === 'denied') { setPushState('denied'); return }
      // 既存の push.ts が localStorage['fcm_token'] を管理している
      setPushState(getStoredToken() ? 'on' : 'off')
    }, 0)
    return () => clearTimeout(id)
  }, [])

  const enablePush = async () => {
    setPushWorking(true)
    try {
      // 既存の getFCMToken() がトークン取得・push_subscriptions への保存を担う
      await getFCMToken()
      setPushState('on')
    } catch (err) {
      if (Notification.permission === 'denied') setPushState('denied')
      else alert(err instanceof Error ? err.message : '通知の設定に失敗しました')
    } finally {
      setPushWorking(false)
    }
  }

  const disablePush = async () => {
    setPushWorking(true)
    try {
      const token = getStoredToken()
      if (token) {
        // push_subscriptions から削除
        const supabase = createClient()
        await supabase.from('push_subscriptions').delete().eq('fcm_token', token)
        localStorage.removeItem('fcm_token')
      }
      setPushState('off')
    } finally {
      setPushWorking(false)
    }
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/admin/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const role = (profile as { role: string } | null)?.role
      if (role !== 'teacher' && role !== 'admin') {
        router.push('/admin'); return
      }

      // 担当展示を取得
      const { data: assignments } = await supabase
        .from('exhibit_editors').select('exhibit_id').eq('user_id', user.id)
      const ids = (assignments ?? []).map((a: { exhibit_id: string }) => a.exhibit_id)

      if (ids.length === 0) { setLoading(false); return }

      const { data: exhibitData } = await supabase
        .from('exhibits').select('id, name, class_label').in('id', ids).order('class_label')
      setExhibits((exhibitData ?? []) as Exhibit[])

      // 既存の通知設定を取得
      const { data: settingsData } = await supabase
        .from('teacher_notify_settings')
        .select('*')
        .eq('user_id', user.id)
        .in('exhibit_id', ids)

      const map: Record<string, Setting> = {}
      for (const id of ids) {
        const existing = (settingsData ?? []).find((s: Setting) => s.exhibit_id === id)
        map[id] = existing ? (existing as Setting) : DEFAULT_SETTING(id)
      }
      setSettings(map)
      setLoading(false)
    })
  }, [router])

  const toggle = useCallback((exhibitId: string, key: SettingKey, currentUserId: string) => {
    setSettings(prev => {
      const next = { ...prev, [exhibitId]: { ...prev[exhibitId], [key]: !prev[exhibitId][key] } }
      void (async () => {
        setSavingKeys(s => new Set(s).add(exhibitId))
        const supabase = createClient()
        await supabase
          .from('teacher_notify_settings')
          .upsert({ ...next[exhibitId], user_id: currentUserId, exhibit_id: exhibitId })
        setSavingKeys(s => { const ns = new Set(s); ns.delete(exhibitId); return ns })
        setSavedKeys(s => new Set(s).add(exhibitId))
        setTimeout(() => setSavedKeys(s => { const ns = new Set(s); ns.delete(exhibitId); return ns }), 1500)
      })()
      return next
    })
  }, [])

  if (loading) return <PageLoader />

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h2 style={{ fontFamily:"'Kaisei Decol',serif", fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>
            通知設定
          </h2>
          <Link href="/admin/teacher/logs" style={{
            fontSize: 11, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif",
            textDecoration: 'none', padding: '3px 10px', borderRadius: 99,
            border: '1px solid #e2e8f0', background: '#f8fafc',
          }}>
            ← ログを見る
          </Link>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
          変更ログページで「通知ON」として表示する項目を展示ごとに設定します
        </div>
      </div>

      {/* ── プッシュ通知カード ── */}
      {pushState !== 'checking' && (
        <div style={{
          background: '#fff', borderRadius: 16, padding: '16px 20px', marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: pushState === 'on' ? 'rgba(255,107,0,0.1)' : '#f8fafc',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>
            {pushState === 'on' ? '🔔' : pushState === 'denied' ? '🔕' : '🔕'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>
              ブラウザのプッシュ通知
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
              {pushState === 'on'
                ? 'このブラウザに通知を送ります。設定ONの項目が更新されると届きます。'
                : pushState === 'denied'
                ? 'ブラウザで通知がブロックされています。ブラウザの設定から許可してください。'
                : pushState === 'unsupported'
                ? 'このブラウザはプッシュ通知に対応していません。'
                : '有効にすると、設定ONの項目が更新されたとき通知が届きます。'}
            </div>
          </div>
          {pushState === 'off' && (
            <button onClick={enablePush} disabled={pushWorking} style={{
              padding: '8px 18px', borderRadius: 10, border: 'none', flexShrink: 0,
              background: pushWorking ? '#e2e8f0' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
              color: pushWorking ? '#94a3b8' : '#fff',
              fontWeight: 700, fontSize: 12, cursor: pushWorking ? 'not-allowed' : 'pointer',
              fontFamily:"'Kiwi Maru',serif",
            }}>
              {pushWorking ? '設定中…' : '有効にする'}
            </button>
          )}
          {pushState === 'on' && (
            <button onClick={disablePush} disabled={pushWorking} style={{
              padding: '8px 18px', borderRadius: 10, flexShrink: 0,
              border: '1px solid #e2e8f0', background: '#fff',
              color: '#64748b', fontWeight: 700, fontSize: 12,
              cursor: pushWorking ? 'not-allowed' : 'pointer',
              fontFamily:"'Kiwi Maru',serif",
            }}>
              {pushWorking ? '解除中…' : '無効にする'}
            </button>
          )}
        </div>
      )}

      {exhibits.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 16, padding: '40px 20px', textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔔</div>
          <div style={{ fontSize: 14, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
            担当クラスが設定されていません
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {exhibits.map(ex => {
            const s = settings[ex.id]
            if (!s) return null
            const enabledCount = SETTING_ROWS.filter(r => s[r.key]).length

            return (
              <div key={ex.id} style={{
                background: '#fff', borderRadius: 16,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
                overflow: 'hidden',
              }}>
                {/* ヘッダー */}
                <div style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#fafafa',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                      {ex.class_label ?? ex.name}
                    </div>
                    {ex.class_label && (
                      <div style={{ fontSize: 11, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>{ex.name}</div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11, padding: '2px 10px', borderRadius: 99,
                    background: enabledCount > 0 ? 'rgba(255,107,0,0.1)' : '#f1f5f9',
                    color: enabledCount > 0 ? '#FF8C00' : '#94a3b8',
                    fontFamily:"'Kiwi Maru',serif", fontWeight: 700,
                  }}>
                    {enabledCount}件 ON
                  </span>
                  {savingKeys.has(ex.id) && (
                    <span style={{ fontSize: 11, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>保存中…</span>
                  )}
                  {!savingKeys.has(ex.id) && savedKeys.has(ex.id) && (
                    <span style={{ fontSize: 11, color: '#10b981', fontFamily:"'Kiwi Maru',serif" }}>✓ 保存済み</span>
                  )}
                </div>

                {/* 設定行 */}
                <div style={{ padding: '8px 20px' }}>
                  {SETTING_ROWS.map(row => {
                    const isOn = s[row.key]
                    return (
                      <div key={row.key} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 0',
                        borderBottom: '1px solid #f8fafc',
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: isOn ? 'rgba(255,107,0,0.1)' : '#f8fafc',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16,
                        }}>
                          {ACTION_ICONS[row.action]}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 700, color: '#1e293b',
                            fontFamily:"'Kiwi Maru',serif",
                          }}>
                            {ACTION_LABELS[row.action]}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                            {row.description}
                          </div>
                        </div>
                        {/* トグル */}
                        <button
                          onClick={() => userId && toggle(ex.id, row.key, userId)}
                          style={{
                            width: 44, height: 24, borderRadius: 99, border: 'none',
                            cursor: 'pointer', flexShrink: 0, position: 'relative',
                            background: isOn ? '#FF8C00' : '#e2e8f0',
                            transition: 'background 0.2s',
                          }}
                          aria-label={isOn ? 'オフにする' : 'オンにする'}
                        >
                          <span style={{
                            position: 'absolute', top: 3,
                            left: isOn ? 23 : 3,
                            width: 18, height: 18, borderRadius: '50%',
                            background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            transition: 'left 0.2s',
                          }} />
                        </button>
                      </div>
                    )
                  })}
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
