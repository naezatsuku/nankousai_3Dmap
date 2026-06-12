import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  // 呼び出し元が admin か検証
  const auth = await createServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data: profile } = await auth
    .from('profiles').select('role').eq('id', user.id).single()
  if ((profile as { role: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const { userId, role } = await request.json() as { userId?: string; role?: string }

  if (!userId || !['admin', 'editor', 'student', 'teacher', 'band'].includes(role ?? '')) {
    return NextResponse.json({ error: 'userId と role (admin|editor|student|teacher|band) が必要です' }, { status: 400 })
  }

  // 自分自身の降格による admin 不在を防ぐため、自分のロール変更は禁止
  if (userId === user.id) {
    return NextResponse.json({ error: '自分自身のロールは変更できません' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
