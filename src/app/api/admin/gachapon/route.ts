import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { buildGachaQrUrl } from '@/lib/stamp'
import { randomUUID } from 'crypto'

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function requireAdmin(): Promise<boolean> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return (profile as { role: string } | null)?.role === 'admin'
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const db = serviceDb()
  const { data } = await db
    .from('site_settings')
    .select('gachapon_cost, gachapon_secret')
    .eq('singleton', true)
    .single()

  let secret = data?.gachapon_secret as string | null
  if (!secret) {
    secret = randomUUID()
    await db.from('site_settings').update({ gachapon_secret: secret }).eq('singleton', true)
  }

  const proto   = req.headers.get('x-forwarded-proto') ?? 'https'
  const host    = req.headers.get('host') ?? ''
  const baseUrl = `${proto}://${host}`

  return NextResponse.json({
    cost:  data?.gachapon_cost ?? 5,
    qrUrl: buildGachaQrUrl(baseUrl, secret),
  })
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const body = await req.json() as { cost?: number }
  if (typeof body.cost !== 'number' || body.cost < 1) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const { error } = await serviceDb()
    .from('site_settings')
    .update({ gachapon_cost: Math.floor(body.cost) })
    .eq('singleton', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
