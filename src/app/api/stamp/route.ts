import { NextResponse } from 'next/server'
import { createClient }  from '@supabase/supabase-js'
import { verifyQr }      from '@/lib/stamp'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get('userId')
  if (!userId) return NextResponse.json({ stamps: [] })

  const { data } = await supabase()
    .from('stamps')
    .select('exhibit_id, stamped_at')
    .eq('user_id', userId)

  return NextResponse.json({ stamps: data ?? [] })
}

export async function POST(req: Request) {
  const body = await req.json() as { exhibitId: string; w: string; h: string; userId: string }
  const { exhibitId, w, h, userId } = body

  if (!exhibitId || !w || !h || !userId) {
    return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 })
  }

  const db = supabase()

  const { data: exhibit } = await db
    .from('exhibits')
    .select('stamp_secret, is_stamp_target, name, thumbnail_url')
    .eq('id', exhibitId)
    .single()

  if (!exhibit?.is_stamp_target || !exhibit.stamp_secret) {
    return NextResponse.json({ error: 'この展示はスタンプ対象外です' }, { status: 400 })
  }

  if (!verifyQr(exhibit.stamp_secret, exhibitId, parseInt(w), h)) {
    return NextResponse.json({ error: 'QRコードが無効または期限切れです' }, { status: 400 })
  }

  const { error } = await db.from('stamps').insert({ user_id: userId, exhibit_id: exhibitId })

  if (error?.code === '23505') {
    return NextResponse.json({ already: true, exhibitName: exhibit.name })
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, exhibitName: exhibit.name, thumbnail_url: exhibit.thumbnail_url })
}
