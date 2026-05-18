import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: Request) {
  const userId  = new URL(req.url).searchParams.get('userId') ?? ''
  const supabase = db()

  // 設定・ユーザー投票・スタンプ済み展示を並列取得
  const [settingsRes, voteRes, stampsRes] = await Promise.all([
    supabase.from('vote_settings').select('show_ranking').single(),
    userId
      ? supabase.from('votes').select('exhibit_id').eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null }),
    userId
      ? supabase.from('stamps').select('exhibit_id').eq('user_id', userId)
      : Promise.resolve({ data: [] }),
  ])

  const showRanking = settingsRes.data?.show_ranking ?? false

  // スタンプ済み展示 ID（重複排除）
  const stampedIds = [...new Set((stampsRes.data ?? []).map((s: { exhibit_id: string }) => s.exhibit_id))]
  const stampedExhibits: { id: string; name: string; type: string; class_label: string | null }[] = []

  if (stampedIds.length > 0) {
    const { data: exs } = await supabase
      .from('exhibits')
      .select('id, name, type, class_label')
      .in('id', stampedIds)
    if (exs) stampedExhibits.push(...exs as typeof stampedExhibits)
  }

  // 現在の投票先名
  let userVote: { exhibitId: string; exhibitName: string } | null = null
  if (voteRes.data?.exhibit_id) {
    const name = stampedExhibits.find(e => e.id === voteRes.data!.exhibit_id)?.name
    userVote = { exhibitId: voteRes.data.exhibit_id, exhibitName: name ?? '' }
  }

  // ランキング（公開設定が ON のときのみ）
  type RankEntry = { rank: number; exhibitId: string; exhibitName: string }
  let ranking: RankEntry[] = []
  if (showRanking) {
    const { data: allVotes } = await supabase.from('votes').select('exhibit_id')
    if (allVotes) {
      const counts: Record<string, number> = {}
      for (const v of allVotes) counts[v.exhibit_id] = (counts[v.exhibit_id] ?? 0) + 1

      // 展示名を取得
      const ids = Object.keys(counts)
      const { data: exNames } = await supabase.from('exhibits').select('id, name').in('id', ids)
      const nameMap: Record<string, string> = {}
      for (const e of exNames ?? []) nameMap[e.id] = e.name

      ranking = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([id], i) => ({ rank: i + 1, exhibitId: id, exhibitName: nameMap[id] ?? '' }))
    }
  }

  return NextResponse.json({ userVote, stampedExhibits, showRanking, ranking })
}

export async function POST(req: Request) {
  const { userId, exhibitId } = await req.json() as { userId?: string; exhibitId?: string }
  if (!userId || !exhibitId) {
    return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 })
  }

  const supabase = db()

  // スタンプ確認
  const { count } = await supabase
    .from('stamps')
    .select('*', { count: 'exact', head: true })
    .eq('exhibit_id', exhibitId)
    .eq('user_id', userId)

  if ((count ?? 0) === 0) {
    return NextResponse.json({ error: 'この展示にスタンプがありません' }, { status: 403 })
  }

  // 投票を upsert（1人1票・変更可）
  const { error } = await supabase
    .from('votes')
    .upsert({ user_id: userId, exhibit_id: exhibitId }, { onConflict: 'user_id' })

  if (error) {
    console.error('[vote] upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
