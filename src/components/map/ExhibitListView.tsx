'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Exhibit, ExhibitType } from '@/types'

const TYPE_CONFIG: Record<ExhibitType, { label: string; emoji: string; bg: string; color: string }> = {
  class:     { label: '展示',      emoji: '🎨', bg: 'linear-gradient(135deg,#FF6B00,#FFAA28)', color: '#FF6B00' },
  food:      { label: 'フード',    emoji: '🍱', bg: 'linear-gradient(135deg,#f59e0b,#fcd34d)', color: '#f59e0b' },
  band:      { label: '軽音楽部',  emoji: '🎸', bg: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#7c3aed' },
  special:   { label: 'スペシャル', emoji: '⭐', bg: 'linear-gradient(135deg,#0284c7,#38bdf8)', color: '#0284c7' },
  cafeteria: { label: '食堂',      emoji: '🍜', bg: 'linear-gradient(135deg,#16a34a,#86efac)', color: '#16a34a' },
}

const DAY_LABEL: Record<string, string> = { sat: '土', sun: '日', both: '両日' }

type TypeFilter = 'all' | ExhibitType
type DayFilter  = 'all' | 'sat' | 'sun'

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all',       label: 'すべて' },
  { key: 'class',     label: '展示' },
  { key: 'food',      label: 'フード' },
  { key: 'band',      label: '軽音楽部' },
  { key: 'special',   label: 'スペシャル' },
  { key: 'cafeteria', label: '食堂' },
]

interface Props {
  exhibits:      Exhibit[]
  onSwitchToMap: () => void
}

