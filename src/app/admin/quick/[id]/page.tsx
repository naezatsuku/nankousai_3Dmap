'use client'

import PageLoader from '@/components/ui/PageLoader'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// ── 型 ────────────────────────────────────────────────────────
interface MenuItem { id:string; name:string; price:number; stock:number; is_selling:boolean; sold_count:number }
interface Comment  { id:string; user_id:string; body:string; author_name?:string|null; is_approved:boolean; created_at:string }
interface NoticeLikeInfo { id:string; title:string; created_at:string; likeCount:number }

type ExhibitType = 'class'|'food'|'band'|'special'|'cafeteria'

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

  const isFood  = type === 'food' || type === 'cafeteria'
  const waitMin = Math.max(0, tpg * queueCount)

  // ── データ読み込み ────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/admin/login'); return }

      const { data } = await supabase
        .from('exhibits')
        .select('name, type, is_stamp_target, has_wait_time, wait_minutes, stamp_secret')
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

  const flashSaved = useCallback(() => {
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }, [])

  // ── 保存系 ───────────────────────────────────────────────────
  const saveWait = async () => {
    setSaving(true)
    await createClient().from('exhibits').update({ has_wait_time: hasWait, wait_minutes: waitMin }).eq('id', id)
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
        @media (min-width:900px) {
          .qp-body { overflow:hidden; padding:20px 24px; }
          .qp-wrap {
            display:grid; grid-template-columns:2fr 2fr 1fr;
            gap:20px; height:100%; max-width:none; align-items:stretch;
            transition: grid-template-columns 0.25s ease;
          }
          .qp-wrap.comments-closed { grid-template-columns:1fr 1fr auto; }
          .qp-col { display:flex; flex-direction:column; gap:16px; overflow-y:auto; padding-bottom:16px; min-width:0; }
          .qp-col-comments { overflow:hidden; padding-bottom:0; }
          .qp-col-comments.closed { overflow:visible; }
          .qp-pane { display:block !important; }
          .qp-pane--fill { display:flex !important; flex-direction:column; gap:16px; flex:1; min-height:0; overflow:hidden; }
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
                        <div style={{ display:'flex', alignItems:'center', gap:10, background:'#fff', borderRadius:10, padding:'8px 14px', marginBottom:6 }}>
                          <span style={{ flex:1, fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>在庫数</span>
                          <button onClick={() => setMenus(ms => ms.map(m => m.id===menu.id ? {...m,stock:Math.max(0,m.stock-1)} : m))} style={calcBtnStyle}>−</button>
                          <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:26, fontWeight:700, color:'#1e293b', minWidth:44, textAlign:'center' }}>
                            {menu.stock}
                          </span>
                          <button onClick={() => setMenus(ms => ms.map(m => m.id===menu.id ? {...m,stock:m.stock+1} : m))} style={calcBtnStyle}>＋</button>
                        </div>
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
function QrDisplay({ exhibitId }: { exhibitId: string }) {
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
        <QrComp value={qrUrl} size={240} />
      </div>
    </div>
  )
}
