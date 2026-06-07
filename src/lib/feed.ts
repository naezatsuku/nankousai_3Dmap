/**
 * lib/feed.ts
 * 「お知らせ」と「みんなの声（展示コメント）」を時系列マージした統合タイムライン用
 */

import { fetchNotices, type NoticeItem } from '@/lib/notices'

// ─── 型 ──────────────────────────────────────────────────────

export interface FeedComment {
  id:               string
  exhibit_id:       string
  body:             string
  author_name:      string | null
  created_at:       string
  exhibit_name:     string
  exhibit_thumbnail?: string
}

export type FeedItem =
  | { kind: 'notice';  id: string; created_at: string; sortKey: number; notice:  NoticeItem }
  | { kind: 'comment'; id: string; created_at: string; sortKey: number; comment: FeedComment }

export interface FeedPage {
  items:      FeedItem[]
  nextCursor: string | null
  hasMore:    boolean
}

// ─── Supabase レスポンス用中間型（/api/comments-feed）────────

interface RawFeedComment {
  id:          string
  exhibit_id:  string
  body:        string
  author_name: string | null
  created_at:  string
  exhibit:     { id: string; name: string; thumbnail_url: string | null; cover_url: string | null } | null
}

// ─── マッパー ─────────────────────────────────────────────────

export function noticeToFeedItem(notice: NoticeItem): FeedItem {
  return {
    kind:       'notice',
    id:         notice.id,
    created_at: notice.created_at,
    sortKey:    Date.parse(notice.created_at),
    notice,
  }
}

function rawCommentToFeedItem(raw: RawFeedComment): FeedItem {
  const comment: FeedComment = {
    id:                raw.id,
    exhibit_id:        raw.exhibit_id,
    body:              raw.body,
    author_name:       raw.author_name,
    created_at:        raw.created_at,
    exhibit_name:      raw.exhibit?.name ?? '不明な展示',
    exhibit_thumbnail: raw.exhibit?.thumbnail_url ?? raw.exhibit?.cover_url ?? undefined,
  }
  return {
    kind:       'comment',
    id:         `comment-${raw.id}`,
    created_at: raw.created_at,
    sortKey:    Date.parse(raw.created_at),
    comment,
  }
}

// ─── ページ単位の取得・マージ ─────────────────────────────────

async function fetchCommentItems(pageSize: number, cursor?: string | null): Promise<FeedItem[]> {
  try {
    const qs = new URLSearchParams({ limit: String(pageSize) })
    if (cursor) qs.set('before', cursor)
    const res = await fetch(`/api/comments-feed?${qs.toString()}`)
    if (!res.ok) return []
    const json = await res.json() as { comments: RawFeedComment[] }
    return (json.comments ?? []).map(rawCommentToFeedItem)
  } catch {
    return []
  }
}

async function fetchNoticeItems(pageSize: number, cursor?: string | null): Promise<FeedItem[]> {
  try {
    const notices = await fetchNotices({ limit: pageSize, before: cursor ?? undefined })
    return notices.map(noticeToFeedItem)
  } catch {
    return []
  }
}

/** 2つの ISO 日時のうち新しい（≒大きい）方を返す。null は「制約なし」として扱う */
function pickNewer(a: string | null, b: string | null): string | null {
  if (a == null) return b
  if (b == null) return a
  return Date.parse(a) >= Date.parse(b) ? a : b
}

/**
 * カーソルより古いお知らせ・コメントを取得し、時系列でマージした1ページ分を返す。
 *
 * お知らせ／コメントという独立にページングされる2つのソースをマージする際、
 * 単純に「今回表示した最後の要素の created_at」をカーソルにすると、
 * 表示しきれず取りこぼされたまま二度と取得されないアイテムが発生しうる。
 * そのため「まだ続きがあるソースの中で最も新しい境界（＝浅い方の最古取得アイテム）」
 * を次回カーソルにする：深い方のソースは一部範囲が重複して再取得されるが、
 * それは seenIds で重複除去すればよく、取りこぼしは発生しない。
 */
export async function fetchFeedPage(
  cursor:   string | null,
  pageSize: number,
  seenIds:  Set<string>,
): Promise<FeedPage> {
  const [notices, comments] = await Promise.all([
    fetchNoticeItems(pageSize, cursor),
    fetchCommentItems(pageSize, cursor),
  ])

  const noticesExhausted  = notices.length  < pageSize
  const commentsExhausted = comments.length < pageSize

  const noticeFrontier  = noticesExhausted  ? null : notices[notices.length - 1].created_at
  const commentFrontier = commentsExhausted ? null : comments[comments.length - 1].created_at
  const nextCursor = pickNewer(noticeFrontier, commentFrontier)

  const items = [...notices, ...comments]
    .filter(item => !seenIds.has(item.id))
    .sort((a, b) => b.sortKey - a.sortKey)

  return { items, nextCursor, hasMore: nextCursor != null }
}
