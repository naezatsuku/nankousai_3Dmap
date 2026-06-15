'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageLoader from '@/components/ui/PageLoader'
import NotificationBanner from '@/components/ui/NotificationBanner'

interface Slot    { id: string; date: string; start_at: string; end_at: string; required_count: number }
interface Member  { user_id: string; profiles: { id: string; name: string } | null }
interface Assign  { slot_id: string; user_id: string }
interface Exhibit { id: string; name: string; class_label: string | null }
interface DayData  { slots: Slot[]; members: Member[]; assigns: Assign[] }

const DATES = ['sat', 'sun'] as const

const MAX_AVATARS = 4 // これを超えたら +N 表示
const MAX_PRINT_COLS = 6 // 印刷時、1段あたりの名前セル数の上限（縦型A4の幅に収まる目安）

function sortMembers(members: Member[], myUserId: string) {
  return [...members].sort((a, b) => {
    if (a.user_id === myUserId) return -1
    if (b.user_id === myUserId) return  1
    return (a.profiles?.name ?? '').localeCompare(b.profiles?.name ?? '', 'ja')
  })
}

// 印刷表のレイアウト計算：列数はその日の最大必要人数に揃え、
// ページ幅に収まらない場合は均等な段数に分割する
function buildPrintLayout(slots: Slot[]) {
  const totalCols = slots.length ? Math.max(1, ...slots.map(s => s.required_count)) : 1
  const rowsPerSlot = Math.max(1, Math.ceil(totalCols / MAX_PRINT_COLS))
  const colsPerRow = Math.ceil(totalCols / rowsPerSlot)
  return { rowsPerSlot, colsPerRow }
}

// 名前セルの文字サイズ：セルの大きさは名前の長さに関係なく一定にしたいので、
// 基準サイズに収まる長さまでは全員同じサイズ。それを超える名前だけ、
// セルに収まるように縮小する（できるだけ縮小しないことを優先）
const PRINT_NAME_BASE_SIZE = 12 // px
const PRINT_NAME_FIT_CHARS = 6  // この文字数までは基準サイズのまま

function printNameFontSize(name: string) {
  if (name.length <= PRINT_NAME_FIT_CHARS) return PRINT_NAME_BASE_SIZE
  return Math.round(PRINT_NAME_BASE_SIZE * PRINT_NAME_FIT_CHARS / name.length)
}

// コマ→割当ユーザーIDセット
function buildAssignMap(assigns: Assign[]) {
  const map = new Map<string, Set<string>>()
  for (const a of assigns) {
    if (!map.has(a.slot_id)) map.set(a.slot_id, new Set())
    map.get(a.slot_id)!.add(a.user_id)
  }
  return map
}

// 画像出力のレイアウト定数（A4縦の印刷イメージに合わせる）
const IMG_SCALE = 3        // 高解像度化の倍率
const IMG_PAD = 24         // 画像の外側余白
const IMG_CONTENT_W = 688  // A4幅(約794px) − 印刷余白14mm×2 相当
const IMG_TIME_COL_W = 106 // 時間列の幅 ≒28mm
const IMG_HEADER_H = 26
const IMG_ROW_H = 24
const IMG_TITLE_SIZE = 16

