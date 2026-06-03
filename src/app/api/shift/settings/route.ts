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

async function getCallerExhibitId(): Promise<{ userId: string; exhibitId: string | null; role: string } | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as { role: string } | null)?.role ?? ''

  if (role === 'admin') return { userId: user.id, exhibitId: null, role }

  // editor: exhibit_editors から
  if (role === 'editor') {
    const { data } = await supabase
      .from('exhibit_editors').select('exhibit_id').eq('user_id', user.id).limit(1).single()
    return { userId: user.id, exhibitId: (data as { exhibit_id: string } | null)?.exhibit_id ?? null, role }
  }

  // student: student_exhibits から
  if (role === 'student') {
    const { data } = await supabase
      .from('student_exhibits').select('exhibit_id').eq('user_id', user.id).limit(1).single()
    return { userId: user.id, exhibitId: (data as { exhibit_id: string } | null)?.exhibit_id ?? null, role }
  }

  return null
}

// GET /api/shift/settings?exhibitId=
export async function GET(req: Request) {
  const caller = await getCallerExhibitId()
  if (!caller) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const exhibitId = new URL(req.url).searchParams.get('exhibitId') ?? caller.exhibitId
  if (!exhibitId) return NextResponse.json({ error: 'exhibitId が必要です' }, { status: 400 })

  const { data } = await serviceDb()
    .from('shift_settings')
    .select('*')
    .eq('exhibit_id', exhibitId)
  return NextResponse.json({ settings: data ?? [] })
}

// POST /api/shift/settings  — 設定保存 & コマ生成
export async function POST(req: Request) {
  const caller = await getCallerExhibitId()
  if (!caller || caller.role === 'student')
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const body = await req.json() as {
    exhibitId: string
    date: 'sat' | 'sun'
    startTime: string   // "09:00"
    endTime: string     // "17:00"
    intervalMinutes: number
    defaultRequired: number
  }

  const db = serviceDb()

  // upsert 設定
  const { data: setting, error: sErr } = await db
    .from('shift_settings')
    .upsert({
      exhibit_id:       body.exhibitId,
      date:             body.date,
      start_time:       body.startTime,
      end_time:         body.endTime,
      interval_minutes: body.intervalMinutes,
      default_required: body.defaultRequired,
      created_by:       caller.userId,
    }, { onConflict: 'exhibit_id,date' })
    .select().single()

  if (sErr || !setting) return NextResponse.json({ error: sErr?.message }, { status: 500 })

  // 既存コマを削除して再生成
  await db.from('shift_slots').delete().eq('setting_id', (setting as { id: string }).id)

  const slots = []
  const [sh, sm] = body.startTime.split(':').map(Number)
  const [eh, em] = body.endTime.split(':').map(Number)
  let cur = sh * 60 + sm
  const end = eh * 60 + em
  let idx = 0

  while (cur + body.intervalMinutes <= end) {
    const startH = String(Math.floor(cur / 60)).padStart(2, '0')
    const startM = String(cur % 60).padStart(2, '0')
    cur += body.intervalMinutes
    const endH = String(Math.floor(cur / 60)).padStart(2, '0')
    const endM = String(cur % 60).padStart(2, '0')
    slots.push({
      setting_id:     (setting as { id: string }).id,
      exhibit_id:     body.exhibitId,
      date:           body.date,
      start_at:       `${startH}:${startM}`,
      end_at:         `${endH}:${endM}`,
      required_count: body.defaultRequired,
      order_index:    idx++,
    })
  }

  if (slots.length > 0) await db.from('shift_slots').insert(slots)

  return NextResponse.json({ ok: true, slotCount: slots.length })
}
