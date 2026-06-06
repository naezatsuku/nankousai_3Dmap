import { createClient } from '@/lib/supabase/client'

export interface SpecialSched {
  id: string
  day: 'sat' | 'sun'
  start_at: string
  end_at: string
  location: string
  note?: string
}

export interface SpecialGroup {
  id: string
  name: string
  category: string
  description: string
  thumbnail_url?: string
  enable_announcement: boolean
  announcement_color?: string
  schedules: SpecialSched[]
}

interface RawSched {
  id: string
  exhibit_id: string
  day: 'sat' | 'sun'
  start_at: string
  end_at: string
  location: string | null
  description: string | null
}

interface RawExhibit {
  id: string
  name: string
  category: string | null
  description: string | null
  thumbnail_url: string | null
  enable_announcement: boolean | null
  announcement_color: string | null
  special_schedules: RawSched[]
}

const trimTime = (t: string) => t.slice(0, 5)

export const DUMMY_GROUPS: SpecialGroup[] = [
  {
    id: 'g1', name: 'ダンス部', category: 'ダンス',
    description: '総勢30名によるストリートダンスショー。今年は新ジャンルにも挑戦！',
    enable_announcement: false,
    schedules: [
      { id: 's1', day: 'sat', start_at: '10:30', end_at: '11:00', location: 'メインアリーナ', note: 'ヒップホップステージ' },
      { id: 's2', day: 'sat', start_at: '14:00', end_at: '14:30', location: 'メインアリーナ', note: 'K-POPステージ' },
      { id: 's3', day: 'sun', start_at: '10:00', end_at: '10:30', location: 'メインアリーナ' },
    ],
  },
  {
    id: 'g2', name: '演劇部', category: '演劇',
    description: '今年のテーマは「時間」。オリジナル脚本の短編2作を上演します。',
    enable_announcement: false,
    schedules: [
      { id: 's4', day: 'sat', start_at: '11:30', end_at: '12:30', location: '視聴覚室（5F）', note: '第1回公演' },
      { id: 's5', day: 'sun', start_at: '11:00', end_at: '12:00', location: '視聴覚室（5F）', note: '第2回公演' },
      { id: 's6', day: 'sun', start_at: '14:00', end_at: '15:00', location: '視聴覚室（5F）', note: '第3回公演（最終）' },
    ],
  },
  {
    id: 'g3', name: '合唱部', category: '合唱',
    description: 'アカペラと伴奏ありの2ステージ構成。美しいハーモニーをお楽しみに。',
    enable_announcement: false,
    schedules: [
      { id: 's7', day: 'sat', start_at: '13:00', end_at: '13:40', location: 'メインアリーナ' },
      { id: 's8', day: 'sun', start_at: '13:30', end_at: '14:10', location: 'メインアリーナ' },
    ],
  },
  {
    id: 'g4', name: 'マジック同好会', category: 'マジック',
    description: '目の前で起こる不思議。プロ顔負けの本格マジックショー！',
    enable_announcement: false,
    schedules: [
      { id: 's9',  day: 'sat', start_at: '12:00', end_at: '12:30', location: 'サブアリーナ' },
      { id: 's10', day: 'sun', start_at: '12:30', end_at: '13:00', location: 'サブアリーナ' },
    ],
  },
]

export async function fetchSpecialGroups(): Promise<SpecialGroup[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('exhibits')
      .select('id, name, category, description, thumbnail_url, enable_announcement, announcement_color, special_schedules(*)')
      .eq('is_active', true)
      .order('name')

    if (error || !data) return DUMMY_GROUPS

    const groups = (data as unknown as RawExhibit[])
      .filter(raw => raw.special_schedules && raw.special_schedules.length > 0)
      .map(raw => ({
      id:                   raw.id,
      name:                 raw.name,
      category:             raw.category ?? '',
      description:          raw.description ?? '',
      thumbnail_url:        raw.thumbnail_url ?? undefined,
      enable_announcement:  raw.enable_announcement ?? false,
      announcement_color:   raw.announcement_color ?? undefined,
      schedules:     (raw.special_schedules ?? []).map((s): SpecialSched => ({
        id:       s.id,
        day:      s.day,
        start_at: trimTime(s.start_at),
        end_at:   trimTime(s.end_at),
        location: s.location ?? '',
        note:     s.description ?? undefined,
      })),
    }))

    return groups.length > 0 ? groups : DUMMY_GROUPS
  } catch {
    return DUMMY_GROUPS
  }
}
