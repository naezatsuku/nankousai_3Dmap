// ============================================================
// 南高祭 公式サイト — 型定義  (最終更新: 全ページ実装反映版)
// ============================================================

// ─────────────────────────────────────────────────────────────
// プリミティブ / 共通
// ─────────────────────────────────────────────────────────────

/** 開催日 */
export type Day = 'sat' | 'sun' | 'both'

/** 学校区分 */
export type SchoolType = 'middle' | 'high'

/** ロール */
export type Role = 'admin' | 'editor'

/** 展示種別 */
export type ExhibitType = 'class' | 'food' | 'band' | 'special' | 'cafeteria'

/** 画像・動画の種別 */
export type MediaType = 'image' | 'video'

/** 階数 */
export type FloorNumber = 1 | 2 | 3 | 4 | 5 | 6

/** 公演・展示の状態 */
export type PerformanceStatus = 'upcoming' | 'live' | 'done'

// ─────────────────────────────────────────────────────────────
// profiles — ユーザー情報
// ─────────────────────────────────────────────────────────────

export interface Profile {
  /** Supabase auth.users.id と一致 */
  id: string
  email: string
  name: string
  school_type: SchoolType
  /** 学年: 中1=1 〜 高3=6 */
  grade: 1 | 2 | 3 | 4 | 5 | 6
  /** 組番号: 1〜5 */
  class_num: 1 | 2 | 3 | 4 | 5
  /** 出席番号 */
  student_num: number
  role: Role
}

// ─────────────────────────────────────────────────────────────
// exhibits — 展示団体
// ─────────────────────────────────────────────────────────────

export interface Exhibit {
  id: string
  /** 展示名（例: "高2-1 お化け屋敷"） */
  name: string
  /** クラス名（例: "高2-1"）。有志団体などはなし */
  class_label?: string
  type: ExhibitType
  /** Three.js メッシュ名（例: "201", "main", "sub"）*/
  room_object?: string
  /** ユーザー向け表示名（例: "201教室", "メインアリーナ"）*/
  room_display?: string
  floor?: FloorNumber
  description?: string
  /** 正方形宣材写真 URL */
  thumbnail_url?: string
  /** 詳細ページ背景写真 URL */
  cover_url?: string
  /** 現在の待ち時間（分）*/
  wait_minutes: number
  is_active: boolean
  day: Day
  created_at?: string
  updated_at?: string
}

// ─────────────────────────────────────────────────────────────
// exhibit_images — 展示の追加画像・動画
// ─────────────────────────────────────────────────────────────

export interface ExhibitMedia {
  id: string
  exhibit_id: string
  url: string
  type: MediaType
  /** 表示順（昇順）*/
  order_index: number
}

// ─────────────────────────────────────────────────────────────
// exhibit_editors — 編集権限
// ─────────────────────────────────────────────────────────────

export interface ExhibitEditor {
  user_id: string
  exhibit_id: string
  /** JOIN 用（任意）*/
  profile?: Profile
  exhibit?: Exhibit
}

// ─────────────────────────────────────────────────────────────
// notices — お知らせ / アナウンス
// ─────────────────────────────────────────────────────────────

export interface Notice {
  id: string
  exhibit_id: string
  title: string
  body: string
  /** true のときヘッダーテロップに流す */
  is_urgent: boolean
  created_at: string
  /** JOIN 用（任意）*/
  exhibit?: Pick<Exhibit, 'id' | 'name' | 'thumbnail_url'>
}

/** お知らせ一覧ページ用（既読フラグを付加）*/
export interface NoticeListItem extends Notice {
  is_read: boolean
}

// ─────────────────────────────────────────────────────────────
// bands — 軽音楽部バンド
// ─────────────────────────────────────────────────────────────

export interface Band {
  id: string
  /** 軽音楽部の exhibit.id */
  exhibit_id: string
  name: string
  /** バンドメンバー名一覧 */
  members: string[]
  /** Instagram ハンドル（@なし）*/
  instagram?: string
  thumbnail_url?: string
  /** JOIN 用（任意）*/
  schedules?: BandSchedule[]
}

/** schedules を必須にした JOIN 済み型（band/page.tsx で使用）*/
export type BandWithSchedules = Band & { schedules: BandSchedule[] }

// ─────────────────────────────────────────────────────────────
// band_schedules — バンド公演スケジュール
// ─────────────────────────────────────────────────────────────

