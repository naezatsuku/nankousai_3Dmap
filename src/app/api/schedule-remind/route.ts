import { NextResponse }              from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { parseSA, getAccessToken, sendFCM } from '@/lib/fcm'

function pad(n: number) { return String(n).padStart(2, '0') }
function toHHMM(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
function toHHMMSS(d: Date) { return `${toHHMM(d)}:00` }
function addMin(d: Date, min: number) { return new Date(d.getTime() + min * 60 * 1000) }

export async function POST(req: Request) {
  try {
    const body = await req.json() as { testTime?: string; bypassDayCheck?: boolean }

    let now = new Date()
    if (body.testTime) {
      const [h, m] = body.testTime.split(':').map(Number)
      now = new Date(now)
      now.setHours(h, m, 0, 0)
    }

    const dow   = now.getDay()
    const today = dow === 6 ? 'sat' : dow === 0 ? 'sun' : null

    if (!today && !body.bypassDayCheck) {
      return NextResponse.json({ skipped: 'not a festival day' })
    }
    const day = today ?? 'sat'

    const sa          = parseSA()
    const accessToken = await getAccessToken(sa)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // ── ウィンドウ定義 ──────────────────────────────────────────
    // 10分前: now+8〜now+12（pg_cron 5分間隔でも確実にキャッチ）
    const w10from = toHHMMSS(addMin(now,  8))
    const w10to   = toHHMMSS(addMin(now, 12))
    // 開始時: now-2〜now+3
    const w0from  = toHHMMSS(addMin(now, -2))
    const w0to    = toHHMMSS(addMin(now,  3))

    const results: { phase: string; name: string; start: string; sent: number }[] = []

    // ── special_schedules ──────────────────────────────────────
    for (const [phase, from, to] of [['10min', w10from, w10to], ['start', w0from, w0to]] as const) {
      const { data: schedules } = await supabase
        .from('special_schedules')
        .select('exhibit_id, start_at, location, exhibit:exhibits(name)')
        .eq('day', day)
        .gte('start_at', from)
        .lte('start_at', to)

      for (const s of (schedules ?? []) as any[]) {
        const { data: subs } = await supabase
          .from('exhibit_push_subs').select('fcm_token').eq('exhibit_id', s.exhibit_id)

        const name  = s.exhibit?.name ?? '催し'
        const start = (s.start_at as string).slice(0, 5)
        const loc   = s.location ? `（${s.location}）` : ''
        const title = phase === '10min'
          ? `⏰ 10分後に開始 — ${name}`
          : `🔔 始まりました — ${name}`
        const msg   = phase === '10min'
          ? `${start}〜 ${loc}に来てね！`.trim()
          : `${loc}でスタート！`.trim()

        let sent = 0
        for (const sub of (subs ?? []) as any[]) {
          if (await sendFCM(accessToken, sa.project_id, sub.fcm_token, title, msg) === 200) sent++
        }
        results.push({ phase, name, start, sent })
      }
    }

    // ── band_schedules ─────────────────────────────────────────
    for (const [phase, from, to] of [['10min', w10from, w10to], ['start', w0from, w0to]] as const) {
      const { data: bands } = await supabase
        .from('band_schedules')
        .select('start_at, stage, band:bands!inner(name, exhibit_id)')
        .eq('day', day)
        .gte('start_at', from)
        .lte('start_at', to)

      for (const b of (bands ?? []) as any[]) {
        const band = b.band as { name: string; exhibit_id: string }
        const { data: subs } = await supabase
          .from('exhibit_push_subs').select('fcm_token').eq('exhibit_id', band.exhibit_id)

        const start = (b.start_at as string).slice(0, 5)
        const stage = b.stage ? `（${b.stage}）` : ''
        const title = phase === '10min'
          ? `🎸 10分後に開始 — ${band.name}`
          : `🎸 始まりました — ${band.name}`
        const msg   = phase === '10min'
          ? `${start}〜 ${stage}に来てね！`.trim()
          : `${stage}でスタート！`.trim()

        let sent = 0
        for (const sub of (subs ?? []) as any[]) {
          if (await sendFCM(accessToken, sa.project_id, sub.fcm_token, title, msg) === 200) sent++
        }
        results.push({ phase, name: band.name, start, sent })
      }
    }

    return NextResponse.json({
      referenceTime: toHHMM(now),
      windows: { '10min': `${w10from}〜${w10to}`, start: `${w0from}〜${w0to}` },
      results,
      totalSent: results.reduce((s, r) => s + r.sent, 0),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
