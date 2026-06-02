'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'

const QrScanner     = dynamic(() => import('@/components/ui/QrScanner'),    { ssr: false })
const FeedbackSheet = dynamic(() => import('@/components/ui/FeedbackSheet'), { ssr: false })

interface StampExhibit { id: string; name: string; class_label: string | null; thumbnail_url: string | null }
interface StampRecord  { exhibit_id: string; stamped_at: string }
interface Toast        { msg: string; type: 'ok' | 'err' | 'already' }

const COLS = 5
const GAP  = 8   // セル間の隙間 px
const PAD  = 16  // 外側の余白 px

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

  const [exhibits,      setExhibits]      = useState<StampExhibit[]>([])
  const [stamps,        setStamps]        = useState<StampRecord[]>([])
  const [scanning,      setScanning]      = useState(false)
  const [newStampId,    setNewStampId]    = useState<string | null>(null)
  const [toast,         setToast]         = useState<Toast | null>(null)
  const [feedbackSheet, setFeedbackSheet] = useState<{ exhibitId: string; exhibitName: string } | null>(null)
  const [page,        setPage]        = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(3)
  const [cellSize,    setCellSize]    = useState(56)
  const [gate] = useState<'blocked' | 'ok'>(() => {
    if (typeof window === 'undefined') return 'ok'
    const ua         = navigator.userAgent
    const isMobile   = /iPhone|iPad|iPod|Android/.test(ua)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    return (!isMobile || isStandalone) ? 'ok' : 'blocked'
  })
  const [gateIOS] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return /iPhone|iPad|iPod/.test(navigator.userAgent)
  })

  const bodyRef  = useRef<HTMLDivElement>(null)
  const touchX   = useRef(0)

  // ── セルサイズ・1ページの行数を計測 ───────────────────────────────
  useEffect(() => {
    const measure = () => {
      if (!bodyRef.current) return
      const W = bodyRef.current.clientWidth
      const H = bodyRef.current.clientHeight

      // セル幅：画面幅から計算しつつ最大 100px に抑える
      const csRaw = Math.floor((W - PAD * 2 - GAP * (COLS - 1)) / COLS)
      const cs    = Math.min(csRaw, 100)
      // 名前エリアを含むセル全高
      const cellH = cs + 22
      // 収まる行数
      const rows = Math.max(1, Math.floor((H - GAP * 4) / (cellH + GAP)))

      setCellSize(cs)
      setRowsPerPage(rows)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (bodyRef.current) ro.observe(bodyRef.current)
    return () => ro.disconnect()
  }, [])

  const itemsPerPage = rowsPerPage * COLS
  const pageCount    = Math.max(1, Math.ceil(exhibits.length / itemsPerPage))
  const pageExhibits = exhibits.slice(page * itemsPerPage, (page + 1) * itemsPerPage)

  // ── データ取得 ────────────────────────────────────────────────────
  useEffect(() => {
    createClient()
      .from('exhibits')
      .select('id, name, class_label, thumbnail_url')
      .eq('is_stamp_target', true)
      .eq('is_active', true)
      .then(({ data }) => { if (data) setExhibits(data as StampExhibit[]) })
  }, [])

  useEffect(() => {
    if (!userId) return
    fetch(`/api/stamp?userId=${userId}`)
      .then(r => r.json())
      .then((json: { stamps: StampRecord[] }) => { if (json.stamps) setStamps(json.stamps) })
  }, [userId])

  const fetchStamps = useCallback(async (uid: string) => {
    const res  = await fetch(`/api/stamp?userId=${uid}`)
    const json = await res.json() as { stamps: StampRecord[] }
    if (json.stamps) setStamps(json.stamps)
  }, [])

  // ── スキャン処理 ──────────────────────────────────────────────────
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exhibitId: e, w, h, userId }),
      })
      const json = await res.json() as { ok?: boolean; already?: boolean; exhibitName?: string; error?: string }

      if (json.already) {
        showToast(`${json.exhibitName} は既にスタンプ済みです`, 'already')
        setFeedbackSheet({ exhibitId: e, exhibitName: json.exhibitName ?? '' })
      } else if (json.ok) {
        setNewStampId(e)
        setTimeout(() => setNewStampId(null), 1500)
        await fetchStamps(userId)
        showToast(`✓ ${json.exhibitName} のスタンプを押しました！`, 'ok')
        setFeedbackSheet({ exhibitId: e, exhibitName: json.exhibitName ?? '' })
        const idx = exhibits.findIndex(ex => ex.id === e)
        if (idx >= 0) setPage(Math.floor(idx / itemsPerPage))
      } else {
        showToast(json.error ?? 'エラーが発生しました', 'err')
      }
    } catch {
      showToast('このQRコードは対応していません', 'err')
    }
  }, [userId, fetchStamps, showToast, exhibits, itemsPerPage])

  const stampedIds = new Set(stamps.map(s => s.exhibit_id))
  const collected  = stamps.length
  const total      = exhibits.length

  // ── インストールゲート画面 ─────────────────────────────────────────
  if (gate === 'blocked') {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px', background: '#fff8f0', textAlign: 'center',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/nanpen.png" alt="" style={{ width: 80, marginBottom: 20, opacity: 0.85 }} />
        <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
          アプリ版でのみ使えます
        </div>
        <div style={{ fontSize: 12, color: '#64748b', fontFamily: "'Kiwi Maru',serif", lineHeight: 1.8, marginBottom: 32 }}>
          スタンプラリーはホーム画面に追加した<br />
          アプリ版からのみご利用いただけます。
        </div>

        <div style={{
          width: '100%', maxWidth: 320,
          background: '#fff', borderRadius: 16, padding: '20px',
          border: '1.5px solid rgba(255,140,0,0.3)',
          boxShadow: '0 4px 16px rgba(255,107,0,0.08)',
          textAlign: 'left',
        }}>
          <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>
            {gateIOS ? '📱 iPhoneの場合' : '📱 Androidの場合'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {gateIOS ? (
              <>
                <GateStep n={1} text="SafariでこのページをAirする（他のブラウザは不可）" />
                <GateStep n={2} text="画面下の共有ボタン（□↑）をタップ" />
                <GateStep n={3} text="「ホーム画面に追加」を選んで「追加」" />
                <GateStep n={4} text="ホーム画面のアイコンからアプリを起動" />
              </>
            ) : (
              <>
                <GateStep n={1} text="Chrome でこのページを開く" />
                <GateStep n={2} text="右上メニュー（⋮）→「ホーム画面に追加」" />
                <GateStep n={3} text="ホーム画面のアイコンからアプリを起動" />
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes stamp-pop {
          0%   { transform: scale(1.8) rotate(-6deg); opacity: 0; }
          55%  { transform: scale(0.93) rotate(1deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: '#f8fafc', overflow: 'hidden',
      }}>

        {/* ── ヘッダー ── */}
        <div style={{
          padding: '14px 16px 12px', flexShrink: 0,
          background: '#fff', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 17, fontWeight: 700, color: '#1e293b' }}>
              🎯 スタンプラリー
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", marginTop: 1 }}>
              各展示でQRを読み取ろう
            </div>
          </div>
          <div style={{
            padding: '6px 14px', borderRadius: 99,
            background: collected === total && total > 0 ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f1f5f9',
            fontFamily: "'Kaisei Decol',serif", fontSize: 14, fontWeight: 700,
            color: collected === total && total > 0 ? '#fff' : '#64748b',
          }}>
            {collected} / {total}
            {collected === total && total > 0 && ' 🎉'}
          </div>
        </div>

        {/* ── グリッド本体 ── */}
        <div
          ref={bodyRef}
          style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center' }}
          onTouchStart={e => { touchX.current = e.touches[0].clientX }}
          onTouchEnd={e => {
            const diff = touchX.current - e.changedTouches[0].clientX
            if (diff >  50 && page < pageCount - 1) setPage(p => p + 1)
            if (diff < -50 && page > 0)             setPage(p => p - 1)
          }}
        >
          {total === 0 ? (
            <div style={{
              width: '100%', textAlign: 'center',
              color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", fontSize: 13,
            }}>
              スタンプ展示が設定されていません
            </div>
          ) : (
            <div style={{
              padding: `0 ${PAD}px`,
              display: 'flex', flexDirection: 'column', gap: GAP,
              width: '100%',
              alignItems: 'center',  // デスクトップで中央寄せ
            }}>
              {Array.from({ length: rowsPerPage }, (_, r) => (
                <div key={r} style={{ display: 'flex', gap: GAP }}>
                  {Array.from({ length: COLS }, (_, c) => {
                    const ex      = pageExhibits[r * COLS + c]
                    const stamped = ex ? stampedIds.has(ex.id) : false
                    const isNew   = ex ? newStampId === ex.id : false

                    return (
                      <div key={c} style={{ width: cellSize, flexShrink: 0 }}>
                        {/* 画像ボックス */}
                        <div style={{
                          width: cellSize, height: cellSize,
                          borderRadius: 10,
                          overflow: 'hidden',
                          background: !ex ? '#f1f5f9' : stamped ? '#fff0e0' : '#e9f0f8',
                          border: stamped ? '2px solid #FF8C0080' : '1.5px solid #e2e8f0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative',
                          boxShadow: stamped ? '0 2px 8px rgba(255,107,0,0.15)' : '0 1px 3px rgba(0,0,0,0.06)',
                          transition: 'border-color 0.3s, box-shadow 0.3s',
                        }}>
                          {ex && stamped && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ex.thumbnail_url ?? '/nanpen.png'}
                              alt={ex.name}
                              onError={e => { (e.target as HTMLImageElement).src = '/nanpen.png' }}
                              style={{
                                width: '100%', height: '100%', objectFit: 'cover',
                                animation: isNew ? 'stamp-pop 0.45s cubic-bezier(.22,.68,0,1.2)' : undefined,
                              }}
                            />
                          )}
                          {ex && !stamped && (
                            <span style={{ fontSize: cellSize * 0.3, opacity: 0.18 }}>⬜</span>
                          )}
                          {/* スタンプ済みチェック */}
                          {stamped && (
                            <div style={{
                              position: 'absolute', bottom: 3, right: 3,
                              width: 14, height: 14, borderRadius: '50%',
                              background: '#FF6B00', color: '#fff',
                              fontSize: 8, fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                            }}>✓</div>
                          )}
                        </div>

                        {/* クラス名 */}
                        <div style={{
                          marginTop: 4,
                          fontSize: Math.max(8, Math.floor(cellSize * 0.13)),
                          color: ex ? (stamped ? '#92400e' : '#64748b') : 'transparent',
                          fontFamily: "'Kiwi Maru',serif",
                          fontWeight: stamped ? 700 : 400,
                          textAlign: 'center',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          width: cellSize,
                        }}>
                          {ex ? (ex.class_label ?? ex.name) : '　'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── ページネーション ── */}
        {pageCount > 1 && (
          <div style={{
            flexShrink: 0, padding: '6px 16px 4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: '#f8fafc',
          }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: '5px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
                background: '#fff', cursor: page === 0 ? 'default' : 'pointer',
                color: page === 0 ? '#cbd5e1' : '#475569',
                fontSize: 12, fontWeight: 700, fontFamily: "'Kiwi Maru',serif",
              }}
            >← 前</button>

            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {Array.from({ length: pageCount }, (_, i) => (
                <button key={i} onClick={() => setPage(i)} style={{
                  width: i === page ? 20 : 7, height: 7,
                  borderRadius: 99, border: 'none', cursor: 'pointer', padding: 0,
                  background: i === page ? '#FF6B00' : '#cbd5e1',
                  transition: 'all 0.2s',
                }} />
              ))}
            </div>

            <button
              onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
              disabled={page === pageCount - 1}
              style={{
                padding: '5px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
                background: '#fff', cursor: page === pageCount - 1 ? 'default' : 'pointer',
                color: page === pageCount - 1 ? '#cbd5e1' : '#475569',
                fontSize: 12, fontWeight: 700, fontFamily: "'Kiwi Maru',serif",
              }}
            >次 →</button>
          </div>
        )}

        {/* ── スキャンボタン ── */}
        <div style={{
          padding: '8px 16px 16px', flexShrink: 0,
          background: '#fff', borderTop: '1px solid #e2e8f0',
        }}>
          <button
            onClick={() => setScanning(true)}
            disabled={total === 0}
            style={{
              width: '100%', padding: '13px', borderRadius: 12, border: 'none',
              cursor: total === 0 ? 'default' : 'pointer',
              background: total === 0 ? '#e2e8f0' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
              color: total === 0 ? '#94a3b8' : '#fff',
              fontSize: 15, fontWeight: 700, fontFamily: "'Kaisei Decol',serif",
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: total === 0 ? 'none' : '0 4px 14px rgba(255,107,0,0.3)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <rect x="7" y="7" width="10" height="10" rx="1" />
            </svg>
            QR をスキャン
          </button>
        </div>
      </div>

      {scanning && <QrScanner onResult={handleScanResult} onCancel={() => setScanning(false)} />}
      {feedbackSheet && (
        <FeedbackSheet
          exhibitId={feedbackSheet.exhibitId}
          exhibitName={feedbackSheet.exhibitName}
          userId={userId}
          onClose={() => setFeedbackSheet(null)}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          zIndex: 300,
          background: toast.type === 'ok' ? '#16a34a' : toast.type === 'already' ? '#d97706' : '#dc2626',
          color: '#fff', padding: '12px 24px', borderRadius: 12,
          fontSize: 13, fontWeight: 700, fontFamily: "'Kiwi Maru',serif",
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', maxWidth: 300,
          textAlign: 'center', animation: 'toast-in 0.2s ease-out', whiteSpace: 'pre-wrap',
        }}>
          {toast.msg}
        </div>
      )}
    </>
  )
}

function GateStep({ n, text }: { n: number; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg,#FF6B00,#FFAA28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: "'Kaisei Decol',serif",
      }}>{n}</div>
      <div style={{ fontSize: 12, color: '#374151', fontFamily: "'Kiwi Maru',serif", lineHeight: 1.65, paddingTop: 3 }}>
        {text}
      </div>
    </div>
  )
}
