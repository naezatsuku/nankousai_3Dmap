'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

type NavItem = {
  href: string; icon: string; label: string
  adminOnly?: boolean; editorOk?: boolean; studentOk?: boolean
}
type NavGroup = {
  id:         string
  label:      string | null  // null = グループヘッダーなし（単独アイテム）
  icon?:      string
  adminOnly?: boolean
  editorOk?:  boolean
  studentOk?: boolean
  items:      NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id:'dashboard', label:null,
    editorOk:true,
    items:[
      { href:'/admin', icon:'⊞', label:'ダッシュボード', editorOk:true },
    ],
  },
  {
    id:'exhibit', label:'展示管理', icon:'🏫',
    editorOk:true,
    items:[
      { href:'/admin/edit',     icon:'✏',  label:'展示編集',     editorOk:true },
      { href:'/admin/notices',  icon:'🔔', label:'お知らせ管理', editorOk:true },
      { href:'/admin/food',     icon:'🍱', label:'販売数管理',   adminOnly:true },
      { href:'/admin/exhibits', icon:'🏫', label:'団体管理',     adminOnly:true },
    ],
  },
  {
    id:'announce', label:'告知・通知', icon:'📢',
    adminOnly:true,
    items:[
      { href:'/admin/announcements', icon:'📢', label:'アナウンス管理', adminOnly:true },
      { href:'/admin/notify-test',   icon:'🧪', label:'通知テスト',     adminOnly:true },
    ],
  },
  {
    id:'shift', label:'シフト管理', icon:'📅',
    editorOk:true, studentOk:true,
    items:[
      { href:'/admin/shift/survey',  icon:'📝', label:'アンケート',   editorOk:true, studentOk:true },
      { href:'/admin/shift/view',    icon:'📅', label:'シフト表',     editorOk:true, studentOk:true },
      { href:'/admin/shift/members', icon:'👤', label:'メンバー管理', editorOk:true },
      { href:'/admin/shift/edit',    icon:'✏',  label:'シフト編集',   editorOk:true },
    ],
  },
  {
    id:'system', label:'システム', icon:'⚙',
    adminOnly:true,
    items:[
      { href:'/admin/users',    icon:'👥', label:'権限管理',   adminOnly:true },
      { href:'/admin/settings', icon:'⚙',  label:'サイト設定', adminOnly:true },
    ],
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname    = usePathname()
  const router      = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profile,    setProfile]    = useState<Profile | null>(null)

  // pathname から現在のアクティブグループを計算（ロール不問）
  const activeGroupId = NAV_GROUPS.find(g =>
    g.items.some(item =>
      item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
    )
  )?.id ?? null

  // アクティブなグループを初期展開状態に含める
  const [openGroups, setOpenGroups] = useState<Set<string>>(() =>
    new Set(activeGroupId ? [activeGroupId] : [])
  )

  // パスが変わったらアクティブグループを自動展開
  useEffect(() => {
    if (activeGroupId) setOpenGroups(prev => new Set([...prev, activeGroupId]))
  }, [activeGroupId])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            const p = data as Profile
            setProfile(p)
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
  const isStudent   = profile?.role === 'student'
  const displayName = profile?.name || '…'

  // アイテムが表示可能か
  const itemVisible = (n: NavItem) => {
    if (isStudent) return !!n.studentOk
    if (!isAdmin)  return !n.adminOnly
    return true
  }
  // グループが表示可能か（1件以上表示できるアイテムがある）
  const groupVisible = (g: NavGroup) => {
    if (isStudent && !g.studentOk) return false
    return g.items.some(itemVisible)
  }
  const visibleGroups = NAV_GROUPS.filter(groupVisible)

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
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <Link href="/map" style={{
            width:34, height:34, borderRadius:8,
            background:'rgba(255,255,255,0.08)',
            border:'none', color:'#fff', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            textDecoration:'none',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/>
              <line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
          </Link>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>{displayName}</span>
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
        <nav style={{ flex:1, padding:'10px 10px', overflowY:'auto' }}>
          {visibleGroups.map(group => {
            const visibleItems = group.items.filter(itemVisible)
            const isOpen   = group.label === null || openGroups.has(group.id)
            const hasActive = visibleItems.some(item =>
              item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
            )

            // グループヘッダーなし（ダッシュボードなど単独アイテム）
            if (group.label === null) {
              return visibleItems.map(item => {
                const active = item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href)
                return (
                  <Link key={item.href} href={item.href}
                    onClick={() => setMobileOpen(false)}
                    style={{
                      display:'flex', alignItems:'center', gap:10,
                      padding:'9px 12px', borderRadius:10, marginBottom:2,
                      background: active ? 'rgba(255,107,0,0.18)' : 'transparent',
                      color: active ? '#FF8C00' : 'rgba(255,255,255,0.55)',
                      textDecoration:'none', fontSize:13, fontWeight: active ? 700 : 400,
                      fontFamily:"'Kiwi Maru',serif", transition:'all 0.15s',
                      borderLeft: active ? '3px solid #FF8C00' : '3px solid transparent',
                    }}>
                    <span style={{ fontSize:15 }}>{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })
            }

            // カテゴリーグループ（プルダウン）
            return (
              <div key={group.id} style={{ marginBottom:4 }}>
                {/* グループヘッダー */}
                <button
                  onClick={() => setOpenGroups(prev => {
                    const next = new Set(prev)
                    next.has(group.id) ? next.delete(group.id) : next.add(group.id)
                    return next
                  })}
                  style={{
                    width:'100%', display:'flex', alignItems:'center', gap:8,
                    padding:'8px 12px', borderRadius:10, border:'none', cursor:'pointer',
                    background: hasActive
                      ? 'rgba(255,107,0,0.12)'
                      : isOpen ? 'rgba(255,255,255,0.05)' : 'transparent',
                    color: hasActive ? '#FF8C00' : 'rgba(255,255,255,0.5)',
                    fontSize:11, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                    letterSpacing:'0.04em', transition:'all 0.15s',
                    textAlign:'left',
                  }}>
                  <span style={{ fontSize:14 }}>{group.icon}</span>
                  <span style={{ flex:1 }}>{group.label}</span>
                  <span style={{
                    fontSize:10, opacity:0.6,
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition:'transform 0.2s',
                    display:'inline-block',
                  }}>▼</span>
                </button>

                {/* アイテム一覧（折りたたみ） */}
                {isOpen && (
                  <div style={{ paddingLeft:6, marginTop:2 }}>
                    {visibleItems.map(item => {
                      const active = pathname.startsWith(item.href)
                      return (
                        <Link key={item.href} href={item.href}
                          onClick={() => setMobileOpen(false)}
                          style={{
                            display:'flex', alignItems:'center', gap:9,
                            padding:'8px 10px 8px 14px', borderRadius:8, marginBottom:1,
                            background: active ? 'rgba(255,107,0,0.18)' : 'transparent',
                            color: active ? '#FF8C00' : 'rgba(255,255,255,0.5)',
                            textDecoration:'none', fontSize:12, fontWeight: active ? 700 : 400,
                            fontFamily:"'Kiwi Maru',serif", transition:'all 0.15s',
                            borderLeft: active ? '2px solid #FF8C00' : '2px solid rgba(255,255,255,0.08)',
                          }}>
                          <span style={{ fontSize:13 }}>{item.icon}</span>
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
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
                  {isAdmin ? 'ADMIN' : isStudent ? 'STUDENT' : 'EDITOR'}
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
            <Link href="/map" style={{
              display:'flex', alignItems:'center', gap:5,
              padding:'6px 14px', borderRadius:8,
              background:'#f1f5f9', border:'1px solid #e2e8f0',
              color:'#475569', fontSize:12, fontWeight:700,
              fontFamily:"'Kiwi Maru',serif", textDecoration:'none',
              transition:'background 0.15s',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                <line x1="9" y1="3" x2="9" y2="18"/>
                <line x1="15" y1="6" x2="15" y2="21"/>
              </svg>
              マップ
            </Link>
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
