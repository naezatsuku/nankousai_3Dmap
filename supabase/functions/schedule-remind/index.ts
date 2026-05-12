import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAccessToken, sendFCM, type ServiceAccount } from '../_shared/fcm.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function pad(n: number) { return String(n).padStart(2, '0') }
function toHHMMSS(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:00` }

serve(async (_req) => {
  try {
    const now   = new Date()
    const dow   = now.getDay()
    const today = dow === 6 ? 'sat' : dow === 0 ? 'sun' : null

    // 祭当日以外はスキップ
    if (!today) {
      return new Response(JSON.stringify({ skipped: 'not a festival day' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // 25〜35分後のウィンドウ（通知は開始30分前に届く）
    const from = toHHMMSS(new Date(now.getTime() + 25 * 60 * 1000))
    const to   = toHHMMSS(new Date(now.getTime() + 35 * 60 * 1000))

    const sa: ServiceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')!)
    const accessToken = await getAccessToken(sa)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let sent = 0

    // ── 催し（special_schedules） ───────────────────────────────
    const { data: specials } = await supabase
      .from('special_schedules')
      .select('exhibit_id, start_at, location, description, exhibit:exhibits(name)')
      .eq('day', today)
      .gte('start_at', from)
      .lte('start_at', to)

    for (const s of (specials ?? []) as any[]) {
      const { data: subs } = await supabase
        .from('exhibit_push_subs')
        .select('fcm_token')
        .eq('exhibit_id', s.exhibit_id)

      const name  = s.exhibit?.name ?? '催し'
      const start = (s.start_at as string).slice(0, 5)
      const loc   = s.location ? `（${s.location}）` : ''
      const title = `⏰ まもなく開始 — ${name}`
      const body  = `${start}〜 ${loc}`.trim()

      for (const sub of (subs ?? []) as any[]) {
        const status = await sendFCM(accessToken, sa.project_id, sub.fcm_token, title, body)
        if (status === 200) sent++
      }
    }

    // ── 軽音（band_schedules） ──────────────────────────────────
    const { data: bands } = await supabase
      .from('band_schedules')
      .select('start_at, stage, band:bands!inner(name, exhibit_id)')
      .eq('day', today)
      .gte('start_at', from)
      .lte('start_at', to)

    for (const b of (bands ?? []) as any[]) {
      const band = b.band as { name: string; exhibit_id: string }

      const { data: subs } = await supabase
        .from('exhibit_push_subs')
        .select('fcm_token')
        .eq('exhibit_id', band.exhibit_id)

      const start = (b.start_at as string).slice(0, 5)
      const stage = b.stage ? `（${b.stage}）` : ''
      const title = `🎸 まもなく開始 — ${band.name}`
      const body  = `${start}〜 ${stage}`.trim()

      for (const sub of (subs ?? []) as any[]) {
        const status = await sendFCM(accessToken, sa.project_id, sub.fcm_token, title, body)
        if (status === 200) sent++
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
