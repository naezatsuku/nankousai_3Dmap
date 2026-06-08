'use client'

import PageLoader from '@/components/ui/PageLoader'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { motion, AnimatePresence, useSpring } from 'framer-motion'

// ── 型 ────────────────────────────────────────────────────────
interface MenuItem { id:string; name:string; price:number; stock:number; is_selling:boolean; sold_count:number }
interface Comment  { id:string; user_id:string; body:string; author_name?:string|null; is_approved:boolean; created_at:string }
interface NoticeLikeInfo { id:string; title:string; created_at:string; likeCount:number }
interface ChartBar { id:string; label:string; value:number; sub?:string; highlight?:boolean }

type ExhibitType = 'class'|'food'|'band'|'special'|'cafeteria'
type ChartType  = 'food_rate'|'food_items'|'food_revenue'|'visitors'|'comments'|'likes'
type ChartScope = 'all'|'own'

const CHART_TYPES: { id: ChartType; label: string; icon: string }[] = [
  { id:'food_rate',    label:'フード販売率',   icon:'📊' },
  { id:'food_items',   label:'商品別販売数',   icon:'🍱' },
  { id:'food_revenue', label:'フード売上金額', icon:'💰' },
  { id:'visitors',     label:'来場者数ランキング', icon:'🚶' },
  { id:'comments',     label:'コメント数ランキング', icon:'💬' },
  { id:'likes',        label:'いいね数ランキング',   icon:'❤️' },
]

function fmtTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const calcBtnStyle: React.CSSProperties = {
  width:48, height:48, borderRadius:12, border:'1px solid #e2e8f0',
  background:'#fff', cursor:'pointer', fontSize:22, color:'#64748b',
  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
  boxShadow:'0 1px 3px rgba(0,0,0,0.06)',
}

const compactBtnStyle: React.CSSProperties = {
  width:32, height:32, borderRadius:9, border:'1px solid #e2e8f0',
  background:'#fff', cursor:'pointer', fontSize:16, color:'#64748b',
  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
  boxShadow:'0 1px 3px rgba(0,0,0,0.06)',
}

