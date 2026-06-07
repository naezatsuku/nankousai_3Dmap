import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// フィード初期表示・追加読み込み時のバッチ取得
// GET ?ids=id1,id2,...&userId=xxx → { counts: {[noticeId]:number}, liked: string[] }
export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams
  const ids    = (searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const userId = searchParams.get('userId') ?? ''

  if (!ids.length) return NextResponse.json({ counts: {}, liked: [] })

  const db = supabase()

  const [countsRes, likedRes] = await Promise.all([
    db.from('notice_likes').select('notice_id').in('notice_id', ids),
    userId
      ? db.from('notice_likes').select('notice_id').in('notice_id', ids).eq('user_id', userId)
      : Promise.resolve({ data: [] as { notice_id: string }[] }),
  ])

  const counts: Record<string, number> = {}
  for (const row of (countsRes.data ?? []) as { notice_id: string }[]) {
    counts[row.notice_id] = (counts[row.notice_id] ?? 0) + 1
  }
  const liked = ((likedRes.data ?? []) as { notice_id: string }[]).map(r => r.notice_id)

  return NextResponse.json({ counts, liked })
}

// トグル（誰でもいいね可能・スタンプ等の条件なし）
// POST { noticeId, userId } → { liked: boolean, likeCount: number }
export async function POST(req: Request) {
  const body = await req.json() as { noticeId: string; userId: string }
  const { noticeId, userId } = body

  if (!noticeId || !userId) {
    return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 })
  }

  const db = supabase()

  const [{ count: userLikeCount }, { count: totalLikeCount }] = await Promise.all([
    db.from('notice_likes').select('*', { count: 'exact', head: true })
      .eq('notice_id', noticeId).eq('user_id', userId),
    db.from('notice_likes').select('*', { count: 'exact', head: true })
      .eq('notice_id', noticeId),
  ])

  const nowLiked = (userLikeCount ?? 0) === 0
  const { error: writeError } = nowLiked
    ? await db.from('notice_likes').insert({ notice_id: noticeId, user_id: userId })
    : await db.from('notice_likes').delete().eq('notice_id', noticeId).eq('user_id', userId)

  if (writeError) {
    return NextResponse.json({ error: writeError.message }, { status: 500 })
  }

  const likeCount = (totalLikeCount ?? 0) + (nowLiked ? 1 : -1)

  return NextResponse.json({ liked: nowLiked, likeCount })
}
