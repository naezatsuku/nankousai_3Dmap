'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
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

export default function MapPage() {
  const [exhibits, setExhibits]         = useState<Exhibit[]>([])
  const [floor, setFloor]               = useState(2)
  const [searchQuery, setSearchQuery]   = useState('')
  const [selectedRoom, setSelectedRoom] = useState<string>('')
  const [sheetExhibit, setSheetExhibit] = useState<Exhibit | null>(null)

  // Supabase から is_active な展示を全件取得し、リアルタイム更新も購読
  useEffect(() => {
    const supabase = createClient()

    supabase
      .from('exhibits')
      .select('id, name, class_label, type, room_object, room_display, floor, wait_minutes, is_active, day, thumbnail_url')
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) setExhibits(data as Exhibit[])
      })

    // 待ち時間のリアルタイム更新
    const channel = supabase
      .channel('exhibits-map')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'exhibits' },
        (payload) => {
          const updated = payload.new as Exhibit
          if (!updated.is_active) {
            setExhibits(prev => prev.filter(e => e.id !== updated.id))
            setSheetExhibit(prev => prev?.id === updated.id ? null : prev)
          } else {
            setExhibits(prev =>
              prev.some(e => e.id === updated.id)
                ? prev.map(e => e.id === updated.id ? { ...e, ...updated } : e)
                : [...prev, updated]
            )
            setSheetExhibit(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const floorExhibits = exhibits.filter(e => e.floor === floor)

  const handleRoomClick = useCallback((nodeName: string) => {
    const exhibit = exhibits.find(e => e.room_object === nodeName) ?? null
    setSelectedRoom(nodeName)
    setSheetExhibit(exhibit)
  }, [exhibits])

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
      <MapCanvas
        floor={floor}
        exhibits={floorExhibits}
        searchQuery={searchQuery}
        onRoomClick={handleRoomClick}
      />

      <FloorSelector current={floor} onChange={handleFloorChange} />
      <SearchBar onSearch={setSearchQuery} />
      <SideButtons />

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
