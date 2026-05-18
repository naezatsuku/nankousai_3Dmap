'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'

const QrScanner     = dynamic(() => import('@/components/ui/QrScanner'),    { ssr: false })
const FeedbackSheet = dynamic(() => import('@/components/ui/FeedbackSheet'), { ssr: false })

interface StampExhibit { id: string; name: string; thumbnail_url: string | null }
interface StampRecord  { exhibit_id: string; stamped_at: string }
interface Toast        { msg: string; type: 'ok' | 'err' | 'already' }

// ── スタンプサイズ（展示数に応じて縮小）──────────────────────────
function stampSizePct(n: number): number {
  return Math.max(7, Math.min(13, 100 / n))
}

// ── 魔法陣 SVG ────────────────────────────────────────────────────
function MagicCircle({ n, stampedIds, exhibits, newStampId }: {
  n: number
  exhibits: StampExhibit[]
  stampedIds: Set<string>
  newStampId: string | null
}) {
  const sizePct = stampSizePct(n)
  const ringR   = 36 // 配置リングの半径（%）

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1' }}>
      {/* ── SVG 魔法陣 ─────────────────────────── */}
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <radialGradient id="mc-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#1e0b38" />
            <stop offset="100%" stopColor="#06091a" />
          </radialGradient>
          <radialGradient id="mc-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#FF6B0022" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* 背景 */}
        <circle cx="50" cy="50" r="49" fill="url(#mc-bg)" />
        <circle cx="50" cy="50" r="49" fill="url(#mc-glow)" />

        {/* 外リング */}
        <circle cx="50" cy="50" r="47" fill="none" stroke="#C8922A" strokeWidth="0.4" opacity="0.6" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="#C8922A" strokeWidth="0.8" opacity="0.9" />

        {/* スタンプ配置リング（破線） */}
        <circle cx="50" cy="50" r={ringR} fill="none" stroke="#C8922A" strokeWidth="0.3" opacity="0.35" strokeDasharray="2 3" />

        {/* 中間リング */}
        <circle cx="50" cy="50" r="26" fill="none" stroke="#C8922A" strokeWidth="0.6" opacity="0.7" />

        {/* 内リング */}
        <circle cx="50" cy="50" r="13" fill="none" stroke="#C8922A" strokeWidth="0.7" opacity="0.9" />

        {/* 六芒星（内側装飾） */}
        <polygon points="50,37 60.4,56 39.6,56" fill="none" stroke="#C8922A" strokeWidth="0.4" opacity="0.55" />
        <polygon points="50,63 60.4,44 39.6,44" fill="none" stroke="#C8922A" strokeWidth="0.4" opacity="0.55" />

        {/* スタンプ位置への放射線 */}
        {exhibits.map((_, i) => {
          const a  = (2 * Math.PI * i / n) - Math.PI / 2
          const x1 = 50 + 13 * Math.cos(a)
          const y1 = 50 + 13 * Math.sin(a)
          const x2 = 50 + 44 * Math.cos(a)
          const y2 = 50 + 44 * Math.sin(a)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#C8922A" strokeWidth="0.25" opacity="0.25" />
        })}

        {/* 外リング上の小マーク（スタンプ位置） */}
        {exhibits.map((_, i) => {
          const a = (2 * Math.PI * i / n) - Math.PI / 2
          const x = 50 + 45 * Math.cos(a)
          const y = 50 + 45 * Math.sin(a)
          return <circle key={i} cx={x} cy={y} r="1.2" fill="#C8922A" opacity="0.85" />
        })}
      </svg>

      {/* ── スタンプスロット ────────────────────── */}
      {exhibits.map((exhibit, i) => {
        const a         = (2 * Math.PI * i / n) - Math.PI / 2
        const leftPct   = 50 + ringR * Math.cos(a)
        const topPct    = 50 + ringR * Math.sin(a)
        const collected = stampedIds.has(exhibit.id)
        const isNew     = newStampId === exhibit.id

        return (
          <StampSlot
            key={exhibit.id}
            exhibit={exhibit}
            collected={collected}
            isNew={isNew}
            leftPct={leftPct}
            topPct={topPct}
            sizePct={sizePct}
          />
        )
      })}

      {/* ── 中央テキスト ─────────────────────────── */}
      <div style={{
        position:       'absolute',
        inset:          0,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        pointerEvents:  'none',
      }}>
        <div style={{ fontSize: 'clamp(9px, 2vw, 13px)', color: '#C8922A', fontFamily: "'Kaisei Decol',serif", letterSpacing: '0.15em', opacity: 0.85 }}>
          南高祭
        </div>
        <div style={{ fontSize: 'clamp(7px, 1.5vw, 10px)', color: '#C8922A80', fontFamily: "'Kiwi Maru',serif", marginTop: 2 }}>
          STAMP RALLY
        </div>
      </div>
    </div>
  )
}

