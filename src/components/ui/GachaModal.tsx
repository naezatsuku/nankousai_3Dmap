'use client'

import { useState } from 'react'

interface GachaModalProps {
  userId: string
  w: string
  h: string
  cost: number
  available: number
  onClose: () => void
  onSuccess: (newAvailable: number) => void
}

export default function GachaModal({ userId, w, h, cost, available, onClose, onSuccess }: GachaModalProps) {
  const maxSpins = Math.floor(available / cost)
  const [spins, setSpins]       = useState(Math.min(1, maxSpins))
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')
  const [result, setResult]     = useState<{ spins: number; stampsUsed: number } | null>(null)

  const stampsNeeded = spins * cost

  const handleConfirm = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res  = await fetch('/api/gachapon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, w, h, spins }),
      })
      const json = await res.json() as { ok?: boolean; spins?: number; stampsUsed?: number; available?: number; error?: string }
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'エラーが発生しました')
        setConfirming(false)
        return
      }
      setResult({ spins: json.spins!, stampsUsed: json.stampsUsed! })
      onSuccess(json.available!)
    } catch {
      setError('通信に失敗しました')
      setConfirming(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 260,
      background: 'rgba(15,23,42,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 340,
        background: '#fff', borderRadius: 20, padding: '22px 20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      }}>
        {result ? (
          <>
            <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 18, fontWeight: 700, color: '#1e293b', textAlign: 'center', marginBottom: 8 }}>
              🎉 ガラポン権利を獲得！
            </div>
            <div style={{ fontSize: 13, color: '#64748b', fontFamily: "'Kiwi Maru',serif", textAlign: 'center', lineHeight: 1.8, marginBottom: 20 }}>
              {result.spins} 回分（スタンプ {result.stampsUsed} 個消費）<br />
              受付でガラポンを回してください！
            </div>
            <button onClick={onClose} style={{
              width: '100%', padding: '13px', borderRadius: 12, border: 'none',
              cursor: 'pointer', background: 'linear-gradient(135deg,#FF6B00,#FFAA28)',
              color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: "'Kaisei Decol',serif",
            }}>
              閉じる
            </button>
          </>
        ) : (
          <>
            <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 17, fontWeight: 700, color: '#1e293b', textAlign: 'center', marginBottom: 4 }}>
              🎰 ガラポンを回す
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", textAlign: 'center', marginBottom: 18 }}>
              消費するスタンプ数を設定してください
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
              <Row label="有効な残りスタンプ" value={`${available} 個`} />
              <Row label="1回に必要なスタンプ" value={`${cost} 個`} />
            </div>

            {maxSpins < 1 ? (
              <div style={{ padding: '14px', borderRadius: 12, background: '#fef2f2', color: '#dc2626', fontSize: 13, fontFamily: "'Kiwi Maru',serif", textAlign: 'center', marginBottom: 16 }}>
                スタンプが足りません
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', fontFamily: "'Kiwi Maru',serif", marginBottom: 8 }}>
                  ガラポンを回す回数
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
                  <StepBtn onClick={() => setSpins(s => Math.max(1, s - 1))} disabled={confirming}>−</StepBtn>
                  <div style={{ flex: 1, textAlign: 'center', fontFamily: "'Kaisei Decol',serif", fontSize: 26, fontWeight: 700, color: '#1e293b' }}>
                    {spins} 回
                  </div>
                  <StepBtn onClick={() => setSpins(s => Math.min(maxSpins, s + 1))} disabled={confirming}>＋</StepBtn>
                </div>
                <div style={{ fontSize: 13, color: '#374151', fontFamily: "'Kiwi Maru',serif", textAlign: 'center', marginBottom: 18 }}>
                  消費スタンプ数: <strong>{stampsNeeded} 個</strong>
                </div>
              </>
            )}

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', marginBottom: 12, fontSize: 12, color: '#dc2626', fontFamily: "'Kiwi Maru',serif" }}>
                ⚠ {error}
              </div>
            )}

            {confirming ? (
              <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fff8f0', border: '1px solid rgba(255,140,0,0.25)' }}>
                <div style={{ fontSize: 12, color: '#374151', fontFamily: "'Kiwi Maru',serif", lineHeight: 1.7, marginBottom: 12, textAlign: 'center' }}>
                  スタンプ {stampsNeeded} 個を消費して<br />ガラポンを {spins} 回 分回します。よろしいですか？
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirming(false)} disabled={submitting} style={{
                    flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #e2e8f0',
                    background: '#fff', color: '#536471', fontSize: 13, fontWeight: 700,
                    fontFamily: "'Kaisei Decol',serif", cursor: 'pointer',
                  }}>
                    キャンセル
                  </button>
                  <button onClick={handleConfirm} disabled={submitting} style={{
                    flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg,#FF6B00,#FFAA28)', color: '#fff',
                    fontSize: 13, fontWeight: 700, fontFamily: "'Kaisei Decol',serif", cursor: 'pointer',
                  }}>
                    {submitting ? '処理中…' : '確定する'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} style={{
                  flex: 1, padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0',
                  background: '#fff', color: '#536471', fontSize: 14, fontWeight: 700,
                  fontFamily: "'Kaisei Decol',serif", cursor: 'pointer',
                }}>
                  キャンセル
                </button>
                <button
                  onClick={() => setConfirming(true)}
                  disabled={maxSpins < 1}
                  style={{
                    flex: 2, padding: '12px', borderRadius: 12, border: 'none',
                    cursor: maxSpins < 1 ? 'default' : 'pointer',
                    background: maxSpins < 1 ? '#e2e8f0' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
                    color: maxSpins < 1 ? '#94a3b8' : '#fff',
                    fontSize: 14, fontWeight: 700, fontFamily: "'Kaisei Decol',serif",
                  }}
                >
                  ガラポンを回す！
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: 12, color: '#64748b', fontFamily: "'Kiwi Maru',serif" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', fontFamily: "'Kaisei Decol',serif" }}>{value}</span>
    </div>
  )
}

function StepBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 36, height: 36, borderRadius: 10,
      border: '1px solid #e2e8f0', background: '#fff',
      cursor: disabled ? 'default' : 'pointer', fontSize: 16, color: '#64748b',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {children}
    </button>
  )
}
