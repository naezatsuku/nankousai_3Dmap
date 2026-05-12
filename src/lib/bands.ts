import { createClient } from '@/lib/supabase/client'
import type { BandWithSchedules, BandSchedule } from '@/types'

// Postgres TIME returns "HH:MM:SS" — truncate to "HH:MM"
const trimTime = (t: string) => t.slice(0, 5)

interface RawSchedule {
  id: string
  band_id: string
  day: 'sat' | 'sun'
  start_at: string
  end_at: string
  stage: string | null
}

interface RawBand {
  id: string
  exhibit_id: string
  name: string
  members: string[]
  instagram: string | null
  thumbnail_url: string | null
  band_schedules: RawSchedule[]
}

export const DUMMY_BANDS: BandWithSchedules[] = [
  {
    id: '1', exhibit_id: 'band',
    name: 'The Crimson',
    members: ['田中 颯', '鈴木 葵', '佐藤 陸', '山田 蓮'],
    instagram: 'the_crimson_band',
    schedules: [
      { id: 's1', band_id: '1', day: 'sat', start_at: '09:30', end_at: '09:50', stage: 'メインステージ' },
      { id: 's2', band_id: '1', day: 'sun', start_at: '10:00', end_at: '10:20', stage: 'メインステージ' },
    ],
  },
  {
    id: '2', exhibit_id: 'band',
    name: 'Neon Dreams',
    members: ['高橋 凛', '伊藤 悠', '中村 空'],
    instagram: 'neon_dreams_official',
    schedules: [
      { id: 's3', band_id: '2', day: 'sat', start_at: '10:00', end_at: '10:25', stage: 'メインステージ' },
      { id: 's4', band_id: '2', day: 'sun', start_at: '10:30', end_at: '10:55', stage: 'メインステージ' },
    ],
  },
]

export async function fetchBands(): Promise<BandWithSchedules[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('bands')
      .select('*, band_schedules(*)')
      .order('name')

    if (error || !data) return DUMMY_BANDS

    return (data as unknown as RawBand[]).map(raw => ({
      id:            raw.id,
      exhibit_id:    raw.exhibit_id,
      name:          raw.name,
      members:       raw.members ?? [],
      instagram:     raw.instagram ?? undefined,
      thumbnail_url: raw.thumbnail_url ?? undefined,
      schedules:     (raw.band_schedules ?? []).map((s): BandSchedule => ({
        id:       s.id,
        band_id:  s.band_id,
        day:      s.day,
        start_at: trimTime(s.start_at),
        end_at:   trimTime(s.end_at),
        stage:    s.stage ?? undefined,
      })),
    }))
  } catch {
    return DUMMY_BANDS
  }
}
