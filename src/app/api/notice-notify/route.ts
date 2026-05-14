import { NextResponse }                      from 'next/server'
import { createClient }                      from '@supabase/supabase-js'
import { parseSA, getAccessToken, sendFCM }  from '@/lib/fcm'

export async function POST(req: Request) {
  try {
    const { title, body, senderName, exhibitId } =
      await req.json() as { title: string; body: string; senderName?: string; exhibitId: string }

    const notifTitle = senderName ? `📣 ${senderName}` : '📣 新しいお知らせ'
    const notifBody  = [title, body].filter(Boolean).join('\n')

    const sa          = parseSA()
    const accessToken = await getAccessToken(sa)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    // その展示を購読しているユーザーのみに送信
    const { data: subs } = await supabase
      .from('exhibit_push_subs')
      .select('fcm_token')
      .eq('exhibit_id', exhibitId)
    const tokens = (subs ?? []).map((s: { fcm_token: string }) => s.fcm_token)

    let sent = 0
    const invalid: string[] = []

    for (const token of tokens) {
      const status = await sendFCM(accessToken, sa.project_id, token, notifTitle, notifBody)
      if (status === 200) {
        sent++
      } else if (status === 400 || status === 404) {
        invalid.push(token)
      }
    }

    if (invalid.length > 0) {
      await supabase.from('exhibit_push_subs').delete().in('fcm_token', invalid)
      await supabase.from('push_subscriptions').delete().in('fcm_token', invalid)
    }

    return NextResponse.json({ sent, invalid: invalid.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
