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
    'pkcs8',
    pemToBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const rawSig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(sigInput),
  )
  const sig = btoa(String.fromCharCode(...new Uint8Array(rawSig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${sigInput}.${sig}`,
  })
  const { access_token } = await res.json() as { access_token: string }
  return access_token
}

async function sendFCM(
  accessToken: string,
  projectId:   string,
  fcmToken:    string,
  title:       string,
  body:        string,
): Promise<number> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          data: { title, body },
        },
      }),
    },
  )
  return res.status
}

export async function POST(req: Request) {
  try {
    const { title, body } = await req.json() as { title: string; body: string }

    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    if (!saJson) {
      return NextResponse.json({ error: 'FIREBASE_SERVICE_ACCOUNT_JSON not set' }, { status: 500 })
    }
    const sa: ServiceAccount = JSON.parse(saJson)
    const accessToken = await getAccessToken(sa)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: subs } = await supabase.from('push_subscriptions').select('fcm_token')
    const tokens = (subs ?? []).map((s: { fcm_token: string }) => s.fcm_token)

    let sent = 0
    const invalid: string[] = []

    for (const token of tokens) {
      const status = await sendFCM(accessToken, sa.project_id, token, title, body)
      if (status === 200) {
        sent++
      } else if (status === 400 || status === 404) {
        invalid.push(token)
      }
    }

    if (invalid.length > 0) {
      await supabase.from('push_subscriptions').delete().in('fcm_token', invalid)
      await supabase.from('exhibit_push_subs').delete().in('fcm_token', invalid)
    }

    return NextResponse.json({ sent, invalid: invalid.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}