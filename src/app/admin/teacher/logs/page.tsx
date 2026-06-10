'use client'

import PageLoader from '@/components/ui/PageLoader'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ACTION_LABELS, ACTION_ICONS } from '@/lib/activity-log'
import type { ActionType } from '@/lib/activity-log'

interface NotifySetting {
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

interface LogRow {
  id:          string
  exhibit_id:  string
  user_id:     string | null
  action_type: ActionType
  summary:     string | null
  created_at:  string
  exhibit:     { name: string; class_label: string | null } | null
  editor:      { name: string } | null
}

const ACTION_SETTING_KEY: Record<ActionType, keyof Omit<NotifySetting, 'exhibit_id'>> = {
  notice_posted:    'notify_notice_posted',
  notice_edited:    'notify_notice_edited',
  notice_rejected:  'notify_notice_rejected',
  content_edited:   'notify_content_edited',
  basic_edited:     'notify_basic_edited',
  wait_updated:     'notify_wait_updated',
  status_changed:   'notify_status_changed',
  sales_updated:    'notify_sales_updated',
}

function fmtDatetime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  const h    = Math.floor(min / 60)
  const d    = Math.floor(h / 24)
  if (d > 0)   return `${d}日前`
  if (h > 0)   return `${h}時間前`
  if (min > 0) return `${min}分前`
  return 'たった今'
}

const ALL_ACTIONS: ActionType[] = [
  'notice_posted', 'notice_edited', 'content_edited',
  'basic_edited', 'wait_updated', 'status_changed', 'sales_updated',
]

