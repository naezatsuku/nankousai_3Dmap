// (main)/layout.tsx
import type { ReactNode } from 'react'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import Header           from '@/components/ui/Header'
import TabBarWrapper    from '@/components/ui/TabBarWrapper'
import PullToRefresh    from '@/components/ui/PullToRefresh'
import NavigationLoader from '@/components/ui/NavigationLoader'
import SiteClosedPage   from '@/components/ui/SiteClosedPage'
import PrivateSiteBanner from '@/components/ui/PrivateSiteBanner'

type LayoutProps = {
  children: ReactNode
}

const PRIVILEGED_ROLES = ['admin', 'editor', 'teacher'] as const

function serviceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export default async function Layout({ children }: LayoutProps) {
  let bannerRole: string | null = null

  if (process.env.NODE_ENV !== 'development') {
    const { data: settings } = await serviceDb()
      .from('site_settings')
      .select('is_public')
      .single()

    const isPublic = (settings as { is_public?: boolean } | null)?.is_public ?? true

    if (!isPublic) {
      const supabase = await createServerClient()
      const { data: { user } } = await supabase.auth.getUser()

      let role: string | null = null
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        role = (profile as { role: string } | null)?.role ?? null
      }

      if (!role || !(PRIVILEGED_ROLES as readonly string[]).includes(role)) {
        return <SiteClosedPage />
      }

      bannerRole = role
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh', overflow:'hidden', overscrollBehavior:'none', touchAction:'pan-x pan-y' }}>
      <NavigationLoader />
      <Header />
      {bannerRole && <PrivateSiteBanner role={bannerRole} />}
      <PullToRefresh>
        {children}
      </PullToRefresh>
      <TabBarWrapper />
    </div>
  )
}
