/**
 * lib/notices.ts
 * お知らせの型・データ取得・既読管理（localStorage）
 */

import { createClient } from '@/lib/supabase/client'

// ─── 型 ──────────────────────────────────────────────────────

export interface NoticeLink {
  label: string
  href:  string
}

export type BodySegment =
  | { type: 'text'; text: string }
  | { type: 'link'; label: string; href: string }
  | { type: 'break' }

export interface NoticeMedia {
  id:       string
  type:     'image' | 'video'
  url:      string
  caption?: string
}

export interface NoticeItem {
  id:                string
  exhibit_id:        string
  sender:            string
  sender_thumbnail?: string
  title:             string
  body:              BodySegment[]
  media:             NoticeMedia[]
  is_urgent:         boolean
  created_at:        string
}

// ─── Supabase レスポンス用中間型 ─────────────────────────────

interface RawNoticeMedia { id: string; url: string; type: 'image'|'video'; caption: string|null; order_index: number }
interface RawNotice {
  id: string; exhibit_id: string; title: string; body: string
  sender_name: string|null; is_urgent: boolean; created_at: string
  notice_media: RawNoticeMedia[]
  exhibit: { id: string; name: string; thumbnail_url: string|null; cover_url: string|null } | null
}

// ─── Supabase データ取得 ──────────────────────────────────────

