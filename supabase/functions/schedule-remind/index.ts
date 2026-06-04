import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAccessToken, sendFCM, type ServiceAccount } from '../_shared/fcm.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function pad(n: number) { return String(n).padStart(2, '0') }
function toHHMMSS(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:00` }
function addMin(d: Date, min: number) { return new Date(d.getTime() + min * 60 * 1000) }

serve(async (_req) => {
  try {
    const now = new Date()
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000) // UTC→JST

    // 日付チェック（文化祭当日のみ）
    const dateStr = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`
    const today =
      dateStr === '2025-09-13' ? 'sat' :
      dateStr === '2025-09-14' ? 'sun' : null

    if (!today) {
      return new Response(JSON.stringify({ skipped: 'not a festival day' }), {
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

    const sa: ServiceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')!)
    const accessToken = await getAccessToken(sa)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

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
        const { data: subs } = await supabase
          .from('exhibit_push_subs').select('fcm_token').eq('exhibit_id', s.exhibit_id)

        const name  = s.exhibit?.name ?? '催し'
        const start = (s.start_at as string).slice(0, 5)
        const loc   = s.location ? `（${s.location}）` : ''
        const title = phase === '10min' ? `⏰ 10分後に開始 — ${name}` : `🔔 始まりました — ${name}`
        const body  = phase === '10min' ? `${start}〜 ${loc}に来てね！`.trim() : `${loc}でスタート！`.trim()

        for (const sub of (subs ?? []) as any[]) {
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
        const { data: subs } = await supabase
          .from('exhibit_push_subs').select('fcm_token').eq('exhibit_id', band.exhibit_id)

        const start = (b.start_at as string).slice(0, 5)
        const stage = b.stage ? `（${b.stage}）` : ''
        const title = phase === '10min' ? `🎸 10分後に開始 — ${band.name}` : `🎸 始まりました — ${band.name}`
        const body  = phase === '10min' ? `${start}〜 ${stage}に来てね！`.trim() : `${stage}でスタート！`.trim()

        for (const sub of (subs ?? []) as any[]) {
          if (await sendFCM(accessToken, sa.project_id, sub.fcm_token, title, body) === 200) sent++
        }
      }
    }

    // ── シフト通知 ────────────────────────────────────────────
    // shift_notification_prefs に登録されたユーザーの担当シフト開始前に通知
    const { data: prefs } = await supabase
      .from('shift_notification_prefs')
      .select('user_id, notify_minutes')

    for (const pref of (prefs ?? []) as { user_id: string; notify_minutes: number }[]) {
      const winFrom = toHHMMSS(addMin(now, pref.notify_minutes - 2))
      const winTo   = toHHMMSS(addMin(now, pref.notify_minutes + 2))

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
        // 送信済みチェック（毎分 cron の重複送信防止）
        const { error: dupErr } = await supabase
          .from('sent_shift_notifications')
          .insert({ user_id: pref.user_id, slot_id: slot.id })
        if (dupErr) continue // すでに送信済みならスキップ

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