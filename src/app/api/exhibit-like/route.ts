import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: Request) {
  const body = await req.json() as { exhibitId: string; userId: string }
  const { exhibitId, userId } = body

  if (!exhibitId || !userId) {
    return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 })
  }

  const db = supabase()

  // 3クエリを並列実行
  const [
    { count: stampCount },
    { count: userLikeCount },
    { count: totalLikeCount },
  ] = await Promise.all([
    db.from('stamps').select('*', { count: 'exact', head: true })
      .eq('exhibit_id', exhibitId).eq('user_id', userId),
    db.from('exhibit_likes').select('*', { count: 'exact', head: true })
      .eq('exhibit_id', exhibitId).eq('user_id', userId),
    db.from('exhibit_likes').select('*', { count: 'exact', head: true })
      .eq('exhibit_id', exhibitId),
  ])

  if ((stampCount ?? 0) === 0) {
    return NextResponse.json({ error: 'スタンプを取得していない展示にはいいねできません' }, { status: 403 })
  }

  const nowLiked = (userLikeCount ?? 0) === 0
  if (nowLiked) {
    await db.from('exhibit_likes').insert({ exhibit_id: exhibitId, user_id: userId })
  } else {
    await db.from('exhibit_likes').delete()
      .eq('exhibit_id', exhibitId).eq('user_id', userId)
  }

  // 操作後のカウントは取得済みの値から計算（追加クエリ不要）
  const likeCount = (totalLikeCount ?? 0) + (nowLiked ? 1 : -1)

  return NextResponse.json({ liked: nowLiked, likeCount })
}
