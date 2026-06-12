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

// POST /api/admin/users/assign
// body: { userId, exhibitIds, table: 'exhibit_editors' | 'student_exhibits' | 'band_editors' }
// band_editors の場合 exhibitIds にはバンド ID を渡す
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if ((profile as { role: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const body = await req.json() as {
    userId:     string
    exhibitIds: string[]
    table:      'exhibit_editors' | 'student_exhibits' | 'band_editors'
  }

  if (!body.userId || !['exhibit_editors', 'student_exhibits', 'band_editors'].includes(body.table)) {
    return NextResponse.json({ error: 'パラメータが不正です' }, { status: 400 })
  }

  const idColumn = body.table === 'band_editors' ? 'band_id' : 'exhibit_id'

  const db = serviceDb()
  await db.from(body.table).delete().eq('user_id', body.userId)

  if (body.exhibitIds.length > 0) {
    await db.from(body.table).insert(
      body.exhibitIds.map(id => ({ user_id: body.userId, [idColumn]: id }))
    )
  }

  return NextResponse.json({ ok: true })
}
