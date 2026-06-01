'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Exhibit } from '@/types'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'
import FloorSelector   from '@/components/map/FloorSelector'
import SearchBar       from '@/components/map/SearchBar'
import RoomSheet       from '@/components/map/RoomSheet'
import SideButtons     from '@/components/ui/SideButtons'
import InstallBanner   from '@/components/ui/InstallBanner'

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
  const [mapEnabled, setMapEnabled]     = useState<boolean | null>(null)
  const [exhibits, setExhibits]         = useState<Exhibit[]>([])
  const [floor, setFloor]               = useState(2)
  const [searchQuery, setSearchQuery]   = useState('')
  const [selectedRoom, setSelectedRoom]   = useState<string>('')
  const [sheetExhibits, setSheetExhibits] = useState<Exhibit[]>([])
  const [focusRoom, setFocusRoom]       = useState<string | null>(null)
  const floorRef                        = useRef(floor)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then((d: { map_enabled: boolean }) => setMapEnabled(d.map_enabled ?? true))
  }, [])

  const fetchExhibits = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('exhibits')
      .select('id, name, class_label, type, room_object, room_display, floor, has_wait_time, wait_minutes, is_active, day, thumbnail_url')
      .eq('is_active', true)
    if (data) setExhibits(data as Exhibit[])
  }, [])

  // プルダウン更新 / フォーカス復帰で再取得
  useRefreshOnFocus(fetchExhibits, 2 * 60 * 1000)
  useEffect(() => {
    window.addEventListener('app-refresh', fetchExhibits)
    return () => window.removeEventListener('app-refresh', fetchExhibits)
  }, [fetchExhibits])

  // Supabase から is_active な展示を全件取得し、リアルタイム更新も購読
  useEffect(() => {
    const supabase = createClient()

    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchExhibits()

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
            setSheetExhibits(prev => prev.filter(e => e.id !== updated.id))
          } else {
            setExhibits(prev =>
              prev.some(e => e.id === updated.id)
                ? prev.map(e => e.id === updated.id ? { ...e, ...updated } : e)
                : [...prev, updated]
            )
            setSheetExhibits(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchExhibits])

  const floorExhibits = useMemo(() => exhibits.filter(e => e.floor === floor), [exhibits, floor])

  // floorRef を常に最新に保つ
  useEffect(() => { floorRef.current = floor }, [floor])

  // 入力中：ハイライト更新のみ、フォーカスはしない
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
    setFocusRoom(null)
  }, [])

  // Enter 確定時：1件一致ならフォーカス・フロア移動
  const handleConfirm = useCallback((q: string) => {
    if (!q.trim()) return
    const lower = q.toLowerCase()
    const matches = exhibits.filter(e =>
      e.name.toLowerCase().includes(lower) ||
      (e.class_label?.toLowerCase().includes(lower) ?? false)
    )
    if (matches.length === 1) {
      const m = matches[0]
      if (m.floor !== undefined && m.floor !== floorRef.current) setFloor(m.floor)
      setFocusRoom(m.room_object ?? null)
    }
  }, [exhibits])

  const handleRoomClick = useCallback((nodeName: string) => {
    setSelectedRoom(nodeName)
    setSheetExhibits(exhibits.filter(e => e.room_object === nodeName))
  }, [exhibits])

  const handleClose = useCallback(() => {
    setSelectedRoom('')
    setSheetExhibits([])
  }, [])

  const handleFloorChange = useCallback((f: number) => {
    setFloor(f)
    handleClose()
  }, [handleClose])

  // サジェストから選択されたとき
  const handleSelect = useCallback((exhibit: Exhibit) => {
    if (exhibit.floor !== undefined && exhibit.floor !== floorRef.current) setFloor(exhibit.floor)
    setFocusRoom(exhibit.room_object ?? null)
  }, [])

  if (mapEnabled === false) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #e0f0ff 0%, #f0f8ff 100%)',
        gap: 16, padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 56 }}>🗺️</div>
        <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
          マップは現在非公開です
        </div>
        <div style={{ fontFamily: "'Kiwi Maru',serif", fontSize: 13, color: '#64748b', lineHeight: 1.8 }}>
          公開までしばらくお待ちください。
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      <MapCanvas
        floor={floor}
        exhibits={floorExhibits}
        searchQuery={searchQuery}
        focusRoom={focusRoom}
        onRoomClick={handleRoomClick}
      />

      <FloorSelector current={floor} onChange={handleFloorChange} />
      <SearchBar onSearch={handleSearch} onConfirm={handleConfirm} onSelect={handleSelect} exhibits={exhibits} />
      <SideButtons />

      {/* インストール誘導バナー（マップ上部に重ねて表示） */}
      <div style={{ position: 'absolute', top: 56, left: 0, right: 0, zIndex: 30, pointerEvents: 'auto' }}>
        <InstallBanner />
      </div>

      <RoomSheet
        exhibits={sheetExhibits}
        roomDisplay={
          sheetExhibits[0]?.room_display ??
          (selectedRoom ? `${selectedRoom}` : '')
        }
        floor={floor}
        onClose={handleClose}
      />
    </div>
  )
}
