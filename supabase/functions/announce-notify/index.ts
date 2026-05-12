import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAccessToken, sendFCM, type ServiceAccount } from '../_shared/fcm.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { title, body } = await req.json() as { title: string; body: string }

    const sa: ServiceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')!)
    const accessToken = await getAccessToken(sa)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: subs } = await supabase.from('push_subscriptions').select('fcm_token')
    const tokens = (subs ?? []).map((s: { fcm_token: string }) => s.fcm_token)

    let sent = 0
    const invalid: string[] = []

    for (const token of tokens) {
      const status = await sendFCM(accessToken, sa.project_id, token, title, body)
      if (status === 200) {
        sent++
      } else if (status === 400 || status === 404) {
        invalid.push(token)
      }
    }

    // 無効なトークンを削除
    if (invalid.length > 0) {
      await supabase.from('push_subscriptions').delete().in('fcm_token', invalid)
      await supabase.from('exhibit_push_subs').delete().in('fcm_token', invalid)
    }

    return new Response(JSON.stringify({ sent, invalid: invalid.length }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
