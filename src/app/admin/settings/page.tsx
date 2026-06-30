'use client'

import PageLoader from '@/components/ui/PageLoader'
import React, { useState, useEffect } from 'react'
import { SLOT_CSS, STAGE_LABELS, buildThresholds } from '@/lib/waitColorUtil'

export default function SettingsPage() {
  const [isPublic,         setIsPublic]         = useState<boolean | null>(null)
  const [mapEnabled,       setMapEnabled]       = useState<boolean | null>(null)
  const [likeCountVisible, setLikeCountVisible] = useState<boolean | null>(null)
  const [commentMode,      setCommentMode]      = useState<'all_on' | 'public_off' | 'all_off' | null>(null)
  const [festivalSat,      setFestivalSat]      = useState<string>('2025-09-13')
  const [festivalSun,      setFestivalSun]      = useState<string>('2025-09-14')
  const [triggerMin,       setTriggerMin]       = useState<number>(5)
  const [waitStageCount,   setWaitStageCount]   = useState<number>(4)
  const [waitTh1,          setWaitTh1]          = useState<number>(10)
  const [waitTh2,          setWaitTh2]          = useState<number>(25)
  const [waitTh3,          setWaitTh3]          = useState<number>(40)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then((d: {
        is_public: boolean
        map_enabled: boolean; like_count_visible: boolean
        comment_mode?: 'all_on' | 'public_off' | 'all_off'
        festival_sat: string; festival_sun: string
        announcement_trigger_minutes?: number
        wait_stage_count?: number
        wait_threshold_low?: number; wait_threshold_high?: number; wait_threshold_3?: number
      }) => {
        setIsPublic(d.is_public ?? true)
        setMapEnabled(d.map_enabled)
        setLikeCountVisible(d.like_count_visible)
        setCommentMode(d.comment_mode ?? 'all_on')
        setFestivalSat(d.festival_sat ?? '2025-09-13')
        setFestivalSun(d.festival_sun ?? '2025-09-14')
        setTriggerMin(d.announcement_trigger_minutes ?? 5)
        setWaitStageCount(d.wait_stage_count    ?? 4)
        setWaitTh1(d.wait_threshold_low  ?? 10)
        setWaitTh2(d.wait_threshold_high ?? 25)
        setWaitTh3(d.wait_threshold_3    ?? 40)
      })
  }, [])

  const handleSave = async () => {
    if (isPublic === null || mapEnabled === null || likeCountVisible === null || commentMode === null || saving) return
    setSaving(true)
    setSaved(false)
    setError('')
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_public: isPublic,
        map_enabled: mapEnabled, like_count_visible: likeCountVisible,
        comment_mode: commentMode,
        festival_sat: festivalSat, festival_sun: festivalSun,
        announcement_trigger_minutes: triggerMin,
        wait_stage_count: waitStageCount,
        wait_threshold_low: waitTh1, wait_threshold_high: waitTh2, wait_threshold_3: waitTh3,
      }),
    })
    const json = await res.json() as { ok?: boolean; error?: string }
    setSaving(false)
    if (!res.ok || !json.ok) { setError(json.error ?? `エラー (${res.status})`); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // 段階数に応じたしきい値カード設定
  const thresholds = [waitTh1, waitTh2, waitTh3]
  const setters   = [setWaitTh1, setWaitTh2, setWaitTh3]
  const activeCount = waitStageCount - 2  // 表示するスライダー本数
  const labels = STAGE_LABELS[waitStageCount] ?? STAGE_LABELS[4]
  const colors = ['#4ade80', ...(SLOT_CSS[waitStageCount] ?? SLOT_CSS[4])]

  // preview: 各ステージの範囲テキスト
  const activeThresholds = buildThresholds(waitStageCount, waitTh1, waitTh2, waitTh3)
  const previewStages = labels.map((lbl, i) => {
    const prevTh = activeThresholds[i - 2] ?? 0
    const thisTh = activeThresholds[i - 1]
    const range = i === 0
      ? '0分'
      : thisTh !== undefined
        ? `${prevTh + 1}〜${thisTh}分`
        : `${prevTh + 1}分〜`
    return { label: lbl, color: colors[i], range }
  })

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
        <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>
          🗺 マップ公開設定
        </div>

        {isPublic === null || mapEnabled === null || likeCountVisible === null || commentMode === null ? (
          <PageLoader />
        ) : (
          <>
            {/* ── サイト公開状態 ── */}
            <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>
              🌐 サイト公開設定
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
              {[
                { value: true,  label: '公開する',    desc: '一般来場者がサイト全体を閲覧できます',       color: '#10b981' },
                { value: false, label: '非公開にする', desc: '来場者は「準備中」画面のみ表示されます。admin・editor・teacher は引き続き閲覧可能です', color: '#ef4444' },
              ].map(opt => {
                const isSel = isPublic === opt.value
                return (
                  <button key={String(opt.value)} onClick={() => { setIsPublic(opt.value); setSaved(false) }}
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
                      <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 14, fontWeight: 700, color: isSel ? opt.color : '#1e293b' }}>
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

            {/* ── マップ公開 ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[
                { value: true,  label: '公開する',    desc: '来場者がマップを閲覧できます',             color: '#10b981' },
                { value: false, label: '非公開にする', desc: 'マップページに「非公開」画面が表示されます', color: '#ef4444' },
              ].map(opt => {
                const isSel = mapEnabled === opt.value
                return (
                  <button key={String(opt.value)} onClick={() => { setMapEnabled(opt.value); setSaved(false) }}
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
                      <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 14, fontWeight: 700, color: isSel ? opt.color : '#1e293b' }}>
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

            {/* ── いいね数表示 ── */}
            <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 20, marginTop: 28 }}>
              ❤ いいね数の表示設定
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[
                { value: true,  label: '表示する',    desc: '展示ページでいいね数がハートの隣に表示されます', color: '#10b981' },
                { value: false, label: '非表示にする', desc: 'いいねボタンは残りますが数は表示されません',     color: '#64748b' },
              ].map(opt => {
                const isSel = likeCountVisible === opt.value
                return (
                  <button key={String(opt.value)} onClick={() => { setLikeCountVisible(opt.value); setSaved(false) }}
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
                      <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 14, fontWeight: 700, color: isSel ? opt.color : '#1e293b' }}>
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

            {/* ── コメント機能設定 ── */}
            <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 20, marginTop: 28 }}>
              💬 コメント機能設定
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[
                { value: 'all_on' as const,     label: '全てON',       desc: 'スタンプラリー後のコメント機能・タイムラインの「みんなの声」とも表示します', color: '#10b981' },
                { value: 'public_off' as const,  label: 'コメント公開OFF', desc: 'スタンプラリー後のコメント機能はそのまま。タイムラインの「みんなの声」は非表示にします', color: '#f59e0b' },
                { value: 'all_off' as const,     label: '全てOFF',      desc: 'スタンプラリー後のコメント機能・タイムラインの「みんなの声」とも非表示にします', color: '#ef4444' },
              ].map(opt => {
                const isSel = commentMode === opt.value
                return (
                  <button key={opt.value} onClick={() => { setCommentMode(opt.value); setSaved(false) }}
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
                      <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 14, fontWeight: 700, color: isSel ? opt.color : '#1e293b' }}>
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

            {/* ── 文化祭日程 ── */}
            <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 16, marginTop: 28 }}>
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
                  <input type="date" value={value} onChange={e => onChange(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      border: '1.5px solid #e2e8f0', fontSize: 13, color: '#1e293b',
                      fontFamily: "'Kiwi Maru',serif", boxSizing: 'border-box', background: '#f8fafc',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* ── 特殊演出トリガー ── */}
            <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 12, marginTop: 28 }}>
              🎬 特殊演出トリガー
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", marginBottom: 14 }}>
              公演開始の何分前に演出を表示するか設定します。
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
              <button onClick={() => setTriggerMin(m => Math.max(1, m - 1))} style={stepBtnStyle}>−</button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <input
                  type="text" inputMode="numeric"
                  value={triggerMin}
                  onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 1) setTriggerMin(n) }}
                  onBlur={() => setTriggerMin(m => Math.max(1, Math.min(30, m)))}
                  style={{
                    fontFamily: "'Kaisei Decol',serif", fontSize: 32, fontWeight: 700,
                    color: '#1e293b', textAlign: 'center',
                    border: 'none', background: 'transparent', outline: 'none', width: 72,
                  }}
                />
                <span style={{ fontSize: 13, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>分前</span>
              </div>
              <button onClick={() => setTriggerMin(m => Math.min(30, m + 1))} style={stepBtnStyle}>＋</button>
            </div>

            {/* ── 混雑基準（待ち時間） ── */}
            <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 12, marginTop: 28 }}>
              🚦 混雑基準（待ち時間）
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", marginBottom: 16 }}>
              マップのマーカー色と混雑シートの色分け基準を設定します。
            </div>

            {/* 段階数セレクター */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', fontFamily: "'Kiwi Maru',serif", marginBottom: 8 }}>
                段階数
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[3, 4, 5].map(n => {
                  const isSel = waitStageCount === n
                  return (
                    <button key={n} onClick={() => { setWaitStageCount(n); setSaved(false) }}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                        cursor: 'pointer', fontFamily: "'Kaisei Decol',serif",
                        fontSize: 14, fontWeight: 700,
                        background: isSel ? '#6366f1' : '#f1f5f9',
                        color: isSel ? '#fff' : '#64748b',
                        boxShadow: isSel ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      {n}段階
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 動的しきい値スライダー */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {Array.from({ length: activeCount }, (_, i) => {
                const val     = thresholds[i]
                const prevVal = i > 0 ? thresholds[i - 1] : 0
                const nextVal = i < activeCount - 1 ? thresholds[i + 1] : 120
                const stageName = labels[i + 1]  // threshold i = upper limit of stage i+1
                const color = colors[i + 1]

                const decrease = () => setters[i](v => Math.max(prevVal + 1, v - 5))
                const increase = () => setters[i](v => Math.min(nextVal - 1, v + 5))

                return (
                  <div key={i} style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                          「{stageName}」の上限
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", marginTop: 2 }}>
                          この分数以下は {stageName} で表示
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button onClick={decrease} style={stepBtnStyle}>−</button>
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <input
                          type="text" inputMode="numeric"
                          value={val}
                          onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 1) setters[i](n) }}
                          onBlur={() => setters[i](v => Math.max(prevVal + 1, Math.min(nextVal - 1, v)))}
                          style={{
                            fontFamily: "'Kaisei Decol',serif", fontSize: 28, fontWeight: 700,
                            color, textAlign: 'center',
                            border: 'none', background: 'transparent', outline: 'none', width: 72,
                          }}
                        />
                        <span style={{ fontSize: 13, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>分以下</span>
                      </div>
                      <button onClick={increase} style={stepBtnStyle}>＋</button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* カラープレビュー */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
              {previewStages.map(({ label, color, range }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: 99, padding: '4px 10px',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontFamily: "'Kiwi Maru',serif", color: '#475569', fontWeight: 700 }}>{label}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>{range}</span>
                </div>
              ))}
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', marginBottom: 12, fontSize: 12, color: '#dc2626', fontFamily: "'Kiwi Maru',serif" }}>
                ⚠ {error}
              </div>
            )}

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