export interface BandSchedule {
  id: string
  band_id: string
  day: 'sat' | 'sun'
  /** "HH:MM" 形式 */
  start_at: string
  end_at: string
  stage?: string
  /** JOIN 用（任意）*/
  band?: Band
}

/** タイムライン表示用（band/page.tsx の todayItems）*/
export interface ScheduledBandItem {
  band: BandWithSchedules
  sch: BandSchedule
  status: PerformanceStatus
}

// ─────────────────────────────────────────────────────────────
// food_menus — フードメニュー
// ─────────────────────────────────────────────────────────────

export interface FoodMenu {
  id: string
  exhibit_id: string
  name: string
  price: number
  image_url?: string
  description?: string
  stock: number
  is_selling: boolean
  /** 販売数（高3のみ人気ランキングに使用）*/
  sold_count: number
  /** JOIN 用（任意）*/
  exhibit?: Pick<Exhibit, 'id' | 'name' | 'class_label' | 'thumbnail_url' | 'type'>
}

/** フード在庫の状態 */
export type FoodMenuStatus = 'selling' | 'soldout' | 'stopped'

/** FoodMenu に状態を付加した表示用型（food/page.tsx で使用）*/
export type FoodMenuWithStatus = FoodMenu & { displayStatus: FoodMenuStatus }

// ─────────────────────────────────────────────────────────────
// special_schedules — その他パフォーマンス日程
// ─────────────────────────────────────────────────────────────

export interface SpecialSchedule {
  id: string
  exhibit_id: string
  day: 'sat' | 'sun'
  start_at: string
  end_at: string
  location?: string
  description?: string
  /** JOIN 用（任意）*/
  exhibit?: Pick<Exhibit, 'id' | 'name' | 'thumbnail_url' | 'type'>
}

/** special/page.tsx のタイムライン表示用 */
export interface SpecialScheduleItem {
  schedule: SpecialSchedule
  exhibit: Pick<Exhibit, 'id' | 'name' | 'thumbnail_url' | 'type'>
  status: PerformanceStatus
}

// ─────────────────────────────────────────────────────────────
// UI ユーティリティ型
// ─────────────────────────────────────────────────────────────

/** マップの教室タップ情報 */
export interface RoomInfo {
  /** Three.js ノード名（例: "201"）*/
  objectName: string
  exhibit: Exhibit | null
}

/** お知らせの既読状態（localStorage で管理する ID の集合）*/
export type ReadSet = Set<string>

/** マップ上の CSS2D マーカーに渡すデータ */
export interface MapMarkerData {
  nodeName: string
  exhibit: Exhibit
}

// ─────────────────────────────────────────────────────────────
// フォーム型（管理画面）
// ─────────────────────────────────────────────────────────────

export type ExhibitFormData = Pick<
  Exhibit,
  | 'name'
  | 'class_label'
  | 'type'
  | 'room_object'
  | 'room_display'
  | 'floor'
  | 'description'
  | 'wait_minutes'
  | 'is_active'
  | 'day'
>

export type FoodMenuFormData = Omit<FoodMenu, 'id' | 'sold_count' | 'exhibit'>

export type BandFormData = Omit<Band, 'id' | 'schedules'>

export type BandScheduleFormData = Omit<BandSchedule, 'id' | 'band'>

export type SpecialScheduleFormData = Omit<SpecialSchedule, 'id' | 'exhibit'>

// ─────────────────────────────────────────────────────────────
// ユーティリティ関数
// ─────────────────────────────────────────────────────────────

/** "HH:MM" → 分（数値）*/
export const timeToMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** 現在時刻（分）と BandSchedule から公演の状態を返す */
export const getPerformanceStatus = (
  schedule: Pick<BandSchedule | SpecialSchedule, 'start_at' | 'end_at'>,
  nowMin: number,
): PerformanceStatus => {
  const st = timeToMin(schedule.start_at)
  const en = timeToMin(schedule.end_at)
  if (nowMin < st)  return 'upcoming'
  if (nowMin < en)  return 'live'
  return 'done'
}

/** FoodMenu から表示用ステータスを返す */
export const getFoodMenuStatus = (menu: FoodMenu): FoodMenuStatus => {
  if (!menu.is_selling)  return 'stopped'
  if (menu.stock === 0)  return 'soldout'
  return 'selling'
}
