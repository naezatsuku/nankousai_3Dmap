'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageLoader from '@/components/ui/PageLoader'
import NotificationBanner from '@/components/ui/NotificationBanner'

interface StudentProfile {
  id:          string
  name:        string
  email:       string
  school_type: string
  grade:       number
  class_num:   number
  student_num: number
}

interface Exhibit { id: string; name: string; class_label: string | null }

// grade + school_type → 表示文字列  例: high,4 → "高1"
function gradeLabel(school_type: string, grade: number): string {
  if (school_type === 'high')   return `高${grade - 3}`
  if (school_type === 'middle') return `中${grade}`
  return `${grade}`
}

function classLabel(p: StudentProfile): string {
  return `${gradeLabel(p.school_type, p.grade)}-${p.class_num}`
}

export default function ShiftMembersPage() {
  const router = useRouter()
  const [myRole,     setMyRole]     = useState('')
  const [exhibits,   setExhibits]   = useState<Exhibit[]>([])
  const [exhibitId,  setExhibitId]  = useState<string | null>(null)
  const [students,   setStudents]   = useState<StudentProfile[]>([])
  const [assigned,   setAssigned]   = useState<Set<string>>(new Set())
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [filterClass,setFilterClass]= useState<string>('all')

  // 現在選択中の展示のクラスラベル（★ フィルター判定用）
  const [myExhibitClasses, setMyExhibitClasses] = useState<Set<string>>(new Set())

  const loadAssigned = useCallback(async (eid: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('student_exhibits')
      .select('user_id')
      .eq('exhibit_id', eid)
    setAssigned(new Set(((data ?? []) as { user_id: string }[]).map(r => r.user_id)))
  }, [])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const role = (profile as { role: string } | null)?.role ?? ''
      setMyRole(role)
      if (role === 'student') { router.push('/admin/shift/view'); return }

      // 担当展示を取得
      // 全 student を先行取得開始（exhibit 取得・loadAssigned と並列で走る）
      const studentsPromise = supabase
        .from('profiles')
        .select('id, name, email, school_type, grade, class_num, student_num')
        .eq('role', 'student')
        .order('grade').order('class_num').order('student_num')

      if (role === 'admin') {
        const { data: allEx } = await supabase
          .from('exhibits').select('id, name, class_label').order('class_label', { nullsFirst: false })
        const allExArr = (allEx ?? []) as Exhibit[]
        setExhibits(allExArr)
        // admin は全展示なので ★ なし
        if (allExArr.length > 0) {
          setExhibitId(allExArr[0].id)
          await loadAssigned(allExArr[0].id)
        }
      } else {
        const { data: links } = await supabase
          .from('exhibit_editors')
          .select('exhibit_id, exhibits(id, name, class_label)')
          .eq('user_id', user.id)
        type LinkRow = { exhibit_id: string; exhibits: Exhibit | null }
        const exs = ((links ?? []) as unknown as LinkRow[]).map(l => l.exhibits).filter(Boolean) as Exhibit[]
        setExhibits(exs)
        if (exs.length > 0) {
          setExhibitId(exs[0].id)
          // 最初の展示のクラスラベルを ★ 対象として設定
          if (exs[0].class_label) setMyExhibitClasses(new Set([exs[0].class_label]))
          await loadAssigned(exs[0].id)
        }
      }

      const { data: stuData } = await studentsPromise
      setStudents((stuData ?? []) as StudentProfile[])
      setLoading(false)
    }
    init()
  }, [router, loadAssigned])

  useEffect(() => {
    if (!exhibitId) return
    const tid = setTimeout(() => {
      loadAssigned(exhibitId)
      // 選択中の展示のクラスラベルのみを ★ 対象に更新
      const ex = exhibits.find(e => e.id === exhibitId)
      setMyExhibitClasses(ex?.class_label ? new Set([ex.class_label]) : new Set())
    }, 0)
    return () => clearTimeout(tid)
  }, [exhibitId, exhibits, loadAssigned])


  const toggle = (userId: string) => {
    setAssigned(prev => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  const handleSave = async () => {
    if (!exhibitId) return
    setSaving(true)
    await fetch('/api/shift/members', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exhibitId, userIds: [...assigned] }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // クラスラベル一覧（フィルター用）
  const classOptions = [...new Set(students.map(s => classLabel(s)))].sort()

  const filtered = filterClass === 'all'
    ? students
    : students.filter(s => classLabel(s) === filterClass)


  // 一括割当：フィルター中の生徒全員を割り当て
  const bulkAssign = () => {
    setAssigned(prev => {
      const next = new Set(prev)
      filtered.forEach(s => next.add(s.id))
      return next
    })
  }

  // 一括解除：フィルター中の生徒全員を解除
  const bulkRemove = () => {
    setAssigned(prev => {
      const next = new Set(prev)
      filtered.forEach(s => next.delete(s.id))
      return next
    })
  }

  if (loading) return (
    <PageLoader />
  )

  return (
    <div style={{ maxWidth:700 }}>
      <NotificationBanner />
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
          👤 メンバー管理
        </h1>
        <p style={{ fontSize:13, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
          生徒をクラスに割り当てます。割り当てた生徒はシフトアンケート・シフト表を利用できます。
        </p>
      </div>

      {/* 展示選択（複数の場合） */}
      {exhibits.length > 1 && (
        <>
          <div style={{ marginBottom:10, display:'flex', gap:6, flexWrap:'wrap' }}>
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

          {/* 現在操作中クラスの説明 */}
          {exhibitId && (() => {
            const current = exhibits.find(e => e.id === exhibitId)
            return (
              <div style={{
                marginBottom:16, padding:'12px 16px', borderRadius:12,
                background:'#f0f9ff', border:'1px solid #bae6fd',
                display:'flex', alignItems:'flex-start', gap:10,
              }}>
                <span style={{ fontSize:18, flexShrink:0 }}>ℹ️</span>
                <div>
                  <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:13, fontWeight:700, color:'#0c4a6e', marginBottom:3 }}>
                    現在 <span style={{ color:'#0284c7' }}>「{current?.class_label ?? current?.name}」</span> のメンバーを管理しています
                  </div>
                  <div style={{ fontSize:11, color:'#64748b', fontFamily:"'Kiwi Maru',serif", lineHeight:1.65 }}>
                    ここで割り当てた生徒は、<strong>{current?.class_label ?? current?.name}</strong> のシフトアンケートとシフト表を利用できるようになります。<br />
                    別のクラスのメンバーを管理するには、上のボタンで切り替えてください。
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* フィルターバー */}
      <div style={{
        background:'#fff', borderRadius:14, padding:'14px 16px', marginBottom:16,
        border:'1px solid #f1f5f9', boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
        display:'flex', flexWrap:'wrap', gap:10, alignItems:'center',
      }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#64748b', fontFamily:"'Kiwi Maru',serif", flexShrink:0 }}>
          クラスで絞り込み：
        </div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', flex:1 }}>
          <button onClick={() => setFilterClass('all')} style={{
            padding:'4px 12px', borderRadius:99, border:'none', cursor:'pointer',
            background: filterClass === 'all' ? '#1e293b' : '#f1f5f9',
            color: filterClass === 'all' ? '#fff' : '#64748b',
            fontSize:11, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
          }}>すべて</button>
          {classOptions.map(cl => (
            <button key={cl} onClick={() => setFilterClass(cl)} style={{
              padding:'4px 12px', borderRadius:99, border:'none', cursor:'pointer',
              background: filterClass === cl
                ? (myExhibitClasses.has(cl) ? '#FF6B00' : '#1e293b')
                : (myExhibitClasses.has(cl) ? '#fff8f0' : '#f1f5f9'),
              color: filterClass === cl ? '#fff' : (myExhibitClasses.has(cl) ? '#FF6B00' : '#64748b'),
              fontSize:11, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
              boxShadow: myExhibitClasses.has(cl) ? 'inset 0 0 0 1.5px #fed7aa' : 'none',
            }}>
              {cl}{myExhibitClasses.has(cl) ? ' ★' : ''}
            </button>
          ))}
        </div>

        {/* 一括操作ボタン */}
        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          <button onClick={bulkAssign} style={{
            padding:'5px 12px', borderRadius:8, border:'none', cursor:'pointer',
            background:'#f0fdf4', color:'#16a34a', fontSize:11, fontWeight:700,
            fontFamily:"'Kiwi Maru',serif", boxShadow:'inset 0 0 0 1px #86efac',
          }}>
            表示中を一括追加
          </button>
          <button onClick={bulkRemove} style={{
            padding:'5px 12px', borderRadius:8, border:'none', cursor:'pointer',
            background:'#fef2f2', color:'#dc2626', fontSize:11, fontWeight:700,
            fontFamily:"'Kiwi Maru',serif", boxShadow:'inset 0 0 0 1px #fca5a5',
          }}>
            表示中を一括解除
          </button>
        </div>
      </div>

      {/* 生徒リスト */}
      {students.length === 0 ? (
        <div style={{ color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13, padding:'24px 0' }}>
          student ロールのユーザーがいません。
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
          {filtered.map(s => {
            const isAssigned = assigned.has(s.id)
            const cl = classLabel(s)
            return (
              <div key={s.id} onClick={() => toggle(s.id)} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                borderRadius:12, cursor:'pointer',
                background: isAssigned ? '#f0fdf4' : '#fff',
                border: `1px solid ${isAssigned ? '#86efac' : '#f1f5f9'}`,
                transition:'all 0.12s',
              }}>
                {/* チェック */}
                <div style={{
                  width:22, height:22, borderRadius:6, border:'2px solid',
                  borderColor: isAssigned ? '#10b981' : '#cbd5e1',
                  background: isAssigned ? '#10b981' : '#fff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, color:'#fff', flexShrink:0, transition:'all 0.12s',
                }}>
                  {isAssigned ? '✓' : ''}
                </div>

                {/* 情報 */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight: isAssigned ? 700 : 400, color: isAssigned ? '#16a34a' : '#1e293b' }}>
                      {s.name || '（名前未設定）'}
                    </span>
                    <span style={{
                      fontSize:10, padding:'1px 7px', borderRadius:99,
                      background: myExhibitClasses.has(cl) ? '#fff8f0' : '#f1f5f9',
                      color: myExhibitClasses.has(cl) ? '#FF6B00' : '#94a3b8',
                      fontFamily:"'Kiwi Maru',serif", fontWeight:700,
                      border: myExhibitClasses.has(cl) ? '1px solid #fed7aa' : 'none',
                    }}>
                      {cl} {s.student_num}番
                    </span>
                  </div>
                  <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif' " }}>
                    {s.email}
                  </div>
                </div>

                <div style={{ fontSize:11, fontWeight:700, color: isAssigned ? '#10b981' : '#cbd5e1', fontFamily:"'Kiwi Maru',serif", flexShrink:0 }}>
                  {isAssigned ? '割当済' : '未割当'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 保存ボタン */}
      <button onClick={handleSave} disabled={saving || !exhibitId} style={{
        padding:'13px 40px', borderRadius:12, border:'none',
        cursor: (saving || !exhibitId) ? 'default' : 'pointer',
        background: saved ? '#10b981' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
        color:'#fff', fontSize:15, fontWeight:700, fontFamily:"'Kaisei Decol',serif",
        boxShadow: saved ? 'none' : '0 4px 16px rgba(255,107,0,0.3)', transition:'all 0.2s',
      }}>
        {saving ? '保存中…' : saved ? '✓ 保存しました' : '割り当てを保存する'}
      </button>

      <div style={{ marginTop:10, fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
        ★ マークは担当クラスと一致する学年組
      </div>
    </div>
  )
}
