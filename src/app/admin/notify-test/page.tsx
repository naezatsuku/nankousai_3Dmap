'use client'

import { useState } from 'react'

interface TestResult {
  referenceTime: string
  windows:       { '10min': string; start: string }
  results:       { phase: string; name: string; start: string; sent: number }[]
  totalSent:     number
  skipped?:      string
  error?:        string
}

export default function NotifyTestPage() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const defaultTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`

  const [time, setTime]       = useState(defaultTime)
  const [bypass, setBypass]   = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult]   = useState<TestResult | null>(null)

  const run = async () => {
    setRunning(true)
    setResult(null)
    try {
      const res  = await fetch('/api/schedule-remind', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ testTime: time, bypassDayCheck: bypass }),
      })
      setResult(await res.json())
    } catch (e) {
      setResult({ referenceTime: time, windows: { '10min': '', start: '' }, results: [], totalSent: 0, error: String(e) })
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
        </div>

        <div style={{ marginTop:12, padding:'10px 14px', borderRadius:10, background:'#f8fafc', fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
          <strong style={{ color:'#475569' }}>10分前ウィンドウ:</strong> {time} の 8〜12分後に開始予定の催しに通知
          <br />
          <strong style={{ color:'#475569' }}>開始ウィンドウ:</strong> {time} の -2〜+3分に開始予定の催しに通知
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

              {result.results.length === 0 ? (
                <div style={{ padding:'20px 0', textAlign:'center', color:'#cbd5e1', fontSize:13, fontFamily:"'Kiwi Maru',serif" }}>
                  対象の催しがありませんでした
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
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
                      <div style={{
                        fontSize:11, fontWeight:700, flexShrink:0,
                        color: r.sent > 0 ? '#22c55e' : '#94a3b8',
                        fontFamily:"'Kiwi Maru',serif",
                      }}>
                        {r.sent > 0 ? `✓ ${r.sent}件` : '購読者なし'}
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