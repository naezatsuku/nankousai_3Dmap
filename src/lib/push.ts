import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { firebaseApp } from './firebase'
import { createClient } from './supabase/client'

const VAPID_KEY       = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!
const TOKEN_KEY       = 'fcm_token'
const SUBS_KEY        = 'push_subs'
const SUBS_META_KEY   = 'push_subs_meta'
const GLOBAL_OPT_OUT  = 'push_global_off'

// ── FCM トークン取得 ─────────────────────────────────────────────
// エラーは呼び出し元に伝える（return null ではなく throw）
export async function getFCMToken(): Promise<string> {
  const supported = await isSupported()
  if (!supported) throw new Error('このブラウザは通知に対応していません。PWAとしてホーム画面に追加してください。')

  const messaging = getMessaging(firebaseApp)
  const token = await getToken(messaging, { vapidKey: VAPID_KEY })
  if (!token) throw new Error('FCMトークンを取得できませんでした。通知の許可を確認してください。')

  localStorage.setItem(TOKEN_KEY, token)

  // サーバー API 経由で登録（service_role で RLS バイパス、ログイン済みなら user_id も紐付け）
  await fetch('/api/link-fcm-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fcm_token: token }),
  }).catch(async () => {
    // API が失敗した場合は user_id なしで直接登録（来場者など未ログインの場合）
    const supabase = createClient()
    await supabase
      .from('push_subscriptions')
      .upsert({ fcm_token: token }, { onConflict: 'fcm_token' })
  })

  return token
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

// ── 購読メタ（展示タイプ）管理 ────────────────────────────────
function getSubsMeta(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(SUBS_META_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch { return {} }
}

export function hasSubsOfType(type: string): boolean {
  const subs = getLocalSubs()
  const meta = getSubsMeta()
  for (const id of subs) {
    if (meta[id] === type) return true
  }
  return false
}

// ── 団体購読 ────────────────────────────────────────────────────
// throws if token cannot be obtained
export async function subscribeToExhibit(exhibitId: string, exhibitType?: string): Promise<void> {
  const token = getStoredToken() ?? await getFCMToken()

  const supabase = createClient()
  const { error } = await supabase
    .from('exhibit_push_subs')
    .upsert({ fcm_token: token, exhibit_id: exhibitId })
  if (error) throw new Error(`購読の保存に失敗しました: ${error.message}`)

  const subs = getLocalSubs()
  subs.add(exhibitId)
  localStorage.setItem(SUBS_KEY, JSON.stringify([...subs]))

  if (exhibitType) {
    const meta = getSubsMeta()
    meta[exhibitId] = exhibitType
    localStorage.setItem(SUBS_META_KEY, JSON.stringify(meta))
  }

  await syncSubscriptionSchedule()
}

export async function unsubscribeFromExhibit(exhibitId: string): Promise<void> {
  const token = getStoredToken()
  if (!token) return

  const supabase = createClient()
  await supabase.from('exhibit_push_subs').delete().eq('fcm_token', token).eq('exhibit_id', exhibitId)

  const subs = getLocalSubs()
  subs.delete(exhibitId)
  localStorage.setItem(SUBS_KEY, JSON.stringify([...subs]))

  const meta = getSubsMeta()
  delete meta[exhibitId]
  localStorage.setItem(SUBS_META_KEY, JSON.stringify(meta))

  await syncSubscriptionSchedule()
}

// ── グローバルアナウンス購読 ─────────────────────────────────────
export function isGlobalOn(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(GLOBAL_OPT_OUT) !== '1'
}

export async function subscribeToGlobal(): Promise<void> {
  localStorage.removeItem(GLOBAL_OPT_OUT)
  const token = getStoredToken() ?? await getFCMToken()

  // ログイン済みなら user_id を紐付ける API を優先して呼ぶ
  const linked = await fetch('/api/link-fcm-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fcm_token: token }),
  }).then(r => r.ok).catch(() => false)

  // 未ログイン（401）の場合のみ直接 upsert（user_id なし）
  if (!linked) {
    const supabase = createClient()
    await supabase
      .from('push_subscriptions')
      .upsert({ fcm_token: token }, { onConflict: 'fcm_token' })
  }
}

export async function unsubscribeFromGlobal(): Promise<void> {
  localStorage.setItem(GLOBAL_OPT_OUT, '1')
  const token = getStoredToken()
  if (!token) return
  const supabase = createClient()
  await supabase.from('push_subscriptions').delete().eq('fcm_token', token)
}

// ── 購読予定の同期 ───────────────────────────────────────────────
// 現在の購読リストを /api/schedule (PUT) に送って visit アイテムを同期する
// 並列呼び出し時は進行中の Promise を共有し、重複 DELETE+INSERT を防ぐ
let _syncPromise: Promise<void> | null = null

export async function syncSubscriptionSchedule(): Promise<void> {
  if (typeof window === 'undefined') return
  const userKey = localStorage.getItem('stamp_user_id')
  if (!userKey) return

  if (_syncPromise) return _syncPromise

  _syncPromise = (async () => {
    const exhibitIds = [...getLocalSubs()]
    const fcmToken = getStoredToken()
    await fetch('/api/schedule', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-key': userKey },
      body: JSON.stringify({ exhibitIds, fcmToken }),
    }).catch(() => {})
  })().finally(() => { _syncPromise = null })

  return _syncPromise
}

// ── ローカル購読状態 ─────────────────────────────────────────────
export function getLocalSubs(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(SUBS_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function isSubscribed(exhibitId: string): boolean {
  return getLocalSubs().has(exhibitId)
}
