/**
 * lib/exhibits.ts
 * 展示詳細ページ用の型・ダミーデータ
 */

import { ExhibitType, Day } from '@/types'

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

// ─── ダミーデータ ──────────────────────────────────────────────
export const DUMMY_EXHIBITS: ExhibitDetail[] = [
  // ── class（標準） ───────────────────────────────────────────
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
          { type:'text', text:'放課後3ヶ月間、クラス全員で毎日準備してきました。\n大道具・小道具・音響・照明・演者など、すべて自分たちで手がけています。' },
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

  // ── food（レストランメニュー） ──────────────────────────────
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
    sections: [
      {
        id: 'fsec1', order: 1,
        heading: 'こだわりのポイント',
        body: [
          { type:'text', text:'地元の老舗ソースメーカーと共同開発した秘伝ソースを使用。\n麺はもちもち食感にこだわり、特製ブレンドを採用しています。' },
        ],
        media: [],
      },
    ],
    media: [],
  },

  // ── band ───────────────────────────────────────────────────
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
