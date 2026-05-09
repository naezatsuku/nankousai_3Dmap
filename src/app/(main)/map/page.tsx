'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Exhibit } from '@/types'
import FloorSelector from '@/components/map/FloorSelector'
import SearchBar     from '@/components/map/SearchBar'
import RoomSheet     from '@/components/map/RoomSheet'
import SideButtons   from '@/components/ui/SideButtons'

// Three.js は SSR 不可
const MapCanvas = dynamic(() => import('@/components/map/MapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center"
         style={{ background: '#b8e0f7' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-white/60 border-t-white rounded-full animate-spin" />
        <span style={{ fontFamily:"'Kiwi Maru',serif", fontSize:12, color:'rgba(255,255,255,0.8)' }}>
          マップを読み込み中…
        </span>
      </div>
    </div>
  ),
})

// ─── 試作用ダミーデータ（後で Supabase から取得）───────────
const DUMMY_EXHIBITS: Exhibit[] = [
  { id:'1',  name:'高2-1 お化け屋敷', class_label:'高2-1', type:'class',     room_object:'201',  room_display:'201教室',       floor:2, wait_minutes:15, is_active:true, day:'both' ,thumbnail_url:"https://fastly.picsum.photos/id/788/100/100.jpg?hmac=z9gilrMcmA38nDPv5YJuKSAigFZAZKrTcYuEOqBTPWo"},
  { id:'2',  name:'高2-2 カフェ',      class_label:'高2-2', type:'class',     room_object:'202',  room_display:'202教室',       floor:2, wait_minutes:5,  is_active:true, day:'both' },
  { id:'3',  name:'高2-3 縁日',        class_label:'高2-3', type:'class',     room_object:'203',  room_display:'203教室',       floor:2, wait_minutes:40, is_active:true, day:'both' },
  { id:'4',  name:'メインアリーナ',                          type:'special',   room_object:'main', room_display:'メインアリーナ', floor:2, wait_minutes:20, is_active:true, day:'both' },
  { id:'5',  name:'軽音楽部',                                type:'band',      room_object:'sub',  room_display:'サブアリーナ',   floor:2, wait_minutes:8,  is_active:true, day:'both' },
  { id:'6',  name:'高1-3 謎解き',      class_label:'高1-3', type:'class',     room_object:'103',  room_display:'103教室',       floor:1, wait_minutes:5,  is_active:true, day:'both' },
  { id:'7',  name:'高1-4 VR体験',      class_label:'高1-4', type:'class',     room_object:'104',  room_display:'104教室',       floor:1, wait_minutes:25, is_active:true, day:'both' },
  { id:'8',  name:'食堂',                                    type:'cafeteria', room_object:'108',  room_display:'食堂',           floor:1, wait_minutes:10, is_active:true, day:'both' },
  { id:'9',  name:'中3-1 写真展',      class_label:'中3-1', type:'class',     room_object:'301',  room_display:'301教室',       floor:3, wait_minutes:0,  is_active:true, day:'both' },
  { id:'10', name:'中3-3 映画上映',    class_label:'中3-3', type:'class',     room_object:'308',  room_display:'308教室',       floor:3, wait_minutes:30, is_active:true, day:'both' },
]

export default function MapPage() {
  const [floor, setFloor]               = useState(2)
  const [searchQuery, setSearchQuery]   = useState('')
  const [selectedRoom, setSelectedRoom] = useState<string>('')
  const [sheetExhibit, setSheetExhibit] = useState<Exhibit | null>(null)

  const floorExhibits = DUMMY_EXHIBITS.filter((e) => e.floor === floor)

  const handleRoomClick = useCallback((nodeName: string) => {
    const exhibit = DUMMY_EXHIBITS.find((e) => e.room_object === nodeName) ?? null
    setSelectedRoom(nodeName)
    setSheetExhibit(exhibit)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedRoom('')
    setSheetExhibit(null)
  }, [])

  const handleFloorChange = useCallback((f: number) => {
    setFloor(f)
    handleClose()
  }, [handleClose])

  return (
    <div className="absolute inset-0">
      {/* Three.js マップ（全画面） */}
      <MapCanvas
        floor={floor}
        exhibits={floorExhibits}
        searchQuery={searchQuery}
        onRoomClick={handleRoomClick}
      />

      {/* ── オーバーレイ UI ── */}

      {/* フロアセレクター（左上） */}
      <FloorSelector current={floor} onChange={handleFloorChange} />

      {/* 検索バー（右上） */}
      <SearchBar onSearch={setSearchQuery} />

      {/* 右サイドボタン */}
      <SideButtons />

      {/* ボトムシート */}
      <RoomSheet
        exhibit={sheetExhibit}
        roomDisplay={
          sheetExhibit?.room_display ??
          (selectedRoom ? `${selectedRoom}` : '')
        }
        floor={floor}
        onClose={handleClose}
      />
    </div>
  )
}
