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

type PrefType = 'want' | 'neutral' | 'avoid'

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

  // ── コマ取得 ────────────────────────────────────────────────────
  const { data: slots } = await db
    .from('shift_slots').select('id, required_count')
    .eq('exhibit_id', body.exhibitId).eq('date', body.date)
    .order('order_index')

  const slotList = (slots ?? []) as { id: string; required_count: number }[]
  const slotIds  = slotList.map(s => s.id)
  if (slotIds.length === 0) return NextResponse.json({ ok: true, warnings: [], overloaded: [] })

  // ── メンバー取得（student + editor、重複除去）────────────────────
  const [studentsRes, editorsRes] = await Promise.all([
    db.from('student_exhibits').select('user_id, profiles(id, name)').eq('exhibit_id', body.exhibitId),
    db.from('exhibit_editors').select('user_id, profiles(id, name)').eq('exhibit_id', body.exhibitId),
  ])
  type MRow = { user_id: string; profiles: { name: string } | null }
  const seen = new Set<string>()
  const memberRows: MRow[] = []
  for (const r of [
    ...((studentsRes.data ?? []) as unknown as MRow[]),
    ...((editorsRes.data  ?? []) as unknown as MRow[]),
  ]) {
    if (!seen.has(r.user_id)) { seen.add(r.user_id); memberRows.push(r) }
  }
  const memberIds   = memberRows.map(r => r.user_id)
  const memberNames = new Map(memberRows.map(r => [r.user_id, r.profiles?.name ?? r.user_id]))

  if (memberIds.length === 0) {
    return NextResponse.json({ ok: true, warnings: ['メンバーが登録されていません'], overloaded: [] })
  }

  // ── アンケート回答取得 ──────────────────────────────────────────
  const { data: prefRows } = await db
    .from('shift_preferences').select('user_id, slot_id, type')
    .in('slot_id', slotIds)

  const prefMap = new Map<string, PrefType>()
  for (const p of (prefRows ?? []) as { user_id: string; slot_id: string; type: PrefType }[]) {
    prefMap.set(`${p.user_id}:${p.slot_id}`, p.type)
  }
  const getPref = (uid: string, sid: string): PrefType =>
    prefMap.get(`${uid}:${sid}`) ?? 'neutral'

  // ── 2段階割り当てアルゴリズム ───────────────────────────────────
  // ✕（avoid）は絶対に割り当てない
  const totalRequired = slotList.reduce((s, sl) => s + sl.required_count, 0)
  const baseTarget    = Math.floor(totalRequired / memberIds.length)   // 1人あたり最低目標
  const softCap       = Math.ceil(totalRequired / memberIds.length)     // 通常上限

  const assignCount = new Map<string, number>(memberIds.map(id => [id, 0]))
  const result      = new Map<string, string[]>(slotList.map(s => [s.id, []]))
  const warnings: string[] = []

  // 充足率（want人数÷必要人数）の低いコマから優先処理
  const sorted = [...slotList].sort((a, b) => {
    const wa = memberIds.filter(u => getPref(u, a.id) === 'want').length / a.required_count
    const wb = memberIds.filter(u => getPref(u, b.id) === 'want').length / b.required_count
    return wa - wb
  })

  const tryFill = (slot: { id: string; required_count: number }, cap: number, prefs: PrefType[]) => {
    const assigned = result.get(slot.id)!
    for (const pref of prefs) {
      if (assigned.length >= slot.required_count) break
      const candidates = memberIds
        .filter(uid =>
          getPref(uid, slot.id) === pref &&      // 指定のアンケート回答
          (assignCount.get(uid) ?? 0) < cap &&   // 上限以内
          !assigned.includes(uid)
        )
        .sort((a, b) => (assignCount.get(a) ?? 0) - (assignCount.get(b) ?? 0)) // 少ない人優先

      for (const uid of candidates) {
        if (assigned.length >= slot.required_count) break
        assigned.push(uid)
        assignCount.set(uid, (assignCount.get(uid) ?? 0) + 1)
      }
    }
  }

  // 第1段階: want のみで softCap 以内に収めて埋める
  for (const slot of sorted) tryFill(slot, softCap, ['want'])

  // 第2段階: neutral で補填（softCap 以内）
  for (const slot of sorted) tryFill(slot, softCap, ['neutral'])

  // 第3段階: まだ足りないコマは上限を1ずつ緩めて再試行（avoid は絶対に使わない）
  for (let cap = softCap + 1; cap <= totalRequired; cap++) {
    let allFilled = true
    for (const slot of sorted) {
      if ((result.get(slot.id)?.length ?? 0) < slot.required_count) {
        tryFill(slot, cap, ['want', 'neutral'])
        if ((result.get(slot.id)?.length ?? 0) < slot.required_count) allFilled = false
      }
    }
    if (allFilled) break
  }

  // 警告: それでも足りないコマ
  for (const slot of sorted) {
    const filled = result.get(slot.id)?.length ?? 0
    if (filled < slot.required_count) {
      warnings.push(`${slot.id} は人数不足（${filled}/${slot.required_count}）`)
    }
  }

  // 過負荷メンバー（baseTarget より多くなった人）
  const overloaded = memberIds
    .filter(uid => (assignCount.get(uid) ?? 0) > baseTarget)
    .map(uid => ({
      name:  memberNames.get(uid) ?? uid,
      count: assignCount.get(uid) ?? 0,
    }))

  // ── DB 保存 ────────────────────────────────────────────────────
  const { error: delErr } = await db
    .from('shift_assignments').delete().in('slot_id', slotIds)
  if (delErr) {
    console.error('[auto] delete error:', delErr)
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  const rows = [...result.entries()].flatMap(([slotId, userIds]) =>
    userIds.map(uid => ({ slot_id: slotId, user_id: uid, assigned_by: user.id }))
  )
  if (rows.length > 0) {
    const { error: insErr } = await db.from('shift_assignments').insert(rows)
    if (insErr) {
      console.error('[auto] insert error:', insErr)
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    ok: true,
    assigned:   rows.length,
    warnings,
    overloaded, // [{ name, count }]
    baseTarget,
  })
}
