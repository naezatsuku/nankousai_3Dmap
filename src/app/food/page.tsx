'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FoodMenuStatus, getFoodMenuStatus } from '@/types'
import { DUMMY_STALLS, DUMMY_MENUS, fetchFoodData } from '@/lib/food'
import type { StallExhibit, FoodMenuWithStall } from '@/lib/food'

type FoodMenuEx = FoodMenuWithStall

// ─── ユーティリティ ───────────────────────────────────────────
const STATUS_CONFIG: Record<FoodMenuStatus, { label: string; dot: string; color: string }> = {
  selling: { label: '販売中',   dot: '#16a34a', color: '#15803d' },
  soldout: { label: '売り切れ', dot: '#dc2626', color: '#b91c1c' },
  stopped: { label: '販売停止', dot: '#9ca3af', color: '#6b7280' },
}

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

// ─── サブコンポーネント ───────────────────────────────────────

/** 写真に重ねるステータスピル */
function StatusPill({ status }: { status: FoodMenuStatus }) {
  const { label, dot, color } = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontWeight: 700, padding: '4px 9px',
      borderRadius: 99, color,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      fontFamily: "'Kiwi Maru', serif", flexShrink: 0,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
      {label}
    </span>
  )
}

/** ギャラリーカード（写真主役） */
function MenuCard({ menu, rank }: { menu: FoodMenuEx; rank?: number }) {
  const status = getFoodMenuStatus(menu)
  const isDim  = status !== 'selling'
  const img    = menu.image_url ?? menu.stall.thumbnail_url
  const isTopRank = rank !== undefined && rank <= 3

  return (
    <article className="menu-card" style={{
      background: '#fff', borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      opacity: isDim ? 0.7 : 1,
      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 写真 */}
      <div className="menu-card-photo" style={{
        position: 'relative', width: '100%', aspectRatio: '4 / 3',
        background: 'linear-gradient(135deg,#FFE6B8,#FF8C00)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img
          ? <img className="menu-card-img" src={img} alt={menu.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }} />
          : <span style={{ fontSize: 56 }}>🍱</span>}

        {/* 順位バッジ */}
        {rank !== undefined && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: isTopRank ? 40 : 34, height: isTopRank ? 40 : 34,
            borderRadius: '50%',
            background: isTopRank ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
            fontSize: isTopRank ? 22 : 13, fontWeight: 700,
            color: isTopRank ? '#1a1a1a' : '#fff',
            fontFamily: "'Kaisei Decol', serif",
          }}>
            {isTopRank ? RANK_MEDAL[rank] : `#${rank}`}
          </div>
        )}

        {/* ステータス */}
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <StatusPill status={status} />
        </div>
      </div>

      {/* キャプション */}
      <div style={{ padding: '12px 14px 13px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: "'Kaisei Decol', serif", fontSize: 15, fontWeight: 700,
            color: '#1a1a1a', lineHeight: 1.3,
          }}>
            {menu.name}
          </span>
          <span style={{
            fontFamily: "'Kaisei Decol', serif", fontSize: 16, fontWeight: 700, color: '#FF6B00',
          }}>
            ¥{menu.price.toLocaleString()}
          </span>
        </div>
        <div style={{
          fontSize: 11, color: '#b0a99e', fontFamily: "'Kiwi Maru', serif",
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {menu.stall.name}
          </span>
          <span style={{ flexShrink: 0, color: '#cbc4ba' }}>
            {menu.sold_count}食
          </span>
        </div>
      </div>
    </article>
  )
}

/** クラス別セクション */
function StallSection({ stall, menus, onlyAvailable }: {
  stall: StallExhibit
  menus: FoodMenuEx[]
  onlyAvailable: boolean
}) {
  const visible = onlyAvailable
    ? menus.filter((m) => getFoodMenuStatus(m) === 'selling')
    : menus
  if (visible.length === 0) return null

  return (
    <div style={{ marginBottom: 36 }}>
      {/* クラスヘッダー */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: stall.is_high3
            ? 'linear-gradient(135deg,#FF6B00,#FFAA28)'
            : 'linear-gradient(135deg,#64748b,#94a3b8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, overflow: 'hidden', flexShrink: 0,
        }}>
          {stall.thumbnail_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={stall.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (stall.is_high3 ? '🍳' : '🍜')
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Kaisei Decol', serif", fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>
            {stall.name}
          </div>
          <div style={{ fontSize: 10, color: '#b0a99e', fontFamily: "'Kiwi Maru', serif" }}>
            📍 {stall.location}
          </div>
        </div>
      </div>
      <div className="food-grid">
        {visible.map((m) => <MenuCard key={m.id} menu={m} />)}
      </div>
    </div>
  )
}

/** 編集デザイン風セクション見出し */
function SectionHeading({ index, title, sub }: { index: string; title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 18 }}>
      <span style={{
        fontFamily: "'Kaisei Decol', serif", fontSize: 13, fontWeight: 700,
        color: '#FF8C00', letterSpacing: '0.1em', lineHeight: 1, paddingBottom: 3,
      }}>
        {index}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{
          fontFamily: "'Kaisei Decol', serif", fontSize: 22, fontWeight: 700,
          color: '#1a1a1a', margin: 0, lineHeight: 1.1,
        }}>
          {title}
        </h2>
        {sub && (
          <div style={{
            fontSize: 10, color: '#b0a99e', letterSpacing: '0.18em',
            fontFamily: "'Kiwi Maru', serif", marginTop: 3,
          }}>
            {sub}
          </div>
        )}
      </div>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, #e8e2d8, transparent)' }} />
    </div>
  )
}

