import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAccessToken, sendFCM, type ServiceAccount } from '../_shared/fcm.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function pad(n: number) { return String(n).padStart(2, '0') }
function toHHMMSS(d: Date) {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:00`
}
function addMin(d: Date, min: number) { return new Date(d.getTime() + min * 60 * 1000) }

serve(async (_req) => {
  try {
    const now = new Date()
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000) // UTC→JST

    const sa: ServiceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')!)
    const accessToken = await getAccessToken(sa)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // site_settings から文化祭日程を取得
    const { data: siteSettings } = await supabase
      .from('site_settings')
      .select('festival_sat, festival_sun')
      .single()
    const satDate = (siteSettings?.festival_sat as string | null) ?? '2025-09-13'
    const sunDate = (siteSettings?.festival_sun as string | null) ?? '2025-09-14'

    // 日付チェック（文化祭当日のみ）
    const dateStr = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`
    const today =
      dateStr === satDate ? 'sat' :
      dateStr === sunDate ? 'sun' : null

    if (!today) {
      return new Response(JSON.stringify({ skipped: 'not a festival day', dateStr, satDate, sunDate }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // 時刻チェック（JST 8:30〜16:30 のみ）
    const jstMin = jst.getUTCHours() * 60 + jst.getUTCMinutes()
    if (jstMin < 8 * 60 + 30 || jstMin > 16 * 60 + 30) {
      return new Response(JSON.stringify({ skipped: 'outside festival hours' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // 10分前: now+8〜now+12
    const w10from = toHHMMSS(addMin(now,  8))
    const w10to   = toHHMMSS(addMin(now, 12))
    // 開始時: now-2〜now+3
    const w0from  = toHHMMSS(addMin(now, -2))
    const w0to    = toHHMMSS(addMin(now,  3))

    // 2日以上前の dedup レコードを削除（テーブルが肥大化しないよう）
    await supabase.from('sent_notifications')
      .delete().lt('created_at', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())

    // ── グローバル実行ロック ──────────────────────────────────────
    // pg_cron が同一ウィンドウで2回起動した場合に即リターンする
    const bucketMin = Math.floor(jst.getUTCMinutes() / 5) * 5
    const invKey = `inv:${today}:${pad(jst.getUTCHours())}:${pad(bucketMin)}`
    const { count: invCount, error: invErr } = await supabase
      .from('sent_notifications')
      .insert({ key: invKey }, { count: 'exact', ignoreDuplicates: true } as any)

    if (invErr || invCount === 0) {
      return new Response(JSON.stringify({ skipped: 'duplicate_invocation', invKey }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // dedup キーを INSERT し、新規挿入できた（＝未送信）なら true を返す
    // ignoreDuplicates:true = INSERT ... ON CONFLICT DO NOTHING
    async function tryMark(key: string): Promise<boolean> {
      const { count, error } = await supabase
        .from('sent_notifications')
        .insert({ key }, { count: 'exact', ignoreDuplicates: true } as any)
      return !error && count === 1
    }

    let sent = 0

    for (const [phase, from, to] of [['10min', w10from, w10to], ['start', w0from, w0to]] as const) {
      // ── special_schedules ────────────────────────────────────
      const { data: specials } = await supabase
        .from('special_schedules')
        .select('exhibit_id, start_at, location, exhibit:exhibits(name)')
        .eq('day', today)
        .gte('start_at', from)
        .lte('start_at', to)

      for (const s of (specials ?? []) as any[]) {
        const startKey = (s.start_at as string).slice(0, 8)
        const dedupKey = `ss:${today}:${s.exhibit_id}:${startKey}:${phase}`
        if (!await tryMark(dedupKey)) continue

        const { data: subs } = await supabase
          .from('exhibit_push_subs').select('fcm_token').eq('exhibit_id', s.exhibit_id)

        // PatternB（カスタム通知）設定済みトークンは PatternA をスキップ
        const { data: customSubs } = await supabase
          .from('schedule_items')
          .select('fcm_token')
          .eq('exhibit_id', s.exhibit_id)
          .eq('date', today)
          .not('notify_minutes', 'is', null)
          .not('fcm_token', 'is', null)
        const customTokens = new Set((customSubs ?? []).map((r: any) => r.fcm_token as string))

        const name  = s.exhibit?.name ?? '催し'
        const start = (s.start_at as string).slice(0, 5)
        const loc   = s.location ? `（${s.location}）` : ''
        const title = phase === '10min' ? `⏰ 10分後に開始 — ${name}` : `🔔 始まりました — ${name}`
        const body  = phase === '10min' ? `${start}〜 ${loc}に来てね！`.trim() : `${loc}でスタート！`.trim()

        for (const sub of (subs ?? []) as any[]) {
          if (customTokens.has(sub.fcm_token)) continue
          if (await sendFCM(accessToken, sa.project_id, sub.fcm_token, title, body) === 200) sent++
        }
      }

      // ── band_schedules ───────────────────────────────────────
      const { data: bands } = await supabase
        .from('band_schedules')
        .select('start_at, stage, band:bands!inner(name, exhibit_id)')
        .eq('day', today)
        .gte('start_at', from)
        .lte('start_at', to)

      for (const b of (bands ?? []) as any[]) {
        const band = b.band as { name: string; exhibit_id: string }
        const startKey = (b.start_at as string).slice(0, 8)
        const dedupKey = `bs:${today}:${band.exhibit_id}:${startKey}:${phase}`
        if (!await tryMark(dedupKey)) continue

        const { data: subs } = await supabase
          .from('exhibit_push_subs').select('fcm_token').eq('exhibit_id', band.exhibit_id)

        // PatternB 設定済みトークンは PatternA をスキップ
        const { data: customSubs } = await supabase
          .from('schedule_items')
          .select('fcm_token')
          .eq('exhibit_id', band.exhibit_id)
          .not('notify_minutes', 'is', null)
          .not('fcm_token', 'is', null)
        const customTokens = new Set((customSubs ?? []).map((r: any) => r.fcm_token as string))

        const start = (b.start_at as string).slice(0, 5)
        const stage = b.stage ? `（${b.stage}）` : ''
        const title = phase === '10min' ? `🎸 10分後に開始 — ${band.name}` : `🎸 始まりました — ${band.name}`
        const body  = phase === '10min' ? `${start}〜 ${stage}に来てね！`.trim() : `${stage}でスタート！`.trim()

        for (const sub of (subs ?? []) as any[]) {
          if (customTokens.has(sub.fcm_token)) continue
          if (await sendFCM(accessToken, sa.project_id, sub.fcm_token, title, body) === 200) sent++
        }
      }
    }

    // ── PatternB: schedule_items のカスタム通知 ────────────────
    const { data: customItems } = await supabase
      .from('schedule_items')
      .select('id, exhibit_id, title, date, start_time, notify_minutes, fcm_token')
      .eq('date', today)
      .not('notify_minutes', 'is', null)
      .not('fcm_token', 'is', null)

    for (const item of (customItems ?? []) as any[]) {
      const [h, m] = (item.start_time as string).split(':').map(Number)
      const notifyAt = h * 60 + m - (item.notify_minutes as number)
      if (Math.abs(jstMin - notifyAt) > 2) continue

      const dedupKey = `si:${item.id}:${item.notify_minutes}`
      if (!await tryMark(dedupKey)) continue

      const title = `⏰ ${item.notify_minutes}分後に開始 — ${item.title}`
      const body  = `${item.start_time}〜 もうすぐです！`
      if (await sendFCM(accessToken, sa.project_id, item.fcm_token, title, body) === 200) sent++
    }

    // ── シフト通知 ────────────────────────────────────────────
    // shift_notification_prefs に登録されたユーザーの担当シフト開始前に通知
    const { data: prefs } = await supabase
      .from('shift_notification_prefs')
      .select('user_id, notify_minutes')

    for (const pref of (prefs ?? []) as { user_id: string; notify_minutes: number }[]) {
      const winFrom = toHHMMSS(addMin(now, pref.notify_minutes - 4))
      const winTo   = toHHMMSS(addMin(now, pref.notify_minutes + 1))

      // このユーザーの割り当てコマ ID を取得
      const { data: assignments } = await supabase
        .from('shift_assignments')
        .select('slot_id')
        .eq('user_id', pref.user_id)

      const slotIds = ((assignments ?? []) as { slot_id: string }[]).map(a => a.slot_id)
      if (!slotIds.length) continue

      // ウィンドウ内のコマを取得（id も含める）
      const { data: rawSlots } = await supabase
        .from('shift_slots')
        .select('id, start_at, exhibit_id')
        .in('id', slotIds)
        .eq('date', today)
        .gte('start_at', winFrom)
        .lte('start_at', winTo)

      if (!rawSlots?.length) continue

      // 展示名を取得
      const eids = [...new Set((rawSlots as any[]).map(s => s.exhibit_id))]
      const { data: exhibitRows } = await supabase
        .from('exhibits').select('id, name').in('id', eids)
      const nameMap = new Map((exhibitRows ?? []).map((e: any) => [e.id, e.name as string]))

      // ユーザーの FCM トークンを取得
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('fcm_token')
        .eq('user_id', pref.user_id)

      if (!subs?.length) continue

      for (const slot of (rawSlots as any[])) {
        // 送信済みチェック（重複送信防止）
        const { count: shiftCount, error: dupErr } = await supabase
          .from('sent_shift_notifications')
          .insert({ user_id: pref.user_id, slot_id: slot.id }, { count: 'exact', ignoreDuplicates: true } as any)
        if (dupErr || shiftCount === 0) continue

        const exhibitName = nameMap.get(slot.exhibit_id) ?? 'クラス'
        const start = (slot.start_at as string).slice(0, 5)
        const title = `📅 ${pref.notify_minutes}分後: シフト当番`
        const body  = `${start}〜 ${exhibitName} のシフトが始まります`

        for (const sub of subs as { fcm_token: string }[]) {
          if (await sendFCM(accessToken, sa.project_id, sub.fcm_token, title, body) === 200) sent++
        }
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})