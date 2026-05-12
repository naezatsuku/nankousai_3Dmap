import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Supabase Auth コールバック
 * ・招待メールのリンク（type=invite）
 * ・パスワードリセットのリンク（type=recovery）
 * どちらもここで code を session に変換する
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/admin'
  const error = searchParams.get('error_description')

  // Supabase がエラーを返した場合（例: 期限切れトークン）
  if (error) {
    return NextResponse.redirect(
      `${origin}/admin/login?error=${encodeURIComponent(error)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/admin/login?error=no_code`)
  }

  const supabase = await createClient()
  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeErr) {
    return NextResponse.redirect(
      `${origin}/admin/login?error=${encodeURIComponent(exchangeErr.message)}`
    )
  }

  // セッション確立後、プロフィールの name をチェック
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    // 名前が未設定 = 初回ログイン → ウェルカムページへ
    if (!profile?.name) {
      return NextResponse.redirect(`${origin}/admin/profile?welcome=1`)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
