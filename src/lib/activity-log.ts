import { createClient } from '@/lib/supabase/client'

export type ActionType =
  | 'notice_posted'
  | 'notice_edited'
  | 'content_edited'
  | 'basic_edited'
  | 'wait_updated'
  | 'status_changed'
  | 'sales_updated'

export const ACTION_LABELS: Record<ActionType, string> = {
  notice_posted:  'お知らせを投稿',
  notice_edited:  'お知らせを編集',
  content_edited: '詳細コンテンツを編集',
  basic_edited:   '基本情報を編集',
  wait_updated:   '待ち時間・来場者数を更新',
  status_changed: '公開状態を変更',
  sales_updated:  '販売数を更新',
}

export const ACTION_ICONS: Record<ActionType, string> = {
  notice_posted:  '🔔',
  notice_edited:  '🔔',
  content_edited: '📖',
  basic_edited:   '📝',
  wait_updated:   '⏱',
  status_changed: '🔄',
  sales_updated:  '🍱',
}

export async function logActivity(
  exhibitId: string,
  userId: string,
  actionType: ActionType,
  summary?: string,
) {
  const supabase = createClient()
  await supabase.from('activity_logs').insert({
    exhibit_id:  exhibitId,
    user_id:     userId,
    action_type: actionType,
    summary:     summary ?? null,
  })

  // プッシュ通知（fire-and-forget）
  fetch('/api/push/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ exhibitId, actionType, summary, userId }),
  }).catch(() => {})
}
