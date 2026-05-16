import { NextResponse } from 'next/server'
import { createClient }  from '@supabase/supabase-js'
import { buildQrUrl }    from '@/lib/stamp'

export async function GET(req: Request, { params }: { params: Promise<{ exhibitId: string }> }) {
  const { exhibitId } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data } = await supabase
    .from('exhibits')
    .select('stamp_secret, is_stamp_target')
    .eq('id', exhibitId)
    .single()

  if (!data?.is_stamp_target || !data.stamp_secret) {
    return NextResponse.json({ error: 'not configured' }, { status: 400 })
  }

  const proto   = req.headers.get('x-forwarded-proto') ?? 'https'
  const host    = req.headers.get('host') ?? ''
  const baseUrl = `${proto}://${host}`

  return NextResponse.json({ url: buildQrUrl(baseUrl, exhibitId, data.stamp_secret) })
}
