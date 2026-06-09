import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: Request) {
  const exhibitId = new URL(req.url).searchParams.get('exhibitId')
  const db = supabase()

  if (exhibitId) {
    const { count, error } = await db
      .from('exhibit_push_subs')
      .select('*', { count: 'exact', head: true })
      .eq('exhibit_id', exhibitId)
    if (error) return NextResponse.json({ count: 0 })
    return NextResponse.json({ count: count ?? 0 })
  }

  // 全展示の購読者数を exhibit_id 別に集計して返す
  const { data, error } = await db
    .from('exhibit_push_subs')
    .select('exhibit_id')

  if (error) return NextResponse.json({ counts: {} })

  const counts: Record<string, number> = {}
  for (const row of (data ?? [])) {
    counts[row.exhibit_id] = (counts[row.exhibit_id] ?? 0) + 1
  }
  return NextResponse.json({ counts })
}
