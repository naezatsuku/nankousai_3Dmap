'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Step = 'form' | 'sent'

export default function AdminSignup() {
  const router = useRouter()
  const [step, setStep]           = useState<Step>('form')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const handleSubmit = async () => {
    setError('')

    if (!email || !password || !confirm) {
      setError('すべての項目を入力してください')
      return
    }
    if (password.length < 8) {
      setError('パスワードは8文字以上にしてください')
      return
    }
    if (password !== confirm) {
      setError('パスワードが一致しません')
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // メール確認後 /auth/callback → /admin/profile?welcome=1 へ
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (signUpError) {
      const msg =
        signUpError.message.includes('already registered') ||
        signUpError.message.includes('already been registered')
          ? 'このメールアドレスはすでに登録されています'
          : signUpError.message
      setError(msg)
      setLoading(false)
      return
    }

    // メール確認が無効化されている場合は即座にセッションが生成される
    if (data.session) {
      router.push('/admin/profile?welcome=1')
      router.refresh()
    } else {
      // メール確認フローが有効な場合
      setStep('sent')
    }
    setLoading(false)
  }

  // ── 確認メール送信済み画面 ──────────────────────────────────
  if (step === 'sent') {
    return (
      <div style={{
        minHeight:'100vh', background:'#0f172a',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:20,
      }}>
        <div style={{ width:'100%', maxWidth:380, textAlign:'center' }}>
          <div style={{
            width:64, height:64, borderRadius:'50%', margin:'0 auto 20px',
            background:'rgba(16,185,129,0.15)', border:'2px solid rgba(16,185,129,0.4)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:28,
          }}>✉️</div>

          <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#fff', marginBottom:10 }}>
            確認メールを送信しました
          </div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)', fontFamily:"'Kiwi Maru',serif", lineHeight:1.8, marginBottom:28 }}>
            <span style={{ color:'rgba(255,255,255,0.8)', fontWeight:700 }}>{email}</span>
            <br />
            に確認リンクを送りました。
            <br />
            メール内のリンクをクリックしてアカウントを有効化してください。
          </div>

          <div style={{
            background:'rgba(255,255,255,0.04)', borderRadius:14,
            padding:'14px 20px', border:'1px solid rgba(255,255,255,0.08)',
            fontSize:12, color:'rgba(255,255,255,0.4)', fontFamily:"'Kiwi Maru',serif",
            textAlign:'left', lineHeight:1.8, marginBottom:24,
          }}>
            <div style={{ color:'rgba(255,255,255,0.6)', fontWeight:700, marginBottom:6 }}>届かない場合</div>
            <div>• 迷惑メールフォルダを確認する</div>
            <div>• メールアドレスに誤りがないか確認する</div>
            <div>• 数分待ってから再度お試しください</div>
          </div>

          <Link href="/admin/login" style={{
            display:'block', padding:'12px 0', borderRadius:12,
            border:'1px solid rgba(255,255,255,0.12)',
            color:'rgba(255,255,255,0.6)', textDecoration:'none',
            fontSize:13, fontFamily:"'Kiwi Maru',serif",
          }}>
            ← ログイン画面に戻る
          </Link>
        </div>
      </div>
    )
  }

  // ── サインアップフォーム ────────────────────────────────────
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
            アカウント作成
          </div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)', fontFamily:"'Kiwi Maru',serif" }}>
            南高祭 管理画面
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

          <Field
            label="メールアドレス" type="email"
            value={email} onChange={setEmail}
            placeholder="your@email.com"
            onEnter={handleSubmit}
          />
          <Field
            label="パスワード（8文字以上）" type="password"
            value={password} onChange={setPassword}
            placeholder="••••••••"
            onEnter={handleSubmit}
          />
          <Field
            label="パスワード（確認）" type="password"
            value={confirm} onChange={setConfirm}
            placeholder="••••••••"
            onEnter={handleSubmit}
          />

          {/* パスワード強度インジケーター */}
          {password.length > 0 && (
            <div style={{ marginTop:-8, marginBottom:16 }}>
              <div style={{ display:'flex', gap:3, marginBottom:4 }}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} style={{
                    flex:1, height:3, borderRadius:99,
                    background: i < passwordStrength(password)
                      ? ['#ef4444','#f59e0b','#10b981','#10b981'][passwordStrength(password) - 1]
                      : 'rgba(255,255,255,0.1)',
                    transition:'background 0.2s',
                  }} />
                ))}
              </div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontFamily:"'Kiwi Maru',serif" }}>
                {['','弱い','普通','強い','とても強い'][passwordStrength(password)]}
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width:'100%', padding:'14px 0', borderRadius:12, border:'none', cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? 'rgba(255,107,0,0.4)' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
              color:'#fff', fontSize:15, fontWeight:700,
              fontFamily:"'Kaisei Decol',serif",
              transition:'opacity 0.2s',
              marginTop:8,
            }}
          >
            {loading ? '作成中…' : 'アカウントを作成'}
          </button>
        </div>

        {/* ログインリンク */}
        <div style={{ textAlign:'center', marginTop:20 }}>
          <span style={{ fontSize:12, color:'rgba(255,255,255,0.3)', fontFamily:"'Kiwi Maru',serif" }}>
            すでにアカウントをお持ちの方は
          </span>
          <Link href="/admin/login" style={{
            fontSize:12, color:'#FFAA28', fontWeight:700,
            textDecoration:'none', marginLeft:6, fontFamily:"'Kiwi Maru',serif",
          }}>
            ログイン →
          </Link>
        </div>
      </div>
    </div>
  )
}

/** パスワード強度スコア 0〜4 */
function passwordStrength(pw: string): number {
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) || /[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4)
}

function Field({ label, type, value, onChange, placeholder, onEnter }: {
  label: string; type: string; value: string
  onChange: (v: string) => void; placeholder: string
  onEnter: () => void
}) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>
        {label}
      </label>
      <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onEnter()}
        placeholder={placeholder}
        style={{
          width:'100%', padding:'11px 14px', borderRadius:10,
          background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
          color:'#fff', fontSize:14, outline:'none',
          fontFamily:"'Kiwi Maru',serif", boxSizing:'border-box',
        }}
      />
    </div>
  )
}
