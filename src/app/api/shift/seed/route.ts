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

const MOCK_SUFFIX = '@shift-test.local'

const MOCK_NAMES = [
  '田中太郎', '山田花子', '鈴木健太', '佐藤美咲', '伊藤拓也',
  '渡辺由美', '中村大輔', '小林真由', '加藤翔',   '吉田恵',
  '山口直樹', '松本愛',   '井上智也', '木村実咲', '林悠太',
  '橋本彩',   '清水和也', '岡田優',   '高橋聡',   '石田麻美',
  '森田雄太', '西村千尋', '斉藤浩二', '藤田奈緒', '辻誠',
  '三浦佳代', '竹内光',   '前田瞳',   '坂本亮',   '池田菜々子',
  '山本健一', '川口由加', '永田修平', '黒田菜摘', '内田凌',
  '村田里奈', '青木颯太', '石川沙織', '服部竜也', '野口優花',
]

type PrefType = 'want' | 'neutral' | 'avoid'

// 生徒インデックスとコマインデックスからアンケート回答を決定論的に生成
// 5種類のパターン（朝型・午後型・昼回避・フレキシブル・終盤回避）
function mockPref(studentIdx: number, slotIdx: number, totalSlots: number): PrefType {
  const personality = studentIdx % 5
  // 0-96 の決定論的なハッシュ
  const h = ((studentIdx * 7 + slotIdx * 13) % 97 + 97) % 97

  const midStart = Math.round(totalSlots * 0.375)  // 6/16 = 11:00
  const midEnd   = Math.round(totalSlots * 0.625)  // 10/16 = 13:00
  const lateStart = Math.round(totalSlots * 0.8)   // 13/16 = 15:30

  const morning   = slotIdx < midStart
  const lunch     = slotIdx >= midStart && slotIdx < midEnd
  const lateDay   = slotIdx >= lateStart

  switch (personality) {
    case 0:  // 朝型
      if (morning) return h < 65 ? 'want' : 'neutral'
      if (lunch)   return h < 55 ? 'avoid' : 'neutral'
      if (lateDay) return 'avoid'
      return h < 20 ? 'avoid' : 'neutral'

    case 1:  // 午後型
      if (morning) return h < 60 ? 'avoid' : 'neutral'
      if (lunch)   return h < 40 ? 'avoid' : 'neutral'
      return h < 65 ? 'want' : 'neutral'  // 午後〜終盤 = want

    case 2:  // 昼休み回避（昼は絶対避ける）
      if (lunch)  return 'avoid'
      return h < 45 ? 'want' : 'neutral'

    case 3:  // フレキシブル（少しランダム）
      return h < 30 ? 'want' : h < 40 ? 'avoid' : 'neutral'

    case 4:  // 終盤回避
      if (lateDay) return h < 70 ? 'avoid' : 'neutral'
      return h < 35 ? 'want' : 'neutral'

    default: return 'neutral'
  }
}

