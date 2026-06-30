import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: Request) {
  const body = await req.json() as { exhibitId: string; userId: string; body: string; authorName?: string }
  const { exhibitId, userId, body: text, authorName } = body

  if (!exhibitId || !userId || !text?.trim()) {
    return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 })
  }

  const db = supabase()
  const { data: site } = await db.from('site_settings').select('comment_mode').single()
  if ((site?.comment_mode ?? 'all_on') === 'all_off') {
    return NextResponse.json({ error: '現在コメント機能は停止中です' }, { status: 403 })
  }

  const row: Record<string, string> = {
    exhibit_id: exhibitId,
    user_id:    userId,
    body:       text.trim().slice(0, 200),
  }
  if (authorName?.trim()) row.author_name = authorName.trim().slice(0, 50)

  const { error } = await db
    .from('exhibit_comments')
    .insert(row)

  if (error) {
    console.error('[exhibit-comment] insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
