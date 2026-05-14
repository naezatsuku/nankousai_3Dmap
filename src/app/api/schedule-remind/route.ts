import { NextResponse } from 'next/server'
import { createClient }  from '@supabase/supabase-js'

interface ServiceAccount {
  project_id:   string
  client_email: string
  private_key:  string
}

function pemToBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '')
  const binary = atob(b64)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return buf.buffer
}

function b64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now     = Math.floor(Date.now() / 1000)
  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  }))
  const sigInput = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  )
  const rawSig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(sigInput))
  const sig = btoa(String.fromCharCode(...new Uint8Array(rawSig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${sigInput}.${sig}`,
  })
  const { access_token } = await res.json() as { access_token: string }
  return access_token
}

async function sendFCM(
  accessToken: string, projectId: string, fcmToken: string, title: string, body: string,
): Promise<number> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        data: { title, body },
      },
    }),
  })
  return res.status
}

function pad(n: number) { return String(n).padStart(2, '0') }
function toHHMM(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
function toHHMMSS(d: Date) { return `${toHHMM(d)}:00` }

function addMin(d: Date, min: number) { return new Date(d.getTime() + min * 60 * 1000) }

export async function POST(req: Request) {
  try {
    const body = await req.json() as { testTime?: string; bypassDayCheck?: boolean }

    // 基準時刻（テスト用に上書き可能）
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

    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    if (!saJson) return NextResponse.json({ error: 'FIREBASE_SERVICE_ACCOUNT_JSON not set' }, { status: 500 })

    const sa: ServiceAccount = JSON.parse(saJson)
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