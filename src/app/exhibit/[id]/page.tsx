'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getExhibit, fetchExhibitDetail, ExhibitDetail, ExhibitSection, SectionMedia, ExhibitMedia, BodySegment } from '@/lib/exhibits'
import { useState, useEffect } from 'react'
import { FoodMenu, getFoodMenuStatus } from '@/types'
import { createClient } from '@/lib/supabase/client'

const TYPE_LABEL: Record<string, string> = {
  class:'展示', food:'フード', band:'軽音楽部', special:'スペシャル', cafeteria:'食堂',
}

export default function ExhibitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [exhibit, setExhibit] = useState<ExhibitDetail | null>(() => getExhibit(id))
  const [foodMenus, setFoodMenus] = useState<FoodMenu[]>([])

  useEffect(() => {
    fetchExhibitDetail(id).then(data => { if (data) setExhibit(data) })
  }, [id])

  const exhibitId   = exhibit?.id
  const exhibitType = exhibit?.type

  useEffect(() => {
    if (!exhibitId || (exhibitType !== 'food' && exhibitType !== 'cafeteria')) return
    const supabase = createClient()

    supabase
      .from('food_menus')
      .select('id, exhibit_id, name, price, image_url, description, stock, is_selling, sold_count')
      .eq('exhibit_id', exhibitId)
      .then(({ data }) => { if (data) setFoodMenus(data as FoodMenu[]) })

    const channel = supabase
      .channel(`food-menus-${exhibitId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'food_menus', filter: `exhibit_id=eq.${exhibitId}` },
        (payload) => {
          const updated = payload.new as FoodMenu
          setFoodMenus(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [exhibitId, exhibitType])

  if (!exhibit) {
    return (
      <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, color:'#bbb' }}>
        <span style={{ fontSize:48 }}>🔍</span>
        <span style={{ fontFamily:"'Kiwi Maru',serif", fontSize:14 }}>展示が見つかりませんでした</span>
        <Link href="/map" style={{ color:'#FF8C00', fontWeight:700, fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>マップに戻る</Link>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <div style={{ height:'100%', overflowY:'auto', background:'#fff' }}>
        {/* ── ヒーロー ── */}
        <Hero exhibit={exhibit} />

        {/* ── 情報エリア ── */}
        <InfoSection exhibit={exhibit} />

        {/* ── type別コンテンツ ── */}
        {exhibit.type === 'food' || exhibit.type === 'cafeteria'
          ? <FoodContent exhibit={exhibit} menus={foodMenus} />
          : exhibit.type === 'band'
          ? <BandContent />
          : <StandardContent exhibit={exhibit} />
        }

        {/* ── ギャラリー ── */}
        {exhibit.media.length > 0 && <Gallery media={exhibit.media} />}

        {/* ── マップボタン（固定） ── */}
        <div style={{ padding:'16px 16px 32px' }}>
          <Link href="/map" style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            padding:'14px 0', borderRadius:16,
            background:'#f8f9fa', border:'1px solid #e0e0e0',
            color:'#555', textDecoration:'none',
            fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
            マップで場所を確認する
          </Link>
        </div>
      </div>
    </>
  )
}

// ─── ヒーロー ──────────────────────────────────────────────────
function Hero({ exhibit }: { exhibit: ExhibitDetail }) {
  const hasCover = !!exhibit.cover_url
  return (
    <div style={{ position:'relative', height:240, overflow:'hidden', flexShrink:0 }}>
      {hasCover ? (
        <img src={exhibit.cover_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
      ) : (
        <FallbackHero type={exhibit.type} />
      )}
      {/* グラデーションオーバーレイ */}
      <div style={{
        position:'absolute', inset:0,
        background:'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)',
      }} />
      {/* ← 戻るボタン */}
      <Link href="/map" style={{
        position:'absolute', top:12, left:12,
        width:34, height:34, borderRadius:'50%',
        background:'rgba(0,0,0,0.35)', backdropFilter:'blur(8px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        color:'#fff', fontSize:18, textDecoration:'none',
      }}>←</Link>
      {/* タイトルオーバーレイ */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'16px 16px 20px' }}>
        {exhibit.class_label && (
          <div style={{ fontFamily:"'Kiwi Maru',serif", fontSize:12, color:'rgba(255,255,255,0.8)', marginBottom:4 }}>
            {exhibit.class_label}
          </div>
        )}
        <div style={{
          fontFamily:"'Kaisei Decol',serif", fontSize:28, fontWeight:700,
          color:'#fff', lineHeight:1.2, textShadow:'0 2px 8px rgba(0,0,0,0.3)',
        }}>
          {exhibit.name}
        </div>
      </div>
    </div>
  )
}

/** ヒーロー画像がない場合のフォールバック */
function FallbackHero({ type }: { type: string }) {
  const config: Record<string, { emoji: string; bg: string }> = {
    class:     { emoji:'🎨', bg:'linear-gradient(135deg,#FF6B00,#FFAA28)' },
    food:      { emoji:'🍱', bg:'linear-gradient(135deg,#f59e0b,#fcd34d)' },
    band:      { emoji:'🎸', bg:'linear-gradient(135deg,#7c3aed,#a78bfa)' },
    special:   { emoji:'⭐', bg:'linear-gradient(135deg,#0284c7,#38bdf8)' },
    cafeteria: { emoji:'🍜', bg:'linear-gradient(135deg,#16a34a,#86efac)' },
  }
  const { emoji, bg } = config[type] ?? config.class
  return (
    <div style={{
      width:'100%', height:'100%', background:bg,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:72, opacity:0.6,
    }}>
      {emoji}
    </div>
  )
}

// ─── 情報エリア ───────────────────────────────────────────────
function InfoSection({ exhibit }: { exhibit: ExhibitDetail }) {
  return (
    <div style={{ padding:'20px 16px 0', animation:'slideUp 0.35s ease' }}>
      {/* typeバッジ */}
      <span style={{
        display:'inline-block', fontSize:12, fontWeight:700,
        padding:'4px 14px', borderRadius:99,
        background:'rgba(255,107,0,0.1)', color:'#FF6B00',
        fontFamily:"'Kiwi Maru',serif", marginBottom:10,
        border:'1px solid rgba(255,107,0,0.2)',
      }}>
        {TYPE_LABEL[exhibit.type] ?? '展示'}
      </span>

      {/* 展示名（大） */}
      <div style={{
        fontFamily:"'Kaisei Decol',serif", fontSize:26, fontWeight:700,
        color:'#1a1a1a', lineHeight:1.3, marginBottom:14,
      }}>
        {exhibit.name}
      </div>

      {/* 場所 */}
      {exhibit.room_display && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span style={{ fontFamily:"'Kiwi Maru',serif", fontSize:13, color:'#777' }}>
            {exhibit.room_display}{exhibit.floor ? ` · ${exhibit.floor}F` : ''}
          </span>
        </div>
      )}

      {/* 開催日 */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:20 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ fontFamily:"'Kiwi Maru',serif", fontSize:13, color:'#777' }}>
          {{ both:'土・日 両日', sat:'土曜日のみ', sun:'日曜日のみ' }[exhibit.day]}
          &nbsp;· 9:00〜16:00
        </span>
      </div>

      {/* キャッチコピー */}
      {exhibit.catch_copy && <CatchCopy text={exhibit.catch_copy} />}
    </div>
  )
}

/** キャッチコピー帯 */
function CatchCopy({ text }: { text: string }) {
  return (
    <div style={{
      margin:'0 -16px 0', padding:'22px 32px',
      background:'linear-gradient(135deg,#FF6B00 0%,#FFAA28 60%,#FFD166 100%)',
      borderRadius:24, marginBottom:24,
    }}>
      <div style={{
        fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700,
        color:'#fff', textAlign:'center', lineHeight:1.5,
        textShadow:'0 1px 4px rgba(0,0,0,0.15)',
      }}>
        {text}
      </div>
    </div>
  )
}

// ─── 標準コンテンツ（class / special）────────────────────────
function StandardContent({ exhibit }: { exhibit: ExhibitDetail }) {
  const sorted = [...exhibit.sections].sort((a, b) => a.order - b.order)
  if (sorted.length === 0) return null
  return (
    <div style={{ padding:'0 16px' }}>
      {sorted.map((sec) => (
        <SectionBlock key={sec.id} section={sec} />
      ))}
    </div>
  )
}

/** セクション（見出し帯 + 本文 + メディア） */
function SectionBlock({ section }: { section: ExhibitSection }) {
  return (
    <div style={{ marginBottom:32 }}>
      {/* 見出し帯 */}
      <div style={{
        background:'linear-gradient(135deg,#1a1a2e,#16213e)',
        borderRadius:16, padding:'14px 18px', marginBottom:16,
        boxShadow:'0 4px 16px rgba(0,0,0,0.12)',
      }}>
        <div style={{
          fontFamily:"'Kaisei Decol',serif", fontSize:18, fontWeight:700,
          color:'#fff', lineHeight:1.3,
        }}>
          {section.heading}
        </div>
      </div>

      {/* 本文 */}
      <div style={{ padding:'0 4px', marginBottom: section.media.length > 0 ? 14 : 0 }}>
        <BodyRenderer segments={section.body} />
      </div>

      {/* セクション内メディア */}
      {section.media.length > 0 && <SectionMediaGrid media={section.media} />}
    </div>
  )
}

/** 本文レンダラー */
function BodyRenderer({ segments }: { segments: BodySegment[] }) {
  return (
    <div style={{ fontFamily:"'Kiwi Maru',serif", fontSize:14, color:'#444', lineHeight:1.85 }}>
      {segments.map((seg, i) => {
        if (seg.type === 'break')   return <div key={i} style={{ height:10 }} />
        if (seg.type === 'text')    return <span key={i} style={{ whiteSpace:'pre-wrap' }}>{seg.text}</span>
        if (seg.type === 'heading') return (
          <div key={i} style={{ fontFamily:"'Kaisei Decol',serif", fontSize:16, fontWeight:700, color:'#1a1a1a', margin:'12px 0 4px' }}>
            {seg.text}
          </div>
        )
        if (seg.type === 'link') return (
          <div key={i} style={{ margin:'8px 0' }}>
            <Link href={seg.href} style={{
              display:'inline-flex', alignItems:'center', gap:5,
              color:'#FF6B00', fontWeight:700, textDecoration:'none',
              background:'#fff8f4', border:'1px solid rgba(255,107,0,0.2)',
              borderRadius:99, padding:'5px 14px', fontSize:13,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              {seg.label}
            </Link>
          </div>
        )
        return null
      })}
    </div>
  )
}

/** セクション内メディアグリッド */
function SectionMediaGrid({ media }: { media: SectionMedia[] }) {
  const [active, setActive] = useState(0)
  if (media.length === 1) {
    return <MediaItem item={media[0]} large />
  }
  return (
    <div>
      <MediaItem item={media[active]} large />
      {media[active].caption && (
        <div style={{ fontSize:11, color:'#aaa', textAlign:'center', margin:'6px 0 8px', fontFamily:"'Kiwi Maru',serif" }}>
          {media[active].caption}
        </div>
      )}
      <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
        {media.map((m, i) => (
          <button key={m.id} onClick={() => setActive(i)} style={{
            width:60, height:60, borderRadius:10, flexShrink:0, overflow:'hidden',
            border:'none', cursor:'pointer', padding:0,
            outline: i === active ? '2.5px solid #FF6B00' : '2.5px solid transparent',
            transition:'outline 0.15s',
          }}>
            <MediaThumb item={m} />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── フードコンテンツ ─────────────────────────────────────────
function FoodContent({ exhibit, menus }: { exhibit: ExhibitDetail; menus: FoodMenu[] }) {
  return (
    <div style={{ padding:'0 16px' }}>
      {/* キャッチコピーの下にメニューが来る */}
      {menus.length > 0 && (
        <>
          <div style={{
            fontSize:11, fontWeight:700, color:'#aaa', letterSpacing:'0.1em',
            marginBottom:14, fontFamily:"'Kiwi Maru',serif",
          }}>
            🍽 メニュー
          </div>
          <div style={{ marginBottom:28 }}>
            {menus.map((menu) => <FoodMenuCard key={menu.id} menu={menu} />)}
          </div>
        </>
      )}

      {/* セクション（こだわりポイントなど）*/}
      {exhibit.sections.length > 0 && (
        <div>
          {[...exhibit.sections].sort((a,b)=>a.order-b.order).map((sec) => (
            <SectionBlock key={sec.id} section={sec} />
          ))}
        </div>
      )}
    </div>
  )
}

/** メニューカード（横並びレイアウト） */
function FoodMenuCard({ menu }: { menu: FoodMenu }) {
  const status = getFoodMenuStatus(menu)
  const isSelling = status === 'selling'
  const statusConfig = {
    selling: { label:'販売中',   color:'#16a34a', bg:'#f0fdf4' },
    soldout: { label:'売り切れ', color:'#dc2626', bg:'#fef2f2' },
    stopped: { label:'販売停止', color:'#aaa',    bg:'#f5f5f5' },
  }[status]

  return (
    <div style={{
      display:'flex', gap:14, alignItems:'flex-start',
      padding:'14px 0',
      borderBottom:'1px solid #f1f5f9',
      opacity: isSelling ? 1 : 0.55,
    }}>
      {/* サムネイル */}
      <div style={{
        width:80, height:80, borderRadius:12, flexShrink:0,
        overflow:'hidden', background:'#fef3c7', position:'relative',
      }}>
        {menu.image_url ? (
          <img src={menu.image_url} alt={menu.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <div style={{
            width:'100%', height:'100%',
            background:'linear-gradient(135deg,#fef3c7,#fcd34d)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:32,
          }}>🍱</div>
        )}
        {!isSelling && (
          <div style={{
            position:'absolute', inset:0, background:'rgba(0,0,0,0.5)',
            display:'flex', alignItems:'center', justifyContent:'center',
            borderRadius:12,
          }}>
            <span style={{ fontSize:9, fontWeight:700, color:'#fff', fontFamily:"'Kiwi Maru',serif", textAlign:'center', lineHeight:1.3 }}>
              {statusConfig.label}
            </span>
          </div>
        )}
      </div>

      {/* テキスト */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:4 }}>
          <div style={{
            fontFamily:"'Kaisei Decol',serif", fontSize:16, fontWeight:700, color:'#1a1a1a', lineHeight:1.3,
          }}>
            {menu.name}
          </div>
          <div style={{
            fontFamily:"'Kaisei Decol',serif", fontSize:18, fontWeight:700,
            color:'#FF6B00', flexShrink:0, lineHeight:1.2,
          }}>
            ¥{menu.price.toLocaleString()}
          </div>
        </div>

        {menu.description && (
          <div style={{ fontFamily:"'Kiwi Maru',serif", fontSize:12, color:'#999', lineHeight:1.6, marginBottom:6 }}>
            {menu.description}
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{
            fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
            background:statusConfig.bg, color:statusConfig.color,
            fontFamily:"'Kiwi Maru',serif", border:`1px solid ${statusConfig.color}33`,
          }}>
            {statusConfig.label}
          </span>
          {isSelling && menu.stock > 0 && menu.stock <= 10 && (
            <span style={{ fontSize:10, fontWeight:700, color:'#f59e0b', fontFamily:"'Kiwi Maru',serif" }}>
              残り{menu.stock}個！
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 軽音コンテンツ ───────────────────────────────────────────
function BandContent() {
  return (
    <div style={{ padding:'0 16px 20px' }}>
      <div style={{
        background:'linear-gradient(135deg,#1a1a2e,#16213e)',
        borderRadius:20, padding:'28px 20px', textAlign:'center',
      }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🎸</div>
        <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:18, fontWeight:700, color:'#fff', marginBottom:8 }}>
          軽音楽部のスケジュール
        </div>
        <div style={{ fontFamily:"'Kiwi Maru',serif", fontSize:13, color:'rgba(255,255,255,0.6)', marginBottom:20 }}>
          各バンドの公演時間・メンバー情報はこちら
        </div>
        <Link href="/band" style={{
          display:'inline-flex', alignItems:'center', gap:6, padding:'12px 24px',
          borderRadius:99, background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
          color:'#fff', textDecoration:'none',
          fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700,
        }}>
          🎵 スケジュールを見る →
        </Link>
      </div>
    </div>
  )
}

// ─── ギャラリー ───────────────────────────────────────────────
function Gallery({ media }: { media: ExhibitMedia[] }) {
  const [active, setActive] = useState(0)
  const cur = media[active]
  return (
    <div style={{ padding:'0 16px 24px' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#aaa', letterSpacing:'0.1em', marginBottom:12, fontFamily:"'Kiwi Maru',serif" }}>
        📷 ギャラリー
      </div>
      {/* メインビュー */}
      <div style={{
        width:'100%', aspectRatio:'16/9', borderRadius:16, overflow:'hidden',
        background:'#111', marginBottom:10, position:'relative',
        boxShadow:'0 4px 20px rgba(0,0,0,0.12)',
      }}>
        <MediaItem item={cur} large />
        {/* 前後ボタン */}
        {active > 0 && (
          <button onClick={() => setActive(active-1)} style={{
            position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
            width:34, height:34, borderRadius:'50%', background:'rgba(0,0,0,0.4)',
            border:'none', color:'#fff', fontSize:18, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>‹</button>
        )}
        {active < media.length-1 && (
          <button onClick={() => setActive(active+1)} style={{
            position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
            width:34, height:34, borderRadius:'50%', background:'rgba(0,0,0,0.4)',
            border:'none', color:'#fff', fontSize:18, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>›</button>
        )}
        {/* ドットインジケーター */}
        {media.length > 1 && (
          <div style={{ position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', display:'flex', gap:4 }}>
            {media.map((_,i)=>(
              <div key={i} style={{ width:i===active?18:6, height:6, borderRadius:99, background:i===active?'#fff':'rgba(255,255,255,0.4)', transition:'all 0.25s' }} />
            ))}
          </div>
        )}
      </div>
      {cur.caption && (
        <div style={{ fontSize:11, color:'#aaa', textAlign:'center', marginBottom:10, fontFamily:"'Kiwi Maru',serif" }}>
          {cur.caption}
        </div>
      )}
      {/* サムネイル */}
      {media.length > 1 && (
        <div style={{ display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none' }}>
          {media.map((m,i)=>(
            <button key={m.id} onClick={()=>setActive(i)} style={{
              width:64, height:64, borderRadius:12, flexShrink:0, overflow:'hidden',
              border:'none', cursor:'pointer', padding:0,
              outline:i===active?'2.5px solid #FF6B00':'2.5px solid transparent', transition:'outline 0.15s',
            }}>
              <MediaThumb item={m} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── メディアコンポーネント ───────────────────────────────────
function MediaItem({ item, large=false }: { item: SectionMedia | ExhibitMedia; large?: boolean }) {
  const style: React.CSSProperties = {
    width:'100%', height:'100%', objectFit:'cover',
    borderRadius: large ? 14 : 0,
    aspectRatio: large ? '16/9' : undefined,
  }
  if (item.url) {
    return item.type === 'image'
      ? <img src={item.url} alt={item.caption} style={style} />
      : <video src={item.url} controls style={style} />
  }
  return (
    <div style={{
      width:'100%', aspectRatio: large ? '16/9' : '1/1',
      borderRadius: large ? 14 : 0,
      background:'#1a1a2e', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:8,
      color:'rgba(255,255,255,0.4)',
    }}>
      <span style={{ fontSize: large ? 40 : 22 }}>{item.type==='video'?'▶':'🖼'}</span>
      {item.caption && large && (
        <span style={{ fontSize:12, fontFamily:"'Kiwi Maru',serif" }}>{item.caption}</span>
      )}
    </div>
  )
}

function MediaThumb({ item }: { item: SectionMedia | ExhibitMedia }) {
  if (item.url) {
    return item.type === 'image'
      ? <img src={item.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
      : <div style={{ width:'100%', height:'100%', background:'#222', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.5)', fontSize:20 }}>▶</div>
  }
  return (
    <div style={{ width:'100%', height:'100%', background:'#1a1a2e', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.3)', fontSize:20 }}>
      {item.type==='video'?'▶':'🖼'}
    </div>
  )
}
