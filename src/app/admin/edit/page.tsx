'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Exhibit } from '@/types'

const WAIT_COLOR = (w: number) =>
  w >= 30 ? '#ef4444' : w >= 15 ? '#f59e0b' : w > 0 ? '#10b981' : '#94a3b8'

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  class:     { label:'展示',   color:'#6366f1' },
  food:      { label:'フード', color:'#f59e0b' },
  band:      { label:'軽音',   color:'#a855f7' },
  special:   { label:'特別',   color:'#0ea5e9' },
  cafeteria: { label:'食堂',   color:'#10b981' },
}

export default function EditListPage() {
  const [exhibits, setExhibits] = useState<Exhibit[]>([])
  const [loading, setLoading]   = useState(true)
  const [isEditor, setIsEditor] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = (profile as { role: string } | null)?.role ?? 'editor'
      setIsEditor(role === 'editor')

      if (role === 'editor') {
        // editor: 担当展示のみ
        const { data: assignments } = await supabase
          .from('exhibit_editors')
          .select('exhibit_id')
          .eq('user_id', user.id)

        const ids = (assignments ?? []).map((a: { exhibit_id: string }) => a.exhibit_id)

        if (ids.length === 0) {
          setExhibits([])
          setLoading(false)
          return
        }

        const { data } = await supabase
          .from('exhibits')
          .select('id, name, class_label, type, room_display, floor, wait_minutes, is_active')
          .in('id', ids)
          .order('floor')
        if (data) setExhibits(data as Exhibit[])
      } else {
        // admin: 全展示
        const { data } = await supabase
          .from('exhibits')
          .select('id, name, class_label, type, room_display, floor, wait_minutes, is_active')
          .order('floor')
        if (data) setExhibits(data as Exhibit[])
      }

      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div style={{ maxWidth:900, textAlign:'center', padding:'60px 0', color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13 }}>
        読み込み中…
      </div>
    )
  }

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h2 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#1e293b', marginBottom:3 }}>
            {isEditor ? '担当展示' : '展示一覧'}
          </h2>
          <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
            {isEditor ? '担当に割り当てられた展示のみ表示されます' : 'クリックして編集・待ち時間更新'}
          </div>
        </div>
      </div>

      {exhibits.length === 0 ? (
        <div style={{
          textAlign:'center', padding:'60px 0',
          color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", fontSize:13,
        }}>
          {isEditor
            ? '担当展示がまだ割り当てられていません。管理者に連絡してください。'
            : '展示が登録されていません'}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {exhibits.map(ex => {
            const tc = TYPE_CONFIG[ex.type] ?? TYPE_CONFIG.class
            return (
              <Link key={ex.id} href={`/admin/edit/${ex.id}`} style={{
                display:'flex', alignItems:'center', gap:16,
                background:'#fff', borderRadius:14, padding:'14px 18px',
                textDecoration:'none', border:'1px solid #f1f5f9',
                boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
                opacity: ex.is_active ? 1 : 0.5,
              }}>
                <div style={{
                  fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:99,
                  background:`${tc.color}18`, color:tc.color,
                  flexShrink:0, fontFamily:"'Kiwi Maru',serif",
                }}>
                  {tc.label}
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#1e293b' }}>
                    {ex.class_label && <span style={{ color:'#94a3b8', fontWeight:400, marginRight:6, fontSize:13 }}>{ex.class_label}</span>}
                    {ex.name}
                  </div>
                  <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                    {ex.floor ? `${ex.floor}F` : '—'} · {ex.room_display || '場所未設定'}
                  </div>
                </div>

                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:18, fontWeight:700, color:WAIT_COLOR(ex.wait_minutes), fontFamily:"'Kaisei Decol',serif" }}>
                    {ex.wait_minutes > 0 ? `${ex.wait_minutes}分` : '−'}
                  </div>
                  <div style={{ fontSize:10, color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif" }}>待ち</div>
                </div>

                <div style={{ color:'#cbd5e1', fontSize:18, flexShrink:0 }}>›</div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
