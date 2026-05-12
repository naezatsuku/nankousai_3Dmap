import { createClient } from '@/lib/supabase/client'
import type { FoodMenu } from '@/types'

export interface StallExhibit {
  id: string
  name: string
  class_label: string
  is_high3: boolean
  location: string
  thumbnail_url?: string
}

export interface FoodMenuWithStall extends FoodMenu {
  stall: StallExhibit
}

interface RawMenu {
  id: string
  exhibit_id: string
  name: string
  price: number
  image_url: string | null
  description: string | null
  stock: number
  is_selling: boolean
  sold_count: number
  exhibits: {
    id: string
    name: string
    class_label: string | null
    room_display: string | null
    thumbnail_url: string | null
  } | null
}

export const DUMMY_STALLS: StallExhibit[] = [
  { id: 'e1', name: '3年1組', class_label: '高3-1', is_high3: true,  location: 'クスノキ広場 A' },
  { id: 'e2', name: '3年2組', class_label: '高3-2', is_high3: true,  location: 'クスノキ広場 B' },
  { id: 'e3', name: '3年3組', class_label: '高3-3', is_high3: true,  location: 'クスノキ広場 C' },
  { id: 'e4', name: '3年4組', class_label: '高3-4', is_high3: true,  location: 'クスノキ広場 D' },
  { id: 'e5', name: '3年5組', class_label: '高3-5', is_high3: true,  location: 'クスノキ広場 E' },
  { id: 'e6', name: '食堂',   class_label: '食堂',  is_high3: false, location: '1F 食堂' },
]

export const DUMMY_MENUS: FoodMenuWithStall[] = [
  { id: 'm01', exhibit_id:'e1', name:'焼きそば',           price:300, description:'秘伝ソースの本格派',  stock:12, is_selling:true,  sold_count:87,  stall:DUMMY_STALLS[0] },
  { id: 'm02', exhibit_id:'e1', name:'フランクフルト',      price:200, description:'ジューシー！',        stock:0,  is_selling:true,  sold_count:54,  stall:DUMMY_STALLS[0] },
  { id: 'm03', exhibit_id:'e2', name:'唐揚げ（5個）',       price:350, description:'カリッと揚げたて',    stock:30, is_selling:true,  sold_count:102, stall:DUMMY_STALLS[1] },
  { id: 'm04', exhibit_id:'e2', name:'フライドポテト',      price:250, description:'塩・ケチャップ選べる', stock:45, is_selling:true,  sold_count:78,  stall:DUMMY_STALLS[1] },
  { id: 'm05', exhibit_id:'e3', name:'クレープ（チョコ）',  price:400, description:'ベルギーチョコ使用',  stock:8,  is_selling:true,  sold_count:65,  stall:DUMMY_STALLS[2] },
  { id: 'm06', exhibit_id:'e3', name:'クレープ（イチゴ）',  price:400, description:'フレッシュいちご',    stock:5,  is_selling:true,  sold_count:61,  stall:DUMMY_STALLS[2] },
  { id: 'm07', exhibit_id:'e3', name:'クレープ（抹茶）',    price:420, description:'京都抹茶クリーム',    stock:0,  is_selling:false, sold_count:38,  stall:DUMMY_STALLS[2] },
  { id: 'm08', exhibit_id:'e4', name:'タコス',              price:380, description:'本格メキシカン',      stock:20, is_selling:true,  sold_count:49,  stall:DUMMY_STALLS[3] },
  { id: 'm09', exhibit_id:'e4', name:'ナチョス',             price:300, description:'チーズたっぷり',      stock:18, is_selling:true,  sold_count:33,  stall:DUMMY_STALLS[3] },
  { id: 'm10', exhibit_id:'e5', name:'タピオカミルクティー', price:350, description:'もちもちタピオカ',   stock:25, is_selling:true,  sold_count:95,  stall:DUMMY_STALLS[4] },
  { id: 'm11', exhibit_id:'e5', name:'レモネード',           price:250, description:'国産レモン使用',      stock:30, is_selling:true,  sold_count:71,  stall:DUMMY_STALLS[4] },
  { id: 'm12', exhibit_id:'e5', name:'チャイティー',         price:300, description:'スパイス香る',        stock:0,  is_selling:true,  sold_count:28,  stall:DUMMY_STALLS[4] },
  { id: 'm13', exhibit_id:'e6', name:'日替わり定食',         price:550, description:'今日は唐揚げ定食',   stock:50, is_selling:true,  sold_count:0,   stall:DUMMY_STALLS[5] },
  { id: 'm14', exhibit_id:'e6', name:'うどん',               price:350, description:'出汁が自慢',          stock:40, is_selling:true,  sold_count:0,   stall:DUMMY_STALLS[5] },
]

export interface FoodData {
  stalls: StallExhibit[]
  menus:  FoodMenuWithStall[]
}

export async function fetchFoodData(): Promise<FoodData> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('food_menus')
      .select('*, exhibits(id, name, class_label, room_display, thumbnail_url)')
      .order('exhibit_id')

    if (error || !data) return { stalls: DUMMY_STALLS, menus: DUMMY_MENUS }

    const stallMap = new Map<string, StallExhibit>()
    const menus: FoodMenuWithStall[] = (data as unknown as RawMenu[]).map(raw => {
      const ex = raw.exhibits
      const cl = ex?.class_label ?? ''
      const stall: StallExhibit = {
        id:            ex?.id ?? raw.exhibit_id,
        name:          ex?.name ?? '',
        class_label:   cl,
        is_high3:      cl.startsWith('高3'),
        location:      ex?.room_display ?? '',
        thumbnail_url: ex?.thumbnail_url ?? undefined,
      }
      if (!stallMap.has(stall.id)) stallMap.set(stall.id, stall)

      return {
        id:          raw.id,
        exhibit_id:  raw.exhibit_id,
        name:        raw.name,
        price:       raw.price,
        image_url:   raw.image_url ?? undefined,
        description: raw.description ?? undefined,
        stock:       raw.stock,
        is_selling:  raw.is_selling,
        sold_count:  raw.sold_count,
        stall,
      }
    })

    const stalls = Array.from(stallMap.values())
    return stalls.length > 0 ? { stalls, menus } : { stalls: DUMMY_STALLS, menus: DUMMY_MENUS }
  } catch {
    return { stalls: DUMMY_STALLS, menus: DUMMY_MENUS }
  }
}