export default function ExhibitListView({ exhibits, onSwitchToMap }: Props) {
  const router = useRouter()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [dayFilter,  setDayFilter]  = useState<DayFilter>('all')
  const [search,     setSearch]     = useState('')

  const filtered = useMemo(() => exhibits.filter(e => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false
    if (dayFilter !== 'all' && e.day !== 'both' && e.day !== dayFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return e.name.toLowerCase().includes(q) || (e.class_label?.toLowerCase().includes(q) ?? false)
    }
    return true
  }), [exhibits, typeFilter, dayFilter, search])

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#f5f3ef' }}>
      <style>{`
        @keyframes elFadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .el-card { transition: transform 0.15s, opacity 0.15s, box-shadow 0.15s; }
        .el-card:active { opacity: 0.72; transform: scale(0.97); }
        .el-card:hover  { box-shadow: 0 4px 20px rgba(0,0,0,0.12) !important; transform: translateY(-2px); }
        .el-chip { transition: all 0.15s; }
        .el-chip:active { opacity: 0.7; }
        .el-scroll::-webkit-scrollbar { display: none; }
        .el-scroll { scrollbar-width: none; }

        /* ── レスポンシブ グリッド ── */
        .el-grid { grid-template-columns: repeat(2, 1fr); }
        @media (min-width: 640px)  { .el-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1024px) { .el-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (min-width: 1280px) { .el-grid { grid-template-columns: repeat(5, 1fr); } }

        /* ── PCではカードホバーを有効化、モバイルは :active のみ ── */
        @media (hover: none) { .el-card:hover { box-shadow: 0 1px 8px rgba(0,0,0,0.07) !important; transform: none !important; } }

        /* ── DesktopNav 分のボトムパディング ── */
        @media (min-width: 640px) { .el-scroll-area { padding-bottom: 100px !important; } }

        /* ── ヘッダーとグリッドの最大幅 ── */
        .el-inner { max-width: 1400px; margin: 0 auto; width: 100%; }

        /* ── PC: フィルター横並び (折り返し可) ── */
        @media (min-width: 640px) {
          .el-filter-row { flex-wrap: wrap !important; overflow-x: visible !important; padding-bottom: 12px !important; }
          .el-sep { display: none !important; }
          .el-day-group { display: flex; gap: 6px; margin-left: auto; }
        }
      `}</style>

      {/* ─── ヘッダー ─── */}
      <div style={{
        flexShrink: 0,
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid #f1e8dc',
        zIndex: 10,
      }}>
        <div className="el-inner" style={{ padding: '12px 16px 0' }}>

          {/* タイトル行 + マップに戻るボタン */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div>
              <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#1e293b' }}>
                展示一覧
              </div>
              <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginTop:1 }}>
                {filtered.length}件
              </div>
            </div>
            <button
              onClick={onSwitchToMap}
              style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'8px 18px', borderRadius:99, border:'none', cursor:'pointer',
                background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
                color:'#fff', fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                boxShadow:'0 2px 10px rgba(255,107,0,0.28)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                <line x1="9" y1="3" x2="9" y2="18"/>
                <line x1="15" y1="6" x2="15" y2="21"/>
              </svg>
              マップで見る
            </button>
          </div>

          {/* 検索バー */}
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            background:'#f1f5f9', borderRadius:10, padding:'9px 14px',
            marginBottom:10,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="展示名・クラス名で検索…"
              style={{
                flex:1, border:'none', background:'transparent', outline:'none',
                fontSize:14, color:'#334155', fontFamily:"'Kiwi Maru',serif",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#aaa', fontSize:14, padding:0 }}
              >
                ✕
              </button>
            )}
          </div>

          {/* フィルターチップ */}
          <div className="el-filter-row el-scroll" style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:12, alignItems:'center' }}>
            {/* 種別フィルター */}
            {TYPE_FILTERS.map(f => {
              const active = typeFilter === f.key
              return (
                <button key={f.key} className="el-chip" onClick={() => setTypeFilter(f.key)} style={{
                  flexShrink:0, padding:'6px 14px', borderRadius:99, border:'none', cursor:'pointer',
                  background: active ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f1f5f9',
                  color: active ? '#fff' : '#64748b',
                  fontWeight:700, fontSize:12, fontFamily:"'Kiwi Maru',serif",
                }}>
                  {f.label}
                </button>
              )
            })}
            {/* セパレーター（モバイルのみ表示） */}
            <div className="el-sep" style={{ width:1, background:'#e2e8f0', flexShrink:0, alignSelf:'stretch', margin:'0 2px' }} />
            {/* 日付フィルター */}
            <div className="el-day-group" style={{ display:'flex', gap:6 }}>
              {(['all', 'sat', 'sun'] as DayFilter[]).map(d => {
                const active = dayFilter === d
                const label  = d === 'all' ? '両日' : d === 'sat' ? '土曜' : '日曜'
                return (
                  <button key={d} className="el-chip" onClick={() => setDayFilter(d)} style={{
                    flexShrink:0, padding:'6px 13px', borderRadius:99, border:'none', cursor:'pointer',
                    background: active ? '#1e293b' : '#f1f5f9',
                    color: active ? '#fff' : '#64748b',
                    fontWeight:700, fontSize:12, fontFamily:"'Kiwi Maru',serif",
                  }}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── カードグリッド ─── */}
      <div className="el-scroll-area" style={{ flex:1, overflowY:'auto', padding:'16px 12px 40px' }}>
        <div className="el-inner" style={{ padding:'0 4px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding:'80px 20px', textAlign:'center' }}>
              <div style={{ fontSize:42, marginBottom:12 }}>🔍</div>
              <p style={{ fontSize:14, color:'#bbb', fontFamily:"'Kiwi Maru',serif" }}>
                該当する展示が見つかりません
              </p>
            </div>
          ) : (
            <div className="el-grid" style={{ display:'grid', gap:12 }}>
              {filtered.map((e, i) => {
                const cfg   = TYPE_CONFIG[e.type] ?? TYPE_CONFIG.class
                const thumb = e.thumbnail_url ?? e.cover_url ?? null
                return (
                  <button
                    key={e.id}
                    className="el-card"
                    onClick={() => router.push(`/exhibit/${e.id}`)}
                    style={{
                      background:'#fff', borderRadius:14, border:'none', cursor:'pointer',
                      textAlign:'left', padding:0, overflow:'hidden',
                      boxShadow:'0 1px 8px rgba(0,0,0,0.07)',
                      animation:`elFadeUp ${Math.min(0.06 + i * 0.02, 0.5)}s ease both`,
                    }}
                  >
                    {/* サムネイル */}
                    <div style={{ position:'relative', aspectRatio:'4/3', overflow:'hidden' }}>
                      {thumb ? (
                        <img src={thumb} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                      ) : (
                        <div style={{
                          width:'100%', height:'100%', background:cfg.bg,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:42, opacity:0.6,
                        }}>
                          {cfg.emoji}
                        </div>
                      )}
                      {/* 日付バッジ */}
                      <div style={{
                        position:'absolute', top:7, right:7,
                        background:'rgba(0,0,0,0.52)',
                        backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)',
                        color:'#fff', fontSize:10, fontWeight:700,
                        padding:'3px 8px', borderRadius:99,
                        fontFamily:"'Kiwi Maru',serif",
                      }}>
                        {DAY_LABEL[e.day] ?? ''}
                      </div>
                    </div>

                    {/* テキスト情報 */}
                    <div style={{ padding:'10px 12px 12px' }}>
                      {e.class_label && (
                        <div style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:3 }}>
                          {e.class_label}
                        </div>
                      )}
                      <div style={{
                        fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700,
                        color:'#0f172a', lineHeight:1.35,
                        overflow:'hidden', display:'-webkit-box',
                        WebkitLineClamp:2, WebkitBoxOrient:'vertical',
                        marginBottom:8,
                      }}>
                        {e.name}
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                        {/* 場所チップ */}
                        {e.room_display && (
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:3,
                            fontSize:10, color:'#475569', fontFamily:"'Kiwi Maru',serif",
                            background:'#f1f5f9', padding:'3px 8px', borderRadius:99,
                          }}>
                            📍 {e.room_display}{e.floor != null ? ` · ${e.floor}F` : ''}
                          </span>
                        )}
                        {/* 種別バッジ */}
                        <span style={{
                          fontSize:10, fontWeight:700,
                          color: cfg.color,
                          background: `${cfg.color}18`,
                          padding:'3px 8px', borderRadius:99,
                          fontFamily:"'Kiwi Maru',serif",
                        }}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
