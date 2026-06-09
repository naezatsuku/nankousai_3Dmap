import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAccessToken, sendFCM, parseSA } from '@/lib/fcm'
import type { ActionType } from '@/lib/activity-log'

const NOTIFY_KEY: Record<ActionType, string> = {
  notice_posted:  'notify_notice_posted',
  notice_edited:  'notify_notice_edited',
  content_edited: 'notify_content_edited',
  basic_edited:   'notify_basic_edited',
  wait_updated:   'notify_wait_updated',
  status_changed: 'notify_status_changed',
  sales_updated:  'notify_sales_updated',
}

// 設定がない場合にデフォルトでONとする種類
const DEFAULT_ON = new Set<ActionType>(['notice_posted', 'content_edited', 'status_changed'])

export async function POST(request: NextRequest) {
  const { exhibitId, actionType, summary, userId } = await request.json() as {
    exhibitId: string
    actionType: ActionType
    summary?: string
    userId?: string
  }
  if (!exhibitId || !actionType) {
    return NextResponse.json({ error: 'exhibitId and actionType required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // 1. 担当先生（role = teacher）の user_id を取得
  const { data: editors } = await supabase
    .from('exhibit_editors')
    .select('user_id, profiles!user_id(role)')
    .eq('exhibit_id', exhibitId)

  const teacherIds = ((editors ?? []) as unknown as Array<{ user_id: string; profiles: { role: string } | null }>)
    .filter(e => e.profiles?.role === 'teacher')
    .map(e => e.user_id)

  if (teacherIds.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  // 2. 通知設定を確認 → 通知すべき先生だけに絞る
  const notifyKey = NOTIFY_KEY[actionType]
  const { data: settings } = await supabase
    .from('teacher_notify_settings')
    .select(`user_id, ${notifyKey}`)
    .in('user_id', teacherIds)
    .eq('exhibit_id', exhibitId)

  const settingMap = new Map(
    ((settings ?? []) as unknown as Array<{ user_id: string } & Record<string, boolean>>)
      .map(s => [s.user_id, s[notifyKey]])
  )

  const targetIds = teacherIds.filter(uid => {
    if (!settingMap.has(uid)) return DEFAULT_ON.has(actionType)
    return settingMap.get(uid)
  })

  if (targetIds.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  // 3. 送信者の名前を取得
  let actorName = ''
  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single()
    actorName = (profile as { name: string } | null)?.name ?? ''
  }

  // 4. FCMトークンを取得（既存の push_subscriptions テーブルを使用）
  const { data: tokenRows } = await supabase
    .from('push_subscriptions')
    .select('fcm_token')
    .in('user_id', targetIds)

  const tokens = ((tokenRows ?? []) as Array<{ fcm_token: string }>).map(r => r.fcm_token)
  if (tokens.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  // 5. FCM 送信
  const sa = parseSA()
  const accessToken = await getAccessToken(sa)
  const title = actorName ? `${actorName} が更新しました` : '担当クラスが更新されました'
  const body  = summary ?? '管理画面で確認してください'

  let sent = 0
  await Promise.allSettled(
    tokens.map(async token => {
      const status = await sendFCM(accessToken, sa.project_id, token, title, body, '/nanpen.png')
      if (status >= 200 && status < 300) sent++
    })
  )

  return NextResponse.json({ ok: true, sent })
}
