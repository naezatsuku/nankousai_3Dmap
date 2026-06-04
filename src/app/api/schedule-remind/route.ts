import { NextResponse }              from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { parseSA, getAccessToken, sendFCM } from '@/lib/fcm'

function pad(n: number) { return String(n).padStart(2, '0') }
function toHHMM(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
function toHHMMSS(d: Date) { return `${toHHMM(d)}:00` }
function addMin(d: Date, min: number) { return new Date(d.getTime() + min * 60 * 1000) }

export async function POST(req: Request) {
  try {
    const body = await req.json() as { testTime?: string; bypassDayCheck?: boolean; dayOverride?: 'sat' | 'sun' }

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
    const day = body.dayOverride ?? today ?? 'sat'

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

    interface RawSpecial {
      exhibit_id: string
      start_at:   string
      location:   string | null
      exhibit:    { name: string; thumbnail_url: string | null } | null
    }
    interface RawBandSchedule {
      start_at: string
      stage:    string | null
      band:     { id: string; name: string; exhibit_id: string; thumbnail_url: string | null }
    }
    interface Sub { fcm_token: string }

    const results: { phase: string; name: string; start: string; sent: number }[] = []

    // ── special_schedules ──────────────────────────────────────
    for (const [phase, from, to] of [['10min', w10from, w10to], ['start', w0from, w0to]] as const) {
      const { data: schedules } = await supabase
        .from('special_schedules')
        .select('exhibit_id, start_at, location, exhibit:exhibits(name, thumbnail_url)')
        .eq('day', day)
        .gte('start_at', from)
        .lte('start_at', to)

      for (const s of (schedules ?? []) as unknown as RawSpecial[]) {
        const { data: subs } = await supabase
          .from('exhibit_push_subs').select('fcm_token').eq('exhibit_id', s.exhibit_id)

        const name  = s.exhibit?.name ?? '催し'
        const icon  = s.exhibit?.thumbnail_url ?? undefined
        const start = s.start_at.slice(0, 5)
        const loc   = s.location ? `（${s.location}）` : ''
        const title = phase === '10min' ? `⏰ 10分後に開始 — ${name}` : `🔔 始まりました — ${name}`
        const msg   = phase === '10min' ? `${start}〜 ${loc}に来てね！`.trim() : `${loc}でスタート！`.trim()

        let sent = 0
        for (const sub of (subs ?? []) as Sub[]) {
          if (await sendFCM(accessToken, sa.project_id, sub.fcm_token, title, msg, icon) === 200) sent++
        }
        results.push({ phase, name, start, sent })
      }
    }

    // ── band_schedules ─────────────────────────────────────────
    for (const [phase, from, to] of [['10min', w10from, w10to], ['start', w0from, w0to]] as const) {
      const { data: bands } = await supabase
        .from('band_schedules')
        .select('start_at, stage, band:bands!inner(id, name, exhibit_id, thumbnail_url)')
        .eq('day', day)
        .gte('start_at', from)
        .lte('start_at', to)
      // band.id + start_at でメモリ内重複除去（DBに同一行が複数あっても1通のみ）
      const seen = new Set<string>()
      for (const b of (bands ?? []) as unknown as RawBandSchedule[]) {
        const { band } = b
        const key = `${band.id}:${b.start_at}`
        if (seen.has(key)) continue
        seen.add(key)

        const { data: subs } = await supabase
          .from('exhibit_push_subs').select('fcm_token').eq('exhibit_id', band.exhibit_id)

        const icon  = band.thumbnail_url ?? undefined
        const start = b.start_at.slice(0, 5)
        const stage = b.stage ? `（${b.stage}）` : ''
        const title = phase === '10min' ? `🎸 10分後に開始 — ${band.name}` : `🎸 始まりました — ${band.name}`
        const msg   = phase === '10min' ? `${start}〜 ${stage}に来てね！`.trim() : `${stage}でスタート！`.trim()

        let sent = 0
        for (const sub of (subs ?? []) as Sub[]) {
          if (await sendFCM(accessToken, sa.project_id, sub.fcm_token, title, msg, icon) === 200) sent++
        }
        results.push({ phase, name: band.name, start, sent })
      }
    }

    // ── shift_assignments 通知 ─────────────────────────────────
    const shiftResults: { user_id: string; slotStart: string; exhibitName: string; notifyMin: number; sent: number }[] = []
    const shiftDiag: { step: string; detail: string }[] = []

    const { data: prefs, error: prefsErr } = await supabase
      .from('shift_notification_prefs')
      .select('user_id, notify_minutes')

    if (prefsErr) {
      shiftDiag.push({ step: 'shift_notification_prefs', detail: `ERROR: ${prefsErr.message}` })
    } else {
      shiftDiag.push({ step: 'shift_notification_prefs', detail: `${(prefs ?? []).length} 件` })
    }

    for (const pref of (prefs ?? []) as { user_id: string; notify_minutes: number }[]) {
      const winFrom = toHHMMSS(addMin(now, pref.notify_minutes - 2))
      const winTo   = toHHMMSS(addMin(now, pref.notify_minutes + 2))

      const { data: assignments, error: assignErr } = await supabase
        .from('shift_assignments').select('slot_id').eq('user_id', pref.user_id)
      if (assignErr) { shiftDiag.push({ step: 'shift_assignments', detail: `ERROR: ${assignErr.message}` }); continue }

      const slotIds = ((assignments ?? []) as { slot_id: string }[]).map(a => a.slot_id)
      shiftDiag.push({ step: `user ${pref.user_id.slice(0,8)}… assignments`, detail: `${slotIds.length} コマ, window=${winFrom}〜${winTo}, day=${day}` })
      if (!slotIds.length) continue

      const { data: rawSlots, error: slotErr } = await supabase
        .from('shift_slots').select('start_at, exhibit_id')
        .in('id', slotIds).eq('date', day)
        .gte('start_at', winFrom).lte('start_at', winTo)
      if (slotErr) { shiftDiag.push({ step: 'shift_slots', detail: `ERROR: ${slotErr.message}` }); continue }
      shiftDiag.push({ step: 'shift_slots in window', detail: `${(rawSlots ?? []).length} 件` })
      if (!rawSlots?.length) continue

      const eids = [...new Set((rawSlots as any[]).map(s => s.exhibit_id))]
      const { data: exhibitRows } = await supabase.from('exhibits').select('id, name').in('id', eids)
      const nameMap = new Map((exhibitRows ?? []).map((e: any) => [e.id, e.name as string]))

      const { data: subs, error: subsErr } = await supabase
        .from('push_subscriptions').select('fcm_token').eq('user_id', pref.user_id)
      if (subsErr) { shiftDiag.push({ step: 'push_subscriptions', detail: `ERROR: ${subsErr.message}` }); continue }
      shiftDiag.push({ step: 'push_subscriptions', detail: `${(subs ?? []).length} トークン` })
      if (!subs?.length) continue

      for (const slot of rawSlots as any[]) {
        const exhibitName = nameMap.get(slot.exhibit_id) ?? 'クラス'
        const start = (slot.start_at as string).slice(0, 5)
        const title = `📅 ${pref.notify_minutes}分後: シフト当番`
        const body  = `${start}〜 ${exhibitName} のシフトが始まります`
        let sent = 0
        for (const sub of subs as { fcm_token: string }[]) {
          const status = await sendFCM(accessToken, sa.project_id, sub.fcm_token, title, body)
          shiftDiag.push({ step: 'FCM送信', detail: `status=${status}` })
          if (status === 200) sent++
        }
        shiftResults.push({ user_id: pref.user_id, slotStart: start, exhibitName, notifyMin: pref.notify_minutes, sent })
      }
    }

    const allSent = results.reduce((s, r) => s + r.sent, 0)
                  + shiftResults.reduce((s, r) => s + r.sent, 0)

    return NextResponse.json({
      referenceTime: toHHMM(now),
      day,
      windows: { '10min': `${w10from}〜${w10to}`, start: `${w0from}〜${w0to}` },
      results,
      shiftResults,
      shiftDiag,
      totalSent: allSent,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
