'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async () => {
    if (!email || !password) { setError('メールアドレスとパスワードを入力してください'); return }
    setLoading(true); setError('')
    // TODO: Supabase Auth に差し替え
    await new Promise(r => setTimeout(r, 800))
    if (email === 'admin@example.com' && password === 'password') {
      router.push('/admin')
    } else {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:'100vh', background:'#0f172a',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:20,
    }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        {/* ロゴ */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{
            width:56, height:56, borderRadius:16, margin:'0 auto 14px',
            background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:26,
          }}>🎪</div>
          <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#fff', marginBottom:4 }}>
            南高祭 管理画面
          </div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)', fontFamily:"'Kiwi Maru',serif" }}>
            登録されたアカウントでログインしてください
          </div>
        </div>

        {/* フォーム */}
        <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:20, padding:24, border:'1px solid rgba(255,255,255,0.08)' }}>
          {error && (
            <div style={{
              background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)',
              borderRadius:10, padding:'10px 14px', marginBottom:16,
              fontSize:12, color:'#fca5a5', fontFamily:"'Kiwi Maru',serif",
            }}>
              {error}
            </div>
          )}

          <Field label="メールアドレス" type="email" value={email} onChange={setEmail} placeholder="your@email.com" />
          <Field label="パスワード" type="password" value={password} onChange={setPassword} placeholder="••••••••" />

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width:'100%', padding:'14px 0', borderRadius:12, border:'none', cursor:'pointer',
              background: loading ? 'rgba(255,107,0,0.4)' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
              color:'#fff', fontSize:15, fontWeight:700,
              fontFamily:"'Kaisei Decol',serif",
              transition:'opacity 0.2s',
              marginTop:8,
            }}
          >
            {loading ? 'ログイン中…' : 'ログイン'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder }: {
  label:string; type:string; value:string; onChange:(v:string)=>void; placeholder:string
}) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>
        {label}
      </label>
      <input
        type={type} value={value}
        onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width:'100%', padding:'11px 14px', borderRadius:10,
          background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
          color:'#fff', fontSize:14, outline:'none',
          fontFamily:"'Kiwi Maru',serif",
        }}
      />
    </div>
  )
}