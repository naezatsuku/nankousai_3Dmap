'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TickerMsg {
  text:   string
  urgent: boolean
}

const FALLBACK: TickerMsg[] = [
  { text: '🎉 南高祭へようこそ！楽しんでいってください', urgent: false },
]

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function Header() {
  const [hh, setHh]       = useState('--')
  const [mm, setMm]       = useState('--')
  const [ss, setSs]       = useState('--')
  const [colon, setColon] = useState(true)
  const [msgs, setMsgs]   = useState<TickerMsg[]>(FALLBACK)
  const [idx, setIdx]     = useState(0)
  const [fade, setFade]   = useState(true)

  const fetchMsgs = useCallback(async () => {
    try {
      const supabase = createClient()
      const result: TickerMsg[] = []

      // ── グローバルアナウンス ──────────────────────────────────
      const { data: annData } = await supabase
        .from('announcements')
        .select('body, is_urgent')
        .eq('is_active', true)
        .order('is_urgent', { ascending: false })
        .order('created_at', { ascending: false })

      for (const a of (annData ?? []) as { body: string; is_urgent: boolean }[]) {
        result.push({ text: a.body, urgent: a.is_urgent })
      }

      // ── 現在時刻・曜日 ──────────────────────────────────────
      const now    = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()
      const dow    = now.getDay()
      const todayDay = dow === 6 ? 'sat' : dow === 0 ? 'sun' : null
      const days     = todayDay ? [todayDay] : ['sat', 'sun']

      // ── 催し（special_schedules） ────────────────────────────
      const { data: specData } = await supabase
        .from('special_schedules')
        .select('day, start_at, end_at, location, description, exhibit:exhibits(name)')
        .in('day', days)

      for (const s of (specData ?? []) as any[]) {
        const start = timeToMin(s.start_at)
        const end   = timeToMin(s.end_at)
        const name  = (s.exhibit as { name: string } | null)?.name ?? ''
        const desc  = s.description ? `「${s.description}」` : ''
        const loc   = s.location    ? `（${s.location}）`    : ''
        if (start <= nowMin && nowMin <= end) {
          result.push({ text: `🎪 ${name}${desc} 開催中！${loc}`, urgent: false })
        } else if (nowMin < start && start <= nowMin + 30) {
          result.push({ text: `⏰ ${name}${desc} まもなく開始${loc}`, urgent: false })
        }
      }

      // ── 軽音（band_schedules） ──────────────────────────────
      const { data: bandData } = await supabase
        .from('band_schedules')
        .select('day, start_at, end_at, stage, band:bands(name)')
        .in('day', days)

      for (const b of (bandData ?? []) as any[]) {
        const start = timeToMin(b.start_at)
        const end   = timeToMin(b.end_at)
        const name  = (b.band as { name: string } | null)?.name ?? ''
        const stage = b.stage ? `（${b.stage}）` : ''
        if (start <= nowMin && nowMin <= end) {
          result.push({ text: `🎸 ${name} 演奏中！${stage}`, urgent: false })
        } else if (nowMin < start && start <= nowMin + 30) {
          result.push({ text: `🎸 ${name} まもなく開始${stage}`, urgent: false })
        }
      }

      setMsgs(result.length > 0 ? result : FALLBACK)
      setIdx(0)
    } catch {
      // keep current messages on error
    }
  }, [])

  // 時計
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setHh(String(d.getHours()).padStart(2, '0'))
      setMm(String(d.getMinutes()).padStart(2, '0'))
      setSs(String(d.getSeconds()).padStart(2, '0'))
      setColon(c => !c)
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [])

  // 初回取得 + 60秒ポーリング
  useEffect(() => {
    fetchMsgs()
    const id = setInterval(fetchMsgs, 60_000)
    return () => clearInterval(id)
  }, [fetchMsgs])

  // announcements リアルタイム更新
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('ann-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetchMsgs)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchMsgs])

  // メッセージローテーション
  useEffect(() => {
    if (msgs.length <= 1) return
    const id = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % msgs.length)
        setFade(true)
      }, 350)
    }, 4000)
    return () => clearInterval(id)
  }, [msgs])

  const cur = msgs[idx % Math.max(msgs.length, 1)] ?? FALLBACK[0]

  return (
    <>
      <style>{`
        @keyframes headerShimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes tickerBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.25; }
        }
      `}</style>

      <header
        style={{
          background:           'rgba(255,255,255,0.97)',
          backdropFilter:       'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom:         '1px solid rgba(255,140,0,0.15)',
          padding:              '10px 16px',
          flexShrink:           0,
          zIndex:               50,
          position:             'relative',
        }}
      >
        {/* グラデーションシマーライン */}
        <div style={{
          position:       'absolute',
          top: 0, left: 0, right: 0,
          height:         3,
          background:     'linear-gradient(90deg, #FF6B00, #FFB347, #FF8C00, #FFD166, #FF6B00)',
          backgroundSize: '200% 100%',
          animation:      'headerShimmer 3s linear infinite',
        }} />

        {/* 1行目: タイトル + 時刻ピル */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{
              fontFamily:           "'Kaisei Decol', serif",
              fontSize:             22,
              fontWeight:           700,
              background:           'linear-gradient(90deg, #E85A00, #FF8C00)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
              backgroundClip:       'text',
              letterSpacing:        '0.04em',
              lineHeight:           1,
            }}>
              南高祭
            </span>
            <span style={{ fontFamily: "'Kiwi Maru', serif", fontSize: 10, color: '#ccc', letterSpacing: '0.1em' }}>
              2025
            </span>
          </div>

          <div style={{
            display:      'flex',
            alignItems:   'center',
            background:   'linear-gradient(135deg, #fff8f0, #ffe8cc)',
            border:       '1px solid rgba(255,140,0,0.2)',
            borderRadius: 9,
            padding:      '4px 10px',
            gap:          2,
          }}>
            <span style={{
              fontFamily:    "'Kaisei Decol', serif",
              fontSize:      17,
              fontWeight:    700,
              color:         '#E85A00',
              letterSpacing: '0.05em',
            }}>
              {hh}
              <span style={{ opacity: colon ? 1 : 0.15, transition: 'opacity 0.1s' }}>:</span>
              {mm}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#FFB347', marginLeft: 2 }}>
              {ss}
            </span>
          </div>
        </div>

        {/* 2行目: ティッカー */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          7,
          background:   cur.urgent
            ? 'linear-gradient(90deg, #fff0f0, #fff5f5)'
            : 'linear-gradient(90deg, #fff8f0, #fffaf6)',
          borderRadius: 99,
          padding:      '5px 12px 5px 10px',
          border:       cur.urgent
            ? '1px solid rgba(239,68,68,0.2)'
            : '1px solid rgba(255,140,0,0.13)',
          overflow:     'hidden',
          transition:   'background 0.35s, border-color 0.35s',
        }}>
          {/* 点滅ドット */}
          <div style={{
            flexShrink:   0,
            width:        6,
            height:       6,
            borderRadius: '50%',
            background:   cur.urgent ? '#ef4444' : '#FF6B00',
            animation:    'tickerBlink 1.2s ease-in-out infinite',
            transition:   'background 0.35s',
          }} />

          {/* メッセージ */}
          <div style={{
            flex:       1,
            overflow:   'hidden',
            position:   'relative',
            height:     18,
            display:    'flex',
            alignItems: 'center',
          }}>
            {/* 左フェードマスク */}
            <div style={{
              position:   'absolute',
              left: 0, top: 0, bottom: 0,
              width:      12,
              background: cur.urgent
                ? 'linear-gradient(to right, #fff0f0, transparent)'
                : 'linear-gradient(to right, #fff8f0, transparent)',
              zIndex: 1,
            }} />
            <div style={{
              fontSize:    11,
              color:       cur.urgent ? '#b91c1c' : '#b36000',
              fontFamily:  "'Kiwi Maru', serif",
              whiteSpace:  'nowrap',
              opacity:     fade ? 1 : 0,
              transform:   fade ? 'translateX(0)' : 'translateX(8px)',
              transition:  'opacity 0.35s ease, transform 0.35s ease',
              paddingLeft: 4,
            }}>
              {cur.text}
            </div>
          </div>
        </div>
      </header>
    </>
  )
}