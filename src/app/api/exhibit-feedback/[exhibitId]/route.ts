import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: Request, { params }: { params: Promise<{ exhibitId: string }> }) {
  const { exhibitId } = await params
  const searchParams  = new URL(req.url).searchParams
  const userId        = searchParams.get('userId') ?? ''
  const limitParam    = searchParams.get('limit')
  const db            = supabase()

  const commentQuery = db
    .from('exhibit_comments')
    .select('id, body, author_name, created_at')
    .eq('exhibit_id', exhibitId)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })

  if (limitParam) commentQuery.limit(parseInt(limitParam))

  const [commentsRes, likeCountRes, siteRes] = await Promise.all([
    commentQuery,
    db.from('exhibit_likes').select('*', { count: 'exact', head: true }).eq('exhibit_id', exhibitId),
    db.from('site_settings').select('like_count_visible').single(),
  ])

  let userLiked    = false
  let userHasStamp = false
  if (userId) {
    const [likedRes, stampRes] = await Promise.all([
      db.from('exhibit_likes').select('*', { count: 'exact', head: true })
        .eq('exhibit_id', exhibitId).eq('user_id', userId),
      db.from('stamps').select('*', { count: 'exact', head: true })
        .eq('exhibit_id', exhibitId).eq('user_id', userId),
    ])
    userLiked    = (likedRes.count  ?? 0) > 0
    userHasStamp = (stampRes.count ?? 0) > 0
  }

  return NextResponse.json({
    likeCount:     likeCountRes.count ?? 0,
    userLiked,
    userHasStamp,
    showLikeCount: siteRes.data?.like_count_visible ?? true,
    comments:      commentsRes.data ?? [],
  })
}
