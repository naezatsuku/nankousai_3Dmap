'use client'

import { useState, useMemo } from 'react'
import { FoodMenu, FoodMenuStatus, getFoodMenuStatus } from '@/types'

// ─── 試作ダミーデータ ──────────────────────────────────────
// exhibit.type が 'food' で class_label が '高3-X' のクラスのみランキング対象

interface StallExhibit {
  id: string
  name: string
  class_label: string
  is_high3: boolean  // 高3かどうか（ランキング対象）
  location: string
  thumbnail_url?: string
}

const DUMMY_STALLS: StallExhibit[] = [
  { id: 'e1', name: '3年1組',  class_label: '高3-1', is_high3: true,  location: 'クスノキ広場 A' },
  { id: 'e2', name: '3年2組',  class_label: '高3-2', is_high3: true,  location: 'クスノキ広場 B' },
  { id: 'e3', name: '3年3組',  class_label: '高3-3', is_high3: true,  location: 'クスノキ広場 C' },
  { id: 'e4', name: '3年4組',  class_label: '高3-4', is_high3: true,  location: 'クスノキ広場 D' },
  { id: 'e5', name: '3年5組',  class_label: '高3-5', is_high3: true,  location: 'クスノキ広場 E' },
  { id: 'e6', name: '食堂',    class_label: '食堂',  is_high3: false, location: '1F 食堂' },
]

interface FoodMenuEx extends FoodMenu {
  stall: StallExhibit
}

const DUMMY_MENUS: FoodMenuEx[] = [
  // 高3-1: 焼きそば・フランクフルト
  { id: 'm01', exhibit_id:'e1', name:'焼きそば',        price:300, description:'秘伝ソースの本格派',  stock:12, is_selling:true,  sold_count:87, stall:DUMMY_STALLS[0] },
  { id: 'm02', exhibit_id:'e1', name:'フランクフルト',   price:200, description:'ジューシー！',        stock:0,  is_selling:true,  sold_count:54, stall:DUMMY_STALLS[0] },
  // 高3-2: 唐揚げ・ポテト
  { id: 'm03', exhibit_id:'e2', name:'唐揚げ（5個）',    price:350, description:'カリッと揚げたて',    stock:30, is_selling:true,  sold_count:102,stall:DUMMY_STALLS[1] },
  { id: 'm04', exhibit_id:'e2', name:'フライドポテト',   price:250, description:'塩・ケチャップ選べる', stock:45, is_selling:true,  sold_count:78, stall:DUMMY_STALLS[1] },
  // 高3-3: クレープ
  { id: 'm05', exhibit_id:'e3', name:'クレープ（チョコ）',price:400, description:'ベルギーチョコ使用',  stock:8,  is_selling:true,  sold_count:65, stall:DUMMY_STALLS[2] },
  { id: 'm06', exhibit_id:'e3', name:'クレープ（イチゴ）',price:400, description:'フレッシュいちご',    stock:5,  is_selling:true,  sold_count:61, stall:DUMMY_STALLS[2] },
  { id: 'm07', exhibit_id:'e3', name:'クレープ（抹茶）', price:420, description:'京都抹茶クリーム',    stock:0,  is_selling:false, sold_count:38, stall:DUMMY_STALLS[2] },
  // 高3-4: タコス
  { id: 'm08', exhibit_id:'e4', name:'タコス',           price:380, description:'本格メキシカン',      stock:20, is_selling:true,  sold_count:49, stall:DUMMY_STALLS[3] },
  { id: 'm09', exhibit_id:'e4', name:'ナチョス',         price:300, description:'チーズたっぷり',      stock:18, is_selling:true,  sold_count:33, stall:DUMMY_STALLS[3] },
  // 高3-5: ドリンク
  { id: 'm10', exhibit_id:'e5', name:'タピオカミルクティー', price:350, description:'もちもちタピオカ',  stock:25, is_selling:true,  sold_count:95, stall:DUMMY_STALLS[4] },
  { id: 'm11', exhibit_id:'e5', name:'レモネード',        price:250, description:'国産レモン使用',      stock:30, is_selling:true,  sold_count:71, stall:DUMMY_STALLS[4] },
  { id: 'm12', exhibit_id:'e5', name:'チャイティー',      price:300, description:'スパイス香る',        stock:0,  is_selling:true,  sold_count:28, stall:DUMMY_STALLS[4] },
  // 食堂
  { id: 'm13', exhibit_id:'e6', name:'日替わり定食',      price:550, description:'今日は唐揚げ定食',    stock:50, is_selling:true,  sold_count:0,  stall:DUMMY_STALLS[5] },
  { id: 'm14', exhibit_id:'e6', name:'うどん',            price:350, description:'出汁が自慢',          stock:40, is_selling:true,  sold_count:0,  stall:DUMMY_STALLS[5] },
]

