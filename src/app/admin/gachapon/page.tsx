'use client'

import { useState, useEffect } from 'react'
import PageLoader from '@/components/ui/PageLoader'

export default function GachaponAdminPage() {
  const [cost,    setCost]    = useState<number | null>(null)
  const [qrUrl,   setQrUrl]   = useState<string | null>(null)
  const [QrComp,  setQrComp]  = useState<React.ComponentType<{ value: string; size: number }> | null>(null)
  const [error,   setError]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    import('qrcode.react').then(m => setQrComp(() => m.QRCodeSVG as React.ComponentType<{ value: string; size: number }>))
  }, [])

  const load = async () => {
    try {
      const res  = await fetch('/api/admin/gachapon')
      const json = await res.json() as { cost?: number; qrUrl?: string; error?: string }
      if (!res.ok) { setError(json.error ?? 'エラーが発生しました'); return }
      setCost(json.cost ?? 5)
      setQrUrl(json.qrUrl ?? null)
    } catch {
      setError('読み込みに失敗しました')
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [])

  const handleSave = async () => {
    if (cost === null || saving) return
    setSaving(true)
    setSaved(false)
    setError('')
    const res  = await fetch('/api/admin/gachapon', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cost }),
    })
    const json = await res.json() as { ok?: boolean; error?: string }
    setSaving(false)
    if (!res.ok || !json.ok) { setError(json.error ?? `エラー (${res.status})`); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
          🎰 ガラポン管理
        </h1>
        <div style={{ fontSize: 13, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>
          ガラポン専用QRコードの表示と、1回あたりの必要スタンプ数を設定します。
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', marginBottom: 16, fontSize: 12, color: '#dc2626', fontFamily: "'Kiwi Maru',serif" }}>
          ⚠ {error}
        </div>
      )}

      <div style={{
        background: '#fff', borderRadius: 16, padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
        marginBottom: 20,
      }}>
        <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>
          📷 ガラポン専用QRコード
        </div>

        {!qrUrl || !QrComp ? (
          <PageLoader />
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12, fontFamily: "'Kiwi Maru',serif" }}>
              来場者にこの QR を読み取ってもらいます（60秒ごとに更新）
            </div>
            <div style={{ display: 'inline-block', padding: 16, background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.1)' }}>
              <QrComp value={qrUrl} size={240} />
            </div>
          </div>
        )}
      </div>

      <div style={{
        background: '#fff', borderRadius: 16, padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
      }}>
        <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
          🎯 1回に必要なスタンプ数
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", marginBottom: 16 }}>
          来場者がガラポンを1回回すのに消費するスタンプ数です。
        </div>

        {cost === null ? (
          <PageLoader />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
              <button onClick={() => { setCost(c => Math.max(1, (c ?? 1) - 1)); setSaved(false) }} style={stepBtnStyle}>−</button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <input
                  type="text" inputMode="numeric"
                  value={cost}
                  onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 1) { setCost(n); setSaved(false) } }}
                  onBlur={() => setCost(c => Math.max(1, c ?? 1))}
                  style={{
                    fontFamily: "'Kaisei Decol',serif", fontSize: 32, fontWeight: 700,
                    color: '#1e293b', textAlign: 'center',
                    border: 'none', background: 'transparent', outline: 'none', width: 72,
                  }}
                />
                <span style={{ fontSize: 13, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>個</span>
              </div>
              <button onClick={() => { setCost(c => (c ?? 1) + 1); setSaved(false) }} style={stepBtnStyle}>＋</button>
            </div>

            <button onClick={handleSave} disabled={saving}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                cursor: saving ? 'default' : 'pointer',
                background: saved ? '#10b981' : 'linear-gradient(135deg,#6366f1,#818cf8)',
                color: '#fff', fontSize: 15, fontWeight: 700,
                fontFamily: "'Kaisei Decol',serif",
                boxShadow: '0 4px 16px rgba(99,102,241,0.25)',
                transition: 'all 0.2s',
              }}
            >
              {saving ? '保存中…' : saved ? '✓ 保存しました' : '設定を保存する'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const stepBtnStyle: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 10,
  border: '1px solid #e2e8f0', background: '#fff',
  cursor: 'pointer', fontSize: 18, color: '#64748b',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}
