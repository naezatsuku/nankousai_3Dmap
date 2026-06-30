import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams
  const before       = searchParams.get('before')
  const exhibitId    = searchParams.get('exhibitId')
  const limitParam   = parseInt(searchParams.get('limit') ?? '20')
  const limit        = Math.min(Math.max(limitParam || 20, 1), 50)

  const db = supabase()

  const { data: site } = await db.from('site_settings').select('comment_mode').single()
  if ((site?.comment_mode ?? 'all_on') !== 'all_on') {
    return NextResponse.json({ comments: [] })
  }

  let query = db
    .from('exhibit_comments')
    .select('id, exhibit_id, body, author_name, created_at, exhibit:exhibits(id, name, thumbnail_url, cover_url)')
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (exhibitId) query = query.eq('exhibit_id', exhibitId)
  if (before)    query = query.lt('created_at', before)

  const { data, error } = await query

  if (error) return NextResponse.json({ comments: [] })

  return NextResponse.json({ comments: data ?? [] })
}
