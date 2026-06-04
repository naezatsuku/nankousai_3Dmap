import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function resolveUserKey(req: Request): Promise<string | null> {
  // ログイン済みなら user_id を優先
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return user.id
  } catch { /* noop */ }
  // 未ログインは X-User-Key ヘッダー（stamp_user_id）
  return req.headers.get('x-user-key')
}

// GET /api/schedule?date=sat|sun
export async function GET(req: Request) {
  const userKey = await resolveUserKey(req)
  if (!userKey) return NextResponse.json({ items: [] })

  const date = new URL(req.url).searchParams.get('date')
  const db = serviceDb()
  let query = db.from('schedule_items').select('*').eq('user_key', userKey).order('start_time')
  if (date) query = query.eq('date', date)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// POST /api/schedule  — 予定を追加
export async function POST(req: Request) {
  const userKey = await resolveUserKey(req)
  if (!userKey) return NextResponse.json({ error: 'user_key が必要です' }, { status: 400 })

  const body = await req.json() as {
    title:         string
    date:          'sat' | 'sun'
    start_time:    string
    end_time?:     string
    location?:     string
    exhibit_id?:   string
    notify_minutes?: number
    color?:        string
    type?:         'visit' | 'custom'
  }

  const { data, error } = await serviceDb()
    .from('schedule_items')
    .insert({ ...body, user_key: userKey, type: body.type ?? 'visit' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

// DELETE /api/schedule?id=  または  ?slotId=
export async function DELETE(req: Request) {
  const userKey = await resolveUserKey(req)
  if (!userKey) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const params = new URL(req.url).searchParams
  const id     = params.get('id')
  const slotId = params.get('slotId')
  const db     = serviceDb()

  if (id) {
    const { error } = await db.from('schedule_items').delete().eq('id', id).eq('user_key', userKey)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (slotId) {
    // シフトコマIDからdate/start_atを引いてシフト通知を削除
    const { data: slot } = await db.from('shift_slots').select('date, start_at').eq('id', slotId).single()
    if (!slot) return NextResponse.json({ ok: true })
    const s = slot as { date: string; start_at: string }
    const { error } = await db.from('schedule_items')
      .delete()
      .eq('user_key', userKey)
      .eq('title', 'シフト当番')
      .eq('date', s.date)
      .eq('start_time', s.start_at.slice(0, 5))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'id または slotId が必要です' }, { status: 400 })
}

// PATCH /api/schedule  — notify_minutes 更新
export async function PATCH(req: Request) {
  const userKey = await resolveUserKey(req)
  if (!userKey) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const body = await req.json() as { id: string; notify_minutes: number | null }
  const { error } = await serviceDb()
    .from('schedule_items')
    .update({ notify_minutes: body.notify_minutes })
    .eq('id', body.id)
    .eq('user_key', userKey)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
