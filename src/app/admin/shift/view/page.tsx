'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Slot    { id: string; date: string; start_at: string; end_at: string; required_count: number }
interface Member  { user_id: string; profiles: { id: string; name: string } | null }
interface Assign  { slot_id: string; user_id: string }
interface Exhibit { id: string; name: string; class_label: string | null }

export default function ShiftViewPage() {
  const router = useRouter()
  const [exhibits,   setExhibits]   = useState<Exhibit[]>([])
  const [exhibitId,  setExhibitId]  = useState<string | null>(null)
  const [myUserId,   setMyUserId]   = useState('')
  const [role,       setRole]       = useState('')
  const [date,       setDate]       = useState<'sat'|'sun'>('sat')
  const [slots,      setSlots]      = useState<Slot[]>([])
  const [members,    setMembers]    = useState<Member[]>([])
  const [assigns,    setAssigns]    = useState<Assign[]>([])
  const [loading,    setLoading]    = useState(true)
  const [dataLoading,setDataLoading]= useState(false)
  const [noExhibit,  setNoExhibit]  = useState(false)

  const fetchAll = useCallback(async (eid: string, d: 'sat'|'sun') => {
    setDataLoading(true)
    const res  = await fetch(`/api/shift/assignments?exhibitId=${eid}&date=${d}`)
    const data = await res.json() as { slots: Slot[]; members: Member[]; assignments: Assign[] }
    setSlots(data.slots ?? [])
    setMembers(data.members ?? [])
    setAssigns(data.assignments ?? [])
    setDataLoading(false)
  }, [])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      setMyUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const r = (profile as { role: string } | null)?.role ?? ''
      setRole(r)

      const table = r === 'editor' ? 'exhibit_editors' : 'student_exhibits'
      const { data: links } = await supabase
        .from(table)
        .select('exhibit_id, exhibits(id, name, class_label)')
        .eq('user_id', user.id)
      // admin でも割り当てクラスがある場合はそちらを優先

      type LinkRow = { exhibit_id: string; exhibits: Exhibit | null }
      const exs = ((links ?? []) as unknown as LinkRow[])
        .map(l => l.exhibits).filter(Boolean) as Exhibit[]

      if (exs.length === 0) { setNoExhibit(true); setLoading(false); return }
      setExhibits(exs)
      setExhibitId(exs[0].id)
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    if (exhibitId) fetchAll(exhibitId, date)
  }, [exhibitId, date, fetchAll])

  const assignMap = new Map<string, Set<string>>()
  for (const a of assigns) {
    if (!assignMap.has(a.slot_id)) assignMap.set(a.slot_id, new Set())
    assignMap.get(a.slot_id)!.add(a.user_id)
  }

  const currentExhibit = exhibits.find(e => e.id === exhibitId)

  if (loading) return (
    <div style={{ textAlign:'center', padding:'60px 0', color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>読み込み中…</div>
  )
  if (noExhibit) return (
    <div style={{ maxWidth:600 }}>
      <h1 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#1e293b', marginBottom:8 }}>シフト表</h1>
      <p style={{ color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>クラスが割り当てられていません。</p>
    </div>
  )

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#1e293b', marginBottom:4 }}>📅 シフト表</h1>
          <div style={{ fontSize:13, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
            {currentExhibit?.class_label ?? currentExhibit?.name}
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
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
        </div>
      </div>

      {/* クラス選択（複数の場合） */}
      {exhibits.length > 1 && (
        <div style={{ marginBottom:16, display:'flex', gap:6, flexWrap:'wrap' }}>
          {exhibits.map(ex => (
            <button key={ex.id} onClick={() => setExhibitId(ex.id)} style={{
              padding:'6px 16px', borderRadius:99, border:'none', cursor:'pointer',
              background: exhibitId === ex.id ? '#1e293b' : '#f1f5f9',
              color: exhibitId === ex.id ? '#fff' : '#64748b',
              fontWeight:700, fontSize:12, fontFamily:"'Kiwi Maru',serif", transition:'all 0.15s',
            }}>
              {ex.class_label ?? ex.name}
            </button>
          ))}
        </div>
      )}

      {dataLoading ? (
        <div style={{ color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13, padding:'20px 0' }}>読み込み中…</div>
      ) : slots.length === 0 ? (
        <div style={{ color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13, padding:'20px 0' }}>
          この日のシフトはまだ設定されていません。
        </div>
      ) : (
        <div>
          <table style={{ borderCollapse:'collapse', width:'100%', maxWidth:600 }}>
            <thead>
              <tr>
                <th style={{ padding:'10px 16px', background:'#f8fafc', border:'1px solid #e2e8f0', fontFamily:"'Kiwi Maru',serif", fontSize:11, color:'#64748b', fontWeight:700, textAlign:'left', whiteSpace:'nowrap', width:120 }}>
                  時間
                </th>
                <th style={{ padding:'10px 16px', background:'#f8fafc', border:'1px solid #e2e8f0', fontFamily:"'Kiwi Maru',serif", fontSize:11, color:'#64748b', fontWeight:700, textAlign:'left' }}>
                  メンバー
                </th>
                <th style={{ padding:'10px 12px', background:'#f8fafc', border:'1px solid #e2e8f0', fontFamily:"'Kiwi Maru',serif", fontSize:11, color:'#94a3b8', fontWeight:700, textAlign:'center', width:70 }}>
                  人数
                </th>
              </tr>
            </thead>
            <tbody>
              {slots.map(slot => {
                const slotAssigns = assignMap.get(slot.id) ?? new Set()
                const filled = slotAssigns.size
                const short  = filled < slot.required_count
                const assignedMembers = members.filter(m => slotAssigns.has(m.user_id))
                return (
                  <tr key={slot.id}>
                    <td style={{ padding:'10px 16px', border:'1px solid #e2e8f0', fontFamily:"'Kaisei Decol',serif", fontSize:13, fontWeight:700, color:'#1e293b', whiteSpace:'nowrap', verticalAlign:'middle' }}>
                      {slot.start_at.slice(0,5)}〜{slot.end_at.slice(0,5)}
                    </td>
                    <td style={{ padding:'8px 16px', border:'1px solid #e2e8f0', verticalAlign:'middle' }}>
                      {assignedMembers.length === 0 ? (
                        <span style={{ fontSize:12, color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif" }}>未割当</span>
                      ) : (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                          {assignedMembers.map(m => {
                            const isMe = m.user_id === myUserId
                            return (
                              <span key={m.user_id} style={{
                                fontSize:12, fontWeight: isMe ? 700 : 400,
                                padding:'3px 10px', borderRadius:99,
                                background: isMe ? '#fff8f0' : '#f0fdf4',
                                color: isMe ? '#FF6B00' : '#16a34a',
                                border: `1px solid ${isMe ? '#fed7aa' : '#86efac'}`,
                                fontFamily:"'Kiwi Maru',serif",
                              }}>
                                {m.profiles?.name ?? '?'}{isMe ? ' (自分)' : ''}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </td>
                    <td style={{
                      padding:'8px 12px', border:'1px solid #e2e8f0', textAlign:'center',
                      fontFamily:"'Kaisei Decol',serif", fontSize:13, fontWeight:700,
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
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginTop:16, flexWrap:'wrap' }}>
        <span style={{ fontSize:11, padding:'3px 10px', borderRadius:99, background:'#fff8f0', color:'#FF6B00', border:'1px solid #fed7aa', fontFamily:"'Kiwi Maru',serif" }}>
          自分のシフト
        </span>
        <span style={{ fontSize:11, padding:'3px 10px', borderRadius:99, background:'#f0fdf4', color:'#16a34a', border:'1px solid #86efac', fontFamily:"'Kiwi Maru',serif" }}>
          他のメンバー
        </span>
        <span style={{ fontSize:11, color:'#dc2626', fontFamily:"'Kiwi Maru',serif", alignSelf:'center' }}>
          ⚠ 赤字＝人数不足
        </span>
      </div>

      {(role === 'editor' || role === 'admin') && (
        <div style={{ marginTop:24, padding:'14px 16px', borderRadius:12, background:'#f8fafc', border:'1px solid #e2e8f0' }}>
          <a href="/admin/shift/edit" style={{ fontSize:13, fontWeight:700, color:'#FF6B00', fontFamily:"'Kiwi Maru',serif", textDecoration:'none' }}>
            ✏ シフト編集ページへ →
          </a>
        </div>
      )}
    </div>
  )
}