// ── メインページ ───────────────────────────────────────────────
export default function QuickPage() {
  const { id } = useParams<{ id:string }>()
  const router  = useRouter()

  const [name,          setName]          = useState('')
  const [type,          setType]          = useState<ExhibitType>('class')
  const [isTarget,      setIsTarget]      = useState(false)
  const [hasWait,       setHasWait]       = useState(true)
  const [tpg,           setTpg]           = useState(5)
  const [queueCount,    setQueueCount]    = useState(0)
  const [visitorCount,  setVisitorCount]  = useState(0)
  const visitorCountRef = useRef(visitorCount)
  useEffect(() => { visitorCountRef.current = visitorCount }, [visitorCount])
  const [menus,         setMenus]         = useState<MenuItem[]>([])
  const [comments,      setComments]      = useState<Comment[]>([])
  const [noticeLikes,   setNoticeLikes]   = useState<NoticeLikeInfo[]>([])
  const [likesLoading,  setLikesLoading]  = useState(true)

  const [stampSecret,  setStampSecret]  = useState<string | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [commentsOpen, setCommentsOpen] = useState(true)
  const [qTab,         setQTab]         = useState<'wait'|'qr'|'menu'|'comments'>('wait')
  const [qrFullscreen, setQrFullscreen] = useState(false)

  const [chartType,    setChartType]    = useState<ChartType>('food_rate')
  const [chartScope,   setChartScope]   = useState<ChartScope>('all')
  const [chartBars,    setChartBars]    = useState<ChartBar[]>([])
  const [chartUnit,    setChartUnit]    = useState('')
  const [chartLoading, setChartLoading] = useState(true)

  const isFood  = type === 'food' || type === 'cafeteria'
  const waitMin = Math.max(0, tpg * queueCount)

  // ── データ読み込み ────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/admin/login'); return }

      const { data } = await supabase
        .from('exhibits')
        .select('name, type, is_stamp_target, has_wait_time, wait_minutes, stamp_secret, visitor_count')
        .eq('id', id)
        .single()

      if (data) {
        setName(data.name ?? '')
        setType(data.type as ExhibitType)
        setIsTarget(data.is_stamp_target ?? false)
        setHasWait(data.has_wait_time ?? true)

        setStampSecret(data.stamp_secret ?? null)
        setTpg(5)
        setQueueCount(Math.round((data.wait_minutes ?? 0) / 5))
        setVisitorCount(data.visitor_count ?? 0)
      }

      if (data?.type === 'food' || data?.type === 'cafeteria') {
        const { data: md } = await supabase
          .from('food_menus').select('id, name, price, stock, is_selling, sold_count').eq('exhibit_id', id)
        if (md) setMenus(md as MenuItem[])
      }

      setLoading(false)
    })
  }, [id, router])

  // ── コメント定期取得（30秒ごと） ──────────────────────────────
  const fetchComments = useCallback(() => {
    createClient()
      .from('exhibit_comments')
      .select('id, user_id, body, author_name, is_approved, created_at')
      .eq('exhibit_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setComments(data as Comment[]) })
  }, [id])

  useEffect(() => {
    fetchComments()
    const t = setInterval(fetchComments, 30_000)
    return () => clearInterval(t)
  }, [fetchComments])

  // ── 自分の団体のお知らせ いいね数取得 ────────────────────────
  const fetchNoticeLikes = useCallback(async () => {
    const { data: notices } = await createClient()
      .from('notices')
      .select('id, title, created_at')
      .eq('exhibit_id', id)
      .order('created_at', { ascending: false })

    if (!notices || notices.length === 0) {
      setNoticeLikes([])
      setLikesLoading(false)
      return
    }

    const ids = notices.map(n => n.id)
    try {
      const res  = await fetch(`/api/notice-like?ids=${ids.join(',')}`)
      const json = await res.json() as { counts: Record<string, number> }
      setNoticeLikes(notices.map(n => ({ id: n.id, title: n.title, created_at: n.created_at, likeCount: json.counts[n.id] ?? 0 })))
    } catch {
      setNoticeLikes(notices.map(n => ({ id: n.id, title: n.title, created_at: n.created_at, likeCount: 0 })))
    }
    setLikesLoading(false)
  }, [id])

  useEffect(() => { fetchNoticeLikes() }, [fetchNoticeLikes])

  // ── PC簡単表示：右上グラフのデータ取得（リアルタイム） ────────
  const fetchChartData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setChartLoading(true)
    const supabase = createClient()
    const bars: ChartBar[] = []
    let unit = ''

    try {
      if (chartType === 'food_rate' || chartType === 'food_items' || chartType === 'food_revenue') {
        if (chartScope === 'own') {
          const { data: ms } = await supabase.from('food_menus')
            .select('id, name, price, stock, sold_count').eq('exhibit_id', id)
          ;(ms ?? []).forEach(m => {
            if (chartType === 'food_rate') {
              bars.push({ id: m.id, label: m.name, value: m.stock > 0 ? Math.round((m.sold_count / m.stock) * 1000) / 10 : 0 })
            } else if (chartType === 'food_items') {
              bars.push({ id: m.id, label: m.name, value: m.sold_count })
            } else {
              bars.push({ id: m.id, label: m.name, value: m.price * m.sold_count })
            }
          })
          unit = chartType === 'food_rate' ? '%' : chartType === 'food_revenue' ? '円' : '個'
        } else {
          const [{ data: exs }, { data: ms }] = await Promise.all([
            supabase.from('exhibits').select('id, name, class_label').in('type', ['food', 'cafeteria']),
            supabase.from('food_menus').select('id, exhibit_id, name, price, stock, sold_count'),
          ])
          const exMap = new Map((exs ?? []).map(e => [e.id, e]))

          if (chartType === 'food_items' || chartType === 'food_rate') {
            ;(ms ?? []).forEach(m => {
              const ex = exMap.get(m.exhibit_id)
              if (!ex) return
              const value = chartType === 'food_rate'
                ? (m.stock > 0 ? Math.round((m.sold_count / m.stock) * 1000) / 10 : 0)
                : m.sold_count
              bars.push({ id: m.id, label: `${ex.class_label ?? ex.name} ${m.name}`, value, highlight: m.exhibit_id === id })
            })
            unit = chartType === 'food_rate' ? '%' : '個'
          } else {
            const agg = new Map<string, { revenue:number }>()
            ;(ms ?? []).forEach(m => {
              if (!exMap.has(m.exhibit_id)) return
              const cur = agg.get(m.exhibit_id) ?? { revenue:0 }
              cur.revenue += m.price * m.sold_count
              agg.set(m.exhibit_id, cur)
            })
            agg.forEach((v, exhibitId) => {
              const ex = exMap.get(exhibitId)
              if (!ex) return
              bars.push({ id: exhibitId, label: ex.class_label ?? ex.name, value: v.revenue, highlight: exhibitId === id })
            })
            unit = '円'
          }
        }
      } else if (chartType === 'visitors') {
        if (chartScope === 'own') {
          bars.push({ id, label: name || '自分の団体', value: visitorCountRef.current, highlight: true })
        } else {
          const { data: exs } = await supabase.from('exhibits')
            .select('id, name, class_label, visitor_count')
            .order('visitor_count', { ascending: false })
          ;(exs ?? []).forEach(e => {
            bars.push({ id: e.id, label: e.class_label ?? e.name, value: e.visitor_count ?? 0, highlight: e.id === id })
          })
        }
        unit = '人'
      } else if (chartType === 'comments') {
        if (chartScope === 'own') {
          const { count } = await supabase.from('exhibit_comments')
            .select('id', { count:'exact', head:true }).eq('exhibit_id', id)
          bars.push({ id, label: name || '自分の団体', value: count ?? 0, highlight: true })
        } else {
          const [{ data: exs }, { data: comments }] = await Promise.all([
            supabase.from('exhibits').select('id, name, class_label'),
            supabase.from('exhibit_comments').select('exhibit_id'),
          ])
          const counts = new Map<string, number>()
          ;(comments ?? []).forEach(c => counts.set(c.exhibit_id, (counts.get(c.exhibit_id) ?? 0) + 1))
          ;(exs ?? []).forEach(e => {
            const cnt = counts.get(e.id)
            if (!cnt) return
            bars.push({ id: e.id, label: e.class_label ?? e.name, value: cnt, highlight: e.id === id })
          })
        }
        unit = '件'
      } else if (chartType === 'likes') {
        if (chartScope === 'own') {
          const { data: notices } = await supabase.from('notices').select('id').eq('exhibit_id', id)
          const noticeIds = (notices ?? []).map(n => n.id)
          const { count } = noticeIds.length > 0
            ? await supabase.from('notice_likes').select('id', { count:'exact', head:true }).in('notice_id', noticeIds)
            : { count: 0 }
          bars.push({ id, label: name || '自分の団体', value: count ?? 0, highlight: true })
        } else {
          const [{ data: exs }, { data: notices }, { data: likes }] = await Promise.all([
            supabase.from('exhibits').select('id, name, class_label'),
            supabase.from('notices').select('id, exhibit_id'),
            supabase.from('notice_likes').select('notice_id'),
          ])
          const noticeToExhibit = new Map((notices ?? []).map(n => [n.id, n.exhibit_id]))
          const counts = new Map<string, number>()
          ;(likes ?? []).forEach(l => {
            const exhibitId = noticeToExhibit.get(l.notice_id)
            if (!exhibitId) return
            counts.set(exhibitId, (counts.get(exhibitId) ?? 0) + 1)
          })
          ;(exs ?? []).forEach(e => {
            const cnt = counts.get(e.id)
            if (!cnt) return
            bars.push({ id: e.id, label: e.class_label ?? e.name, value: cnt, highlight: e.id === id })
          })
        }
        unit = '件'
      }
    } catch (err) {
      console.error('[quick chart] fetch error:', err)
    }

    bars.sort((a, b) => b.value - a.value)
    setChartBars(bars.slice(0, 10))
    setChartUnit(unit)
    setChartLoading(false)
  }, [chartType, chartScope, id, name])

  useEffect(() => { fetchChartData() }, [fetchChartData])

  // 来場者数の増減はグラフを再取得せず、自分のバーの値だけをその場で滑らかに更新する
  useEffect(() => {
    if (chartType !== 'visitors' || chartScope !== 'own') return
    setChartBars(prev => prev.map(b => b.id === id ? { ...b, value: visitorCount } : b))
  }, [visitorCount, chartType, chartScope, id])

  // 常に最新の fetchChartData を参照するための ref（チャンネルの張り直しを最小限にする）
  const fetchChartDataRef = useRef(fetchChartData)
  useEffect(() => { fetchChartDataRef.current = fetchChartData }, [fetchChartData])

  // リアルタイム購読：今選択中のグラフが参照するテーブルだけを購読する
  useEffect(() => {
    const tables: string[] =
      chartType === 'visitors' ? ['exhibits'] :
      chartType === 'comments' ? ['exhibit_comments'] :
      chartType === 'likes'    ? ['notice_likes', 'notices'] :
      /* food_rate / food_items / food_revenue */ ['food_menus']

    const supabase = createClient()
    let channel = supabase.channel(`quick-chart-${chartType}-${id}`)
    for (const table of tables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => fetchChartDataRef.current({ silent: true }),
      )
    }
    channel.subscribe((status) => {
      console.log(`[quick chart] realtime(${chartType}) ${tables.join(',')}:`, status)
    })

    return () => { supabase.removeChannel(channel) }
  }, [chartType, id])

  const flashSaved = useCallback(() => {
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }, [])

  // ── 保存系 ───────────────────────────────────────────────────
  const saveWait = async () => {
    setSaving(true)
    await createClient().from('exhibits').update({ has_wait_time: hasWait, wait_minutes: waitMin, visitor_count: visitorCount }).eq('id', id)
    setSaving(false); flashSaved()
  }
  const saveQr = async () => {
    setSaving(true)
    const updates: Record<string, unknown> = { is_stamp_target: isTarget }
    if (isTarget && !stampSecret) {
      const newSecret = crypto.randomUUID()
      updates.stamp_secret = newSecret
      setStampSecret(newSecret)
    }
    await createClient().from('exhibits').update(updates).eq('id', id)
    setSaving(false); flashSaved()
  }
  const saveMenu = async () => {
    setSaving(true)
    const existing = menus.filter(m => !m.id.startsWith('new_'))
    if (existing.length > 0) {
      await createClient().from('food_menus').upsert(
        existing.map(m => ({ id: m.id, exhibit_id: id, name: m.name, price: m.price, stock: m.stock, is_selling: m.is_selling, sold_count: m.sold_count }))
      )
    }
    setSaving(false); flashSaved()
  }

  // ── コメント操作 ─────────────────────────────────────────────
  const approveComment = async (commentId: string) => {
    await createClient().from('exhibit_comments').update({ is_approved: true }).eq('id', commentId)
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_approved: true } : c))
  }
  const deleteComment = async (commentId: string) => {
    await createClient().from('exhibit_comments').delete().eq('id', commentId)
    setComments(prev => prev.filter(c => c.id !== commentId))
  }

  if (loading) {
    return (
      <PageLoader />
    )
  }

  const pendingCount = comments.filter(c => !c.is_approved).length

  const quickTabs = [
    { id:'wait'     as const, icon:'⏱', label:'待ち時間' },
    { id:'qr'       as const, icon:'🎯', label:'QR' },
    ...(isFood ? [{ id:'menu' as const, icon:'🍽', label:'メニュー' }] : []),
    { id:'comments' as const, icon:'💬', label:'コメント', badge: pendingCount },
  ]
  const qTabIndex = Math.max(0, quickTabs.findIndex(t => t.id === qTab))

  return (
    <div style={{ height:'100dvh', display:'flex', flexDirection:'column', background:'#f8fafc', overflow:'hidden' }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .qp-body { flex:1; overflow-y:auto; padding:16px 16px 78px; }
        .qp-wrap { max-width:520px; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
        .qp-col  { display:contents; }
        .qp-pane { display:none; }
        .qp-pane[data-active="true"] { display:block; }
        .qp-pane--fill[data-active="true"] { display:flex; flex-direction:column; gap:16px; }
        .qp-desktop-wrap { display:none; }
        @media (min-width:900px) {
          .qp-body { overflow:hidden; padding:20px 24px; }
          .qp-wrap { display:none; }
          .qp-desktop-wrap {
            display:grid; grid-template-columns:3fr 7fr;
            gap:20px; height:100%;
          }
          .qp-mobile-tabs { display:none !important; }
        }
      `}</style>

      {/* ── ヘッダー ── */}
      <div style={{
        background:'#fff', borderBottom:'1px solid #e2e8f0',
        padding:'0 16px', height:56, flexShrink:0,
        display:'flex', alignItems:'center', gap:12,
      }}>
        <Link href={`/admin/edit/${id}`} style={{
          width:36, height:36, borderRadius:10, background:'#f1f5f9',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:18, color:'#64748b', textDecoration:'none', flexShrink:0,
        }}>←</Link>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#1e293b',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
          <div style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>かんたん更新</div>
        </div>
        {saved && (
          <div style={{ fontSize:12, color:'#10b981', fontWeight:700, fontFamily:"'Kiwi Maru',serif", flexShrink:0 }}>
            ✓ 更新しました
          </div>
        )}
        {isTarget && (
          <button onClick={() => setQrFullscreen(true)} style={{
            display:'flex', alignItems:'center', gap:6, flexShrink:0, whiteSpace:'nowrap',
            padding:'9px 16px', borderRadius:10, border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#a855f7,#7c3aed)', color:'#fff',
            fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
            boxShadow:'0 2px 8px rgba(124,58,237,0.25)',
          }}>
            🎯 QRコードを表示
          </button>
        )}
      </div>

      {/* ── コンテンツ ── */}
      <div className="qp-body">
        <div className={`qp-wrap${commentsOpen ? '' : ' comments-closed'}`}>

          {/* ── 列1：待ち時間 ── */}
          <div className="qp-col">
          <div className="qp-pane" data-active={qTab === 'wait'}>

            <Section label="⏱ 待ち時間">
              <button onClick={() => setHasWait(v => !v)} style={{
                width:'100%', padding:'13px 16px', borderRadius:12, border:'none', cursor:'pointer',
                display:'flex', alignItems:'center', gap:12,
                background: hasWait ? '#f0fdf4' : '#f8fafc',
                boxShadow: hasWait ? 'inset 0 0 0 1.5px #86efac' : 'inset 0 0 0 1.5px #e2e8f0',
                marginBottom:16, transition:'all 0.15s',
              }}>
                <Toggle on={hasWait} />
                <span style={{ fontSize:14, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                  color: hasWait ? '#16a34a' : '#94a3b8' }}>
                  {hasWait ? '待ち時間機能 有効' : '待ち時間機能 無効'}
                </span>
              </button>

              {hasWait && (<>
                <div style={{
                  background:'linear-gradient(135deg,#0f172a,#1e293b)', borderRadius:16, padding:'20px',
                  textAlign:'center', marginBottom:16,
                }}>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>
                    現在の待ち時間
                  </div>
                  <div style={{
                    fontFamily:"'Kaisei Decol',serif", fontSize:72, fontWeight:700, lineHeight:1,
                    color: waitMin>=30?'#fca5a5':waitMin>=15?'#fcd34d':'#86efac',
                  }}>
                    {waitMin}
                  </div>
                  <div style={{ fontSize:16, color:'rgba(255,255,255,0.5)', marginTop:6, fontFamily:"'Kiwi Maru',serif" }}>分</div>
                </div>

                <div style={{ background:'#f8fafc', borderRadius:12, padding:'16px 20px', marginBottom:12 }}>
                  <div style={{ fontSize:11, color:'#94a3b8', marginBottom:12, fontFamily:"'Kiwi Maru',serif", textAlign:'center' }}>
                    待ち組数（1組あたり {tpg} 分）
                  </div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:20 }}>
                    <button onClick={() => setQueueCount(v => Math.max(0, v-1))} style={calcBtnStyle}>−</button>
                    <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:52, fontWeight:700, color:'#1e293b', minWidth:72, textAlign:'center', lineHeight:1 }}>
                      {queueCount}
                    </span>
                    <button onClick={() => setQueueCount(v => v+1)} style={calcBtnStyle}>＋</button>
                  </div>
                  <div style={{ textAlign:'center', marginTop:6, fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>組</div>
                </div>

                <input
                  type="number" min={0} value={queueCount}
                  onChange={e => setQueueCount(Number(e.target.value))}
                  style={{ width:'100%', padding:'11px', borderRadius:10, border:'1px solid #e2e8f0',
                    fontSize:15, fontFamily:"'Kaisei Decol',serif", boxSizing:'border-box',
                    textAlign:'center', color:'#1e293b', outline:'none', marginBottom:12 }}
                />
              </>)}

              <div style={{ background:'#fff7ed', borderRadius:12, padding:'16px 20px', marginBottom:12, border:'1px solid #fde68a' }}>
                <div style={{ fontSize:11, color:'#92400e', marginBottom:12, fontFamily:"'Kiwi Maru',serif", textAlign:'center', fontWeight:700 }}>
                  🚶 来場者数
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:20 }}>
                  <button onClick={() => setVisitorCount(v => Math.max(0, v-1))} style={calcBtnStyle}>−</button>
                  <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:40, fontWeight:700, color:'#1e293b', minWidth:90, textAlign:'center', lineHeight:1 }}>
                    {visitorCount}
                  </span>
                  <button onClick={() => setVisitorCount(v => v+1)} style={calcBtnStyle}>＋</button>
                </div>
                <div style={{ textAlign:'center', marginTop:6, fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>人</div>
              </div>

              <SaveBtn onClick={saveWait} saving={saving} saved={saved} label="待ち時間を更新する" />
            </Section>

          </div>
          </div>

          {/* ── 列2：スタンプ QR ＋ メニュー ── */}
          <div className="qp-col">
          <div className="qp-pane" data-active={qTab === 'qr'}>

            <Section label="🎯 スタンプ QR">
              <button onClick={() => setIsTarget(v => !v)} style={{
                width:'100%', padding:'13px 16px', borderRadius:12, border:'none', cursor:'pointer',
                display:'flex', alignItems:'center', gap:12,
                background: isTarget ? '#fdf4ff' : '#f8fafc',
                boxShadow: isTarget ? 'inset 0 0 0 1.5px #a855f7' : 'inset 0 0 0 1.5px #e2e8f0',
                marginBottom:12, transition:'all 0.15s',
              }}>
                <Toggle on={isTarget} color="#a855f7" />
                <span style={{ fontSize:14, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                  color: isTarget ? '#7c3aed' : '#94a3b8' }}>
                  {isTarget ? 'スタンプラリー 参加中' : 'スタンプラリー 不参加'}
                </span>
              </button>
              <button onClick={saveQr} disabled={saving} style={{
                width:'100%', padding:'14px', borderRadius:12, border:'none', cursor:'pointer',
                background: saved ? '#10b981' : 'linear-gradient(135deg,#a855f7,#7c3aed)',
                color:'#fff', fontSize:15, fontWeight:700,
                fontFamily:"'Kaisei Decol',serif", transition:'background 0.3s',
                boxShadow:'0 4px 14px rgba(124,58,237,0.3)', marginBottom: isTarget ? 16 : 0,
              }}>
                {saving ? '保存中…' : saved ? '✓ 保存しました' : '設定を保存する'}
              </button>
              {isTarget && <QrDisplay exhibitId={id} />}
            </Section>

          </div>

          {/* メニュー（フードのみ） */}
          {isFood && (
          <div className="qp-pane" data-active={qTab === 'menu'}>
              <Section label="🍽 メニュー">
                {menus.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'24px 0', color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
                    メニューが登録されていません
                  </div>
                ) : (
                  <div style={{ background:'#f8fafc', borderRadius:12, padding:'4px 16px', marginBottom:12 }}>
                    {menus.map((menu, i) => (
                      <div key={menu.id} style={{ padding:'14px 0', borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
                          <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700, color:'#1e293b' }}>
                            {menu.name}
                          </span>
                          <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:13, fontWeight:700, color:'#FF6B00', flexShrink:0, marginLeft:8 }}>
                            ¥{menu.price.toLocaleString()}
                          </span>
                        </div>
                        <button
                          onClick={() => setMenus(ms => ms.map(m => m.id===menu.id ? {...m,is_selling:!m.is_selling} : m))}
                          style={{
                            width:'100%', padding:'11px', borderRadius:10, border:'none', cursor:'pointer',
                            background: menu.is_selling ? '#f0fdf4' : '#f5f5f5',
                            color: menu.is_selling ? '#16a34a' : '#94a3b8',
                            fontWeight:700, fontSize:13, fontFamily:"'Kiwi Maru',serif",
                            boxShadow: menu.is_selling ? 'inset 0 0 0 1.5px #86efac' : 'inset 0 0 0 1.5px #e2e8f0',
                            marginBottom:8,
                          }}
                        >
                          {menu.is_selling ? '✓ 販売中' : '✗ 販売停止'}
                        </button>
                        <div style={{ display:'flex', alignItems:'center', gap:10, background:'#fff8f0', borderRadius:10, padding:'8px 14px', border:'1px solid #fde68a' }}>
                          <span style={{ flex:1, fontSize:11, color:'#92400e', fontFamily:"'Kiwi Maru',serif", fontWeight:700 }}>販売数</span>
                          <button onClick={() => setMenus(ms => ms.map(m => m.id===menu.id ? {...m,sold_count:Math.max(0,m.sold_count-1)} : m))} style={calcBtnStyle}>−</button>
                          <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:26, fontWeight:700, color:'#FF6B00', minWidth:44, textAlign:'center' }}>
                            {menu.sold_count}
                          </span>
                          <button onClick={() => setMenus(ms => ms.map(m => m.id===menu.id ? {...m,sold_count:m.sold_count+1} : m))} style={calcBtnStyle}>＋</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <SaveBtn onClick={saveMenu} saving={saving} saved={saved} label="メニューを更新する" disabled={menus.length===0} />
              </Section>
          </div>
          )}

          </div>

          {/* ── 列3（1fr）：コメント承認 ── */}
          <div className={`qp-col qp-col-comments${commentsOpen ? '' : ' closed'}`}>
          <div className="qp-pane qp-pane--fill" data-active={qTab === 'comments'}>

            <Section label="❤️ お知らせの反応（いいね数）">
              {likesLoading ? (
                <div style={{ textAlign:'center', padding:'24px 0', color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
                  読み込み中…
                </div>
              ) : noticeLikes.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px 0', color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
                  まだお知らせを投稿していません
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {noticeLikes.map(n => (
                    <div key={n.id} style={{
                      display:'flex', alignItems:'center', gap:10,
                      background:'#fff8f4', borderRadius:12, padding:'10px 14px',
                      border:'1px solid rgba(255,107,0,0.12)',
                    }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{
                          fontSize:13, fontWeight:700, color:'#1e293b', fontFamily:"'Kaisei Decol',serif",
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                        }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize:10, color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif" }}>
                          {fmtTime(n.created_at)}
                        </div>
                      </div>
                      <div style={{
                        display:'flex', alignItems:'center', gap:5, flexShrink:0,
                        color:'#FF6B00', fontFamily:"'Kiwi Maru',serif", fontWeight:700, fontSize:14,
                      }}>
                        <span style={{ fontSize:17, lineHeight:1 }}>♥</span>
                        <span>{n.likeCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section
              label={`💬 コメント${pendingCount > 0 ? `（承認待ち ${pendingCount} 件）` : ''}`}
              accent={pendingCount > 0}
              fill
              collapsible
              open={commentsOpen}
              onToggle={() => setCommentsOpen(v => !v)}
            >
              <div style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:12 }}>
                30秒ごとに自動更新
              </div>
              {comments.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px 0', color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
                  コメントはまだありません
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {comments.map((c, i) => (
                    <div key={c.id} style={{
                      display:'flex', gap:10, borderRadius:14, padding:'13px 14px',
                      border: c.is_approved ? '1px solid #f1f5f9' : '1px solid #fde68a',
                      background: c.is_approved ? '#fff' : '#fffbeb',
                      animation: `fadeUp ${Math.min(0.05 + i * 0.04, 0.4)}s ease both`,
                    }}>
                      {/* アバター（承認状態を視覚化） */}
                      <div style={{
                        width:36, height:36, borderRadius:'50%', flexShrink:0,
                        background: c.is_approved
                          ? 'linear-gradient(135deg,#dcfce7,#bbf7d0)'
                          : 'linear-gradient(135deg,#fef3c7,#fde68a)',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:15,
                      }}>
                        {c.is_approved ? '✓' : '⏳'}
                      </div>

                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' }}>
                          <span style={{ fontSize:12, fontWeight:700, color:'#475569', fontFamily:"'Kiwi Maru',serif" }}>
                            {c.author_name?.trim() || 'ゲスト'}
                          </span>
                          <span style={{
                            fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:99,
                            fontFamily:"'Kiwi Maru',serif", letterSpacing:'0.05em',
                            background: c.is_approved ? 'linear-gradient(135deg,#22c55e,#16a34a)' : '#fef9c3',
                            color: c.is_approved ? '#fff' : '#92400e',
                          }}>
                            {c.is_approved ? '✓ 承認済み' : '⏳ 承認待ち'}
                          </span>
                          <span style={{ fontSize:10, color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif", marginLeft:'auto' }}>
                            {fmtTime(c.created_at)}
                          </span>
                        </div>

                        <p style={{ fontSize:13, color:'#374151', fontFamily:"'Kiwi Maru',serif", lineHeight:1.6, margin:'0 0 8px' }}>
                          {c.body}
                        </p>

                        <div style={{ display:'flex', gap:6 }}>
                          {!c.is_approved && (
                            <button onClick={() => approveComment(c.id)} style={{
                              padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer',
                              background:'#16a34a', color:'#fff',
                              fontSize:11, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                            }}>承認</button>
                          )}
                          <button onClick={() => deleteComment(c.id)} style={{
                            padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer',
                            background:'#fee2e2', color:'#dc2626',
                            fontSize:11, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                          }}>削除</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
          </div>

        </div>

        {/* ══════════ PC用レイアウト（左30% / 右70%） ══════════ */}
        <div className="qp-desktop-wrap">

          {/* ── 左列（30%）：待ち時間（コンパクト・上から35%まで）＋ メニュー ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:16, height:'100%', overflow:'hidden', minWidth:0 }}>

            <div style={{ flex:'0 0 35%', minHeight:0, overflow:'hidden' }}>
              <Section label="⏱ 待ち時間" fill>
                <button onClick={() => setHasWait(v => !v)} style={{
                  width:'100%', padding:'10px 14px', borderRadius:10, border:'none', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:10,
                  background: hasWait ? '#f0fdf4' : '#f8fafc',
                  boxShadow: hasWait ? 'inset 0 0 0 1.5px #86efac' : 'inset 0 0 0 1.5px #e2e8f0',
                  marginBottom:10, transition:'all 0.15s', flexShrink:0,
                }}>
                  <Toggle on={hasWait} />
                  <span style={{ fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                    color: hasWait ? '#16a34a' : '#94a3b8' }}>
                    {hasWait ? '待ち時間機能 有効' : '待ち時間機能 無効'}
                  </span>
                </button>

                {hasWait && (
                  <div style={{
                    display:'flex', alignItems:'center', gap:14,
                    background:'#f8fafc', borderRadius:12, padding:'10px 16px', marginBottom:10, flexShrink:0,
                  }}>
                    <div style={{ textAlign:'center', flexShrink:0 }}>
                      <div style={{ fontSize:9, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", whiteSpace:'nowrap' }}>現在の待ち時間</div>
                      <div style={{
                        fontFamily:"'Kaisei Decol',serif", fontSize:32, fontWeight:700, lineHeight:1.1,
                        color: waitMin>=30?'#dc2626':waitMin>=15?'#d97706':'#16a34a',
                      }}>
                        {waitMin}<span style={{ fontSize:13, marginLeft:2 }}>分</span>
                      </div>
                    </div>
                    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:10, minWidth:0 }}>
                      <button onClick={() => setQueueCount(v => Math.max(0, v-1))} style={compactBtnStyle}>−</button>
                      <div style={{ textAlign:'center', minWidth:36 }}>
                        <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:24, fontWeight:700, color:'#1e293b', lineHeight:1 }}>{queueCount}</div>
                        <div style={{ fontSize:9, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>組待ち（{tpg}分/組）</div>
                      </div>
                      <button onClick={() => setQueueCount(v => v+1)} style={compactBtnStyle}>＋</button>
                    </div>
                  </div>
                )}

                <div style={{
                  display:'flex', alignItems:'center', gap:14,
                  background:'#fff7ed', borderRadius:12, padding:'10px 16px', marginBottom:10, flexShrink:0,
                  border:'1px solid #fde68a',
                }}>
                  <div style={{ textAlign:'center', flexShrink:0 }}>
                    <div style={{ fontSize:9, color:'#92400e', fontFamily:"'Kiwi Maru',serif", whiteSpace:'nowrap', fontWeight:700 }}>来場者数</div>
                    <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:24, fontWeight:700, lineHeight:1.1, color:'#1e293b' }}>
                      {visitorCount}<span style={{ fontSize:11, marginLeft:2 }}>人</span>
                    </div>
                  </div>
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:10, minWidth:0 }}>
                    <button onClick={() => setVisitorCount(v => Math.max(0, v-1))} style={compactBtnStyle}>−</button>
                    <button onClick={() => setVisitorCount(v => v+1)} style={compactBtnStyle}>＋</button>
                  </div>
                </div>

                <SaveBtn onClick={saveWait} saving={saving} saved={saved} label="更新する" />
              </Section>
            </div>

            {isFood && (
              <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                <Section label="🍽 メニュー" fill>
                  {menus.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'24px 0', color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
                      メニューが登録されていません
                    </div>
                  ) : (
                    <div style={{ background:'#f8fafc', borderRadius:12, padding:'4px 16px', marginBottom:12 }}>
                      {menus.map((menu, i) => (
                        <div key={menu.id} style={{ padding:'14px 0', borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
                            <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700, color:'#1e293b' }}>
                              {menu.name}
                            </span>
                            <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:13, fontWeight:700, color:'#FF6B00', flexShrink:0, marginLeft:8 }}>
                              ¥{menu.price.toLocaleString()}
                            </span>
                          </div>
                          <button
                            onClick={() => setMenus(ms => ms.map(m => m.id===menu.id ? {...m,is_selling:!m.is_selling} : m))}
                            style={{
                              width:'100%', padding:'11px', borderRadius:10, border:'none', cursor:'pointer',
                              background: menu.is_selling ? '#f0fdf4' : '#f5f5f5',
                              color: menu.is_selling ? '#16a34a' : '#94a3b8',
                              fontWeight:700, fontSize:13, fontFamily:"'Kiwi Maru',serif",
                              boxShadow: menu.is_selling ? 'inset 0 0 0 1.5px #86efac' : 'inset 0 0 0 1.5px #e2e8f0',
                              marginBottom:8,
                            }}
                          >
                            {menu.is_selling ? '✓ 販売中' : '✗ 販売停止'}
                          </button>
                          <div style={{ display:'flex', alignItems:'center', gap:10, background:'#fff8f0', borderRadius:10, padding:'8px 14px', border:'1px solid #fde68a' }}>
                            <span style={{ flex:1, fontSize:11, color:'#92400e', fontFamily:"'Kiwi Maru',serif", fontWeight:700 }}>販売数</span>
                            <button onClick={() => setMenus(ms => ms.map(m => m.id===menu.id ? {...m,sold_count:Math.max(0,m.sold_count-1)} : m))} style={compactBtnStyle}>−</button>
                            <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#FF6B00', minWidth:36, textAlign:'center' }}>
                              {menu.sold_count}
                            </span>
                            <button onClick={() => setMenus(ms => ms.map(m => m.id===menu.id ? {...m,sold_count:m.sold_count+1} : m))} style={compactBtnStyle}>＋</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <SaveBtn onClick={saveMenu} saving={saving} saved={saved} label="メニューを更新する" disabled={menus.length===0} />
                </Section>
              </div>
            )}
          </div>

          {/* ── 右列（70%）：上＝グラフ／下＝プレースホルダー ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:20, height:'100%', minWidth:0 }}>
            <div style={{
              flex:1, minHeight:0, borderRadius:16, background:'#fff',
              border:'1px solid #f1f5f9', boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
              display:'flex', flexDirection:'column', overflow:'hidden', padding:'14px 18px',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
                <select
                  value={chartType}
                  onChange={e => setChartType(e.target.value as ChartType)}
                  style={{
                    fontSize:12, fontFamily:"'Kiwi Maru',serif", color:'#1e293b',
                    border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 10px',
                    background:'#fff', cursor:'pointer', outline:'none',
                  }}
                >
                  {CHART_TYPES.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                  ))}
                </select>

                <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:'1px solid #e2e8f0', marginLeft:'auto' }}>
                  {(['all','own'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setChartScope(s)}
                      style={{
                        padding:'6px 12px', border:'none', cursor:'pointer',
                        fontSize:11, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                        background: chartScope === s ? 'linear-gradient(135deg,#FF6B00,#FFB347)' : '#fff',
                        color: chartScope === s ? '#fff' : '#94a3b8',
                        transition:'all 0.15s',
                      }}
                    >
                      {s === 'all' ? '全クラス' : '自分のクラス'}
                    </button>
                  ))}
                </div>
              </div>

              <BarChart bars={chartBars} unit={chartUnit} loading={chartLoading} />
            </div>
            <div style={{
              flex:1, minHeight:0, borderRadius:16, border:'2px dashed #e2e8f0',
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'#cbd5e1', fontSize:13, fontFamily:"'Kiwi Maru',serif",
            }}>
              準備中
            </div>
          </div>

        </div>
      </div>

      {/* ── モバイル用タブ（下部固定バー / main の TabBar 準拠） ── */}
      <nav className="qp-mobile-tabs" style={{
        position:'fixed', left:0, right:0, bottom:0, zIndex:50,
        display:'flex', alignItems:'center',
        background:'rgba(255,255,255,0.97)',
        backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
        borderTop:'1px solid rgba(255,140,0,0.10)',
        padding:'6px 0 max(6px, env(safe-area-inset-bottom))',
      }}>
        {/* スライドインジケーター */}
        <div style={{
          position:'absolute', top:0, height:2.5,
          width:`${100 / quickTabs.length}%`,
          background:'linear-gradient(90deg,#FF6B00,#FFB347)',
          borderRadius:'0 0 4px 4px',
          left:`${qTabIndex * (100 / quickTabs.length)}%`,
          transition:'left 0.32s cubic-bezier(0.34,1.3,0.64,1)',
        }} />

        {quickTabs.map(({ id, icon, label, badge }) => {
          const active = qTab === id
          return (
            <button key={id} onClick={() => setQTab(id)} style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              background:'none', border:'none', cursor:'pointer', padding:'4px 0',
              transition:'transform 0.15s ease',
              transform: active ? 'translateY(-1px)' : 'translateY(0)',
            }} aria-label={label}>
              <div style={{ position:'relative', display:'inline-flex' }}>
                <span style={{ fontSize:20, filter: active ? 'none' : 'grayscale(1) opacity(0.55)', transition:'filter 0.2s' }}>
                  {icon}
                </span>
                {!!badge && badge > 0 && (
                  <div style={{
                    position:'absolute', top:-4, right:-7,
                    background:'#F44336', color:'#fff',
                    fontSize:9, fontWeight:'bold', width:16, height:16, borderRadius:'50%',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    border:'2px solid #fff', fontFamily:'sans-serif', lineHeight:1,
                  }}>
                    {badge > 9 ? '9+' : badge}
                  </div>
                )}
              </div>
              <span style={{
                fontSize:10, fontFamily:"'Kiwi Maru',serif",
                color: active ? '#FF6B00' : '#bbb',
                fontWeight: active ? 'bold' : 'normal',
                transition:'color 0.2s',
              }}>
                {label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* ── QRコード全画面表示 ── */}
      {qrFullscreen && isTarget && (
        <div style={{
          position:'fixed', inset:0, zIndex:300,
          background:'linear-gradient(135deg,#fdf4ff,#f5f3ff)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:28,
          animation:'fadeUp 0.2s ease both',
        }}>
          <button onClick={() => setQrFullscreen(false)} style={{
            position:'absolute', top:20, right:20,
            width:44, height:44, borderRadius:14, border:'none', cursor:'pointer',
            background:'#fff', color:'#64748b', fontSize:18,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 2px 10px rgba(0,0,0,0.08)',
          }} aria-label="閉じる">✕</button>

          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:13, color:'#a855f7', fontWeight:700, fontFamily:"'Kiwi Maru',serif", letterSpacing:'0.05em', marginBottom:6 }}>
              🎯 スタンプ QR
            </div>
            <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#1e293b' }}>
              {name}
            </div>
          </div>

          <QrDisplay exhibitId={id} size={320} />
        </div>
      )}
    </div>
  )
}

// ── 共通コンポーネント ─────────────────────────────────────────
function Section({ label, children, accent, fill, collapsible, open = true, onToggle }: {
  label: string; children: React.ReactNode
  accent?: boolean; fill?: boolean
  collapsible?: boolean; open?: boolean; onToggle?: () => void
}) {
  return (
    <div style={fill ? { display:'flex', flexDirection:'column', flex:1, overflow:'hidden' } : undefined}>
      {collapsible && !open ? (
        /* 折りたたみ中：縦向きスリムタブ */
        <button
          onClick={onToggle}
          style={{
            all: 'unset', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8,
            background: accent ? '#fffbeb' : '#fff',
            border: accent ? '1px solid #fde68a' : '1px solid #f1f5f9',
            borderRadius: 16, padding: '16px 10px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            fontSize: 11, fontWeight: 700,
            color: accent ? '#d97706' : '#94a3b8',
            fontFamily: "'Kiwi Maru',serif",
            letterSpacing: '0.05em',
            writingMode: 'vertical-rl',
            width: '100%', height: '100%', boxSizing: 'border-box' as const,
          }}
        >
          <span style={{ fontSize: 9 }}>▶</span>
          {label}
        </button>
      ) : (
        <>
          <div
            onClick={collapsible ? onToggle : undefined}
            style={{
              fontSize:11, fontWeight:700, color: accent ? '#d97706' : '#94a3b8',
              fontFamily:"'Kiwi Maru',serif", letterSpacing:'0.05em', marginBottom:10,
              flexShrink:0, display:'flex', alignItems:'center', gap:6,
              cursor: collapsible ? 'pointer' : 'default',
              userSelect: 'none' as const,
            }}
          >
            <span style={{ flex:1 }}>{label}</span>
            {collapsible && <span style={{ fontSize:10 }}>▼</span>}
          </div>
          <div style={{
            background:'#fff', borderRadius:16, padding:'16px',
            boxShadow:'0 1px 3px rgba(0,0,0,0.06)',
            border: accent ? '1px solid #fde68a' : '1px solid #f1f5f9',
            ...(fill ? { flex:1, overflowY:'auto' as const } : {}),
          }}>
            {children}
          </div>
        </>
      )}
    </div>
  )
}

function Toggle({ on, color = '#22c55e' }: { on: boolean; color?: string }) {
  return (
    <div style={{
      width:44, height:24, borderRadius:99, flexShrink:0, position:'relative',
      background: on ? color : '#cbd5e1', transition:'background 0.2s',
    }}>
      <div style={{
        position:'absolute', top:3, borderRadius:'50%', width:18, height:18, background:'#fff',
        left: on ? 23 : 3, transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  )
}

function SaveBtn({ onClick, saving, saved, label, disabled }: {
  onClick: () => void; saving: boolean; saved: boolean; label: string; disabled?: boolean
}) {
  return (
    <button onClick={onClick} disabled={saving || disabled} style={{
      width:'100%', padding:'14px', borderRadius:12, border:'none', cursor:'pointer',
      background: saved ? '#10b981' : (disabled ? '#e2e8f0' : 'linear-gradient(135deg,#FF6B00,#FFAA28)'),
      color: disabled ? '#94a3b8' : '#fff', fontSize:15, fontWeight:700,
      fontFamily:"'Kaisei Decol',serif", transition:'background 0.3s',
      boxShadow: disabled ? 'none' : '0 4px 14px rgba(255,107,0,0.25)',
    }}>
      {saving ? '更新中…' : saved ? '✓ 更新しました' : label}
    </button>
  )
}

// ── QR 表示 ───────────────────────────────────────────────────
function QrDisplay({ exhibitId, size = 240 }: { exhibitId: string; size?: number }) {
  const [qrUrl,  setQrUrl]  = React.useState<string | null>(null)
  const [qrErr,  setQrErr]  = React.useState(false)
  const [QrComp, setQrComp] = React.useState<React.ComponentType<{ value:string; size:number }> | null>(null)

  React.useEffect(() => {
    import('qrcode.react').then(m => setQrComp(() => m.QRCodeSVG as React.ComponentType<{ value:string; size:number }>))
  }, [])

  React.useEffect(() => {
    const load = async () => {
      try {
        const res  = await fetch(`/api/stamp-qr/${exhibitId}`)
        const json = await res.json() as { url?:string }
        if (json.url) { setQrUrl(json.url); setQrErr(false) }
        else setQrErr(true)
      } catch { setQrErr(true) }
    }
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [exhibitId])

  if (qrErr) return (
    <div style={{ color:'#f87171', fontSize:13, fontFamily:"'Kiwi Maru',serif", padding:'16px', textAlign:'center' }}>
      QR の取得に失敗しました
    </div>
  )
  if (!qrUrl || !QrComp) return (
    <PageLoader />
  )
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:11, color:'#94a3b8', marginBottom:12, fontFamily:"'Kiwi Maru',serif" }}>
        来場者にこの QR を読み取ってもらいます（60秒ごとに更新）
      </div>
      <div style={{ display:'inline-block', padding:16, background:'#fff',
        borderRadius:16, boxShadow:'0 2px 16px rgba(0,0,0,0.1)' }}>
        <QrComp value={qrUrl} size={size} />
      </div>
    </div>
  )
}

// ── 数値カウントアップ／ダウン表示 ─────────────────────────────
function AnimatedNumber({ value, unit }: { value: number; unit: string }) {
  const spring = useSpring(value, { stiffness: 120, damping: 20, mass: 0.6 })
  const [display, setDisplay] = useState(value)

  useEffect(() => { spring.set(value) }, [value, spring])
  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => setDisplay(latest))
    return unsubscribe
  }, [spring])

  const rounded = Number.isInteger(value) ? Math.round(display) : Math.round(display * 10) / 10
  return <>{rounded.toLocaleString()}{unit}</>
}

// ── 棒グラフ（カスタム実装・ライブラリ未使用） ─────────────────
function BarChart({ bars, unit, loading }: { bars: ChartBar[]; unit: string; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
        color:'#cbd5e1', fontSize:12, fontFamily:"'Kiwi Maru',serif" }}>
        読み込み中…
      </div>
    )
  }
  if (bars.length === 0) {
    return (
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
        color:'#cbd5e1', fontSize:12, fontFamily:"'Kiwi Maru',serif" }}>
        データがありません
      </div>
    )
  }

  const max = Math.max(...bars.map(b => b.value), 1)

  return (
    <div style={{ flex:1, minHeight:0, overflowX:'auto', overflowY:'hidden', display:'flex', alignItems:'flex-end', gap:14, padding:'4px 6px 2px' }}>
      <AnimatePresence initial={false}>
        {bars.map(b => (
          <motion.div
            key={b.id}
            layout
            initial={{ opacity:0, scale:0.85 }}
            animate={{ opacity:1, scale:1 }}
            exit={{ opacity:0, scale:0.85 }}
            transition={{ type:'spring', stiffness:300, damping:28 }}
            style={{
              flex:'0 0 56px', height:'100%', display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'flex-end', gap:6,
            }}
          >
            <motion.div
              layout
              style={{
                fontSize:11.5, fontFamily:"'Kaisei Decol',serif", fontWeight:700, lineHeight:1.2,
                color: b.highlight ? '#FF6B00' : '#1e293b', whiteSpace:'nowrap',
              }}
            >
              <AnimatedNumber value={b.value} unit={unit} />
            </motion.div>

            <div style={{ flex:1, width:'100%', minHeight:0, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
              <motion.div
                layout
                initial={false}
                animate={{ height:`${Math.max(2, (b.value / max) * 100)}%` }}
                transition={{ type:'spring', stiffness:260, damping:26 }}
                style={{
                  width:30, borderRadius:'7px 7px 0 0',
                  background: b.highlight
                    ? 'linear-gradient(180deg,#FFB347,#FF6B00)'
                    : 'linear-gradient(180deg,#cbd5e1,#94a3b8)',
                }}
              />
            </div>

            <motion.div
              layout
              style={{
                fontSize:10.5, fontFamily:"'Kiwi Maru',serif",
                color: b.highlight ? '#FF6B00' : '#64748b',
                fontWeight: b.highlight ? 700 : 400,
                textAlign:'center', lineHeight:1.3,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%',
              }}
              title={b.label}
            >
              {b.label}
            </motion.div>
            {b.sub && (
              <motion.div layout style={{ fontSize:8, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", lineHeight:1.2, whiteSpace:'nowrap' }}>
                {b.sub}
              </motion.div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
