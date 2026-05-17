'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getReadIds } from '@/lib/notices'
import TabBar     from './TabBar'
import DesktopNav from './DesktopNav'

export default function TabBarWrapper() {
  const [unreadCount, setUnreadCount] = useState(0)



  useEffect(() => {
      const recalc = async () => {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('notices')
        .select('id')
        .order('created_at', { ascending: false })

      if (!data) return
      const readIds = getReadIds()
      setUnreadCount(data.filter((n: { id: string }) => !readIds.has(n.id)).length)
    } catch {
      // DB未接続時は何もしない
    }
  }
    recalc()

    // 既読変化イベント（同タブ）
    window.addEventListener('notices-read-changed', recalc)

    // Supabase Realtime — 新しいお知らせが来たら+1
    const supabase = createClient()
    const channel = supabase
      .channel('notices-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' }, () => {
        setUnreadCount(c => c + 1)
      })
      .subscribe()

    // フォーカス復帰時にも再計算（他タブで既読にした場合）
    window.addEventListener('focus', recalc)

    return () => {
      window.removeEventListener('notices-read-changed', recalc)
      window.removeEventListener('focus', recalc)
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <>
      <div className="sm:hidden">
        <TabBar unreadCount={unreadCount} />
      </div>
      <DesktopNav unreadCount={unreadCount} />
    </>
  )
}