// ── スタンプスロット ──────────────────────────────────────────────
function StampSlot({ exhibit, collected, isNew, leftPct, topPct, sizePct }: {
  exhibit:   StampExhibit
  collected: boolean
  isNew:     boolean
  leftPct:   number
  topPct:    number
  sizePct:   number
}) {
  const imgSrc = exhibit.thumbnail_url ?? '/nanpen.png'

  return (
    <div style={{
      position: 'absolute',
      left:     `${leftPct}%`,
      top:      `${topPct}%`,
    }}>
      {/* インク広がりエフェクト */}
      {isNew && (
        <div style={{
          position:     'absolute',
          width:        `${sizePct * 2}vmin`,
          height:       `${sizePct * 2}vmin`,
          borderRadius: '50%',
          border:       '3px solid #FF6B00',
          transform:    'translate(-50%, -50%)',
          animation:    'ink-ring 0.9s ease-out forwards',
          pointerEvents: 'none',
        }} />
      )}

      {/* スタンプ本体 */}
      <div style={{
        position:        'absolute',
        width:           `${sizePct}vmin`,
        height:          `${sizePct}vmin`,
        borderRadius:    '50%',
        transform:       'translate(-50%, -50%)',
        animation:       isNew ? 'stamp-down 0.75s cubic-bezier(.22,.68,0,1.2) forwards' : undefined,
        overflow:        'hidden',
        border:          collected ? '2px solid #FF6B00' : '1.5px solid #444',
        background:      collected ? '#1a0533' : '#0c101a',
        boxShadow:       collected ? '0 0 10px #FF6B0055' : 'none',
        opacity:         collected ? 1 : 0.35,
        transition:      'opacity 0.4s, box-shadow 0.4s, border-color 0.4s',
      }}>
        {collected && (
          <img
            src={imgSrc}
            alt={exhibit.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
            onError={e => { (e.target as HTMLImageElement).src = '/nanpen.png' }}
          />
        )}
      </div>

      {/* 展示名ラベル（収集済みのみ） */}
      {collected && (
        <div style={{
          position:   'absolute',
          top:        `calc(${sizePct / 2}vmin + 4px)`,
          left:       '50%',
          transform:  'translateX(-50%)',
          whiteSpace: 'nowrap',
          fontSize:   'clamp(7px, 1.4vmin, 9px)',
          color:      '#C8922A',
          fontFamily: "'Kiwi Maru',serif",
          fontWeight: 700,
          textShadow: '0 1px 4px #000a',
          pointerEvents: 'none',
        }}>
          {exhibit.name.length > 6 ? exhibit.name.slice(0, 5) + '…' : exhibit.name}
        </div>
      )}
    </div>
  )
}

// ── メインページ ─────────────────────────────────────────────────
export default function StampPage() {
  const [userId] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    let id = localStorage.getItem('stamp_user_id')
    if (!id) {
      id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
      localStorage.setItem('stamp_user_id', id)
    }
    return id
  })
  const [exhibits,   setExhibits]   = useState<StampExhibit[]>([])
  const [stamps,     setStamps]     = useState<StampRecord[]>([])
  const [scanning,       setScanning]       = useState(false)
  const [newStampId,     setNewStampId]     = useState<string | null>(null)
  const [toast,          setToast]          = useState<Toast | null>(null)
  const [debugLog,       setDebugLog]       = useState<string[]>([])
  const [feedbackSheet,  setFeedbackSheet]  = useState<{ exhibitId: string; exhibitName: string } | null>(null)

  const dbg = (msg: string) => {
    console.log('[stamp]', msg)
    setDebugLog(prev => [...prev.slice(-9), `${new Date().toTimeString().slice(0,8)} ${msg}`])
  }

  // スタンプ対象展示を取得
  useEffect(() => {
    console.log('[stamp] 展示フェッチ開始')
    const sb = createClient()
    sb.from('exhibits')
      .select('id, name, thumbnail_url')
      .eq('is_stamp_target', true)
      .eq('is_active', true)
      .then(({ data, error }) => {
        if (error) { dbg(`展示エラー: ${error.message}`); return }
        dbg(`展示 ${data?.length ?? 0}件`)
        if (data) setExhibits(data as StampExhibit[])
      })
  }, [])

  // 収集済みスタンプを取得
  const fetchStamps = useCallback(async (uid: string) => {
    dbg('スタンプ取得中…')
    const res  = await fetch(`/api/stamp?userId=${uid}`)
    const json = await res.json() as { stamps: StampRecord[] }
    dbg(`スタンプ ${json.stamps?.length ?? 0}件`)
    if (json.stamps) setStamps(json.stamps)
  }, [])

  useEffect(() => {
    if (!userId) return
    let alive = true
    fetch(`/api/stamp?userId=${userId}`)
      .then(r => r.json())
      .then((json: { stamps: StampRecord[] }) => { if (alive && json.stamps) setStamps(json.stamps) })
    return () => { alive = false }
  }, [userId])

  const showToast = useCallback((msg: string, type: Toast['type']) => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const handleScanResult = useCallback(async (qrText: string) => {
    setScanning(false)
    try {
      const url = new URL(qrText)
      const e   = url.searchParams.get('e')
      const w   = url.searchParams.get('w')
      const h   = url.searchParams.get('h')
      if (!e || !w || !h || !userId) { showToast('QRコードを認識できませんでした', 'err'); return }

      const res  = await fetch('/api/stamp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ exhibitId: e, w, h, userId }),
      })
      const json = await res.json() as { ok?: boolean; already?: boolean; exhibitName?: string; error?: string }

      if (json.already) {
        showToast(`${json.exhibitName} は既にスタンプ済みです`, 'already')
        setFeedbackSheet({ exhibitId: e, exhibitName: json.exhibitName ?? '' })
      } else if (json.ok) {
        setNewStampId(e)
        setTimeout(() => setNewStampId(null), 2200)
        await fetchStamps(userId)
        showToast(`✓ ${json.exhibitName} のスタンプを押しました！`, 'ok')
        setFeedbackSheet({ exhibitId: e, exhibitName: json.exhibitName ?? '' })
      } else {
        showToast(json.error ?? 'エラーが発生しました', 'err')
      }
    } catch {
      showToast('このQRコードは対応していません', 'err')
    }
  }, [userId, fetchStamps, showToast])

  const stampedIds  = new Set(stamps.map(s => s.exhibit_id))
  const collected   = stamps.length
  const total       = exhibits.length

  return (
    <>
      <style>{`
        @keyframes stamp-down {
          0%   { transform: translate(-50%,-50%) scale(3) rotate(-10deg); opacity: 0; }
          35%  { opacity: 1; }
          65%  { transform: translate(-50%,-50%) scale(1.08) rotate(1.5deg); }
          80%  { transform: translate(-50%,-50%) scale(0.96); }
          100% { transform: translate(-50%,-50%) scale(1) rotate(0deg); }
        }
        @keyframes ink-ring {
          0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 0.75; }
          100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; }
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div style={{
        minHeight:     '100%',
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        padding:       '20px 16px 40px',
        background:    'linear-gradient(170deg, #0f0520 0%, #10081e 60%, #070d20 100%)',
      }}>

        {/* ── ヘッダー ── */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{
            fontFamily: "'Kaisei Decol',serif",
            fontSize:   22,
            fontWeight: 900,
            color:      '#fff',
            letterSpacing: '0.08em',
            marginBottom: 8,
          }}>
            ✦ スタンプラリー ✦
          </h1>
          {total > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{
                background: 'rgba(255,107,0,0.15)',
                border:     '1px solid rgba(255,107,0,0.4)',
                borderRadius: 99,
                padding:    '4px 16px',
                color:      '#FFAA28',
                fontSize:   13,
                fontWeight: 700,
                fontFamily: "'Kiwi Maru',serif",
              }}>
                {collected} / {total} 収集
              </div>
              {collected === total && total > 0 && (
                <div style={{ color: '#fbbf24', fontSize: 13, fontFamily: "'Kiwi Maru',serif" }}>
                  🎉 コンプリート！
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#ffffff44', fontSize: 12, fontFamily: "'Kiwi Maru',serif" }}>
              準備中です
            </div>
          )}
        </div>

        {/* ── 魔法陣 ── */}
        <div style={{ width: '100%', maxWidth: 440 }}>
          {total > 0 ? (
            <MagicCircle
              n={total}
              exhibits={exhibits}
              stampedIds={stampedIds}
              newStampId={newStampId}
            />
          ) : (
            <div style={{
              aspectRatio:  '1',
              borderRadius: '50%',
              background:   '#06091a',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              color:        '#ffffff22',
              fontSize:     14,
              fontFamily:   "'Kiwi Maru',serif",
            }}>
              スタンプ展示が設定されていません
            </div>
          )}
        </div>

        {/* ── スキャンボタン ── */}
        {total > 0 && (
          <button
            onClick={() => setScanning(true)}
            style={{
              marginTop:    32,
              padding:      '14px 40px',
              borderRadius: 99,
              border:       'none',
              cursor:       'pointer',
              background:   'linear-gradient(135deg, #FF6B00, #FFAA28)',
              color:        '#fff',
              fontSize:     16,
              fontWeight:   700,
              fontFamily:   "'Kaisei Decol',serif",
              boxShadow:    '0 4px 20px rgba(255,107,0,0.5)',
              letterSpacing: '0.05em',
              display:      'flex',
              alignItems:   'center',
              gap:          8,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <rect x="7" y="7" width="10" height="10" rx="1" />
            </svg>
            QR をスキャン
          </button>
        )}

        {/* ── 説明テキスト ── */}
        {total > 0 && (
          <p style={{
            marginTop:  16,
            color:      '#ffffff44',
            fontSize:   11,
            fontFamily: "'Kiwi Maru',serif",
            textAlign:  'center',
            lineHeight: 1.7,
          }}>
            各展示に訪れて QR コードを読み取ってください<br />
            スタンプが集まると魔法陣が完成します
          </p>
        )}
      </div>

      {/* ── QR スキャナー ── */}
      {scanning && (
        <QrScanner
          onResult={handleScanResult}
          onCancel={() => setScanning(false)}
        />
      )}

      {/* ── フィードバックシート ── */}
      {feedbackSheet && (
        <FeedbackSheet
          exhibitId={feedbackSheet.exhibitId}
          exhibitName={feedbackSheet.exhibitName}
          userId={userId}
          onClose={() => setFeedbackSheet(null)}
        />
      )}

      {/* ── デバッグログ（開発時のみ表示） ── */}
      {process.env.NODE_ENV === 'development' && debugLog.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 160, left: 8, right: 8, zIndex: 400,
          background: 'rgba(0,0,0,0.85)', borderRadius: 8, padding: '8px 12px',
          fontFamily: 'monospace', fontSize: 11, color: '#0f0',
          pointerEvents: 'none',
        }}>
          {debugLog.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {/* ── トースト通知 ── */}
      {toast && (
        <div style={{
          position:       'fixed',
          bottom:         100,
          left:           '50%',
          transform:      'translateX(-50%)',
          zIndex:         300,
          background:     toast.type === 'ok' ? '#16a34a' : toast.type === 'already' ? '#d97706' : '#dc2626',
          color:          '#fff',
          padding:        '12px 24px',
          borderRadius:   12,
          fontSize:       13,
          fontWeight:     700,
          fontFamily:     "'Kiwi Maru',serif",
          boxShadow:      '0 4px 20px rgba(0,0,0,0.35)',
          maxWidth:       320,
          textAlign:      'center',
          animation:      'toast-in 0.25s ease-out',
          whiteSpace:     'pre-wrap',
        }}>
          {toast.msg}
        </div>
      )}
    </>
  )
}
