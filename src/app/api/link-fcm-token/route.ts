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

// POST /api/link-fcm-token
// ログイン済みユーザーの FCM トークンに user_id を紐付ける（service_role で RLS をバイパス）
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未ログイン' }, { status: 401 })

  const { fcm_token } = await req.json() as { fcm_token: string }
  if (!fcm_token) return NextResponse.json({ error: 'fcm_token が必要です' }, { status: 400 })

  const db = serviceDb()

  // 同じユーザーの古いトークンを削除（重複通知防止）してから新しいトークンを登録
  await db.from('push_subscriptions').delete()
    .eq('user_id', user.id)
    .neq('fcm_token', fcm_token)

  const { error } = await db
    .from('push_subscriptions')
    .upsert({ fcm_token, user_id: user.id }, { onConflict: 'fcm_token' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