function rawToNoticeItem(raw: RawNotice): NoticeItem {
  return {
    id:         raw.id,
    exhibit_id: raw.exhibit_id,
    sender:     raw.sender_name ?? raw.exhibit?.name ?? '不明',
    sender_thumbnail: raw.exhibit?.thumbnail_url ?? raw.exhibit?.cover_url ?? undefined,
    title:      raw.title,
    body:       raw.body ? [{ type: 'text' as const, text: raw.body }] : [],
    media:      (raw.notice_media ?? [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((m): NoticeMedia => ({
        id:      m.id,
        type:    m.type,
        url:     m.url,
        caption: m.caption ?? undefined,
      })),
    is_urgent:  raw.is_urgent,
    created_at: raw.created_at,
  }
}

export async function fetchNotices(): Promise<NoticeItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('notices')
    .select(`
      id, exhibit_id, title, body, sender_name, is_urgent, created_at,
      notice_media(id, url, type, caption, order_index),
      exhibit:exhibits(id, name, thumbnail_url, cover_url)
    `)
    .order('created_at', { ascending: false })

  if (error || !data) return DUMMY_NOTICES

  return (data as unknown as RawNotice[]).map(rawToNoticeItem)
}

export async function fetchNotice(id: string): Promise<NoticeItem | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('notices')
    .select(`
      id, exhibit_id, title, body, sender_name, is_urgent, created_at,
      notice_media(id, url, type, caption, order_index),
      exhibit:exhibits(id, name, thumbnail_url, cover_url)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return DUMMY_NOTICES.find(n => n.id === id) ?? null

  return rawToNoticeItem(data as unknown as RawNotice)
}

// ─── ダミーデータ（Supabase 未設定時のフォールバック）──────────

export const DUMMY_NOTICES: NoticeItem[] = [
  {
    id: 'n1', exhibit_id: 'e_band', sender: '軽音楽部',
    title: '【重要】第2部の開始時刻が変更になりました',
    body: [
      { type:'text', text:'第2部（Electric Sky）の開始時刻が都合により変更になりました。\n変更前: 11:10〜\n変更後: 11:25〜' },
      { type:'break' },
      { type:'link', label:'軽音楽部スケジュール', href:'/band' },
    ],
    media: [], is_urgent: true, created_at: '2025-09-06T09:45:00+09:00',
  },
  {
    id: 'n2', exhibit_id: 'e1', sender: '高2-1',
    title: 'お化け屋敷 本日オープンしました！',
    body: [
      { type:'text', text:'高2-1のお化け屋敷がいよいよオープンしました🎃\nぜひ遊びに来てください。' },
      { type:'break' },
      { type:'link', label:'マップで場所を確認する（201教室）', href:'/map' },
    ],
    media: [
      { id:'m1', type:'image', url:'', caption:'入口の装飾' },
      { id:'m2', type:'image', url:'', caption:'内部の様子' },
    ],
    is_urgent: false, created_at: '2025-09-06T09:00:00+09:00',
  },
  {
    id: 'n3', exhibit_id: 'e2', sender: '高3-2（焼きそば・フランクフルト）',
    title: 'フランクフルトが売り切れました',
    body: [
      { type:'text', text:'大変ご好評をいただいておりますフランクフルトですが、本日分が売り切れとなりました。' },
      { type:'break' },
      { type:'link', label:'フードメニューを見る', href:'/food' },
    ],
    media: [], is_urgent: false, created_at: '2025-09-06T10:30:00+09:00',
  },
  {
    id: 'n4', exhibit_id: 'e_dance', sender: 'ダンス部',
    title: '本日のステージ写真をアップしました',
    body: [
      { type:'text', text:'本日の午前ステージの写真をアップしました！\n午後のステージは14:00〜メインアリーナにて行います。' },
      { type:'break' },
      { type:'link', label:'催し物スケジュールを確認', href:'/special' },
    ],
    media: [
      { id:'m4', type:'image', url:'', caption:'ヒップホップステージ' },
    ],
    is_urgent: false, created_at: '2025-09-06T11:15:00+09:00',
  },
  {
    id: 'n5', exhibit_id: 'e_cafeteria', sender: '食堂',
    title: '本日のランチメニューのお知らせ',
    body: [
      { type:'text', text:'本日の日替わり定食は「唐揚げ定食」（¥550）です。\n11:30〜14:00の間は特に混み合います。' },
      { type:'break' },
      { type:'link', label:'食堂の場所を確認（1F）', href:'/map' },
    ],
    media: [{ id:'m6', type:'image', url:'', caption:'本日の唐揚げ定食' }],
    is_urgent: false, created_at: '2025-09-06T08:30:00+09:00',
  },
  {
    id: 'n6', exhibit_id: 'e3', sender: '高2-3（縁日）',
    title: '縁日コーナーに新しいゲームが追加されました',
    body: [
      { type:'text', text:'好評につき、射的コーナーを追加しました！\n202教室にてお待ちしています🎯' },
    ],
    media: [
      { id:'m7', type:'image', url:'', caption:'射的コーナー' },
    ],
    is_urgent: false, created_at: '2025-09-06T10:00:00+09:00',
  },
]

// ─── 既読管理（localStorage）─────────────────────────────────

const LS_KEY = 'nanko_sai_read_notices'

export const getReadIds = (): Set<string> => {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(LS_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

export const markAsRead = (id: string): void => {
  if (typeof window === 'undefined') return
  try {
    const ids = getReadIds()
    ids.add(id)
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]))
    window.dispatchEvent(new Event('notices-read-changed'))
  } catch { /* noop */ }
}

/** noticeIds を渡すと全件を既読にする（省略時はダミーデータを使用） */
export const markAllAsRead = (noticeIds?: string[]): void => {
  if (typeof window === 'undefined') return
  try {
    const ids = noticeIds ?? DUMMY_NOTICES.map((n) => n.id)
    localStorage.setItem(LS_KEY, JSON.stringify(ids))
    window.dispatchEvent(new Event('notices-read-changed'))
  } catch { /* noop */ }
}

// ─── フォーマット ─────────────────────────────────────────────

export const formatDate = (iso: string): string => {
  const d = new Date(iso)
  const now = new Date()
  const diffMs  = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1)  return 'たった今'
  if (diffMin < 60) return `${diffMin}分前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return `${diffH}時間前`
  const M  = d.getMonth() + 1
  const D  = d.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${M}/${D} ${hh}:${mm}`
}
