// components/map/MapMarkers.tsx
'use client'

import { Exhibit } from '@/types'

interface MarkerData {
  id: string
  x: number
  y: number
}

interface MapMarkersProps {
  markers: MarkerData[]
  exhibits: Exhibit[]
  onMarkerClick: (nodeName: string) => void
}

const WAIT_COLOR = (min: number) => {
  if (min === 0)  return '#4ade80' // 緑
  if (min <= 15) return '#facc15' // 黄
  return '#ef4444' // 赤
}

export default function MapMarkers({ markers, exhibits, onMarkerClick }: MapMarkersProps) {
  const exhibitMap: Record<string, Exhibit> = {}
  for (const e of exhibits) {
    for (const room of e.room_object ?? []) {
      exhibitMap[room] = e
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {markers.map((m) => {
        const exhibit = exhibitMap[m.id]
        if (!exhibit) return null

        // 待ち時間メーターの割合 (60分で100%とする)
        const hasWait = exhibit.has_wait_time !== false
        const waitPercent = hasWait ? Math.min((exhibit.wait_minutes / 60) * 100, 100) : 0
        const color = hasWait ? WAIT_COLOR(exhibit.wait_minutes) : '#e2e8f0'

        return (
          <div
            key={m.id}
            className="absolute transition-transform duration-75"
            style={{
              left: m.x,
              top: m.y,
              transform: 'translate(-50%, -100%) translateY(-12px)',
            }}
          >
            <button
              onClick={() => onMarkerClick(m.id)}
              className="pointer-events-auto relative active:scale-90 transition-transform"
            >
              {/* 外枠（待ち時間メーター） */}
              <div
                className="w-10 h-10 rounded-full p-[2.5px] shadow-lg bg-white"
                style={{
                  background: hasWait
                    ? `conic-gradient(${color} ${waitPercent}%, #e2e8f0 ${waitPercent}% 100%)`
                    : '#e2e8f0'
                }}
              >
                {/* イメージ写真の丸枠 */}
                <div className="w-full h-full rounded-full bg-white overflow-hidden border border-white flex items-center justify-center">
                  {exhibit.thumbnail_url ? (
                    <img src={exhibit.thumbnail_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-[3px] font-bold text-orange-400">{exhibit.class_label || m.id}</span>
                  )}
                </div>
              </div>
              
              {/* 下の三角チップ */}
              <div 
                className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] mx-auto"
                style={{ borderTopColor: color }}
              />
            </button>
          </div>
        )
      })}
    </div>
  )
}