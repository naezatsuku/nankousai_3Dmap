'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

const NAV = [
  { href:'/admin',               icon:'⊞', label:'ダッシュボード' },
  { href:'/admin/edit',          icon:'✏',  label:'展示編集' },
  { href:'/admin/notices',       icon:'🔔', label:'お知らせ管理' },
  { href:'/admin/announcements', icon:'📢', label:'アナウンス管理' },
  { href:'/admin/notify-test',   icon:'🧪', label:'通知テスト' },
  { href:'/admin/food',           icon:'🍱', label:'販売数管理' },
  { href:'/admin/users',         icon:'👥', label:'権限管理',       adminOnly:true },
  { href:'/admin/exhibits',      icon:'🏫', label:'団体管理',       adminOnly:true },
  { href:'/admin/settings',      icon:'⚙',  label:'サイト設定',     adminOnly:true },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname    = usePathname()
  const router      = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profile, setProfile]       = useState<Profile | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            const p = data as Profile
            setProfile(p)
            // 名前未設定＝初回ログイン → プロフィール設定へ誘導
            if (!p.name && pathname !== '/admin/profile') {
              router.push('/admin/profile?welcome=1')
            }
          }
        })
    })
  }, [pathname, router])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  if (pathname === '/admin/login' || pathname.startsWith('/admin/quick/')) return <>{children}</>

  const isAdmin     = profile?.role === 'admin'
  const displayName = profile?.name || '…'
  const visibleNav  = NAV.filter(n => !n.adminOnly || isAdmin)

  return (
    <>
      <style>{`
        @media (max-width:768px){
          .admin-sidebar{ transform: translateX(-100%); }
          .admin-sidebar.open{ transform: translateX(0); }
          .admin-main{ margin-left:0 !important; padding-top:52px !important; }
          .desktop-topbar{ display:none !important; }
        }
        @media (min-width:769px){
          .admin-overlay{ display:none !important; }
          .mobile-header{ display:none !important; }
        }
      `}</style>

      {/* ── モバイルヘッダー ── */}
      <div className="mobile-header" style={{
        position:'fixed', top:0, left:0, right:0, zIndex:60,
        height:52, background:'#0f172a',
        display:'flex', alignItems:'center', padding:'0 16px', gap:12,
      }}>
        <button onClick={()=>setMobileOpen(v=>!v)} style={{
          width:34, height:34, borderRadius:8, background:'rgba(255,255,255,0.08)',
          border:'none', color:'#fff', fontSize:18, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>☰</button>
        <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:16, fontWeight:700, color:'#fff' }}>
          南高祭 管理
        </span>
        <div style={{ marginLeft:'auto', fontSize:11, color:'rgba(255,255,255,0.5)' }}>
          {displayName}
        </div>
      </div>

      {/* ── オーバーレイ（モバイル） ── */}
      {mobileOpen && (
        <div className="admin-overlay" onClick={()=>setMobileOpen(false)} style={{
          position:'fixed', inset:0, zIndex:59,
          background:'rgba(0,0,0,0.4)', backdropFilter:'blur(2px)',
        }} />
      )}

      {/* ── サイドバー ── */}
      <aside className={`admin-sidebar${mobileOpen?' open':''}`} style={{
        position:'fixed', top:0, left:0, bottom:0, width:220, zIndex:70,
        background:'#0f172a', display:'flex', flexDirection:'column',
        transition:'transform 0.25s ease',
        boxShadow:'4px 0 24px rgba(0,0,0,0.2)',
      }}>
        {/* ロゴ */}
        <div style={{ padding:'24px 20px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:18, fontWeight:700, color:'#fff', marginBottom:2 }}>
            南高祭 管理画面
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)' }}>Admin Dashboard</div>
        </div>

        {/* ナビ */}
        <nav style={{ flex:1, padding:'12px 10px', overflowY:'auto' }}>
          {visibleNav.map(item => {
            const active = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                onClick={()=>setMobileOpen(false)}
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'10px 12px', borderRadius:10, marginBottom:2,
                  background: active ? 'rgba(255,107,0,0.18)' : 'transparent',
                  color: active ? '#FF8C00' : 'rgba(255,255,255,0.55)',
                  textDecoration:'none', fontSize:13, fontWeight: active ? 700 : 400,
                  fontFamily:"'Kiwi Maru',serif",
                  transition:'all 0.15s',
                  borderLeft: active ? '3px solid #FF8C00' : '3px solid transparent',
                }}>
                <span style={{ fontSize:16 }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* ユーザー情報 */}
        <div style={{ padding:'16px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/admin/profile" onClick={()=>setMobileOpen(false)} style={{
            display:'flex', alignItems:'center', gap:10, textDecoration:'none',
            padding:'6px 4px', borderRadius:10,
            background: pathname==='/admin/profile' ? 'rgba(255,107,0,0.12)' : 'transparent',
          }}>
            <div style={{
              width:36, height:36, borderRadius:'50%', flexShrink:0,
              background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:14, fontWeight:700, color:'#fff',
            }}>
              {displayName[0] ?? '?'}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:1 }}>{displayName}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', display:'flex', alignItems:'center', gap:4 }}>
                <span style={{
                  background: isAdmin ? 'rgba(255,107,0,0.3)' : 'rgba(255,255,255,0.1)',
                  color: isAdmin ? '#FF8C00' : 'rgba(255,255,255,0.5)',
                  padding:'1px 6px', borderRadius:99, fontSize:9, fontWeight:700,
                }}>
                  {isAdmin ? 'ADMIN' : 'EDITOR'}
                </span>
                <span style={{ color:'rgba(255,255,255,0.25)', fontSize:9 }}>プロフィール編集 ›</span>
              </div>
            </div>
          </Link>
          <button onClick={handleLogout} style={{
            display:'block', width:'100%', marginTop:10, padding:'8px 0', textAlign:'center',
            borderRadius:8, background:'rgba(255,255,255,0.06)',
            color:'rgba(255,255,255,0.4)', fontSize:11,
            fontFamily:"'Kiwi Maru',serif", border:'none', cursor:'pointer',
          }}>
            ログアウト
          </button>
        </div>
      </aside>

      {/* ── メインコンテンツ ── */}
      <main className="admin-main" style={{
        marginLeft:220, minHeight:'100vh',
        background:'#f8fafc', paddingTop:0,
      }}>
        {/* デスクトップトップバー */}
        <div className="desktop-topbar" style={{
          height:56, background:'#fff',
          borderBottom:'1px solid #e2e8f0',
          display:'flex', alignItems:'center', padding:'0 28px',
          position:'sticky', top:0, zIndex:40,
        }}>
          <Breadcrumb pathname={pathname} />
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
              {displayName}
            </div>
            <div style={{
              width:32, height:32, borderRadius:'50%',
              background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:13, fontWeight:700, color:'#fff',
            }}>
              {displayName[0] ?? '?'}
            </div>
          </div>
        </div>

        {/* ページ本体 */}
        <div style={{ padding:'28px', paddingTop:24 }}>
          {children}
        </div>
      </main>
    </>
  )
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const MAP: Record<string, string> = {
    '/admin':               'ダッシュボード',
    '/admin/edit':          '展示編集',
    '/admin/notices':       'お知らせ管理',
    '/admin/announcements': 'アナウンス管理',
    '/admin/users':         '権限管理',
    '/admin/exhibits':      '団体管理',
    '/admin/notify-test':   '通知テスト',
    '/admin/profile':       'プロフィール',
  }
  const label = Object.entries(MAP)
    .filter(([path]) => pathname.startsWith(path))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? ''
  return (
    <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:16, fontWeight:700, color:'#1e293b' }}>
      {label}
    </div>
  )
}