// ─── ユーティリティ ───────────────────────────────────────────
const STATUS_CONFIG: Record<FoodMenuStatus, { label: string; bg: string; color: string }> = {
  selling: { label: '販売中',   bg: '#f0fdf4', color: '#16a34a' },
  soldout: { label: '売り切れ', bg: '#fef2f2', color: '#dc2626' },
  stopped: { label: '販売停止', bg: '#f5f5f5', color: '#aaa'    },
}

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

// ─── サブコンポーネント ───────────────────────────────────────

/** ステータスバッジ */
function StatusBadge({ status }: { status: FoodMenuStatus }) {
  const { label, bg, color } = STATUS_CONFIG[status]
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 8px',
      borderRadius: 99, background: bg, color,
      fontFamily: "'Kiwi Maru', serif", flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

/** 在庫バー */
function StockBar({ stock, max = 50 }: { stock: number; max?: number }) {
  const pct  = Math.min((stock / max) * 100, 100)
  const color = stock === 0 ? '#fca5a5' : stock <= 10 ? '#fbbf24' : '#86efac'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 99, background: '#f0f0f0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: color, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 10, color: '#aaa', flexShrink: 0, fontFamily: "'Kiwi Maru', serif" }}>
        残 {stock}
      </span>
    </div>
  )
}

