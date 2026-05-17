'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// ── 型 ────────────────────────────────────────────────────────
interface MenuItem { id:string; name:string; price:number; stock:number; is_selling:boolean }

type ExhibitType = 'class'|'food'|'band'|'special'|'cafeteria'
type QuickTab = 'wait'|'qr'|'menu'

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

  const [name,       setName]       = useState('')
  const [type,       setType]       = useState<ExhibitType>('class')
  const [isTarget,   setIsTarget]   = useState(false)
  const [hasWait,    setHasWait]    = useState(true)
  const [tpg,        setTpg]        = useState(5)
  const [queueCount, setQueueCount] = useState(0)
  const [menus,      setMenus]      = useState<MenuItem[]>([])

  const [tab,    setTab]    = useState<QuickTab>('wait')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [loading, setLoading] = useState(true)

  const isFood = type === 'food' || type === 'cafeteria'
  const waitMin = Math.max(0, tpg * queueCount)

  // ── データ読み込み ────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/admin/login'); return }

      const { data } = await supabase
        .from('exhibits')
        .select('name, type, is_stamp_target, has_wait_time, wait_minutes')
        .eq('id', id)
        .single()

      if (data) {
        setName(data.name ?? '')
        setType(data.type as ExhibitType)
        setIsTarget(data.is_stamp_target ?? false)
        setHasWait(data.has_wait_time ?? true)
        const wm = data.wait_minutes ?? 0
        setQueueCount(Math.round(wm / 5))
      }

      if ((data?.type === 'food' || data?.type === 'cafeteria')) {
        const { data: md } = await supabase
          .from('food_menus')
          .select('id, name, price, stock, is_selling')
          .eq('exhibit_id', id)
        if (md) setMenus(md as MenuItem[])
      }

      setLoading(false)
    })
  }, [id, router])

  const flashSaved = useCallback(() => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [])

  // ── 待ち時間保存 ──────────────────────────────────────────────
  const saveWait = async () => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('exhibits').update({
      has_wait_time: hasWait,
      wait_minutes:  waitMin,
    }).eq('id', id)
    setSaving(false)
    flashSaved()
  }

  // ── is_stamp_target 保存 ──────────────────────────────────────
  const saveQr = async () => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('exhibits').update({ is_stamp_target: isTarget }).eq('id', id)
    setSaving(false)
    flashSaved()
  }

  // ── メニュー保存 ──────────────────────────────────────────────
  const saveMenu = async () => {
    setSaving(true)
    const supabase = createClient()
    const existing = menus.filter(m => !m.id.startsWith('new_'))
    if (existing.length > 0) {
      await supabase.from('food_menus').upsert(
        existing.map(m => ({
          id: m.id, exhibit_id: id,
          name: m.name, price: m.price,
          stock: m.stock, is_selling: m.is_selling,
        }))
      )
    }
    setSaving(false)
    flashSaved()
  }

  if (loading) {
    return (
      <div style={{ height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:"'Kiwi Maru',serif", fontSize:13, color:'#94a3b8', background:'#f8fafc' }}>
        読み込み中…
      </div>
    )
  }

  const tabs: { key: QuickTab; label: string }[] = [
    { key:'wait', label:'⏱ 待ち時間' },
    { key:'qr',   label:'🎯 スタンプ QR' },
    ...(isFood ? [{ key:'menu' as QuickTab, label:'🍽 メニュー' }] : []),
  ]

  return (
    <div style={{ height:'100dvh', display:'flex', flexDirection:'column', background:'#f8fafc', overflow:'hidden' }}>

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
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {name}
          </div>
          <div style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>かんたん更新</div>
        </div>

        {/* 保存フィードバック */}
        {saved && (
          <div style={{ fontSize:12, color:'#10b981', fontWeight:700, fontFamily:"'Kiwi Maru',serif", flexShrink:0 }}>
            ✓ 更新しました
          </div>
        )}
      </div>

      {/* ── タブバー ── */}
      <div style={{
        background:'#fff', borderBottom:'1px solid #e2e8f0',
        display:'flex', flexShrink:0,
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex:1, padding:'14px 4px', border:'none', cursor:'pointer',
            background:'transparent',
            color: tab === t.key ? '#FF6B00' : '#94a3b8',
            fontWeight: tab === t.key ? 700 : 400,
            fontSize:13, fontFamily:"'Kiwi Maru',serif",
            borderBottom: tab === t.key ? '2.5px solid #FF6B00' : '2.5px solid transparent',
            transition:'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── コンテンツ ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 16px' }}>

        {/* 待ち時間 */}
        {tab === 'wait' && (
          <div style={{ maxWidth:480, margin:'0 auto' }}>
            {/* 有効/無効トグル */}
            <button onClick={() => setHasWait(v => !v)} style={{
              width:'100%', padding:'14px 16px', borderRadius:14, border:'none', cursor:'pointer',
              display:'flex', alignItems:'center', gap:12,
              background: hasWait ? '#f0fdf4' : '#f8fafc',
              boxShadow: hasWait ? 'inset 0 0 0 1.5px #86efac' : 'inset 0 0 0 1.5px #e2e8f0',
              marginBottom:20, transition:'all 0.15s',
            }}>
              <div style={{
                width:44, height:24, borderRadius:99, flexShrink:0, position:'relative',
                background: hasWait ? '#22c55e' : '#cbd5e1', transition:'background 0.2s',
              }}>
                <div style={{
                  position:'absolute', top:3, borderRadius:'50%', width:18, height:18, background:'#fff',
                  left: hasWait ? 23 : 3, transition:'left 0.2s',
                  boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
              <span style={{ fontSize:14, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                color: hasWait ? '#16a34a' : '#94a3b8' }}>
                {hasWait ? '待ち時間機能 有効' : '待ち時間機能 無効'}
              </span>
            </button>

            {hasWait && (<>
              {/* 待ち時間表示 */}
              <div style={{
                background:'linear-gradient(135deg,#0f172a,#1e293b)', borderRadius:20, padding:'28px',
                textAlign:'center', marginBottom:24,
              }}>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:8, fontFamily:"'Kiwi Maru',serif" }}>
                  現在の待ち時間
                </div>
                <div style={{
                  fontFamily:"'Kaisei Decol',serif", fontSize:80, fontWeight:700, lineHeight:1,
                  color: waitMin>=30?'#fca5a5':waitMin>=15?'#fcd34d':'#86efac',
                }}>
                  {waitMin}
                </div>
                <div style={{ fontSize:18, color:'rgba(255,255,255,0.5)', marginTop:8, fontFamily:"'Kiwi Maru',serif" }}>分</div>
              </div>

              {/* 待ち組数コントロール */}
              <div style={{ background:'#fff', borderRadius:16, padding:'20px',
                boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9', marginBottom:16 }}>
                <div style={{ fontSize:12, color:'#94a3b8', marginBottom:16, fontFamily:"'Kiwi Maru',serif", textAlign:'center' }}>
                  待ち組数（1組あたり {tpg} 分）
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:20 }}>
                  <button onClick={() => setQueueCount(v => Math.max(0, v-1))} style={calcBtnStyle}>−</button>
                  <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:56, fontWeight:700, color:'#1e293b', minWidth:80, textAlign:'center', lineHeight:1 }}>
                    {queueCount}
                  </span>
                  <button onClick={() => setQueueCount(v => v+1)} style={calcBtnStyle}>＋</button>
                </div>
                <div style={{ textAlign:'center', marginTop:8, fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>組</div>
              </div>

              {/* 直接入力 */}
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:11, color:'#94a3b8', display:'block', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>
                  または直接入力
                </label>
                <input
                  type="number" min={0} value={queueCount}
                  onChange={e => setQueueCount(Number(e.target.value))}
                  style={{ width:'100%', padding:'12px', borderRadius:10, border:'1px solid #e2e8f0',
                    fontSize:16, fontFamily:"'Kaisei Decol',serif", boxSizing:'border-box',
                    textAlign:'center', color:'#1e293b', outline:'none' }}
                />
              </div>
            </>)}

            <button onClick={saveWait} disabled={saving} style={{
              width:'100%', padding:'16px', borderRadius:14, border:'none', cursor:'pointer',
              background: saved ? '#10b981' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
              color:'#fff', fontSize:16, fontWeight:700,
              fontFamily:"'Kaisei Decol',serif", transition:'background 0.3s',
              boxShadow:'0 4px 16px rgba(255,107,0,0.3)',
            }}>
              {saving ? '更新中…' : saved ? '✓ 更新しました' : '待ち時間を更新する'}
            </button>
          </div>
        )}

        {/* スタンプ QR */}
        {tab === 'qr' && (
          <StampQrPanel
            exhibitId={id}
            isTarget={isTarget}
            onToggle={() => setIsTarget(v => !v)}
            onSave={saveQr}
            saving={saving}
            saved={saved}
          />
        )}

        {/* メニュー */}
        {tab === 'menu' && isFood && (
          <div style={{ maxWidth:480, margin:'0 auto' }}>
            {menus.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
                メニューが登録されていません
              </div>
            ) : (
              <div style={{ background:'#fff', borderRadius:16, padding:'8px 20px',
                boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9', marginBottom:16 }}>
                {menus.map((menu, i) => (
                  <div key={menu.id} style={{
                    padding:'16px 0',
                    borderTop: i > 0 ? '1px solid #f1f5f9' : 'none',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:12 }}>
                      <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#1e293b' }}>
                        {menu.name}
                      </span>
                      <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700, color:'#FF6B00', flexShrink:0, marginLeft:8 }}>
                        ¥{menu.price.toLocaleString()}
                      </span>
                    </div>

                    <button
                      onClick={() => setMenus(ms => ms.map(m => m.id===menu.id ? {...m,is_selling:!m.is_selling} : m))}
                      style={{
                        width:'100%', padding:'12px', borderRadius:10, border:'none', cursor:'pointer',
                        background: menu.is_selling ? '#f0fdf4' : '#f5f5f5',
                        color: menu.is_selling ? '#16a34a' : '#94a3b8',
                        fontWeight:700, fontSize:14, fontFamily:"'Kiwi Maru',serif",
                        boxShadow: menu.is_selling ? 'inset 0 0 0 1.5px #86efac' : 'inset 0 0 0 1.5px #e2e8f0',
                        marginBottom:10,
                      }}
                    >
                      {menu.is_selling ? '✓ 販売中' : '✗ 販売停止'}
                    </button>

                    <div style={{ display:'flex', alignItems:'center', gap:12,
                      background:'#f8fafc', borderRadius:12, padding:'10px 16px' }}>
                      <span style={{ flex:1, fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>在庫数</span>
                      <button
                        onClick={() => setMenus(ms => ms.map(m => m.id===menu.id ? {...m,stock:Math.max(0,m.stock-1)} : m))}
                        style={calcBtnStyle}
                      >−</button>
                      <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:28, fontWeight:700, color:'#1e293b', minWidth:48, textAlign:'center' }}>
                        {menu.stock}
                      </span>
                      <button
                        onClick={() => setMenus(ms => ms.map(m => m.id===menu.id ? {...m,stock:m.stock+1} : m))}
                        style={calcBtnStyle}
                      >＋</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={saveMenu} disabled={saving || menus.length===0} style={{
              width:'100%', padding:'16px', borderRadius:14, border:'none', cursor:'pointer',
              background: saved ? '#10b981' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
              color:'#fff', fontSize:16, fontWeight:700,
              fontFamily:"'Kaisei Decol',serif", transition:'background 0.3s',
              boxShadow:'0 4px 16px rgba(255,107,0,0.3)',
              opacity: menus.length===0 ? 0.5 : 1,
            }}>
              {saving ? '更新中…' : saved ? '✓ 更新しました' : 'メニューを更新する'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── スタンプ QR パネル ─────────────────────────────────────────
function StampQrPanel({ exhibitId, isTarget, onToggle, onSave, saving, saved }: {
  exhibitId: string
  isTarget:  boolean
  onToggle:  () => void
  onSave:    () => void
  saving:    boolean
  saved:     boolean
}) {
  const [qrUrl,  setQrUrl]  = React.useState<string | null>(null)
  const [qrErr,  setQrErr]  = React.useState(false)
  const [QrComp, setQrComp] = React.useState<React.ComponentType<{ value:string; size:number }> | null>(null)

  React.useEffect(() => {
    import('qrcode.react').then(m => setQrComp(() => m.QRCodeSVG as React.ComponentType<{ value:string; size:number }>))
  }, [])

  React.useEffect(() => {
    if (!isTarget) return
    const load = async () => {
      try {
        const res  = await fetch(`/api/stamp-qr/${exhibitId}`)
        const json = await res.json() as { url?:string }
        if (json.url) { setQrUrl(json.url); setQrErr(false) }
        else           setQrErr(true)
      } catch { setQrErr(true) }
    }
    load()
    const t = setInterval(load, 60 * 1000)
    return () => clearInterval(t)
  }, [exhibitId, isTarget])

  return (
    <div style={{ maxWidth:480, margin:'0 auto' }}>
      {/* トグル */}
      <button onClick={onToggle} style={{
        width:'100%', padding:'14px 16px', borderRadius:14, border:'none', cursor:'pointer',
        display:'flex', alignItems:'center', gap:12,
        background: isTarget ? '#fdf4ff' : '#f8fafc',
        boxShadow:  isTarget ? 'inset 0 0 0 1.5px #a855f7' : 'inset 0 0 0 1.5px #e2e8f0',
        marginBottom:16, transition:'all 0.15s',
      }}>
        <div style={{
          width:44, height:24, borderRadius:99, flexShrink:0, position:'relative',
          background: isTarget ? '#a855f7' : '#cbd5e1', transition:'background 0.2s',
        }}>
          <div style={{
            position:'absolute', top:3, borderRadius:'50%', width:18, height:18, background:'#fff',
            left: isTarget ? 23 : 3, transition:'left 0.2s',
            boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </div>
        <span style={{ fontSize:14, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
          color: isTarget ? '#7c3aed' : '#94a3b8' }}>
          {isTarget ? 'スタンプラリー 参加中' : 'スタンプラリー 不参加'}
        </span>
      </button>

      {/* 保存ボタン */}
      <button onClick={onSave} disabled={saving} style={{
        width:'100%', padding:'16px', borderRadius:14, border:'none', cursor:'pointer',
        background: saved ? '#10b981' : 'linear-gradient(135deg,#a855f7,#7c3aed)',
        color:'#fff', fontSize:16, fontWeight:700,
        fontFamily:"'Kaisei Decol',serif", transition:'background 0.3s',
        boxShadow:'0 4px 16px rgba(124,58,237,0.3)', marginBottom:24,
      }}>
        {saving ? '保存中…' : saved ? '✓ 保存しました' : '設定を保存する'}
      </button>

      {/* QR 表示 */}
      {isTarget && (
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:12, color:'#94a3b8', marginBottom:16, fontFamily:"'Kiwi Maru',serif" }}>
            来場者にこの QR を読み取ってもらいます（60秒ごとに更新）
          </div>
          {qrErr ? (
            <div style={{ color:'#f87171', fontSize:13, fontFamily:"'Kiwi Maru',serif", padding:'20px' }}>
              QR の取得に失敗しました<br />設定を保存してから再読み込みしてください
            </div>
          ) : qrUrl && QrComp ? (
            <div style={{ display:'inline-block', padding:20, background:'#fff',
              borderRadius:20, boxShadow:'0 4px 24px rgba(0,0,0,0.12)' }}>
              <QrComp value={qrUrl} size={260} />
            </div>
          ) : (
            <div style={{ color:'#94a3b8', fontSize:13, fontFamily:"'Kiwi Maru',serif", padding:'20px' }}>
              読み込み中…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
