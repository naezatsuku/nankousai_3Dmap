// (main)/layout.tsx
import type { ReactNode } from 'react'
import Header from '@/components/ui/Header'
import TabBar  from '@/components/ui/TabBar'

type LayoutProps = {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh' }}>
      <Header announcements={[]} />        {/* Supabaseから通知を渡す */}
      <main style={{ flex:1, overflowY:'auto', position:'relative' }}>{children}</main>
      <TabBar unreadCount={1} />    {/* 未読数を渡す */}
    </div>
  )
}