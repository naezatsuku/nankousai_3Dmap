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

// GET /api/shift/assignments?exhibitId=&date=
export async function GET(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const params    = new URL(req.url).searchParams
  const exhibitId = params.get('exhibitId')
  const date      = params.get('date')
  if (!exhibitId) return NextResponse.json({ error: 'exhibitId が必要です' }, { status: 400 })

  const db = serviceDb()

  // コマ取得（クライアントが使うカラムのみ）
  let slotQuery = db.from('shift_slots').select('id, date, start_at, end_at, required_count').eq('exhibit_id', exhibitId).order('order_index')
  if (date) slotQuery = slotQuery.eq('date', date)
  const { data: slots } = await slotQuery

  const slotIds = ((slots ?? []) as { id: string }[]).map(s => s.id)
  if (slotIds.length === 0) return NextResponse.json({ slots: [], assignments: [], members: [] })

  // 割当取得（slot_id と user_id のみ取得 — profiles ジョインすると slot_id が消えるため）
  const { data: assignments } = await db
    .from('shift_assignments')
    .select('slot_id, user_id')
    .in('slot_id', slotIds)

  // クラスメンバー取得（student + editor 両方）
  const [studentsRes, editorsRes] = await Promise.all([
    db.from('student_exhibits').select('user_id, profiles(id, name)').eq('exhibit_id', exhibitId),
    db.from('exhibit_editors').select('user_id, profiles(id, name)').eq('exhibit_id', exhibitId),
  ])

  // 重複を除いてマージ（user_id でユニーク）
  type MemberRow = { user_id: string; profiles: { id: string; name: string } | null }
  const seen = new Set<string>()
  const members: MemberRow[] = []
  const studentRows = (studentsRes.data ?? []) as unknown as MemberRow[]
  const editorRows = (editorsRes.data ?? []) as unknown as MemberRow[]
  for (const row of [...studentRows, ...editorRows]) {
    if (!seen.has(row.user_id)) {
      seen.add(row.user_id)
      members.push(row)
    }
  }

  return NextResponse.json({ slots: slots ?? [], assignments: assignments ?? [], members })
}

// PUT /api/shift/assignments  — 手動割当保存
export async function PUT(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as { role: string } | null)?.role
  if (role === 'student') return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const body = await req.json() as {
    exhibitId: string
    date: string
    assignments: { slotId: string; userIds: string[] }[]
  }

  const db = serviceDb()
  const slotIds = body.assignments.map(a => a.slotId)

  // 既存割当を削除して再挿入
  const { error: delErr } = await db.from('shift_assignments').delete().in('slot_id', slotIds)
  if (delErr) {
    console.error('[assignments PUT] delete error:', delErr)
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  const rows = body.assignments.flatMap(a =>
    a.userIds.map(uid => ({ slot_id: a.slotId, user_id: uid, assigned_by: user.id }))
  )
  if (rows.length > 0) {
    const { error: insErr } = await db.from('shift_assignments').insert(rows)
    if (insErr) {
      console.error('[assignments PUT] insert error:', insErr)
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
