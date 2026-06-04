'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TestResult {
  referenceTime: string
  day?:          string
  windows:       { '10min': string; start: string }
  results:       { phase: string; name: string; start: string; sent: number }[]
  shiftResults:  { user_id: string; slotStart: string; exhibitName: string; notifyMin: number; sent: number }[]
  shiftDiag?:    { step: string; detail: string }[]
  totalSent:     number
  skipped?:      string
  error?:        string
}

export default function NotifyTestPage() {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/admin/login'); return }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if ((p as { role: string } | null)?.role !== 'admin') router.push('/admin')
    })
  }, [router])

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const defaultTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`

  const [time, setTime]       = useState(defaultTime)
  const [bypass, setBypass]   = useState(true)
  const [dayChoice, setDayChoice] = useState<'sat'|'sun'>('sat')
  const [running, setRunning] = useState(false)
  const [result, setResult]   = useState<TestResult | null>(null)
  const [showDiag, setShowDiag] = useState(false)

  const run = async () => {
    setRunning(true)
    setResult(null)
    try {
      const res  = await fetch('/api/schedule-remind', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ testTime: time, bypassDayCheck: bypass, dayOverride: dayChoice }),
      })
      setResult(await res.json())
    } catch (e) {
      setResult({ referenceTime: time, windows: { '10min': '', start: '' }, results: [], shiftResults: [], totalSent: 0, error: String(e) })
    }
    setRunning(false)
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
        通知テスト
      </h1>
      <p style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:24 }}>
        任意の時刻を基準にスケジュール通知をテスト送信します
      </p>

      {/* 設定 */}
      <div style={{ background:'#fff', borderRadius:16, padding:20, marginBottom:20, border:'1px solid #e2e8f0' }}>
        <div style={{ display:'flex', gap:16, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>
              基準時刻
            </div>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              style={{
                padding:'8px 12px', borderRadius:10, border:'1px solid #e2e8f0',
                fontSize:14, fontFamily:'monospace', outline:'none',
              }}
            />
          </div>

          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', paddingBottom:2 }}>
            <input
              type="checkbox"
              checked={bypass}
              onChange={e => setBypass(e.target.checked)}
              style={{ width:16, height:16, accentColor:'#FF6B00', cursor:'pointer' }}
            />
            <span style={{ fontSize:13, fontFamily:"'Kiwi Maru',serif", color:'#475569' }}>
              祭当日チェックをスキップ
            </span>
          </label>

          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>
              日付（シフト検索用）
            </div>
            <select
              value={dayChoice}
              onChange={e => setDayChoice(e.target.value as 'sat'|'sun')}
              style={{ padding:'8px 12px', borderRadius:10, border:'1px solid #e2e8f0', fontSize:13, fontFamily:"'Kiwi Maru',serif" }}
            >
              <option value="sat">土曜日（9/13）</option>
              <option value="sun">日曜日（9/14）</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop:12, padding:'10px 14px', borderRadius:10, background:'#f8fafc', fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
          <div style={{ fontWeight:700, color:'#64748b', marginBottom:4 }}>催し・軽音（固定ウィンドウ）</div>
          <strong style={{ color:'#475569' }}>10分前:</strong> {time} の 8〜12分後に開始予定の催しに通知
          <br />
          <strong style={{ color:'#475569' }}>開始時:</strong> {time} の -2〜+3分に開始予定の催しに通知
          <div style={{ fontWeight:700, color:'#6366f1', margin:'8px 0 4px' }}>シフト通知（個人設定による）</div>
          基準時刻 = <strong style={{ color:'#1e293b' }}>シフト開始時刻 − 自分の通知設定分数</strong> に設定してください
          <br />
          例: 10:00 のシフトで 15分前設定 → 基準時刻を <strong style={{ color:'#1e293b' }}>09:45</strong> にする
          <br />
          <span style={{ color:'#94a3b8' }}>診断ログで実際のウィンドウと notify_minutes を確認できます</span>
        </div>
      </div>

      <button
        onClick={run}
        disabled={running}
        style={{
          display:'inline-flex', alignItems:'center', gap:8,
          padding:'12px 28px', borderRadius:12, border:'none', cursor: running ? 'default' : 'pointer',
          background: running ? '#e2e8f0' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
          color: running ? '#aaa' : '#fff', fontSize:14, fontWeight:700,
          fontFamily:"'Kiwi Maru',serif",
          boxShadow: running ? 'none' : '0 4px 14px rgba(255,107,0,0.3)',
          marginBottom:24,
        }}
      >
        {running ? '送信中…' : '▶ テスト実行'}
      </button>

      {/* 結果 */}
      {result && (
        <div style={{ background:'#fff', borderRadius:16, padding:20, border:'1px solid #e2e8f0' }}>
          {result.error ? (
            <div style={{ color:'#ef4444', fontSize:13, fontFamily:'monospace' }}>{result.error}</div>
          ) : result.skipped ? (
            <div style={{ color:'#94a3b8', fontSize:13, fontFamily:"'Kiwi Maru',serif" }}>スキップ: {result.skipped}</div>
          ) : (
            <>
              <div style={{ display:'flex', gap:16, marginBottom:16, flexWrap:'wrap' }}>
                <div style={{ fontSize:12, color:'#64748b', fontFamily:"'Kiwi Maru',serif" }}>
                  基準時刻: <strong style={{ color:'#1e293b' }}>{result.referenceTime}</strong>
                </div>
                <div style={{ fontSize:12, color:'#64748b', fontFamily:"'Kiwi Maru',serif" }}>
                  合計送信: <strong style={{ color: result.totalSent > 0 ? '#22c55e' : '#94a3b8' }}>{result.totalSent} 件</strong>
                </div>
              </div>

              <div style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace', marginBottom:12 }}>
                10分前: {result.windows['10min']} &nbsp;|&nbsp; 開始: {result.windows.start}
              </div>

              {/* 催し・軽音 */}
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', fontFamily:"'Kiwi Maru',serif", marginBottom:6 }}>
                催し・軽音
              </div>
              {result.results.length === 0 ? (
                <div style={{ padding:'12px 0', color:'#cbd5e1', fontSize:13, fontFamily:"'Kiwi Maru',serif" }}>
                  対象の催しがありませんでした
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                  {result.results.map((r, i) => (
                    <div key={i} style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'10px 14px', borderRadius:10, background:'#f8fafc',
                      border: r.sent > 0 ? '1px solid #86efac' : '1px solid #f1f5f9',
                    }}>
                      <div style={{
                        fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
                        background: r.phase === '10min' ? '#FFF0E0' : '#EFF6FF',
                        color:      r.phase === '10min' ? '#FF8C00' : '#3B82F6',
                        fontFamily:"'Kiwi Maru',serif", flexShrink:0,
                      }}>
                        {r.phase === '10min' ? '10分前' : '開始時'}
                      </div>
                      <div style={{ flex:1, fontSize:13, fontWeight:700, color:'#1e293b', fontFamily:"'Kaisei Decol',serif" }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace', flexShrink:0 }}>
                        {r.start}
                      </div>
                      <div style={{ fontSize:11, fontWeight:700, flexShrink:0, color: r.sent > 0 ? '#22c55e' : '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                        {r.sent > 0 ? `✓ ${r.sent}件` : '購読者なし'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 診断ログ */}
              {(result.shiftDiag ?? []).length > 0 && (
                <div style={{ marginTop:16 }}>
                  <button onClick={() => setShowDiag(v => !v)} style={{
                    fontSize:11, color:'#6366f1', background:'none', border:'none',
                    cursor:'pointer', fontFamily:"'Kiwi Maru',serif", fontWeight:700, padding:0, marginBottom:6,
                  }}>
                    {showDiag ? '▲ 診断ログを隠す' : '▼ 診断ログを表示'}
                  </button>
                  {showDiag && (
                    <div style={{ background:'#f8fafc', borderRadius:10, padding:'10px 14px', fontSize:11, fontFamily:'monospace', display:'flex', flexDirection:'column', gap:3 }}>
                      {(result.shiftDiag ?? []).map((d, i) => (
                        <div key={i} style={{ color: d.detail.startsWith('ERROR') ? '#ef4444' : '#475569' }}>
                          <span style={{ color:'#94a3b8' }}>[{d.step}]</span> {d.detail}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* シフト通知 */}
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', fontFamily:"'Kiwi Maru',serif", marginBottom:6, marginTop:8 }}>
                シフト通知
              </div>
              {(result.shiftResults ?? []).length === 0 ? (
                <div style={{ padding:'12px 0', color:'#cbd5e1', fontSize:13, fontFamily:"'Kiwi Maru',serif" }}>
                  対象のシフトがありませんでした（通知設定済みユーザーのシフトが基準時刻±2分にない）
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {(result.shiftResults ?? []).map((r, i) => (
                    <div key={i} style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'10px 14px', borderRadius:10, background:'#f8fafc',
                      border: r.sent > 0 ? '1px solid #86efac' : '1px solid #f1f5f9',
                    }}>
                      <div style={{
                        fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
                        background:'#EEF2FF', color:'#6366f1',
                        fontFamily:"'Kiwi Maru',serif", flexShrink:0,
                      }}>
                        {r.notifyMin}分前
                      </div>
                      <div style={{ flex:1, fontSize:13, fontWeight:700, color:'#1e293b', fontFamily:"'Kaisei Decol',serif" }}>
                        {r.exhibitName}
                      </div>
                      <div style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace', flexShrink:0 }}>
                        {r.slotStart}
                      </div>
                      <div style={{ fontSize:11, fontWeight:700, flexShrink:0, color: r.sent > 0 ? '#22c55e' : '#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                        {r.sent > 0 ? `✓ ${r.sent}件` : 'トークンなし'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}