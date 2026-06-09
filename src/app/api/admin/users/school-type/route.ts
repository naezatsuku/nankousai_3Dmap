import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { userId, schoolType } = await request.json() as { userId?: string; schoolType?: string }

  if (!userId || !['middle', 'high', 'teacher'].includes(schoolType ?? '')) {
    return NextResponse.json({ error: 'userId と schoolType (middle|high|teacher) が必要です' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { error } = await supabase.from('profiles').update({ school_type: schoolType }).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
