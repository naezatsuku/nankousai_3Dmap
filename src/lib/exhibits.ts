/**
 * lib/exhibits.ts
 * 展示詳細ページ用の型・データ取得ロジック
 */

import { ExhibitType, Day } from '@/types'
import { createClient } from '@/lib/supabase/client'

// ─── 型 ──────────────────────────────────────────────────────

export type BodySegment =
  | { type: 'text';    text: string }
  | { type: 'heading'; text: string }
  | { type: 'link';    label: string; href: string }
  | { type: 'break' }

export interface SectionMedia {
  id:       string
  type:     'image' | 'video'
  url:      string
  caption?: string
}

export interface ExhibitSection {
  id:      string
  heading: string
  body:    BodySegment[]
  media:   SectionMedia[]
  order:   number
}

export interface ExhibitMedia {
  id:       string
  type:     'image' | 'video'
  url:      string
  caption?: string
}

export interface ExhibitDetail {
  id:            string
  name:          string
  class_label?:  string
  type:          ExhibitType
  room_object?:  string[]
  room_display?: string
  floor?:        number
  day:           Day
  catch_copy?:   string
  cover_url?:    string
  thumbnail_url?: string
  description?:  string
  sections:      ExhibitSection[]
  media:         ExhibitMedia[]
}

// ─── Supabase レスポンス用中間型 ─────────────────────────────

interface RawImage { id: string; url: string; type: 'image'|'video'; caption: string|null; order_index: number }
interface RawSection { id: string; heading: string; body: BodySegment[]; order_index: number; section_images: RawImage[] }
interface RawExhibit {
  id: string; name: string; class_label: string|null; type: string
  room_object: string[]|null; room_display: string|null; floor: number|null; day: string|null
  catch_copy: string|null; cover_url: string|null; thumbnail_url: string|null; description: string|null
  sections: RawSection[]; images: RawImage[]
}

// ─── Supabase データ取得 ──────────────────────────────────────

export async function fetchExhibitDetail(id: string): Promise<ExhibitDetail | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('exhibits')
    .select(`
      id, name, class_label, type, room_object, room_display, floor, day,
      catch_copy, cover_url, thumbnail_url, description,
      sections:exhibit_sections(id, heading, body, order_index,
        section_images:exhibit_images(id, url, type, caption, order_index)
      ),
      images:exhibit_images(id, url, type, caption, order_index)
    `)
    .eq('id', id)
    .is('images.section_id', null)
    .single()

  if (error || !data) return null

  const raw = data as unknown as RawExhibit

  return {
    id:            raw.id,
    name:          raw.name,
    class_label:   raw.class_label ?? undefined,
    type:          raw.type as ExhibitType,
    room_object:   raw.room_object ?? undefined,
    room_display:  raw.room_display ?? undefined,
    floor:         raw.floor ?? undefined,
    day:           (raw.day ?? 'both') as Day,
    catch_copy:    raw.catch_copy ?? undefined,
    cover_url:     raw.cover_url ?? undefined,
    thumbnail_url: raw.thumbnail_url ?? undefined,
    description:   raw.description ?? undefined,
    sections: (raw.sections ?? [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((s): ExhibitSection => ({
        id:      s.id,
        heading: s.heading,
        body:    Array.isArray(s.body) ? s.body : [],
        media:   (s.section_images ?? [])
          .sort((a, b) => a.order_index - b.order_index)
          .map((img): SectionMedia => ({
            id:      img.id,
            type:    img.type,
            url:     img.url,
            caption: img.caption ?? undefined,
          })),
        order: s.order_index,
      })),
    media: (raw.images ?? [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((img): ExhibitMedia => ({
        id:      img.id,
        type:    img.type,
        url:     img.url,
        caption: img.caption ?? undefined,
      })),
  }
}

// ─── ダミーデータ（Supabase 未設定時のフォールバック）──────────

export const DUMMY_EXHIBITS: ExhibitDetail[] = [
  {
    id: '1',
    name: 'お化け屋敷',
    class_label: '高2-1',
    type: 'class',
    room_display: '201教室',
    floor: 2,
    day: 'both',
    catch_copy: 'この夏だけの、恐怖を。',
    cover_url: '',
    sections: [
      {
        id: 'sec1', order: 1,
        heading: '展示内容について',
        body: [
          { type:'text', text:'高校2年1組が総力を結集して作り上げたお化け屋敷です。\n今年のテーマは「廃病院」。本格的なセットと演出で、訪れた人を恐怖の世界へ誘います。' },
          { type:'break' },
          { type:'text', text:'所要時間は約10分。心臓の弱い方はご注意ください🎃' },
        ],
        media: [
          { id:'sm1', type:'image', url:'', caption:'入口の装飾' },
          { id:'sm2', type:'image', url:'', caption:'内部の様子' },
        ],
      },
      {
        id: 'sec2', order: 2,
        heading: '制作の裏側',
        body: [
          { type:'text', text:'放課後3ヶ月間、クラス全員で毎日準備してきました。' },
          { type:'break' },
          { type:'link', label:'マップで場所を確認する', href:'/map' },
        ],
        media: [
          { id:'sm3', type:'video', url:'', caption:'制作の様子' },
        ],
      },
    ],
    media: [
      { id:'m1', type:'image', url:'', caption:'全体の様子' },
      { id:'m2', type:'image', url:'', caption:'セット' },
      { id:'m3', type:'video', url:'', caption:'予告動画' },
    ],
  },
  {
    id: 'food1',
    name: '焼きそば・フランクフルト',
    class_label: '高3-1',
    type: 'food',
    room_display: 'クスノキ広場 A',
    floor: 1,
    day: 'both',
    catch_copy: '秘伝ソースで、ひとくち幸せ。',
    cover_url: '',
    sections: [],
    media: [],
  },
  {
    id: 'band1',
    name: '軽音楽部',
    type: 'band',
    room_display: 'サブアリーナ',
    floor: 2,
    day: 'both',
    catch_copy: '音楽で、つながる。',
    cover_url: '',
    sections: [],
    media: [],
  },
]

export const getExhibit = (id: string): ExhibitDetail | null =>
  DUMMY_EXHIBITS.find((e) => e.id === id) ?? null