// 1日分のシフト表をCanvasに描画してPNG用のcanvasを返す（コマが無い日はnull）
function drawDayImage(day: DayData, title: string): HTMLCanvasElement | null {
  const { slots, members, assigns } = day
  if (slots.length === 0) return null

  const assignMap = buildAssignMap(assigns)
  const { rowsPerSlot, colsPerRow } = buildPrintLayout(slots)
  const totalCols = rowsPerSlot * colsPerRow
  const nameColW = (IMG_CONTENT_W - IMG_TIME_COL_W) / colsPerRow

  const tableTop = IMG_PAD + IMG_TITLE_SIZE + 12
  const tableH = IMG_HEADER_H + slots.length * rowsPerSlot * IMG_ROW_H
  const width = IMG_CONTENT_W + IMG_PAD * 2
  const height = tableTop + tableH + IMG_PAD

  const canvas = document.createElement('canvas')
  canvas.width = width * IMG_SCALE
  canvas.height = height * IMG_SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(IMG_SCALE, IMG_SCALE)

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#000'
  ctx.textBaseline = 'middle'

  // タイトル
  ctx.font = `700 ${IMG_TITLE_SIZE}px sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText(title, IMG_PAD, IMG_PAD + IMG_TITLE_SIZE / 2)

  ctx.strokeStyle = '#000'
  ctx.lineWidth = 1
  ctx.textAlign = 'center'

  const cell = (x: number, y: number, w: number, h: number, text: string, font: string) => {
    ctx.strokeRect(x, y, w, h)
    if (text) {
      ctx.font = font
      ctx.fillText(text, x + w / 2, y + h / 2 + 1)
    }
  }

  const left = IMG_PAD
  cell(left, tableTop, IMG_TIME_COL_W, IMG_HEADER_H, '時間', '700 12px sans-serif')
  cell(left + IMG_TIME_COL_W, tableTop, IMG_CONTENT_W - IMG_TIME_COL_W, IMG_HEADER_H, '担当者', '700 12px sans-serif')

  let y = tableTop + IMG_HEADER_H
  for (const slot of slots) {
    const slotAssigns = assignMap.get(slot.id) ?? new Set()
    const assigned = members.filter(m => slotAssigns.has(m.user_id))
    const names = sortMembers(assigned, '').map(m => m.profiles?.name ?? '')
    while (names.length < totalCols) names.push('')

    const slotH = rowsPerSlot * IMG_ROW_H
    cell(left, y, IMG_TIME_COL_W, slotH,
      `${slot.start_at.slice(0,5)}〜${slot.end_at.slice(0,5)}`, '700 12px sans-serif')

    for (let row = 0; row < rowsPerSlot; row++) {
      for (let col = 0; col < colsPerRow; col++) {
        const name = names[row * colsPerRow + col]
        cell(left + IMG_TIME_COL_W + col * nameColW, y + row * IMG_ROW_H, nameColW, IMG_ROW_H,
          name, `${printNameFontSize(name)}px sans-serif`)
      }
    }
    y += slotH
  }

  return canvas
}

export default function ShiftViewPage() {
  const router = useRouter()
  const [exhibits,    setExhibits]    = useState<Exhibit[]>([])
  const [exhibitId,   setExhibitId]   = useState<string | null>(null)
  const [myUserId,    setMyUserId]    = useState('')
  const [role,        setRole]        = useState('')
  const [date,        setDate]        = useState<'sat'|'sun'>('sat')
  const [dayData,     setDayData]     = useState<Record<'sat'|'sun', DayData>>({
    sat: { slots: [], members: [], assigns: [] },
    sun: { slots: [], members: [], assigns: [] },
  })
  const [loading,     setLoading]     = useState(true)
  const [noExhibit,   setNoExhibit]   = useState(false)

  // モーダル用
  const [modalSlot,      setModalSlot]      = useState<Slot | null>(null)
  const [notifyModal,    setNotifyModal]    = useState(false)
  const [notifyMinutes,  setNotifyMinutes]  = useState<number|null>(null)
  const [notifySaving,   setNotifySaving]   = useState(false)
  const [notifySaved,    setNotifySaved]    = useState(false)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      setMyUserId(user.id)

      const { data: pref } = await supabase
        .from('shift_notification_prefs')
        .select('notify_minutes')
        .eq('user_id', user.id)
        .maybeSingle()
      setNotifyMinutes((pref as { notify_minutes: number } | null)?.notify_minutes ?? null)

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const r = (profile as { role: string } | null)?.role ?? ''
      setRole(r)

      type LinkRow = { exhibit_id: string; exhibits: Exhibit | null }
      let exs: Exhibit[] = []

      if (r === 'admin') {
        const { data: allEx } = await supabase
          .from('exhibits')
          .select('id, name, class_label')
          .order('class_label', { nullsFirst: false })
        exs = (allEx ?? []) as Exhibit[]
      } else {
        const table = r === 'editor' ? 'exhibit_editors' : 'student_exhibits'
        const { data: links } = await supabase
          .from(table)
          .select('exhibit_id, exhibits(id, name, class_label)')
          .eq('user_id', user.id)
        exs = ((links ?? []) as unknown as LinkRow[])
          .map(l => l.exhibits).filter(Boolean) as Exhibit[]
      }

      if (exs.length === 0) { setNoExhibit(true); setLoading(false); return }
      setExhibits(exs)
      setExhibitId(exs[0].id)
      setLoading(false)
    }
    init()
  }, [router])

  // 印刷で土日両方を出力できるよう、両日分のデータをまとめて取得
  useEffect(() => {
    if (!exhibitId) return
    let active = true
    Promise.all(DATES.map(d =>
      fetch(`/api/shift/assignments?exhibitId=${exhibitId}&date=${d}`, { cache: 'no-store' })
        .then(r => r.json())
        .then((data: { slots: Slot[]; members: Member[]; assignments: Assign[] }) =>
          [d, { slots: data.slots ?? [], members: data.members ?? [], assigns: data.assignments ?? [] }] as const)
    )).then(results => {
      if (!active) return
      setDayData(prev => {
        const next = { ...prev }
        for (const [d, data] of results) next[d] = data
        return next
      })
    })
    return () => { active = false }
  }, [exhibitId])

  const { slots, members, assigns } = dayData[date]
  const assignMap = buildAssignMap(assigns)

  const currentExhibit = exhibits.find(e => e.id === exhibitId)

  // 土日それぞれのシフト表をPNGとしてダウンロード
  const handleSaveImages = async () => {
    const exhibitName = currentExhibit?.class_label ?? currentExhibit?.name ?? ''
    let saved = 0
    for (const d of DATES) {
      const label = d === 'sat' ? '土曜日' : '日曜日'
      const canvas = drawDayImage(dayData[d], `${exhibitName} シフト表（${label}）`)
      if (!canvas) continue
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
      if (!blob) continue
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `シフト表_${label}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      saved++
    }
    if (saved === 0) alert('保存できるシフトがありません。')
  }

  // 自分が担当するコマに通知を一括設定
  const handleSaveNotify = async () => {
    if (!myUserId) return // ユーザー未取得なら何もしない
    setNotifySaving(true)

    const supabase = createClient()
    let saveErr: string | null = null

    if (notifyMinutes !== null) {
      const { error } = await supabase
        .from('shift_notification_prefs')
        .upsert({ user_id: myUserId, notify_minutes: notifyMinutes }, { onConflict: 'user_id' })
      if (error) saveErr = error.message
    } else {
      const { error } = await supabase
        .from('shift_notification_prefs')
        .delete()
        .eq('user_id', myUserId)
      if (error) saveErr = error.message
    }

    setNotifySaving(false)
    if (saveErr) {
      alert(`保存エラー: ${saveErr}`)
      return
    }
    setNotifySaved(true); setNotifyModal(false)
    setTimeout(() => setNotifySaved(false), 3000)
  }

  if (loading) return (
    <PageLoader />
  )
  if (noExhibit) return (
    <div style={{ maxWidth:600 }}>
      <h1 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#1e293b', marginBottom:8 }}>シフト表</h1>
      <p style={{ color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>クラスが割り当てられていません。</p>
    </div>
  )

  return (
    <>
    <NotificationBanner />
    <div className="shift-screen-view" style={{ maxWidth:700 }}>
      {/* ヘッダー */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
            📅 シフト表
            {notifySaved && (
              <span style={{ marginLeft:10, fontSize:12, color:'#10b981', fontWeight:700, fontFamily:"'Kiwi Maru',serif" }}>
                ✓ 通知を設定しました
              </span>
            )}
          </h1>
          <div style={{ fontSize:13, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
            {currentExhibit?.class_label ?? currentExhibit?.name}
          </div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          {(['sat','sun'] as const).map(d => (
            <button key={d} onClick={() => setDate(d)} style={{
              padding:'7px 20px', borderRadius:99, border:'none', cursor:'pointer',
              background: date === d ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#f1f5f9',
              color: date === d ? '#fff' : '#64748b',
              fontWeight:700, fontSize:12, fontFamily:"'Kiwi Maru',serif", transition:'all 0.15s',
            }}>
              {d === 'sat' ? '土曜日' : '日曜日'}
            </button>
          ))}
          {/* PDF出力ボタン */}
          <button onClick={() => window.print()} title="PDFとして保存する" style={{
            height:36, padding:'0 12px', borderRadius:99, border:'none', cursor:'pointer',
            background:'#f1f5f9', color:'#64748b',
            display:'flex', alignItems:'center', justifyContent:'center', gap:5,
            fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif", whiteSpace:'nowrap',
          }}>
            <span style={{ fontSize:16 }}>📄</span>
            <span className="shift-btn-label">PDFとして保存</span>
          </button>
          {/* 画像出力ボタン */}
          <button onClick={handleSaveImages} title="画像(PNG)として保存する" style={{
            height:36, padding:'0 12px', borderRadius:99, border:'none', cursor:'pointer',
            background:'#f1f5f9', color:'#64748b',
            display:'flex', alignItems:'center', justifyContent:'center', gap:5,
            fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif", whiteSpace:'nowrap',
          }}>
            <span style={{ fontSize:16 }}>🖼</span>
            <span className="shift-btn-label">画像で保存</span>
          </button>
          {/* 通知設定ボタン */}
          <button onClick={() => setNotifyModal(true)} title="シフト通知を設定" style={{
            width:36, height:36, borderRadius:'50%', border:'none', cursor:'pointer',
            background: notifySaved ? '#f0fdf4' : '#f1f5f9',
            color: notifySaved ? '#10b981' : '#64748b',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
            boxShadow: notifySaved ? '0 0 0 2px #86efac' : 'none',
            transition:'all 0.2s',
          }}>🔔</button>
        </div>
      </div>

      {/* クラス選択 */}
      {exhibits.length > 1 && (
        <div style={{ marginBottom:16, display:'flex', gap:6, flexWrap:'wrap' }}>
          {exhibits.map(ex => (
            <button key={ex.id} onClick={() => setExhibitId(ex.id)} style={{
              padding:'6px 16px', borderRadius:99, border:'none', cursor:'pointer',
              background: exhibitId === ex.id ? '#1e293b' : '#f1f5f9',
              color: exhibitId === ex.id ? '#fff' : '#64748b',
              fontWeight:700, fontSize:12, fontFamily:"'Kiwi Maru',serif",
            }}>
              {ex.class_label ?? ex.name}
            </button>
          ))}
        </div>
      )}

      {slots.length === 0 ? (
        <div style={{ color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13, padding:'20px 0' }}>
          この日のシフトはまだ設定されていません。
        </div>
      ) : (
        <table style={{ borderCollapse:'collapse', width:'100%' }}>
          <thead>
            <tr>
              <th style={thS}>時間</th>
              <th style={thS}>メンバー</th>
              <th style={{ ...thS, width:60, textAlign:'center' }}>人数</th>
            </tr>
          </thead>
          <tbody>
            {slots.map(slot => {
              const slotAssigns = assignMap.get(slot.id) ?? new Set()
              const filled   = slotAssigns.size
              const short    = filled < slot.required_count
              const assigned = members.filter(m => slotAssigns.has(m.user_id))
              const sorted   = sortMembers(assigned, myUserId)
              const visible  = sorted.slice(0, MAX_AVATARS)
              const overflow = sorted.slice(MAX_AVATARS)

              return (
                <tr key={slot.id}>
                  <td style={{ ...tdS, whiteSpace:'nowrap', fontWeight:700 }}>
                    {slot.start_at.slice(0,5)}〜{slot.end_at.slice(0,5)}
                  </td>
                  <td style={{ ...tdS, padding:'8px 12px' }}>
                    {sorted.length === 0 ? (
                      <span style={{ fontSize:12, color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif" }}>未割当</span>
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        {visible.map(m => {
                          const isMe = m.user_id === myUserId
                          const name = m.profiles?.name ?? '?'
                          return (
                            <div key={m.user_id} title={name} style={{
                              width:32, height:32, borderRadius:'50%', flexShrink:0,
                              background: isMe ? '#FF6B00' : '#10b981',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:13, fontWeight:700, color:'#fff',
                              boxShadow: isMe ? '0 0 0 2px #fff, 0 0 0 4px #FF6B00' : 'none',
                            }}>
                              {name[0] ?? '?'}
                            </div>
                          )
                        })}
                        {overflow.length > 0 && (
                          <button onClick={() => setModalSlot(slot)} style={{
                            width:32, height:32, borderRadius:'50%', flexShrink:0,
                            background:'#f1f5f9', border:'none', cursor:'pointer',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:11, fontWeight:700, color:'#64748b',
                          }}>
                            +{overflow.length}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{
                    ...tdS, textAlign:'center', fontWeight:700,
                    fontFamily:"'Kaisei Decol',serif", fontSize:13,
                    color: short ? '#dc2626' : '#16a34a',
                    background: short ? '#fef2f2' : '#f0fdf4',
                  }}>
                    {filled}/{slot.required_count}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* 凡例 */}
      <div style={{ display:'flex', gap:10, marginTop:16, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:20, height:20, borderRadius:'50%', background:'#FF6B00' }} />
          <span style={{ fontSize:11, color:'#64748b', fontFamily:"'Kiwi Maru',serif" }}>自分</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:20, height:20, borderRadius:'50%', background:'#10b981' }} />
          <span style={{ fontSize:11, color:'#64748b', fontFamily:"'Kiwi Maru',serif" }}>他のメンバー</span>
        </div>
        <span style={{ fontSize:11, color:'#dc2626', fontFamily:"'Kiwi Maru',serif" }}>赤数字＝人数不足</span>
      </div>

      {(role === 'editor' || role === 'admin') && (
        <div style={{ marginTop:20, padding:'12px 16px', borderRadius:12, background:'#f8fafc', border:'1px solid #e2e8f0' }}>
          <a href="/admin/shift/edit" style={{ fontSize:13, fontWeight:700, color:'#FF6B00', fontFamily:"'Kiwi Maru',serif", textDecoration:'none' }}>
            ✏ シフト編集ページへ →
          </a>
        </div>
      )}

      {/* オーバーフローモーダル */}
      {modalSlot && (() => {
        const slotAssigns = assignMap.get(modalSlot.id) ?? new Set()
        const assigned    = members.filter(m => slotAssigns.has(m.user_id))
        const sorted      = sortMembers(assigned, myUserId)
        return (
          <div style={{
            position:'fixed', inset:0, zIndex:200,
            background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:20,
          }} onClick={() => setModalSlot(null)}>
            <div style={{
              background:'#fff', borderRadius:20, padding:24,
              width:'100%', maxWidth:340, maxHeight:'70vh', display:'flex', flexDirection:'column',
            }} onClick={e => e.stopPropagation()}>
              <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:16, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
                {modalSlot.start_at.slice(0,5)}〜{modalSlot.end_at.slice(0,5)} のメンバー
              </div>
              <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:16 }}>
                {sorted.length} 人
              </div>
              <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                {sorted.map(m => {
                  const isMe = m.user_id === myUserId
                  const name = m.profiles?.name ?? '?'
                  return (
                    <div key={m.user_id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{
                        width:34, height:34, borderRadius:'50%', flexShrink:0,
                        background: isMe ? '#FF6B00' : '#10b981',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:14, fontWeight:700, color:'#fff',
                      }}>
                        {name[0]}
                      </div>
                      <span style={{ fontFamily:"'Kiwi Maru',serif", fontSize:13, color:'#1e293b', fontWeight: isMe ? 700 : 400 }}>
                        {name}{isMe ? ' (自分)' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
              <button onClick={() => setModalSlot(null)} style={{
                marginTop:16, width:'100%', padding:'11px', borderRadius:10, border:'none',
                background:'#f1f5f9', color:'#64748b', fontSize:13, fontWeight:700,
                cursor:'pointer', fontFamily:"'Kiwi Maru',serif",
              }}>閉じる</button>
            </div>
          </div>
        )
      })()}

      {/* 通知設定モーダル */}
      {notifyModal && (
        <div style={{
          position:'fixed', inset:0, zIndex:200,
          background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'flex-end', justifyContent:'center',
        }} onClick={() => setNotifyModal(false)}>
          <div style={{
            width:'100%', maxWidth:480, background:'#fff',
            borderRadius:'20px 20px 0 0', padding:'24px 20px 40px',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:17, fontWeight:700, color:'#1e293b', marginBottom:6 }}>
              🔔 シフト通知を設定
            </div>
            <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:20, lineHeight:1.65 }}>
              自分のシフト時間の何分前に通知しますか？<br />
              設定すると予定ページを開いたときに通知がスケジュールされます。
            </div>

            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:24 }}>
              {[
                { label: 'なし（通知しない）', value: null },
                { label: '5分前',  value: 5 },
                { label: '10分前', value: 10 },
                { label: '15分前', value: 15 },
                { label: '30分前', value: 30 },
                { label: '1時間前', value: 60 },
              ].map(o => (
                <button key={String(o.value)} onClick={() => setNotifyMinutes(o.value)} style={{
                  padding:'8px 16px', borderRadius:99, border:'none', cursor:'pointer',
                  background: notifyMinutes === o.value
                    ? 'linear-gradient(135deg,#6366f1,#818cf8)'
                    : '#f1f5f9',
                  color: notifyMinutes === o.value ? '#fff' : '#64748b',
                  fontWeight:700, fontSize:12, fontFamily:"'Kiwi Maru',serif",
                  transition:'all 0.15s',
                }}>
                  {o.label}
                </button>
              ))}
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setNotifyModal(false)} style={{
                flex:1, padding:'12px', borderRadius:10, border:'1px solid #e2e8f0',
                background:'#fff', fontSize:13, fontWeight:700,
                cursor:'pointer', fontFamily:"'Kiwi Maru',serif", color:'#64748b',
              }}>キャンセル</button>
              <button onClick={handleSaveNotify} disabled={notifySaving} style={{
                flex:2, padding:'12px', borderRadius:10, border:'none',
                background: notifySaving ? '#e2e8f0' : 'linear-gradient(135deg,#6366f1,#818cf8)',
                color: notifySaving ? '#94a3b8' : '#fff',
                fontSize:13, fontWeight:700,
                cursor: notifySaving ? 'default' : 'pointer',
                fontFamily:"'Kaisei Decol',serif",
              }}>
                {notifySaving ? '設定中…' : '設定する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* 印刷用シフト表（画面には表示されず、印刷/PDF出力時のみ表示。土日それぞれ別ページに出力） */}
    <div className="shift-print-view">
      {DATES.map((d, i) => {
        const { slots: dSlots, members: dMembers, assigns: dAssigns } = dayData[d]
        const dAssignMap = buildAssignMap(dAssigns)
        const { rowsPerSlot, colsPerRow } = buildPrintLayout(dSlots)
        const totalCols = rowsPerSlot * colsPerRow

        return (
          <section key={d} className="shift-print-day" style={i > 0 ? { pageBreakBefore: 'always' } : undefined}>
            <h1 className="shift-print-title">
              {currentExhibit?.class_label ?? currentExhibit?.name} シフト表（{d === 'sat' ? '土曜日' : '日曜日'}）
            </h1>
            {dSlots.length === 0 ? (
              <p className="shift-print-empty">この日のシフトは設定されていません。</p>
            ) : (
              <table className="shift-print-table">
                <thead>
                  <tr>
                    <th>時間</th>
                    <th colSpan={colsPerRow}>担当者</th>
                  </tr>
                </thead>
                <tbody>
                  {dSlots.map(slot => {
                    const slotAssigns = dAssignMap.get(slot.id) ?? new Set()
                    const assigned = dMembers.filter(m => slotAssigns.has(m.user_id))
                    const names = sortMembers(assigned, '').map(m => m.profiles?.name ?? '')
                    while (names.length < totalCols) names.push('')

                    return Array.from({ length: rowsPerSlot }).map((_, row) => (
                      <tr key={`${slot.id}-${row}`}>
                        {row === 0 && (
                          <td rowSpan={rowsPerSlot} className="shift-print-time">
                            {slot.start_at.slice(0,5)}〜{slot.end_at.slice(0,5)}
                          </td>
                        )}
                        {names.slice(row * colsPerRow, (row + 1) * colsPerRow).map((name, i2) => (
                          <td key={i2} className="shift-print-name">
                            {name && <span style={{ fontSize: printNameFontSize(name) }}>{name}</span>}
                          </td>
                        ))}
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
            )}
          </section>
        )
      })}
    </div>

    <style>{`
      .shift-print-view { display: none; }
      @media (max-width: 520px) {
        .shift-btn-label { display: none; }
      }
      @media print {
        /* ページ本体以外（管理画面の枠組み）を非表示にし、表だけを出力する */
        .shift-screen-view { display: none !important; }
        .admin-sidebar, .desktop-topbar, .mobile-header, .admin-overlay { display: none !important; }
        .admin-main { margin-left: 0 !important; }

        .shift-print-view { display: block; }
        @page { size: A4 portrait; margin: 14mm; }

        .shift-print-day { page-break-inside: avoid; }
        .shift-print-title {
          font-family: sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #000;
          margin-bottom: 12px;
        }
        .shift-print-empty {
          font-family: sans-serif;
          font-size: 12px;
          color: #000;
        }
        .shift-print-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          font-family: sans-serif;
          font-size: 12px;
          color: #000;
        }
        .shift-print-table th,
        .shift-print-table td {
          border: 1px solid #000;
          padding: 3px 8px;
          text-align: center;
          overflow: hidden;
        }
        .shift-print-table th:first-child,
        .shift-print-time {
          width: 28mm;
          white-space: nowrap;
          overflow: visible;
          font-weight: 700;
          vertical-align: middle;
        }
        .shift-print-name {
          padding: 2px 4px;
          vertical-align: middle;
          white-space: nowrap;
        }
        .shift-print-name span {
          display: inline-block;
          max-width: 100%;
          overflow: hidden;
        }
      }
    `}</style>
    </>
  )
}

const thS: React.CSSProperties = {
  padding:'10px 12px', background:'#f8fafc', border:'1px solid #e2e8f0',
  fontFamily:"'Kiwi Maru',serif", fontSize:11, color:'#64748b', fontWeight:700, textAlign:'left',
}
const tdS: React.CSSProperties = {
  padding:'10px 12px', border:'1px solid #f1f5f9',
  fontFamily:"'Kaisei Decol',serif", fontSize:13, color:'#1e293b',
}
