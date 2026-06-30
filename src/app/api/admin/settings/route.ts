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
  const { data } = await serviceDb()
    .from('site_settings')
    .select('is_public, map_enabled, like_count_visible, comment_mode, festival_sat, festival_sun, announcement_trigger_minutes, wait_stage_count, wait_threshold_low, wait_threshold_high, wait_threshold_3')
    .single()
  return NextResponse.json({
    is_public:                     data?.is_public                     ?? true,
    map_enabled:                   data?.map_enabled                   ?? true,
    like_count_visible:            data?.like_count_visible            ?? true,
    comment_mode:                  data?.comment_mode                  ?? 'all_on',
    festival_sat:                  data?.festival_sat                  ?? '2025-09-13',
    festival_sun:                  data?.festival_sun                  ?? '2025-09-14',
    announcement_trigger_minutes:  data?.announcement_trigger_minutes  ?? 5,
    wait_stage_count:              data?.wait_stage_count              ?? 4,
    wait_threshold_low:            data?.wait_threshold_low            ?? 10,
    wait_threshold_high:           data?.wait_threshold_high           ?? 25,
    wait_threshold_3:              data?.wait_threshold_3              ?? 40,
  })
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const body = await req.json() as {
    is_public?: boolean
    map_enabled?: boolean; like_count_visible?: boolean
    comment_mode?: string
    festival_sat?: string; festival_sun?: string
    announcement_trigger_minutes?: number
    wait_stage_count?: number
    wait_threshold_low?: number; wait_threshold_high?: number; wait_threshold_3?: number
  }
  const patch: Record<string, boolean | string | number> = {}

  if (typeof body.is_public                     === 'boolean') patch.is_public                     = body.is_public
  if (typeof body.map_enabled                   === 'boolean') patch.map_enabled                   = body.map_enabled
  if (typeof body.like_count_visible            === 'boolean') patch.like_count_visible            = body.like_count_visible
  if (typeof body.comment_mode === 'string' && ['all_on', 'public_off', 'all_off'].includes(body.comment_mode))
    patch.comment_mode = body.comment_mode
  if (typeof body.festival_sat                  === 'string')  patch.festival_sat                  = body.festival_sat
  if (typeof body.festival_sun                  === 'string')  patch.festival_sun                  = body.festival_sun
  if (typeof body.announcement_trigger_minutes  === 'number' && body.announcement_trigger_minutes >= 1)
    patch.announcement_trigger_minutes = body.announcement_trigger_minutes
  if (typeof body.wait_stage_count === 'number' && [3, 4, 5].includes(body.wait_stage_count))
    patch.wait_stage_count = body.wait_stage_count
  if (typeof body.wait_threshold_low  === 'number' && body.wait_threshold_low  >= 1)
    patch.wait_threshold_low  = body.wait_threshold_low
  if (typeof body.wait_threshold_high === 'number' && body.wait_threshold_high >= 1)
    patch.wait_threshold_high = body.wait_threshold_high
  if (typeof body.wait_threshold_3    === 'number' && body.wait_threshold_3    >= 1)
    patch.wait_threshold_3    = body.wait_threshold_3

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const { error } = await serviceDb()
    .from('site_settings')
    .update(patch)
    .eq('singleton', true)

  if (error) {
    console.error('[settings] update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