export default function TeacherLogsPage() {
  const router = useRouter()
  const [logs,          setLogs]          = useState<LogRow[]>([])
  const [settings,      setSettings]      = useState<NotifySetting[]>([])
  const [exhibitIds,    setExhibitIds]    = useState<string[]>([])
  const [loading,       setLoading]       = useState(true)
  const [filterType,    setFilterType]    = useState<ActionType | 'all'>('all')
  const [filterExhibit, setFilterExhibit] = useState<string>('all')
  const [showNotifyOnly, setShowNotifyOnly] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/admin/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const role = (profile as { role: string } | null)?.role
      if (role !== 'teacher' && role !== 'admin') {
        router.push('/admin'); return
      }

      // 担当展示一覧を取得
      const { data: assignments } = await supabase
        .from('exhibit_editors').select('exhibit_id').eq('user_id', user.id)
      const ids = (assignments ?? []).map((a: { exhibit_id: string }) => a.exhibit_id)
      setExhibitIds(ids)

      if (ids.length === 0) {
        setLoading(false); return
      }

      // 通知設定を取得（存在する分だけ）
      const { data: settingsData } = await supabase
        .from('teacher_notify_settings')
        .select('*')
        .eq('user_id', user.id)
        .in('exhibit_id', ids)
      setSettings((settingsData ?? []) as NotifySetting[])

      // 変更ログを取得（直近100件）
      const { data: logData } = await supabase
        .from('activity_logs')
        .select('id, exhibit_id, user_id, action_type, summary, created_at, exhibit:exhibits(name, class_label), editor:profiles(name)')
        .in('exhibit_id', ids)
        .order('created_at', { ascending: false })
        .limit(100)
      setLogs((logData ?? []) as unknown as LogRow[])
      setLoading(false)
    })
  }, [router])

  // 通知設定に一致するか（設定なし = デフォルト値で判断）
  const isNotified = (log: LogRow): boolean => {
    const s = settings.find(s => s.exhibit_id === log.exhibit_id)
    const key = ACTION_SETTING_KEY[log.action_type]
    if (!s) {
      // デフォルト値
      return ['notice_posted', 'content_edited', 'status_changed'].includes(log.action_type)
    }
    return s[key]
  }

  const filteredLogs = logs.filter(log => {
    if (filterExhibit !== 'all' && log.exhibit_id !== filterExhibit) return false
    if (filterType !== 'all' && log.action_type !== filterType) return false
    if (showNotifyOnly && !isNotified(log)) return false
    return true
  })

  // exhibit 一覧（フィルター用）
  const exhibitOptions = Array.from(
    new Map(logs.map(l => [l.exhibit_id, l.exhibit])).entries()
  )

  if (loading) return <PageLoader />

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily:"'Kaisei Decol',serif", fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
          変更ログ
        </h2>
        <div style={{ fontSize: 12, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
          担当クラスへの変更履歴を確認できます
        </div>
      </div>

      {/* フィルターバー */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '14px 16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
        marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
      }}>
        <select
          value={filterExhibit}
          onChange={e => setFilterExhibit(e.target.value)}
          style={{
            padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0',
            fontSize: 12, fontFamily:"'Kiwi Maru',serif", color: '#475569', background: '#fff',
          }}
        >
          <option value="all">すべてのクラス</option>
          {exhibitOptions.map(([id, ex]) => (
            <option key={id} value={id}>{ex?.class_label ?? ex?.name ?? id}</option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as ActionType | 'all')}
          style={{
            padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0',
            fontSize: 12, fontFamily:"'Kiwi Maru',serif", color: '#475569', background: '#fff',
          }}
        >
          <option value="all">すべての種類</option>
          {ALL_ACTIONS.map(a => (
            <option key={a} value={a}>{ACTION_ICONS[a]} {ACTION_LABELS[a]}</option>
          ))}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showNotifyOnly}
            onChange={e => setShowNotifyOnly(e.target.checked)}
            style={{ accentColor: '#FF8C00', width: 14, height: 14 }}
          />
          <span style={{ fontSize: 12, fontFamily:"'Kiwi Maru',serif", color: '#475569' }}>
            通知設定ONのみ
          </span>
        </label>

        <Link href="/admin/teacher/notify-settings" style={{
          marginLeft: 'auto', padding: '6px 14px', borderRadius: 8,
          background: 'linear-gradient(135deg,#FF6B00,#FFAA28)',
          color: '#fff', fontSize: 12, fontWeight: 700,
          fontFamily:"'Kiwi Maru',serif", textDecoration: 'none',
        }}>
          通知設定 →
        </Link>
      </div>

      {/* ログ一覧 */}
      {exhibitIds.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 16, padding: '40px 20px', textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
            担当クラスが設定されていません
          </div>
          <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4, fontFamily:"'Kiwi Maru',serif" }}>
            管理者に担当クラスの割り当てを依頼してください
          </div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 16, padding: '40px 20px', textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 14, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
            ログがありません
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredLogs.map(log => {
            const notified = isNotified(log)
            return (
              <div key={log.id} style={{
                background: '#fff', borderRadius: 12, padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                borderLeft: notified ? '3px solid #FF8C00' : '3px solid transparent',
              }}>
                {/* アイコン */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: notified ? 'rgba(255,107,0,0.1)' : '#f8fafc',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>
                  {ACTION_ICONS[log.action_type]}
                </div>

                {/* 本文 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                      background: notified ? 'rgba(255,107,0,0.1)' : '#f1f5f9',
                      color: notified ? '#FF8C00' : '#64748b',
                      fontFamily:"'Kiwi Maru',serif",
                    }}>
                      {ACTION_LABELS[log.action_type]}
                    </span>
                    {log.exhibit && (
                      <span style={{ fontSize: 11, color: '#0ea5e9', fontFamily:"'Kiwi Maru',serif", fontWeight: 700 }}>
                        {log.exhibit.class_label ?? log.exhibit.name}
                      </span>
                    )}
                    {notified && (
                      <span style={{ fontSize: 9, color: '#FF8C00', fontFamily:"'Kiwi Maru',serif" }}>
                        通知ON
                      </span>
                    )}
                  </div>

                  {log.summary && (
                    <div style={{ fontSize: 13, color: '#1e293b', fontFamily:"'Kiwi Maru',serif", marginBottom: 2 }}>
                      {log.summary}
                    </div>
                  )}

                  <div style={{ fontSize: 10, color: '#94a3b8', fontFamily:"'Kiwi Maru',serif", display: 'flex', gap: 8 }}>
                    <span>{log.editor?.name ?? '不明なユーザー'}</span>
                    <span title={new Date(log.created_at).toLocaleString('ja-JP')}>
                      {fmtDatetime(log.created_at)} ({relativeTime(log.created_at)})
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ページ下部メモ */}
      {filteredLogs.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 11, color: '#cbd5e1', fontFamily:"'Kiwi Maru',serif", textAlign: 'center' }}>
          直近 100 件を表示 · 通知設定で受け取る項目を変更できます
        </div>
      )}
    </div>
  )
}
