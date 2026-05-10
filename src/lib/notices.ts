/**
 * lib/notices.ts
 * お知らせの型・ダミーデータ・既読管理（localStorage）
 */

// ─── 型 ──────────────────────────────────────────────────────

/** 本文中のリンクブロック */
export interface NoticeLink {
  label: string   // 表示テキスト
  href:  string   // 遷移先 (例: "/map", "/exhibit/1", "/food")
}

/** 本文ブロック（テキスト or リンク） */
export type BodySegment =
  | { type: 'text'; text: string }
  | { type: 'link'; label: string; href: string }
  | { type: 'break' }

/** メディア（画像 or 動画） */
export interface NoticeMedia {
  id:   string
  type: 'image' | 'video'
  url:  string
  caption?: string
}

/** お知らせ */
export interface NoticeItem {
  id:         string
  exhibit_id: string
  /** 送信者（クラス名 / 団体名） */
  sender:     string
  /** 送信者サムネイル */
  sender_thumbnail?: string
  title:      string
  /** 本文: BodySegment 配列 */
  body:       BodySegment[]
  /** 添付メディア */
  media:      NoticeMedia[]
  is_urgent:  boolean
  created_at: string   // ISO 8601
}

// ─── ダミーデータ ─────────────────────────────────────────────

export const DUMMY_NOTICES: NoticeItem[] = [
  {
    id: 'n1',
    exhibit_id: 'e_band',
    sender: '軽音楽部',
    title: '【重要】第2部の開始時刻が変更になりました',
    body: [
      { type:'text', text:'いつもご支援ありがとうございます。\n軽音楽部です。\n\n第2部（Electric Sky）の開始時刻が都合により変更になりましたのでお知らせします。' },
      { type:'break' },
      { type:'text', text:'変更前: 11:10〜\n変更後: 11:25〜' },
      { type:'break' },
      { type:'text', text:'詳細なスケジュールはこちらからご確認ください → ' },
      { type:'link', label:'軽音楽部スケジュール', href:'/band' },
    ],
    media: [],
    is_urgent: true,
    created_at: '2025-09-06T09:45:00+09:00',
  },
  {
    id: 'n2',
    exhibit_id: 'e1',
    sender: '高2-1',
    title: 'お化け屋敷 本日オープンしました！',
    body: [
      { type:'text', text:'高2-1のお化け屋敷がいよいよオープンしました🎃\n\nクオリティには自信あり！ぜひ遊びに来てください。\n待ち時間は以下のマップでリアルタイムに確認できます。' },
      { type:'break' },
      { type:'link', label:'マップで場所を確認する（201教室）', href:'/map' },
      { type:'break' },
      { type:'text', text:'\n所要時間は約10分です。お化けが苦手な方はご注意を！' },
    ],
    media: [
      { id:'m1', type:'image', url:'', caption:'入口の装飾' },
      { id:'m2', type:'image', url:'', caption:'内部の様子' },
      { id:'m3', type:'video', url:'', caption:'予告動画' },
    ],
    is_urgent: false,
    created_at: '2025-09-06T09:00:00+09:00',
  },
  {
    id: 'n3',
    exhibit_id: 'e2',
    sender: '高3-2（焼きそば・フランクフルト）',
    title: 'フランクフルトが売り切れました',
    body: [
      { type:'text', text:'大変ご好評をいただいておりますフランクフルトですが、本日分が売り切れとなりました。\n\nたくさんのご来店ありがとうございました！' },
      { type:'break' },
      { type:'text', text:'引き続き焼きそばは販売中です。在庫状況はこちら → ' },
      { type:'link', label:'フードメニューを見る', href:'/food' },
    ],
    media: [],
    is_urgent: false,
    created_at: '2025-09-06T10:30:00+09:00',
  },
  {
    id: 'n4',
    exhibit_id: 'e_dance',
    sender: 'ダンス部',
    title: '本日のステージ写真をアップしました',
    body: [
      { type:'text', text:'本日の午前ステージの写真をアップしました！\nご来場いただいた皆さん、ありがとうございました。\n\n午後のステージは14:00〜メインアリーナにて行います。ぜひお越しください！' },
      { type:'break' },
      { type:'link', label:'催し物スケジュールを確認', href:'/special' },
    ],
    media: [
      { id:'m4', type:'image', url:'', caption:'ヒップホップステージ' },
      { id:'m5', type:'image', url:'', caption:'フィナーレ' },
    ],
    is_urgent: false,
    created_at: '2025-09-06T11:15:00+09:00',
  },
  {
    id: 'n5',
    exhibit_id: 'e_cafeteria',
    sender: '食堂',
    title: '本日のランチメニューのお知らせ',
    body: [
      { type:'text', text:'本日の日替わり定食は「唐揚げ定食」（¥550）です。\n\n混雑が予想されるため、早めのご来場をお勧めします。\n11:30〜14:00の間は特に混み合います。' },
      { type:'break' },
      { type:'link', label:'食堂の場所を確認（1F）', href:'/map' },
    ],
    media: [
      { id:'m6', type:'image', url:'', caption:'本日の唐揚げ定食' },
    ],
    is_urgent: false,
    created_at: '2025-09-06T08:30:00+09:00',
  },
  {
    id: 'n6',
    exhibit_id: 'e3',
    sender: '高2-3（縁日）',
    title: '縁日コーナーに新しいゲームが追加されました',
    body: [
      { type:'text', text:'好評につき、射的コーナーを追加しました！\n202教室にてお待ちしています🎯\n\nスーパーボールすくい・輪投げも引き続き楽しめます。' },
    ],
    media: [
      { id:'m7', type:'image', url:'', caption:'射的コーナー' },
      { id:'m8', type:'image', url:'', caption:'輪投げ' },
      { id:'m9', type:'image', url:'', caption:'スーパーボールすくい' },
    ],
    is_urgent: false,
    created_at: '2025-09-06T10:00:00+09:00',
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
  } catch { /* noop */ }
}

export const markAllAsRead = (): void => {
  if (typeof window === 'undefined') return
  try {
    const ids = DUMMY_NOTICES.map((n) => n.id)
    localStorage.setItem(LS_KEY, JSON.stringify(ids))
  } catch { /* noop */ }
}

// ─── フォーマット ─────────────────────────────────────────────
export const formatDate = (iso: string): string => {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1)   return 'たった今'
  if (diffMin < 60)  return `${diffMin}分前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)    return `${diffH}時間前`
  const M = d.getMonth() + 1
  const D = d.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${M}/${D} ${hh}:${mm}`
}
