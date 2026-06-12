'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const FALLBACK_COLOR    = '#FF8C00'
const ANIM_DURATION_MS  = 14000 // フェードアウト完了までの合計時間

interface AnnouncementItem {
  scheduleId:       string
  groupName:        string
  location:         string
  startAt:          string
  color:            string
  remainingSeconds: number
  thumbnail_url?:   string
}

const PARTICLES = [
  { id: 0,  x: 12, y: 18, size: 2,   dur: 5.2, delay: 0.0 },
  { id: 1,  x: 83, y: 12, size: 1.5, dur: 4.1, delay: 0.7 },
  { id: 2,  x: 47, y: 78, size: 2.5, dur: 6.0, delay: 1.1 },
  { id: 3,  x: 91, y: 62, size: 1.0, dur: 4.6, delay: 0.3 },
  { id: 4,  x: 22, y: 88, size: 2.0, dur: 5.5, delay: 0.9 },
  { id: 5,  x: 68, y: 28, size: 1.5, dur: 3.8, delay: 1.6 },
  { id: 6,  x: 54, y: 92, size: 1.0, dur: 6.1, delay: 0.2 },
  { id: 7,  x:  7, y: 52, size: 2.5, dur: 4.0, delay: 1.3 },
  { id: 8,  x: 93, y: 82, size: 2.0, dur: 5.0, delay: 0.6 },
  { id: 9,  x: 36, y: 43, size: 1.5, dur: 4.7, delay: 1.9 },
  { id: 10, x: 60, y:  5, size: 1.0, dur: 3.5, delay: 0.4 },
  { id: 11, x: 75, y: 95, size: 2.0, dur: 5.8, delay: 1.0 },
]

type Phase = 'idle' | 'flash' | 'bars' | 'coming' | 'title' | 'underline' | 'details' | 'countdown' | 'fadeout'
const PHASE_ORDER: Phase[] = ['idle', 'flash', 'bars', 'coming', 'title', 'underline', 'details', 'countdown', 'fadeout']

const DEMO_ITEM: AnnouncementItem = {
  scheduleId:       '__preview__',
  groupName:        'デモ演出',
  location:         'メインアリーナ',
  startAt:          '12:00',
  color:            '#A855F7',
  remainingSeconds: 300,
  thumbnail_url:    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
}

