'use client'

import PageLoader from '@/components/ui/PageLoader'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

const GRADE_OPTIONS = [
  { value: 1, label: '中学1年' },
  { value: 2, label: '中学2年' },
  { value: 3, label: '中学3年' },
  { value: 4, label: '高校1年' },
  { value: 5, label: '高校2年' },
  { value: 6, label: '高校3年' },
]

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #e2e8f0', background: '#fff',
  fontSize: 14, color: '#1e293b', fontFamily: "'Kiwi Maru',serif",
  boxSizing: 'border-box',
}

// ── useSearchParams は Suspense 内でしか使えないため分離 ──────
function ProfileContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const isWelcome    = searchParams.get('welcome') === '1'

  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm]       = useState({ name: '', school_type: 'high', grade: 5, class_num: 1, student_num: 1 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            const p = data as Profile
            setProfile(p)
            setForm({
              name:         p.name,
              school_type:  p.school_type,
              grade:        p.grade,
              class_num:    p.class_num,
              student_num:  p.student_num,
            })
          }
          setLoading(false)
        })
    })
  }, [])

  const handleSave = async () => {
    if (!profile) return
    if (!form.name.trim()) { setError('氏名を入力してください'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('profiles')
      .update({
        name:        form.name.trim(),
        school_type: form.school_type,
        grade:       form.grade,
        class_num:   form.class_num,
        student_num: form.student_num,
      })
      .eq('id', profile.id)

    if (err) {
      setError('保存に失敗しました: ' + err.message)
      setSaving(false)
      return
    }

    setSaved(true)
    // ウェルカムフロー完了 → ダッシュボードへ
    if (isWelcome) {
      setTimeout(() => router.push('/admin'), 1200)
    } else {
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <PageLoader />
    )
  }

  return (
    <div style={{ maxWidth:520 }}>

      {/* ── ウェルカムバナー（初回のみ）── */}
      {isWelcome && (
        <div style={{
          marginBottom:24, padding:'20px 24px',
          borderRadius:16,
          background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
          color:'#fff',
          boxShadow:'0 8px 24px rgba(255,107,0,0.3)',
        }}>
          <div style={{ fontSize:22, marginBottom:6 }}>👋 ようこそ！</div>
          <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:18, fontWeight:700, marginBottom:6 }}>
            まずはプロフィールを設定してください
          </div>
          <div style={{ fontSize:12, opacity:0.85, fontFamily:"'Kiwi Maru',serif", lineHeight:1.6 }}>
            氏名を入力して保存すると、管理画面が使えるようになります。
          </div>
          {/* ステップインジケーター */}
          <div style={{ display:'flex', gap:6, marginTop:14, alignItems:'center' }}>
            <div style={{ width:24, height:24, borderRadius:'50%', background:'rgba(255,255,255,0.9)', color:'#FF6B00', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>1</div>
            <div style={{ fontSize:11, fontWeight:700 }}>プロフィール設定</div>
            <div style={{ width:20, height:2, background:'rgba(255,255,255,0.4)', borderRadius:99 }} />
            <div style={{ width:24, height:24, borderRadius:'50%', background:'rgba(255,255,255,0.25)', color:'rgba(255,255,255,0.7)', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>2</div>
            <div style={{ fontSize:11, opacity:0.7 }}>ダッシュボードへ</div>
          </div>
        </div>
      )}

      {/* ── ページタイトル（通常時）── */}
      {!isWelcome && (
        <div style={{ marginBottom:28 }}>
          <h2 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
            プロフィール編集
          </h2>
          <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
            基本情報を変更できます
          </div>
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:20, padding:'24px', boxShadow:'0 1px 8px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9' }}>

        {/* アバター */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:24 }}>
          <div style={{
            width:72, height:72, borderRadius:'50%',
            background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:28, fontWeight:700, color:'#fff',
          }}>
            {form.name?.[0]?.toUpperCase() ?? '?'}
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* メールアドレス（変更不可） */}
          <Field label="メールアドレス">
            <input value={profile?.email ?? ''} disabled
              style={{ ...inputStyle, background:'#f8fafc', color:'#94a3b8', cursor:'not-allowed' }} />
          </Field>

          {/* ロール（変更不可） */}
          <Field label="ロール">
            <input
              value={
                profile?.role === 'admin'   ? '管理者 (admin)' :
                profile?.role === 'student' ? '生徒 (student)' :
                                              '編集者 (editor)'
              }
              disabled
              style={{ ...inputStyle, background:'#f8fafc', color:'#94a3b8', cursor:'not-allowed' }}
            />
          </Field>

          {/* 氏名 */}
          <Field label="氏名 *">
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="例: 田中 颯"
              style={{
                ...inputStyle,
                border: isWelcome && !form.name.trim() ? '2px solid #FF8C00' : '1px solid #e2e8f0',
              }}
              autoFocus={isWelcome}
            />
            {isWelcome && !form.name.trim() && (
              <div style={{ fontSize:11, color:'#FF8C00', marginTop:4, fontFamily:"'Kiwi Maru',serif" }}>
                ← 氏名を入力してください
              </div>
            )}
          </Field>

          {/* 学校区分 */}
          <Field label="学校区分">
            <select value={form.school_type} onChange={e => setForm(f => ({ ...f, school_type: e.target.value }))} style={inputStyle}>
              <option value="middle">中学</option>
              <option value="high">高校</option>
            </select>
          </Field>

          {/* 学年・組・出席番号 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <Field label="学年">
              <select value={form.grade}
                onChange={e => setForm(f => ({ ...f, grade: Number(e.target.value) as Profile['grade'] }))}
                style={inputStyle}>
                {GRADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="組">
              <select value={form.class_num}
                onChange={e => setForm(f => ({ ...f, class_num: Number(e.target.value) as Profile['class_num'] }))}
                style={inputStyle}>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}組</option>)}
              </select>
            </Field>
            <Field label="出席番号">
              <input type="number" min={1} max={50}
                value={form.student_num}
                onChange={e => setForm(f => ({ ...f, student_num: Number(e.target.value) }))}
                style={inputStyle} />
            </Field>
          </div>
        </div>

        {/* エラー */}
        {error && (
          <div style={{ marginTop:16, padding:'10px 14px', borderRadius:8, background:'#fef2f2', color:'#ef4444', fontSize:12, fontFamily:"'Kiwi Maru',serif" }}>
            {error}
          </div>
        )}

        {/* 保存ボタン */}
        <div style={{ marginTop:24 }}>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            style={{
              width:'100%', padding:'13px 0', borderRadius:10, border:'none',
              background: saved
                ? '#10b981'
                : form.name.trim()
                  ? 'linear-gradient(135deg,#FF6B00,#FFAA28)'
                  : '#f1f5f9',
              color: form.name.trim() ? '#fff' : '#94a3b8',
              fontSize:14, fontWeight:700,
              cursor: form.name.trim() ? 'pointer' : 'not-allowed',
              fontFamily:"'Kiwi Maru',serif",
              boxShadow: form.name.trim() ? '0 4px 14px rgba(255,107,0,0.25)' : 'none',
              transition:'all 0.2s',
            }}
          >
            {saving ? '保存中…' :
             saved  ? (isWelcome ? '✓ 完了！ダッシュボードへ移動します…' : '✓ 保存しました') :
             isWelcome ? '設定を完了してはじめる →' : '変更を保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page: Suspense でラップして useSearchParams を有効化 ────────
export default function ProfilePage() {
  return (
    <Suspense fallback={
      <PageLoader />
    }>
      <ProfileContent />
    </Suspense>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, fontFamily:"'Kiwi Maru',serif" }}>
        {label}
      </label>
      {children}
    </div>
  )
}