/** メニューカード */
function MenuCard({ menu }: { menu: FoodMenuEx }) {
  const status = getFoodMenuStatus(menu)
  const isDim  = status !== 'selling'
  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      padding: '12px 12px',
      border: '1px solid #f0f0f0',
      opacity: isDim ? 0.65 : 1,
      transition: 'opacity 0.2s',
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      {/* サムネ */}
      <div style={{
        width: 56, height: 56, borderRadius: 12, flexShrink: 0,
        background: 'linear-gradient(135deg,#FFD166,#FF8C00)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, overflow: 'hidden',
      }}>
        {menu.image_url
          ? <img src={menu.image_url} alt={menu.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : '🍱'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 名前 + バッジ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
          <span style={{ fontFamily: "'Kaisei Decol', serif", fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
            {menu.name}
          </span>
          <StatusBadge status={status} />
        </div>

        {/* 説明 */}
        {menu.description && (
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4, fontFamily: "'Kiwi Maru', serif" }}>
            {menu.description}
          </div>
        )}

        {/* 価格 */}
        <div style={{ fontFamily: "'Kaisei Decol', serif", fontSize: 16, fontWeight: 700, color: '#FF8C00' }}>
          ¥{menu.price.toLocaleString()}
        </div>

        {/* 在庫バー */}
        <StockBar stock={menu.stock} />
      </div>
    </div>
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
    <div style={{ marginBottom: 20 }}>
      {/* クラスヘッダー */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 8, paddingBottom: 8,
        borderBottom: '1px solid #f0f0f0',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: stall.is_high3
            ? 'linear-gradient(135deg,#FF6B00,#FFAA28)'
            : 'linear-gradient(135deg,#64748b,#94a3b8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>
          {stall.is_high3 ? '🍳' : '🍜'}
        </div>
        <div>
          <div style={{ fontFamily: "'Kaisei Decol', serif", fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
            {stall.name}
          </div>
          <div style={{ fontSize: 10, color: '#aaa', fontFamily: "'Kiwi Maru', serif" }}>
            📍 {stall.location}
          </div>
        </div>
      </div>

      {/* メニューカード */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((m) => <MenuCard key={m.id} menu={m} />)}
      </div>
    </div>
  )
}

// ─── メインページ ──────────────────────────────────────────────
export default function FoodPage() {
  const [onlyAvailable, setOnlyAvailable] = useState(false)

  // 高3のみのランキング（sold_count 降順 top5）
  const ranking = useMemo(() =>
    DUMMY_MENUS
      .filter((m) => m.stall.is_high3)
      .sort((a, b) => b.sold_count - a.sold_count)
      .slice(0, 5),
    []
  )

  // クラス別にグループ化
  const grouped = useMemo(() =>
    DUMMY_STALLS.map((stall) => ({
      stall,
      menus: DUMMY_MENUS.filter((m) => m.exhibit_id === stall.id),
    })),
    []
  )

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:0%} 100%{background-position:200%} }
      `}</style>

      <div style={{
        height: '100%', overflowY: 'auto', background: '#f5f3ef', paddingBottom: 32,
      }}>

        {/* ── ページヘッダー ── */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          padding: '14px 16px 12px',
          borderBottom: '1px solid rgba(255,140,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 10,
          position: 'sticky', top: 0, zIndex: 40,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg,#FF6B00,#FFAA28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🍜</div>
          <div>
            <div style={{
              fontFamily: "'Kaisei Decol', serif", fontSize: 19, fontWeight: 700,
              background: 'linear-gradient(90deg,#E85A00,#FF8C00)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>フード</div>
            <div style={{ fontSize: 10, color: '#aaa', fontFamily: "'Kiwi Maru', serif" }}>
              Food &amp; Drink
            </div>
          </div>

          {/* 販売中のみフィルター */}
          <button
            onClick={() => setOnlyAvailable((v) => !v)}
            style={{
              marginLeft: 'auto',
              fontSize: 11, padding: '6px 14px', borderRadius: 20,
              background: onlyAvailable ? '#FF8C00' : '#f0f0f0',
              color: onlyAvailable ? '#fff' : '#888',
              fontWeight: 700, border: 'none', cursor: 'pointer',
              fontFamily: "'Kiwi Maru', serif",
              transition: 'all 0.2s',
            }}
          >
            販売中のみ
          </button>
        </div>

        <div style={{ padding: '14px 14px 0' }}>

          {/* ── 人気ランキング（高3のみ） ── */}
          <SectionLabel emoji="🏆" label="人気ランキング（模擬店）" />
          <Ranking menus={ranking} />

          {/* ── フード一覧 ── */}
          <SectionLabel emoji="🍱" label="メニュー一覧" topMargin={24} />

          {grouped.map(({ stall, menus }) => (
            <StallSection
              key={stall.id}
              stall={stall}
              menus={menus}
              onlyAvailable={onlyAvailable}
            />
          ))}
        </div>
      </div>
    </>
  )
}

// ─── ランキングカード ──────────────────────────────────────────
function Ranking({ menus }: { menus: FoodMenuEx[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {menus.map((menu, i) => {
        const rank   = i + 1
        const status = getFoodMenuStatus(menu)
        const isDim  = status !== 'selling'
        return (
          <div
            key={menu.id}
            style={{
              background: rank === 1
                ? 'linear-gradient(135deg,#fffbeb,#fff)'
                : '#fff',
              borderRadius: 16,
              border: rank === 1
                ? '1.5px solid rgba(251,191,36,0.4)'
                : '1px solid #f0f0f0',
              padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
              opacity: isDim ? 0.6 : 1,
              animation: `fadeUp ${0.1 + i * 0.05}s ease both`,
            }}
          >
            {/* 順位 */}
            <div style={{
              width: 32, flexShrink: 0, textAlign: 'center',
              fontFamily: "'Kaisei Decol', serif",
            }}>
              {rank <= 3
                ? <span style={{ fontSize: 22 }}>{RANK_MEDAL[rank]}</span>
                : <span style={{ fontSize: 16, fontWeight: 700, color: '#ccc' }}>#{rank}</span>
              }
            </div>

            {/* サムネ */}
            <div style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg,#FFD166,#FF8C00)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, overflow: 'hidden',
            }}>
              {menu.image_url
                ? <img src={menu.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : '🍱'}
            </div>

            {/* テキスト */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'Kaisei Decol', serif", fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                  {menu.name}
                </span>
                <StatusBadge status={status} />
              </div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 1, fontFamily: "'Kiwi Maru', serif" }}>
                {menu.stall.name} · ¥{menu.price}
              </div>
            </div>

            {/* 販売数 */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: "'Kaisei Decol', serif", fontSize: 18, fontWeight: 700, color: '#FF8C00' }}>
                {menu.sold_count}
              </div>
              <div style={{ fontSize: 9, color: '#bbb', fontFamily: "'Kiwi Maru', serif" }}>販売数</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SectionLabel({ emoji, label, topMargin = 0 }: { emoji: string; label: string; topMargin?: number }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: '#aaa',
      letterSpacing: '0.08em',
      margin: `${topMargin}px 0 10px`,
      fontFamily: "'Kiwi Maru', serif",
    }}>
      {emoji} {label}
    </div>
  )
}