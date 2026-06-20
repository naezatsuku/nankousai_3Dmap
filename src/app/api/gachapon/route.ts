import { NextResponse } from 'next/server'
import { createClient }  from '@supabase/supabase-js'
import { verifyGachaQr }  from '@/lib/stamp'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getBalance(db: ReturnType<typeof supabase>, userId: string) {
  const [{ count: collected }, { data: redemptions }] = await Promise.all([
    db.from('stamps').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('gachapon_redemptions').select('stamps_used').eq('user_id', userId),
  ])
  const used      = (redemptions ?? []).reduce((sum, r) => sum + r.stamps_used, 0)
  const available = Math.max(0, (collected ?? 0) - used)
  return { collected: collected ?? 0, used, available }
}

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  const db = supabase()
  const [{ data: settings }, balance] = await Promise.all([
    db.from('site_settings').select('gachapon_cost').eq('singleton', true).single(),
    getBalance(db, userId),
  ])

  return NextResponse.json({ cost: settings?.gachapon_cost ?? 5, ...balance })
}

export async function POST(req: Request) {
  const body = await req.json() as { userId: string; w: string; h: string; spins: number }
  const { userId, w, h, spins } = body

  if (!userId || !w || !h || !spins || spins < 1) {
    return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 })
  }

  const db = supabase()

  const { data: settings } = await db
    .from('site_settings')
    .select('gachapon_cost, gachapon_secret')
    .eq('singleton', true)
    .single()

  if (!settings?.gachapon_secret) {
    return NextResponse.json({ error: 'ガラポンが設定されていません' }, { status: 400 })
  }
  if (!verifyGachaQr(settings.gachapon_secret, parseInt(w), h)) {
    return NextResponse.json({ error: 'QRコードが無効または期限切れです' }, { status: 400 })
  }

  const cost        = settings.gachapon_cost ?? 5
  const stampsNeeded = cost * spins
  const { available } = await getBalance(db, userId)

  if (stampsNeeded > available) {
    return NextResponse.json({ error: 'スタンプが足りません' }, { status: 400 })
  }

  const { error } = await db
    .from('gachapon_redemptions')
    .insert({ user_id: userId, spins, stamps_used: stampsNeeded })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, spins, stampsUsed: stampsNeeded, available: available - stampsNeeded })
}