// POST /api/shift/seed — テストデータを投入
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if ((profile as { role: string } | null)?.role !== 'admin')
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { exhibitId?: string }
  const db = serviceDb()

  // ── exhibitId を決定 ───────────────────────────────────────────
  let exhibitId = body.exhibitId
  if (!exhibitId) {
    const { data: ex } = await db
      .from('exhibits').select('id').limit(1).single()
    if (!ex) return NextResponse.json({ error: '展示が1件もありません' }, { status: 400 })
    exhibitId = (ex as { id: string }).id
  }

  // ── 既存モックを削除（冪等性） ─────────────────────────────────
  const { data: allUsers } = await db.auth.admin.listUsers({ perPage: 1000 })
  const existingMocks = (allUsers?.users ?? []).filter(u => u.email?.endsWith(MOCK_SUFFIX))
  if (existingMocks.length > 0) {
    await Promise.all(existingMocks.map(u => db.auth.admin.deleteUser(u.id)))
  }

  // ── 40人のモックユーザーを作成（バッチ10件×4） ────────────────
  const createdUsers: { id: string; email: string; name: string; idx: number }[] = []
  for (let batch = 0; batch < 4; batch++) {
    const batchNames = MOCK_NAMES.slice(batch * 10, (batch + 1) * 10)
    const results = await Promise.all(
      batchNames.map(async (name, i) => {
        const idx   = batch * 10 + i
        const email = `mock-student-${String(idx + 1).padStart(2, '0')}${MOCK_SUFFIX}`
        const { data, error } = await db.auth.admin.createUser({
          email,
          password:      'MockPass1234!',
          email_confirm: true,
          user_metadata: { name },
        })
        if (error) throw new Error(`${name}: ${error.message}`)
        return { id: data.user.id, email, name, idx }
      }),
    )
    createdUsers.push(...results)
  }

  // ── profiles を upsert ─────────────────────────────────────────
  // DB トリガーが既に作成していても上書きで整合性を確保
  await db.from('profiles').upsert(
    createdUsers.map((u, i) => ({
      id:          u.id,
      email:       u.email,
      name:        u.name,
      role:        'student',
      school_type: 'high',
      grade:       4,   // 高1
      class_num:   1,
      student_num: i + 1,
    })),
    { onConflict: 'id' },
  )

  // ── student_exhibits に登録 ────────────────────────────────────
  await db.from('student_exhibits').insert(
    createdUsers.map(u => ({ user_id: u.id, exhibit_id: exhibitId })),
  )

  // ── 既存のシフト設定・コマをリセット ──────────────────────────
  await db.from('shift_settings').delete().eq('exhibit_id', exhibitId)

  // ── 土日それぞれ shift_settings + shift_slots を生成 ──────────
  // 09:00〜17:00, 30分刻み = 16コマ, 必要人数3
  const allInsertedSlots: { id: string; date: string; order_index: number }[] = []

  for (const date of ['sat', 'sun'] as const) {
    const { data: setting, error: sErr } = await db
      .from('shift_settings')
      .insert({
        exhibit_id:       exhibitId,
        date,
        start_time:       '09:00',
        end_time:         '17:00',
        interval_minutes: 30,
        default_required: 3,
        created_by:       user.id,
      })
      .select('id')
      .single()

    if (sErr || !setting) {
      return NextResponse.json({ error: `設定作成エラー(${date}): ${sErr?.message}` }, { status: 500 })
    }

    const settingId = (setting as { id: string }).id
    const slotRows: {
      setting_id: string; exhibit_id: string; date: string
      start_at: string; end_at: string; required_count: number; order_index: number
    }[] = []

    let cur = 9 * 60   // 09:00
    let idx = 0
    while (cur + 30 <= 17 * 60) {
      const fmt = (m: number) =>
        `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
      slotRows.push({
        setting_id:     settingId,
        exhibit_id:     exhibitId,
        date,
        start_at:       fmt(cur),
        end_at:         fmt(cur + 30),
        required_count: 3,
        order_index:    idx++,
      })
      cur += 30
    }

    const { data: insertedSlots, error: slotErr } = await db
      .from('shift_slots').insert(slotRows).select('id, date, order_index')
    if (slotErr) {
      return NextResponse.json({ error: `コマ作成エラー(${date}): ${slotErr.message}` }, { status: 500 })
    }
    allInsertedSlots.push(...((insertedSlots ?? []) as { id: string; date: string; order_index: number }[]))
  }

  // ── shift_preferences を生成 ───────────────────────────────────
  const satSlots = allInsertedSlots.filter(s => s.date === 'sat').sort((a, b) => a.order_index - b.order_index)
  const sunSlots = allInsertedSlots.filter(s => s.date === 'sun').sort((a, b) => a.order_index - b.order_index)
  const totalSlots = satSlots.length  // 16

  const prefRows: { user_id: string; slot_id: string; type: PrefType }[] = []

  for (const u of createdUsers) {
    // 土曜
    for (const slot of satSlots) {
      const pref = mockPref(u.idx, slot.order_index, totalSlots)
      if (pref !== 'neutral') prefRows.push({ user_id: u.id, slot_id: slot.id, type: pref })
    }
    // 日曜（土曜と少しずれたパターンで）
    for (const slot of sunSlots) {
      const pref = mockPref(u.idx + 3, slot.order_index, totalSlots)
      if (pref !== 'neutral') prefRows.push({ user_id: u.id, slot_id: slot.id, type: pref })
    }
  }

  if (prefRows.length > 0) {
    const { error: prefErr } = await db
      .from('shift_preferences').upsert(prefRows, { onConflict: 'user_id,slot_id' })
    if (prefErr) {
      return NextResponse.json({ error: `希望登録エラー: ${prefErr.message}` }, { status: 500 })
    }
  }

  return NextResponse.json({
    ok:           true,
    exhibitId,
    studentCount: createdUsers.length,
    slotCount:    allInsertedSlots.length,
    prefCount:    prefRows.length,
  })
}

// DELETE /api/shift/seed — テストデータを削除
export async function DELETE(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if ((profile as { role: string } | null)?.role !== 'admin')
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { exhibitId?: string }
  const db = serviceDb()

  // モックユーザーを削除（cascade で profiles・student_exhibits・preferences・assignments も消える）
  const { data: allUsers } = await db.auth.admin.listUsers({ perPage: 1000 })
  const mockUsers = (allUsers?.users ?? []).filter(u => u.email?.endsWith(MOCK_SUFFIX))
  if (mockUsers.length > 0) {
    await Promise.all(mockUsers.map(u => db.auth.admin.deleteUser(u.id)))
  }

  // 展示のシフト設定も削除（cascade で shift_slots も消える）
  if (body.exhibitId) {
    await db.from('shift_settings').delete().eq('exhibit_id', body.exhibitId)
  }

  return NextResponse.json({ ok: true, deleted: mockUsers.length })
}
