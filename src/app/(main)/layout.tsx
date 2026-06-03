// (main)/layout.tsx
import type { ReactNode } from 'react'
import Header           from '@/components/ui/Header'
import TabBarWrapper    from '@/components/ui/TabBarWrapper'
import PullToRefresh    from '@/components/ui/PullToRefresh'
import NavigationLoader from '@/components/ui/NavigationLoader'

type LayoutProps = {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh', overflow:'hidden', overscrollBehavior:'none', touchAction:'pan-x pan-y' }}>
      <NavigationLoader />
      <Header />
      <PullToRefresh>
        {children}
      </PullToRefresh>
      <TabBarWrapper />
    </div>
  )
}