// ─── メインページ ──────────────────────────────────────────────
export default function FoodPage() {
  const router = useRouter()
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [stalls, setStalls] = useState<StallExhibit[]>(DUMMY_STALLS)
  const [menus,  setMenus]  = useState<FoodMenuEx[]>(DUMMY_MENUS)

  useEffect(() => {
    fetchFoodData().then(({ stalls: s, menus: m }) => { setStalls(s); setMenus(m) })
  }, [])

  const ranking = useMemo(() =>
    menus
      .filter((m) => m.stall.is_high3)
      .sort((a, b) => b.sold_count - a.sold_count)
      .slice(0, 4),
    [menus]
  )

  const grouped = useMemo(() =>
    stalls.map((stall) => ({
      stall,
      menus: menus.filter((m) => m.exhibit_id === stall.id),
    })),
    [stalls, menus]
  )

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

        /* 写真ホバー演出（PC） */
        .menu-card:hover { box-shadow: 0 10px 30px rgba(0,0,0,0.10); transform: translateY(-3px); }
        .menu-card:hover .menu-card-img { transform: scale(1.06); }

        /* グリッド：モバイル2カラム */
        .food-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .food-shell   { padding: 18px 14px 48px; }
        .food-header  { padding: 12px 14px; }

        /* タブレット（720px〜）3カラム */
        @media (min-width: 720px) {
          .food-grid { grid-template-columns: repeat(3, 1fr); gap: 18px; }
          .food-shell  { max-width: 1180px; margin: 0 auto; padding: 32px 40px 72px; }
          .food-header { padding: 16px 40px; }
        }
        /* ワイド（1080px〜）4カラム */
        @media (min-width: 1080px) {
          .food-grid { grid-template-columns: repeat(4, 1fr); gap: 22px; }
        }
      `}</style>

      <div style={{ height: '100%', overflowY: 'auto', background: '#faf8f4' }}>

        {/* ── スリムヘッダー ── */}
        <header className="food-header" style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: 'rgba(250,248,244,0.85)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid #eee5d8',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={() => router.push('/map')}
            aria-label="前のページに戻る"
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: '#fff', border: '1px solid #ece4d6', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#8a8278" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
            </svg>
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Kaisei Decol', serif", fontSize: 20, fontWeight: 700,
              color: '#1a1a1a', lineHeight: 1.1,
            }}>
              フード
            </div>
            <div style={{
              fontSize: 9, color: '#c4bcae', letterSpacing: '0.28em',
              fontFamily: "'Kiwi Maru', serif",
            }}>
              FOOD &amp; DRINK
            </div>
          </div>

          <button
            onClick={() => setOnlyAvailable((v) => !v)}
            style={{
              fontSize: 12, padding: '8px 16px', borderRadius: 99, flexShrink: 0,
              background: onlyAvailable ? '#FF6B00' : '#fff',
              color: onlyAvailable ? '#fff' : '#9a9286',
              fontWeight: 700,
              border: onlyAvailable ? 'none' : '1px solid #ece4d6',
              cursor: 'pointer', fontFamily: "'Kiwi Maru', serif",
              transition: 'all 0.2s',
            }}
          >
            ● 販売中のみ
          </button>
        </header>

        {/* ── コンテンツ ── */}
        <div className="food-shell">

          {/* ランキング */}
          {ranking.length > 0 && (
            <section style={{ marginBottom: 44 }}>
              <SectionHeading index="01" title="人気ランキング" sub="POPULAR — 模擬店" />
              <div className="food-grid">
                {ranking.map((menu, i) => (
                  <div key={menu.id} style={{ animation: `fadeUp ${0.08 + i * 0.07}s ease both` }}>
                    <MenuCard menu={menu} rank={i + 1} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* メニュー一覧 */}
          <SectionHeading index="02" title="メニュー一覧" sub="ALL MENU" />
          {grouped.map(({ stall, menus: sm }) => (
            <StallSection
              key={stall.id}
              stall={stall}
              menus={sm}
              onlyAvailable={onlyAvailable}
            />
          ))}
        </div>
      </div>
    </>
  )
}
