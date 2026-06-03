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

// POST /api/shift/members
// body: { exhibitId, userIds }
// editor は自分の担当展示のみ操作可
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as { role: string } | null)?.role

  if (role === 'student') return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const body = await req.json() as { exhibitId: string; userIds: string[] }

  // editor の場合は自分の担当展示のみ許可
  if (role === 'editor') {
    const { data: link } = await supabase
      .from('exhibit_editors')
      .select('exhibit_id')
      .eq('user_id', user.id)
      .eq('exhibit_id', body.exhibitId)
      .single()
    if (!link) return NextResponse.json({ error: '担当展示ではありません' }, { status: 403 })
  }

  const db = serviceDb()
  await db.from('student_exhibits').delete().eq('exhibit_id', body.exhibitId)
  if (body.userIds.length > 0) {
    await db.from('student_exhibits').insert(
      body.userIds.map(user_id => ({ user_id, exhibit_id: body.exhibitId }))
    )
  }

  return NextResponse.json({ ok: true })
}
