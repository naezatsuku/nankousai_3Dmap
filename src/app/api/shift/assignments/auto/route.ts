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

// POST /api/shift/assignments/auto
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as { role: string } | null)?.role
  if (role === 'student') return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const body = await req.json() as { exhibitId: string; date: string }
  const db = serviceDb()

  // コマ取得
  const { data: slots } = await db
    .from('shift_slots').select('*')
    .eq('exhibit_id', body.exhibitId).eq('date', body.date)
    .order('order_index')

  const slotList = (slots ?? []) as { id: string; required_count: number }[]
  const slotIds  = slotList.map(s => s.id)
  if (slotIds.length === 0) return NextResponse.json({ ok: true, warnings: [] })

  // メンバー取得（student + editor 両方）
  const [studentsRes, editorsRes] = await Promise.all([
    db.from('student_exhibits').select('user_id').eq('exhibit_id', body.exhibitId),
    db.from('exhibit_editors').select('user_id').eq('exhibit_id', body.exhibitId),
  ])
  const memberIds = [
    ...((studentsRes.data ?? []) as { user_id: string }[]).map(r => r.user_id),
    ...((editorsRes.data  ?? []) as { user_id: string }[]).map(r => r.user_id),
  ].filter((id, i, arr) => arr.indexOf(id) === i) // 重複除去
  if (memberIds.length === 0) return NextResponse.json({ ok: true, warnings: ['メンバーが登録されていません'] })

  // アンケート回答取得
  const { data: prefRows } = await db
    .from('shift_preferences').select('user_id, slot_id, type')
    .in('slot_id', slotIds)

  type PrefType = 'want' | 'neutral' | 'avoid'
  const prefMap = new Map<string, PrefType>()
  for (const p of (prefRows ?? []) as { user_id: string; slot_id: string; type: PrefType }[]) {
    prefMap.set(`${p.user_id}:${p.slot_id}`, p.type)
  }

  const getPref = (uid: string, sid: string): PrefType =>
    prefMap.get(`${uid}:${sid}`) ?? 'neutral'

  // グリーディ法による割当
  const maxPerPerson = Math.floor(slotIds.length / memberIds.length) + 1
  const assignCount  = new Map<string, number>(memberIds.map(id => [id, 0]))
  const result       = new Map<string, string[]>(slotList.map(s => [s.id, []]))
  const warnings: string[] = []

  // 充足率の低い（want人数÷必要人数 が小さい）コマから処理
  const sorted = [...slotList].sort((a, b) => {
    const wantA = memberIds.filter(uid => getPref(uid, a.id) === 'want').length / a.required_count
    const wantB = memberIds.filter(uid => getPref(uid, b.id) === 'want').length / b.required_count
    return wantA - wantB
  })

  for (const slot of sorted) {
    const assigned = result.get(slot.id)!
    const priorities: PrefType[] = ['want', 'neutral']

    for (const pref of priorities) {
      if (assigned.length >= slot.required_count) break
      const candidates = memberIds
        .filter(uid =>
          getPref(uid, slot.id) === pref &&
          (assignCount.get(uid) ?? 0) < maxPerPerson &&
          !assigned.includes(uid)
        )
        .sort((a, b) => (assignCount.get(a) ?? 0) - (assignCount.get(b) ?? 0))

      for (const uid of candidates) {
        if (assigned.length >= slot.required_count) break
        assigned.push(uid)
        assignCount.set(uid, (assignCount.get(uid) ?? 0) + 1)
      }
    }

    if (assigned.length < slot.required_count) {
      warnings.push(`${slot.id}のコマは人数が不足しています（${assigned.length}/${slot.required_count}）`)
    }
  }

  // 既存割当を削除して保存
  await db.from('shift_assignments').delete().in('slot_id', slotIds)

  const rows = [...result.entries()].flatMap(([slotId, userIds]) =>
    userIds.map(uid => ({ slot_id: slotId, user_id: uid, assigned_by: user.id }))
  )
  if (rows.length > 0) await db.from('shift_assignments').insert(rows)

  return NextResponse.json({ ok: true, warnings })
}
