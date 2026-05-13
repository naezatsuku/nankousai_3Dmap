import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { firebaseApp } from './firebase'
import { createClient } from './supabase/client'

const VAPID_KEY      = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!
const TOKEN_KEY      = 'fcm_token'
const SUBS_KEY       = 'push_subs'
const GLOBAL_OPT_OUT = 'push_global_off'

// ── FCM トークン取得 ─────────────────────────────────────────────
export async function getFCMToken(): Promise<string | null> {
  try {
    const supported = await isSupported()
    if (!supported) return null

    const messaging = getMessaging(firebaseApp)
    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    if (!token) return null

    localStorage.setItem(TOKEN_KEY, token)

    const supabase = createClient()
    await supabase
      .from('push_subscriptions')
      .upsert({ fcm_token: token }, { onConflict: 'fcm_token' })

    return token
  } catch {
    return null
  }
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

// ── 団体購読 ────────────────────────────────────────────────────
export async function subscribeToExhibit(exhibitId: string): Promise<boolean> {
  const token = getStoredToken() ?? await getFCMToken()
  if (!token) return false

  const supabase = createClient()
  await supabase.from('exhibit_push_subs').upsert({ fcm_token: token, exhibit_id: exhibitId })

  const subs = getLocalSubs()
  subs.add(exhibitId)
  localStorage.setItem(SUBS_KEY, JSON.stringify([...subs]))
  return true
}

export async function unsubscribeFromExhibit(exhibitId: string): Promise<void> {
  const token = getStoredToken()
  if (!token) return

  const supabase = createClient()
  await supabase.from('exhibit_push_subs').delete().eq('fcm_token', token).eq('exhibit_id', exhibitId)

  const subs = getLocalSubs()
  subs.delete(exhibitId)
  localStorage.setItem(SUBS_KEY, JSON.stringify([...subs]))
}

// ── グローバルアナウンス購読 ─────────────────────────────────────
export function isGlobalOn(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(GLOBAL_OPT_OUT) !== '1'
}

export async function subscribeToGlobal(): Promise<void> {
  localStorage.removeItem(GLOBAL_OPT_OUT)
  const token = getStoredToken() ?? await getFCMToken()
  if (!token) return
  const supabase = createClient()
  await supabase.from('push_subscriptions').upsert({ fcm_token: token }, { onConflict: 'fcm_token' })
}

export async function unsubscribeFromGlobal(): Promise<void> {
  localStorage.setItem(GLOBAL_OPT_OUT, '1')
  const token = getStoredToken()
  if (!token) return
  const supabase = createClient()
  await supabase.from('push_subscriptions').delete().eq('fcm_token', token)
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
