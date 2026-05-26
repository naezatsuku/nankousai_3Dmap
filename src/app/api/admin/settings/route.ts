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

export async function GET() {
  const { data } = await serviceDb().from('site_settings').select('map_enabled').single()
  return NextResponse.json({ map_enabled: data?.map_enabled ?? true })
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const body = await req.json() as { map_enabled?: boolean }
  if (typeof body.map_enabled !== 'boolean') {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const { error } = await serviceDb()
    .from('site_settings')
    .update({ map_enabled: body.map_enabled })
    .eq('singleton', true)

  if (error) {
    console.error('[settings] update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
