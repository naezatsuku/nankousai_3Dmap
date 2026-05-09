'use client'

/**
 * RoomSheet
 * ─────────────────────────────────────────────────────
 * ・useRouter → Link に変更（App Router対応）
 * ・TabBar と重ならないよう、シートは map の absolute 内ではなく
 *   layout の main 内の固定位置に置くこと。
 *   → このコンポーネント自体は position:fixed を使わず、
 *     親（layout）が <RoomSheet> を TabBar の上かつ
 *     main の中に配置する構造にする。
 *   → z-index は TabBar(z-50) より高い z-[60] に設定。
 *     ただし、このシートは main 内の absolute なので
 *     TabBar（main の外）とは重ならない。
 *
 * ▶ 使い方
 *   page.tsx の return は以下の構造にする:
 *
 *   // (main)/layout.tsx
 *   <div style={{ display:'flex', flexDirection:'column', height:'100dvh' }}>
 *     <Header />
 *     <main style={{ flex:1, position:'relative', overflow:'hidden' }}>
 *       {children}          ← MapPage がここに入る
 *     </main>
 *     <TabBar />            ← main の外
 *   </div>
 *
 *   // map/page.tsx
 *   <div className="absolute inset-0">
 *     <MapCanvas ... />
 *     <FloorSelector ... />
 *     <SearchBar ... />
 *     <SideButtons />
 *     <RoomSheet ... />     ← absolute inset-0 の中 → TabBar と重ならない
 *   </div>
 */

import Link        from 'next/link'
import { Exhibit } from '@/types'

interface RoomSheetProps {
  exhibit:     Exhibit | null
  roomDisplay: string
  floor:       number
  onClose:     () => void
}

const WAIT_COLOR = (min: number): string => {
  if (min === 0)  return '#4ade80'
  if (min <= 10)  return '#facc15'
  if (min <= 25)  return '#fb923c'
  return '#f87171'
}

const TYPE_LABEL: Record<Exhibit['type'], string> = {
  class:     '展示',
  food:      'フード',
  band:      '軽音楽部',
  special:   'スペシャル',
  cafeteria: '食堂',
}

/** 待ち時間 → ラベルテキスト */
const waitLabel = (min: number) =>
  min === 0 ? '待ちなし' : `約 ${min} 分`

export default function RoomSheet({
  exhibit,
  roomDisplay,
  floor,
  onClose,
}: RoomSheetProps) {
  const open = exhibit !== null

  return (
    <>
      {/* ── オーバーレイ（背景暗幕） ── */}
      <div
        onClick={onClose}
        style={{
          position:       'absolute',
          inset:          0,
          zIndex:         60,
          background:     open ? 'rgba(0,0,0,0.25)' : 'transparent',
          backdropFilter: open ? 'blur(2px)' : 'none',
          WebkitBackdropFilter: open ? 'blur(2px)' : 'none',
          pointerEvents:  open ? 'auto' : 'none',
          transition:     'background 0.3s, backdrop-filter 0.3s',
        }}
      />

      {/* ── シート本体 ── */}
      <div
        style={{
          position:      'absolute',
          bottom:        0,
          left:          0,
          right:         0,
          zIndex:        70,
          background:    '#fff',
          borderRadius:  '24px 24px 0 0',
          boxShadow:     '0 -10px 40px rgba(0,0,0,0.12)',
          transform:     open ? 'translateY(0)' : 'translateY(100%)',
          transition:    'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
          willChange:    'transform',
          // セーフエリア（iPhone ホームバー）
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* ハンドル */}
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 8px' }}>
          <div style={{ width:40, height:6, borderRadius:99, background:'#f0f0f0' }} />
        </div>

        {exhibit && (
          <div style={{ padding:'0 20px 32px' }}>

            {/* 閉じるボタン */}
            <button
              onClick={onClose}
              style={{
                position:        'absolute',
                top:             14,
                right:           20,
                width:           32,
                height:          32,
                borderRadius:    '50%',
                background:      '#f8f8f8',
                border:          'none',
                color:           '#aaa',
                fontSize:        14,
                cursor:          'pointer',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
              }}
            >
              ✕
            </button>

            {/* ── メインコンテンツ ── */}
            <div style={{ display:'flex', gap:16, alignItems:'flex-start', marginTop:8 }}>

              {/* サムネイル */}
              <div
                style={{
                  width:          72,
                  height:         72,
                  borderRadius:   16,
                  flexShrink:     0,
                  overflow:       'hidden',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  background:     'linear-gradient(135deg,#FFD166 0%,#FF8C00 100%)',
                  fontSize:       28,
                }}
              >
                {exhibit.thumbnail_url
                  ? <img src={exhibit.thumbnail_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : '🎨'
                }
              </div>

              {/* テキスト */}
              <div style={{ flex:1, minWidth:0, paddingTop:4 }}>
                <p style={{
                  fontSize:12, color:'#aaa', marginBottom:4,
                  fontFamily:"'Kiwi Maru',sans-serif",
                }}>
                  {roomDisplay} · {floor}F
                </p>
                <h3 style={{
                  fontSize:20, fontWeight:700, color:'#1a1a1a',
                  fontFamily:"'Kaisei Decol',serif",
                  lineHeight:1.25, marginBottom:8,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                }}>
                  {exhibit.name}
                </h3>
                <span style={{
                  display:'inline-block',
                  fontSize:11, padding:'3px 12px',
                  borderRadius:99,
                  background:'#FFF0E0', color:'#FF8C00',
                  fontFamily:"'Kiwi Maru',sans-serif",
                  fontWeight:700,
                }}>
                  {TYPE_LABEL[exhibit.type]}
                </span>
              </div>
            </div>

            {/* ── 混雑状況バー ── */}
            <div style={{
              marginTop:20, padding:16,
              borderRadius:16, background:'#fafafa',
              border:'1px solid #f0f0f0',
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:12, fontWeight:700, color:'#888', fontFamily:"'Kiwi Maru',sans-serif" }}>
                  混雑状況
                </span>
                <span style={{
                  fontSize:14, fontWeight:900,
                  color: WAIT_COLOR(exhibit.wait_minutes),
                  fontFamily:"'Kiwi Maru',sans-serif",
                }}>
                  {waitLabel(exhibit.wait_minutes)}
                </span>
              </div>
              <div style={{ width:'100%', height:8, borderRadius:99, background:'#ececec', overflow:'hidden' }}>
                <div
                  style={{
                    height:          '100%',
                    borderRadius:    99,
                    width:           `${Math.max(6, Math.min(exhibit.wait_minutes * 1.5, 100))}%`,
                    background:      `linear-gradient(90deg,#FFD166,${WAIT_COLOR(exhibit.wait_minutes)})`,
                    transition:      'width 0.8s ease',
                  }}
                />
              </div>
            </div>

            {/* ── 詳細ボタン（Link） ── */}
            <Link
              href={`/exhibit/${exhibit.id}`}
              style={{
                display:         'block',
                marginTop:       20,
                padding:         '14px 0',
                borderRadius:    16,
                background:      'linear-gradient(100deg,#F07818,#FFAA28)',
                color:           '#fff',
                fontSize:        16,
                fontWeight:      700,
                textAlign:       'center',
                textDecoration:  'none',
                fontFamily:      "'Kaisei Decol',serif",
                boxShadow:       '0 6px 20px rgba(240,120,24,0.3)',
              }}
            >
              展示の詳細を見る →
            </Link>

          </div>
        )}
      </div>
    </>
  )
}
