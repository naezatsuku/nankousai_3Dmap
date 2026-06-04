'use client'

import PageLoader from '@/components/ui/PageLoader'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface MenuItem {
  id: string
  name: string
  price: number
  sold_count: number
}

interface Stall {
  id: string
  name: string
  class_label: string | null
  menus: MenuItem[]
}

export default function AdminFoodPage() {
  const router = useRouter()
  const [stalls,  setStalls]  = useState<Stall[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<Record<string, boolean>>({})
  const [saved,   setSaved]   = useState<Record<string, boolean>>({})
  // localDraft: menuId → sold_count の編集中の値
  const [draft, setDraft] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/admin/login'); return }
    const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if ((p as { role: string } | null)?.role !== 'admin') { router.push('/admin'); return }

    const { data } = await supabase
      .from('food_menus')
      .select('id, name, price, sold_count, exhibit_id, exhibits(id, name, class_label)')
      .order('exhibit_id')
      .order('name')

    if (!data) { setLoading(false); return }

    // exhibit ごとにグループ化
    const stallMap = new Map<string, Stall>()
    for (const row of data as unknown as {
      id: string; name: string; price: number; sold_count: number; exhibit_id: string
      exhibits: { id: string; name: string; class_label: string | null } | null
    }[]) {
      const ex = row.exhibits
      const key = row.exhibit_id
      if (!stallMap.has(key)) {
        stallMap.set(key, {
          id: key,
          name: ex?.name ?? key,
          class_label: ex?.class_label ?? null,
          menus: [],
        })
      }
      stallMap.get(key)!.menus.push({
        id: row.id, name: row.name, price: row.price, sold_count: row.sold_count,
      })
    }

    const stalls = Array.from(stallMap.values())
    setStalls(stalls)

    // draft を初期化
    const d: Record<string, number> = {}
    for (const s of stalls) for (const m of s.menus) d[m.id] = m.sold_count
    setDraft(d)
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const setDraftValue = (menuId: string, val: number) => {
    setDraft(prev => ({ ...prev, [menuId]: Math.max(0, val) }))
  }

  const save = async (menuId: string) => {
    if (saving[menuId]) return
    setSaving(prev => ({ ...prev, [menuId]: true }))
    const { error } = await createClient()
      .from('food_menus')
      .update({ sold_count: draft[menuId] })
      .eq('id', menuId)
    setSaving(prev => ({ ...prev, [menuId]: false }))
    if (!error) {
      // ローカル state も更新
      setStalls(prev => prev.map(s => ({
        ...s,
        menus: s.menus.map(m => m.id === menuId ? { ...m, sold_count: draft[menuId] } : m),
      })))
      setSaved(prev => ({ ...prev, [menuId]: true }))
      setTimeout(() => setSaved(prev => ({ ...prev, [menuId]: false })), 1800)
    }
  }

  const btnStyle = (color: string, disabled: boolean): React.CSSProperties => ({
    width: 36, height: 36, borderRadius: 8, border: 'none',
    background: disabled ? '#f1f5f9' : color,
    color: disabled ? '#cbd5e1' : '#fff',
    fontSize: 18, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    transition: 'background 0.15s',
  })

  return (
    <div style={{ maxWidth: 700 }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin" style={{ fontSize: 12, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", textDecoration: 'none' }}>
          ← ダッシュボード
        </Link>
        <h1 style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 22, fontWeight: 700, color: '#1e293b', marginTop: 8, marginBottom: 4 }}>
          🍱 販売数管理
        </h1>
        <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>
          各クラスのフードメニューの販売数を編集します。
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : stalls.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 16px',
          background: '#f8fafc', borderRadius: 16,
          color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", fontSize: 13, lineHeight: 2,
          border: '1px dashed #e2e8f0',
        }}>
          フードメニューがまだ登録されていません。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {stalls.map(stall => (
            <div key={stall.id} style={{
              background: '#fff', borderRadius: 16, overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
            }}>
              {/* クラスヘッダー */}
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid #f1f5f9',
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'linear-gradient(135deg,#fff7ed,#fff)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg,#FF6B00,#FFAA28)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>🍳</div>
                <div>
                  {stall.class_label && (
                    <div style={{ fontSize: 10, color: '#f97316', fontFamily: "'Kiwi Maru',serif", fontWeight: 700 }}>
                      {stall.class_label}
                    </div>
                  )}
                  <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                    {stall.name}
                  </div>
                </div>
              </div>

              {/* メニュー行 */}
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stall.menus.map(menu => {
                  const val = draft[menu.id] ?? menu.sold_count
                  const isSaving = !!saving[menu.id]
                  const isSaved  = !!saved[menu.id]
                  const isDirty  = val !== menu.sold_count

                  return (
                    <div key={menu.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 12,
                      background: isDirty ? '#fffbeb' : '#f8fafc',
                      border: `1px solid ${isDirty ? '#fde68a' : '#f1f5f9'}`,
                      transition: 'all 0.15s',
                    }}>
                      {/* 名前・価格 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 14, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {menu.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>
                          ¥{menu.price.toLocaleString()}
                        </div>
                      </div>

                      {/* カウンター */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          style={btnStyle('#64748b', val <= 0)}
                          disabled={val <= 0}
                          onMouseDown={() => setDraftValue(menu.id, val - 1)}
                        >−</button>

                        <input
                          type="number"
                          min={0}
                          value={val}
                          onChange={e => setDraftValue(menu.id, parseInt(e.target.value) || 0)}
                          style={{
                            width: 56, height: 36, textAlign: 'center', borderRadius: 8,
                            border: `1px solid ${isDirty ? '#fbbf24' : '#e2e8f0'}`,
                            fontFamily: "'Kaisei Decol',serif", fontSize: 15, fontWeight: 700,
                            color: '#1e293b', background: '#fff', outline: 'none',
                          }}
                        />

                        <button
                          style={btnStyle('#FF6B00', false)}
                          onMouseDown={() => setDraftValue(menu.id, val + 1)}
                        >＋</button>
                      </div>

                      {/* 保存ボタン */}
                      <button
                        onClick={() => save(menu.id)}
                        disabled={!isDirty || isSaving}
                        style={{
                          padding: '0 14px', height: 36, borderRadius: 8, border: 'none',
                          cursor: isDirty && !isSaving ? 'pointer' : 'default',
                          fontFamily: "'Kiwi Maru',serif", fontSize: 12, fontWeight: 700,
                          flexShrink: 0,
                          background: isSaved ? '#10b981' : isDirty ? '#FF6B00' : '#e2e8f0',
                          color: isDirty || isSaved ? '#fff' : '#94a3b8',
                          transition: 'all 0.15s',
                        }}
                      >
                        {isSaving ? '…' : isSaved ? '✓' : '保存'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
