import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// GET /api/shift/slots?exhibitId=&date=
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const params = new URL(req.url).searchParams
  const exhibitId = params.get('exhibitId')
  const date      = params.get('date')
  if (!exhibitId) return NextResponse.json({ error: 'exhibitId が必要です' }, { status: 400 })

  let query = serviceDb()
    .from('shift_slots')
    .select('*')
    .eq('exhibit_id', exhibitId)
    .order('order_index')

  if (date) query = query.eq('date', date)

  const { data } = await query
  return NextResponse.json({ slots: data ?? [] })
}

// PATCH /api/shift/slots  — コマごとの必要人数更新
export async function PATCH(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as { role: string } | null)?.role
  if (role === 'student') return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const body = await req.json() as { slotId: string; requiredCount: number }
  await serviceDb()
    .from('shift_slots')
    .update({ required_count: body.requiredCount })
    .eq('id', body.slotId)

  return NextResponse.json({ ok: true })
}
