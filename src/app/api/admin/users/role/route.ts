import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { userId, role } = await request.json() as { userId?: string; role?: string }

  if (!userId || !['admin', 'editor', 'student'].includes(role ?? '')) {
    return NextResponse.json({ error: 'userId と role (admin|editor|student) が必要です' }, { status: 400 })
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
