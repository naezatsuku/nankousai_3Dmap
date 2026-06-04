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

// GET /api/shift/preferences?exhibitId=  (editor/admin: 全員分)
// GET /api/shift/preferences?exhibitId=&mine=1  (自分の回答)
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const params    = new URL(req.url).searchParams
  const exhibitId = params.get('exhibitId')
  const mine      = params.get('mine') === '1'
  if (!exhibitId) return NextResponse.json({ error: 'exhibitId が必要です' }, { status: 400 })

  const db = serviceDb()

  // profiles と shift_slots を並列取得（shift_slots は両分岐で共通）
  const [{ data: profile }, { data: slotData }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    db.from('shift_slots').select('id').eq('exhibit_id', exhibitId),
  ])
  const role = (profile as { role: string } | null)?.role
  const slotIds = ((slotData ?? []) as { id: string }[]).map(s => s.id)

  if (slotIds.length === 0) return NextResponse.json({ preferences: [] })

  if (mine || role === 'student') {
    const { data } = await db
      .from('shift_preferences')
      .select('slot_id, type')
      .eq('user_id', user.id)
      .in('slot_id', slotIds)
    return NextResponse.json({ preferences: data ?? [] })
  }

  // editor/admin: 全員分（生徒名付き）
  const { data } = await db
    .from('shift_preferences')
    .select('user_id, slot_id, type, profiles(name)')
    .in('slot_id', slotIds)

  return NextResponse.json({ preferences: data ?? [] })
}

// POST /api/shift/preferences  — 自分の回答を一括保存
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const body = await req.json() as {
    answers: { slotId: string; type: 'want' | 'neutral' | 'avoid' }[]
  }

  const db = serviceDb()
  const rows = body.answers.map(a => ({
    user_id: user.id,
    slot_id: a.slotId,
    type:    a.type,
  }))

  await db.from('shift_preferences')
    .upsert(rows, { onConflict: 'user_id,slot_id' })

  return NextResponse.json({ ok: true })
}