export default function CinematicStageCall() {
  const [isPC, setIsPC]           = useState(false)
  const [queue, setQueue]         = useState<AnnouncementItem[]>([])
  const [activeItem, setActiveItem] = useState<AnnouncementItem | null>(null)
  const [phase, setPhase]         = useState<Phase>('idle')
  const [sidebarItems, setSidebarItems] = useState<AnnouncementItem[]>([])
  const [mouseX, setMouseX]       = useState(0)
  const [mouseY, setMouseY]       = useState(0)

  const shownRef = useRef<Set<string>>(new Set())

  // PC判定 + ?cinematic=preview でデモ即発火
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isPreview = params.get('cinematic') === 'preview'
    const check = () => setIsPC(isPreview || window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    if (isPreview) {
      const t = setTimeout(() => setActiveItem(DEMO_ITEM), 800)
      return () => { window.removeEventListener('resize', check); clearTimeout(t) }
    }
    return () => window.removeEventListener('resize', check)
  }, [])

  // マウスパララックス（演出中のみ）
  useEffect(() => {
    if (phase === 'idle') return
    const handler = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY) }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [phase])

  // キューから次の演出を取り出す（演出が終わったら自動で次へ）
  useEffect(() => {
    if (phase !== 'idle') return
    if (activeItem !== null) return
    if (queue.length === 0) return
    const [next, ...rest] = queue
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQueue(rest)
    setActiveItem(next)
  }, [phase, activeItem, queue])

  // Supabase からN分前公演を取得しキューに積む
  const checkUpcoming = useCallback(async () => {
    if (!isPC) return
    try {
      const res = await fetch('/api/admin/settings')
      const settings = await res.json() as {
        festival_sat: string
        festival_sun: string
        announcement_trigger_minutes?: number
      }
      const tm = settings.announcement_trigger_minutes ?? 5

      const now    = new Date()
      const jst    = new Date(now.getTime() + 9 * 60 * 60 * 1000)
      const today  = jst.toISOString().slice(0, 10)
      const nowMin = jst.getUTCHours() * 60 + jst.getUTCMinutes()

      let day: 'sat' | 'sun' | null = null
      if (settings.festival_sat === today) day = 'sat'
      else if (settings.festival_sun === today) day = 'sun'
      if (!day) return

      const supabase = createClient()
      const [{ data: exhibits }, { data: bands }] = await Promise.all([
        supabase
          .from('exhibits')
          .select('id, name, announcement_color, thumbnail_url, special_schedules(id, day, start_at, location)')
          .eq('is_active', true)
          .eq('enable_announcement', true),
        supabase
          .from('bands')
          .select('id, name, announcement_color, thumbnail_url, band_schedules(id, day, start_at, stage)')
          .eq('enable_announcement', true),
      ])

      type RawEx = {
        id: string; name: string; announcement_color: string | null; thumbnail_url: string | null
        special_schedules: { id: string; day: string; start_at: string; location: string | null }[]
      }
      type RawBand = {
        id: string; name: string; announcement_color: string | null; thumbnail_url: string | null
        band_schedules: { id: string; day: string; start_at: string; stage: string | null }[]
      }

      const newItems: AnnouncementItem[] = []

      const pushIfMatch = (
        schedId: string, schedDay: string, schedStartAt: string, location: string,
        name: string, color: string | null, thumbnailUrl: string | null,
      ) => {
        if (schedDay !== day) return
        if (shownRef.current.has(schedId)) return
        const [h, m] = schedStartAt.slice(0, 5).split(':').map(Number)
        const diff   = h * 60 + m - nowMin
        if (diff >= 0 && diff <= tm) {
          shownRef.current.add(schedId)
          newItems.push({
            scheduleId:       schedId,
            groupName:        name,
            location,
            startAt:          schedStartAt.slice(0, 5),
            color:            color ?? FALLBACK_COLOR,
            remainingSeconds: Math.max(0, diff * 60),
            thumbnail_url:    thumbnailUrl ?? undefined,
          })
        }
      }

      for (const ex of (exhibits ?? []) as unknown as RawEx[]) {
        for (const s of ex.special_schedules ?? []) {
          pushIfMatch(s.id, s.day, s.start_at, s.location ?? '', ex.name, ex.announcement_color, ex.thumbnail_url)
        }
      }
      for (const band of (bands ?? []) as unknown as RawBand[]) {
        for (const s of band.band_schedules ?? []) {
          pushIfMatch(s.id, s.day, s.start_at, s.stage ?? '', band.name, band.announcement_color, band.thumbnail_url)
        }
      }

      if (newItems.length > 0) {
        setQueue(prev => [...prev, ...newItems])
      }
    } catch {
      // 非重要な視覚機能のため silent fail
    }
  }, [isPC])

  useEffect(() => {
    if (!isPC) return
    checkUpcoming()
    const id = setInterval(checkUpcoming, 60_000)
    return () => clearInterval(id)
  }, [isPC, checkUpcoming])

  // アニメーションシーケンス
  useEffect(() => {
    if (!activeItem) return
    const thisItem = activeItem
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase('flash')
    const timers = [
      setTimeout(() => setPhase('bars'),       300),
      setTimeout(() => setPhase('coming'),    1800),
      setTimeout(() => setPhase('title'),     3500),
      setTimeout(() => setPhase('underline'), 5500),
      setTimeout(() => setPhase('details'),   7000),
      setTimeout(() => setPhase('countdown'), 9000),
      setTimeout(() => setPhase('fadeout'),  11500),
      setTimeout(() => {
        setPhase('idle')
        // 演出終了後 → サイドバーに移動（アニメ分14秒を引いた残り時間で）
        setSidebarItems(prev => [
          ...prev,
          { ...thisItem, remainingSeconds: Math.max(0, thisItem.remainingSeconds - Math.round(ANIM_DURATION_MS / 1000)) },
        ])
        setActiveItem(null)
      }, ANIM_DURATION_MS),
    ]
    return () => timers.forEach(clearTimeout)
  }, [activeItem])

  const phaseIdx  = PHASE_ORDER.indexOf(phase)
  const isAtLeast = (p: Phase) => phaseIdx >= PHASE_ORDER.indexOf(p)
  const px        = isPC && typeof window !== 'undefined' ? (mouseX / window.innerWidth  - 0.5) * 10 : 0
  const py        = isPC && typeof window !== 'undefined' ? (mouseY / window.innerHeight - 0.5) * 10 : 0

  return (
    <>
      <style>{`
        @keyframes csFlash    { 0%{opacity:1} 100%{opacity:0} }
        @keyframes csBarsIn   { from{transform:scaleY(0)} to{transform:scaleY(1)} }
        @keyframes csFadeOut  { from{opacity:1} to{opacity:0} }
        @keyframes csScan     { from{transform:translateY(0)} to{transform:translateY(100vh)} }
        @keyframes csFloat    { 0%,100%{opacity:0.35;transform:translateY(0)} 50%{opacity:0.8;transform:translateY(-14px)} }
        @keyframes csComing   { from{opacity:0;letter-spacing:0.55em} to{opacity:1;letter-spacing:0.2em} }
        @keyframes csTitle    { 0%{opacity:0;transform:scale(0.08)} 65%{opacity:1;transform:scale(1.07)} 100%{opacity:1;transform:scale(1)} }
        @keyframes csLine     { from{clip-path:inset(0 50% 0 50%)} to{clip-path:inset(0 0% 0 0%)} }
        @keyframes csFadeUp   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes csBgReveal { from{opacity:0} to{opacity:1} }
        @keyframes csPortrait { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
        @keyframes csSideIn   { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      {/* ── シネマティック演出オーバーレイ ── */}
      {isPC && activeItem && phase !== 'idle' && (
        <>
          {phase === 'flash' && (
            <div style={{
              position:'fixed', inset:0, zIndex:9999,
              background:'#fff', pointerEvents:'all',
              animation:'csFlash 0.3s ease-out forwards',
            }} />
          )}

          {isAtLeast('bars') && (
            <div style={{
              position:'fixed', inset:0, zIndex:9999,
              background: activeItem.thumbnail_url ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.88)',
              pointerEvents:'all', overflow:'hidden',
              animation: phase === 'fadeout' ? 'csFadeOut 1.5s ease forwards' : undefined,
            }}>
              {/* サムネイルぼかし背景 */}
              {activeItem.thumbnail_url && isAtLeast('title') && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeItem.thumbnail_url} alt=""
                  style={{
                    position:'absolute', inset:0, width:'100%', height:'100%',
                    objectFit:'cover', filter:'blur(28px) saturate(1.4)',
                    transform:'scale(1.08)', opacity:0.28, pointerEvents:'none',
                    animation:'csBgReveal 1.2s ease forwards',
                  }}
                />
              )}

              {/* フィルムグレイン */}
              <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.045, pointerEvents:'none' }}>
                <filter id="csGrain">
                  <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                  <feColorMatrix type="saturate" values="0" />
                </filter>
                <rect width="100%" height="100%" filter="url(#csGrain)" />
              </svg>

              {/* 走査線 */}
              <div style={{
                position:'absolute', top:0, left:0, right:0, height:3,
                background:`linear-gradient(90deg, transparent, ${activeItem.color}70, transparent)`,
                animation:'csScan 4s linear infinite', pointerEvents:'none',
              }} />

              {/* ビネット */}
              <div style={{
                position:'absolute', inset:0, pointerEvents:'none',
                background:'radial-gradient(ellipse at center, transparent 22%, rgba(0,0,0,0.68) 100%)',
              }} />

              {/* 浮遊パーティクル */}
              {PARTICLES.map(p => (
                <div key={p.id} style={{
                  position:'absolute', left:`${p.x}%`, top:`${p.y}%`,
                  width:p.size, height:p.size, borderRadius:'50%',
                  background:activeItem.color, boxShadow:`0 0 ${p.size*4}px ${activeItem.color}`,
                  animation:`csFloat ${p.dur}s ease-in-out ${p.delay}s infinite`,
                  pointerEvents:'none',
                }} />
              ))}

              {/* レターボックス上帯 */}
              <div style={{
                position:'absolute', top:0, left:0, right:0, height:'13%',
                background:'#000', transformOrigin:'top',
                animation:'csBarsIn 0.5s ease forwards',
              }} />
              {/* レターボックス下帯 */}
              <div style={{
                position:'absolute', bottom:0, left:0, right:0, height:'13%',
                background:'#000', transformOrigin:'bottom',
                animation:'csBarsIn 0.5s ease forwards',
              }} />

              {/* 中央コンテンツ */}
              <div style={{
                position:'absolute', inset:0,
                display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center',
                transform:`translate(${px}px, ${py}px)`,
                transition:'transform 0.15s ease',
              }}>
                {isAtLeast('coming') && (
                  <div style={{
                    fontSize:11, color:'rgba(255,255,255,0.45)',
                    fontFamily:"'Kaisei Decol',serif", fontWeight:700,
                    letterSpacing:'0.2em', textTransform:'uppercase',
                    marginBottom:22, animation:'csComing 0.7s ease forwards',
                  }}>
                    COMING NEXT
                  </div>
                )}

                {isAtLeast('title') && (
                  <div style={{
                    fontFamily:"'Kaisei Decol',serif",
                    fontSize:'clamp(28px, 4.5vw, 68px)',
                    fontWeight:900, color:'#fff',
                    textAlign:'center', lineHeight:1.15, maxWidth:'65vw',
                    textShadow:`0 0 30px ${activeItem.color}, 0 0 80px ${activeItem.color}55`,
                    animation:'csTitle 1s cubic-bezier(0.34,1.56,0.64,1) forwards',
                  }}>
                    {activeItem.groupName}
                  </div>
                )}

                {isAtLeast('underline') && (
                  <div style={{
                    height:2, width:'38vw', maxWidth:380, marginTop:18,
                    background:`linear-gradient(90deg, transparent, ${activeItem.color}, transparent)`,
                    animation:'csLine 0.5s ease forwards',
                  }} />
                )}

                {isAtLeast('details') && activeItem.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeItem.thumbnail_url} alt={activeItem.groupName}
                    style={{
                      width:140, height:140, borderRadius:20, objectFit:'cover',
                      marginTop:22,
                      border:`2.5px solid ${activeItem.color}`,
                      boxShadow:`0 0 24px ${activeItem.color}70, 0 8px 32px rgba(0,0,0,0.5)`,
                      animation:'csPortrait 0.6s cubic-bezier(0.34,1.4,0.64,1) forwards',
                    }}
                  />
                )}

                {isAtLeast('details') && (
                  <div style={{
                    marginTop: activeItem.thumbnail_url ? 16 : 18,
                    display:'flex', flexDirection:'column', alignItems:'center', gap:7,
                  }}>
                    <div style={{
                      fontFamily:"'Kiwi Maru',serif", fontSize:14, color:'rgba(255,255,255,0.65)',
                      animation:'csFadeUp 0.5s ease forwards',
                    }}>
                      📍 {activeItem.location}
                    </div>
                    <div style={{
                      fontFamily:"'Kiwi Maru',serif", fontSize:14, color:'rgba(255,255,255,0.65)',
                      animation:'csFadeUp 0.5s 0.18s ease both',
                    }}>
                      🕐 {activeItem.startAt} 開始
                    </div>
                  </div>
                )}

                {isAtLeast('countdown') && (
                  <CountdownCircle initialSeconds={activeItem.remainingSeconds} color={activeItem.color} />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 左下サイドバー（演出終了後に残る・上へ積む）── */}
      {isPC && sidebarItems.length > 0 && (
        <div style={{
          position:'fixed', left:16, bottom:16,
          zIndex:9998,
          display:'flex', flexDirection:'column-reverse', gap:10,
          maxHeight:'80vh', overflowY:'auto',
          scrollbarWidth:'none',
        }}>
          {sidebarItems.map(si => (
            <SidebarCard
              key={si.scheduleId}
              item={si}
              onExpire={() => setSidebarItems(prev => prev.filter(i => i.scheduleId !== si.scheduleId))}
            />
          ))}
        </div>
      )}
    </>
  )
}

// ─── 右端ミニカード ────────────────────────────────────────────
function SidebarCard({ item, onExpire }: { item: AnnouncementItem; onExpire: () => void }) {
  const [secs, setSecs] = useState(item.remainingSeconds)
  const onExpireRef = useRef(onExpire)
  useEffect(() => { onExpireRef.current = onExpire })

  useEffect(() => {
    if (secs <= 0) { onExpireRef.current(); return }
    const id = setTimeout(() => setSecs(s => s - 1), 1000)
    return () => clearTimeout(id)
  }, [secs])

  if (secs <= 0) return null

  const displayMin = Math.floor(secs / 60)
  const displaySec = secs % 60
  const color      = item.color
  const progress   = item.remainingSeconds > 0 ? secs / item.remainingSeconds : 0

  return (
    <div style={{
      background:'rgba(10,10,10,0.82)',
      backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
      borderRadius:14, padding:'10px 12px', width:188,
      border:`1px solid ${color}35`,
      boxShadow:`0 4px 24px rgba(0,0,0,0.45), inset 0 0 0 1px ${color}15`,
      display:'flex', flexDirection:'column', gap:7,
      animation:'csSideIn 0.4s ease forwards',
      flexShrink:0,
    }}>
      {/* サムネ + 団体名 */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        {item.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail_url} alt=""
            style={{
              width:36, height:36, borderRadius:8, objectFit:'cover', flexShrink:0,
              border:`1.5px solid ${color}55`,
            }}
          />
        )}
        <div style={{
          fontFamily:"'Kaisei Decol',serif",
          fontSize:12, fontWeight:700, color:'#fff',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1,
        }}>
          {item.groupName}
        </div>
      </div>

      {/* 場所 */}
      <div style={{
        fontSize:10, color:'rgba(255,255,255,0.45)',
        fontFamily:"'Kiwi Maru',serif",
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      }}>
        📍 {item.location}　🕐 {item.startAt}
      </div>

      {/* カウントダウン */}
      <div style={{
        fontFamily:"'Kaisei Decol',serif",
        fontSize:15, fontWeight:900, color,
        letterSpacing:'0.03em',
      }}>
        <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)', fontFamily:"'Kiwi Maru',serif", marginRight:4 }}>
          あと
        </span>
        {displayMin > 0
          ? `${displayMin}分 ${String(displaySec).padStart(2, '0')}秒`
          : `${displaySec}秒`}
      </div>

      {/* プログレスバー */}
      <div style={{ height:2, background:'rgba(255,255,255,0.08)', borderRadius:1, overflow:'hidden' }}>
        <div style={{
          height:'100%', borderRadius:1, background:color,
          width:`${progress * 100}%`,
          transition:'width 1s linear',
          boxShadow:`0 0 6px ${color}`,
        }} />
      </div>
    </div>
  )
}

// ─── カウントダウン円（シネマ内）────────────────────────────────
function CountdownCircle({ initialSeconds, color }: { initialSeconds: number; color: string }) {
  const [secs, setSecs] = useState(initialSeconds)

  useEffect(() => {
    const id = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  const r          = 38
  const circ       = 2 * Math.PI * r
  const dashOffset = circ * (1 - secs / Math.max(1, initialSeconds))
  const displayMin = Math.floor(secs / 60)
  const displaySec = secs % 60

  return (
    <div style={{
      marginTop:28, position:'relative', width:96, height:96,
      animation:'csFadeUp 0.5s ease forwards',
    }}>
      <svg width={96} height={96} style={{ position:'absolute', inset:0, transform:'rotate(-90deg)' }}>
        <circle cx={48} cy={48} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={3} />
        <circle
          cx={48} cy={48} r={r} fill="none"
          stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={dashOffset}
          style={{ transition:'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div style={{
        position:'absolute', inset:0,
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
      }}>
        <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:19, fontWeight:900, color, lineHeight:1 }}>
          {displayMin}:{String(displaySec).padStart(2, '0')}
        </div>
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', fontFamily:"'Kiwi Maru',serif", marginTop:3 }}>
          まで
        </div>
      </div>
    </div>
  )
}
