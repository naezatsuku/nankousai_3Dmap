'use client'

import PageLoader from '@/components/ui/PageLoader'

import React, { useState, useEffect } from 'react'

export default function SettingsPage() {
  const [mapEnabled,       setMapEnabled]       = useState<boolean | null>(null)
  const [likeCountVisible, setLikeCountVisible] = useState<boolean | null>(null)
  const [festivalSat,      setFestivalSat]      = useState<string>('2025-09-13')
  const [festivalSun,      setFestivalSun]      = useState<string>('2025-09-14')
  const [triggerMin,       setTriggerMin]       = useState<number>(5)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then((d: { map_enabled: boolean; like_count_visible: boolean; festival_sat: string; festival_sun: string; announcement_trigger_minutes?: number }) => {
        setMapEnabled(d.map_enabled)
        setLikeCountVisible(d.like_count_visible)
        setFestivalSat(d.festival_sat ?? '2025-09-13')
        setFestivalSun(d.festival_sun ?? '2025-09-14')
        setTriggerMin(d.announcement_trigger_minutes ?? 5)
      })
  }, [])

  const handleSave = async () => {
    if (mapEnabled === null || likeCountVisible === null || saving) return
    setSaving(true)
    setSaved(false)
    setError('')
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ map_enabled: mapEnabled, like_count_visible: likeCountVisible, festival_sat: festivalSat, festival_sun: festivalSun, announcement_trigger_minutes: triggerMin }),
    })
    const json = await res.json() as { ok?: boolean; error?: string }
    setSaving(false)
    if (!res.ok || !json.ok) { setError(json.error ?? `エラー (${res.status})`); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
          サイト設定
        </h1>
        <div style={{ fontSize: 13, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>
          公開状態などの全体設定を管理します。
        </div>
      </div>

      <div style={{
        background: '#fff', borderRadius: 16, padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
      }}>
        <div style={{
          fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700,
          color: '#1e293b', marginBottom: 20,
        }}>
          🗺 マップ公開設定
        </div>

        {mapEnabled === null || likeCountVisible === null ? (
          <PageLoader />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[
                { value: true,  label: '公開する',    desc: '来場者がマップを閲覧できます',          color: '#10b981' },
                { value: false, label: '非公開にする', desc: 'マップページに「非公開」画面が表示されます', color: '#ef4444' },
              ].map(opt => {
                const isSel = mapEnabled === opt.value
                return (
                  <button
                    key={String(opt.value)}
                    onClick={() => { setMapEnabled(opt.value); setSaved(false) }}
                    style={{
                      width: '100%', padding: '14px 16px', borderRadius: 12,
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: isSel ? `${opt.color}0d` : '#f8fafc',
                      boxShadow: isSel ? `inset 0 0 0 2px ${opt.color}` : 'inset 0 0 0 1.5px #e2e8f0',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${isSel ? opt.color : '#cbd5e1'}`,
                      background: isSel ? opt.color : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSel && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <div>
                      <div style={{
                        fontFamily: "'Kaisei Decol',serif", fontSize: 14, fontWeight: 700,
                        color: isSel ? opt.color : '#1e293b',
                      }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", marginTop: 2 }}>
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

          {/* ── いいね数表示設定 ── */}
          <div style={{
            fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700,
            color: '#1e293b', marginBottom: 20, marginTop: 28,
          }}>
            ❤ いいね数の表示設定
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {[
              { value: true,  label: '表示する',    desc: '展示ページでいいね数がハートの隣に表示されます', color: '#10b981' },
              { value: false, label: '非表示にする', desc: 'いいねボタンは残りますが数は表示されません',     color: '#64748b' },
            ].map(opt => {
              const isSel = likeCountVisible === opt.value
              return (
                <button
                  key={String(opt.value)}
                  onClick={() => { setLikeCountVisible(opt.value); setSaved(false) }}
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: 12,
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: isSel ? `${opt.color}0d` : '#f8fafc',
                    boxShadow: isSel ? `inset 0 0 0 2px ${opt.color}` : 'inset 0 0 0 1.5px #e2e8f0',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${isSel ? opt.color : '#cbd5e1'}`,
                    background: isSel ? opt.color : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSel && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div>
                    <div style={{
                      fontFamily: "'Kaisei Decol',serif", fontSize: 14, fontWeight: 700,
                      color: isSel ? opt.color : '#1e293b',
                    }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", marginTop: 2 }}>
                      {opt.desc}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* ── 文化祭日程設定 ── */}
          <div style={{
            fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700,
            color: '#1e293b', marginBottom: 16, marginTop: 28,
          }}>
            📅 文化祭日程
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", marginBottom: 14 }}>
            スケジュール通知の日付判定に使用されます。
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            {[
              { label: '土曜日', value: festivalSat, onChange: setFestivalSat },
              { label: '日曜日', value: festivalSun, onChange: setFestivalSun },
            ].map(({ label, value, onChange }) => (
              <div key={label} style={{ flex: 1, minWidth: 180 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, fontFamily: "'Kiwi Maru',serif" }}>
                  {label}
                </label>
                <input
                  type="date"
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: '1.5px solid #e2e8f0', fontSize: 13, color: '#1e293b',
                    fontFamily: "'Kiwi Maru',serif", boxSizing: 'border-box',
                    background: '#f8fafc',
                  }}
                />
              </div>
            ))}
          </div>

          {/* ── 特殊演出トリガー設定 ── */}
          <div style={{
            fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700,
            color: '#1e293b', marginBottom: 12, marginTop: 28,
          }}>
            🎬 特殊演出トリガー
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", marginBottom: 14 }}>
            公演開始の何分前に演出を表示するか設定します。
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#f8fafc', borderRadius: 12, padding: '14px 16px', marginBottom: 24,
          }}>
            <button
              onClick={() => setTriggerMin(m => Math.max(1, m - 1))}
              style={stepBtnStyle}
            >−</button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 32, fontWeight: 700, color: '#1e293b' }}>
                {triggerMin}
              </span>
              <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 6, fontFamily: "'Kiwi Maru',serif" }}>分前</span>
            </div>
            <button
              onClick={() => setTriggerMin(m => Math.min(30, m + 1))}
              style={stepBtnStyle}
            >＋</button>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, background: '#fef2f2', marginBottom: 12,
              fontSize: 12, color: '#dc2626', fontFamily: "'Kiwi Maru',serif",
            }}>
              ⚠ {error}
            </div>
          )}

          <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                cursor: saving ? 'default' : 'pointer',
                background: saved
                  ? '#10b981'
                  : 'linear-gradient(135deg,#6366f1,#818cf8)',
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
