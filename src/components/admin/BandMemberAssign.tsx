'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface MemberRow {
  user_id: string
  profile: { id: string; name: string | null; email: string } | null
}

interface ProfileOption { id: string; name: string | null; email: string }

/**
 * バンド担当者（band_editors）の割当UI。
 * 軽音展示の編集ページ（/admin/edit/[id] バンドタブ）から部長・admin が使う。
 * 担当者は /admin/band（マイバンド）で自分のバンドを編集・お知らせ投稿できる。
 */
export default function BandMemberAssign({ bandId }: { bandId: string }) {
  const isUnsaved = bandId.startsWith('new_')

  const [members, setMembers]         = useState<MemberRow[]>([])
  const [allProfiles, setAllProfiles] = useState<ProfileOption[] | null>(null)
  const [open, setOpen]               = useState(false)
  const [query, setQuery]             = useState('')

  const loadMembers = useCallback(() => {
    if (isUnsaved) return
    createClient()
      .from('band_editors')
      .select('user_id, profile:profiles(id, name, email)')
      .eq('band_id', bandId)
      .then(({ data }) => { if (data) setMembers(data as unknown as MemberRow[]) })
  }, [bandId, isUnsaved])

  useEffect(() => { loadMembers() }, [loadMembers])

  // 候補リストは「＋追加」を開いたときに一度だけ取得
  const openPicker = async () => {
    setOpen(v => !v)
    if (allProfiles === null) {
      const { data } = await createClient()
        .from('profiles')
        .select('id, name, email')
        .order('name')
      setAllProfiles((data ?? []) as ProfileOption[])
    }
  }

  const addMember = async (userId: string) => {
    await createClient().from('band_editors').insert({ band_id: bandId, user_id: userId })
    setQuery('')
    setOpen(false)
    loadMembers()
  }

  const removeMember = async (userId: string) => {
    await createClient().from('band_editors').delete()
      .eq('band_id', bandId).eq('user_id', userId)
    loadMembers()
  }

  if (isUnsaved) {
    return (
      <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginTop:4 }}>
        💡 保存するとこのバンドに担当者を割り当てられます
      </div>
    )
  }

  const memberIds  = new Set(members.map(m => m.user_id))
  const candidates = (allProfiles ?? [])
    .filter(p => !memberIds.has(p.id))
    .filter(p => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      return (p.name ?? '').toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    })
    .slice(0, 8)

  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
        {members.map(m => (
          <span key={m.user_id} style={{
            display:'inline-flex', alignItems:'center', gap:6,
            fontSize:11, padding:'4px 6px 4px 10px', borderRadius:99,
            background:'#faf5ff', color:'#7c3aed', border:'1px solid #d8b4fe',
            fontFamily:"'Kiwi Maru',serif", fontWeight:700,
          }}>
            {m.profile?.name || m.profile?.email || m.user_id.slice(0, 8)}
            <button
              onClick={() => removeMember(m.user_id)}
              title="担当から外す"
              style={{
                width:16, height:16, borderRadius:'50%', border:'none',
                background:'rgba(124,58,237,0.12)', color:'#7c3aed',
                fontSize:10, cursor:'pointer', lineHeight:1, padding:0,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}
            >✕</button>
          </span>
        ))}
        {members.length === 0 && (
          <span style={{ fontSize:11, color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif" }}>
            担当者なし
          </span>
        )}
        <button onClick={openPicker} style={{
          fontSize:11, padding:'4px 10px', borderRadius:99,
          border:'1.5px dashed #d8b4fe', background:'#fff', color:'#a855f7',
          cursor:'pointer', fontFamily:"'Kiwi Maru',serif", fontWeight:700,
        }}>
          ＋ 追加
        </button>
      </div>

      {open && (
        <div style={{
          marginTop:8, padding:10, borderRadius:10,
          border:'1px solid #e9d5ff', background:'#fdfaff',
        }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="名前またはメールで検索"
            autoFocus
            style={{
              width:'100%', padding:'7px 10px', borderRadius:8,
              border:'1px solid #e2e8f0', fontSize:12,
              fontFamily:"'Kiwi Maru',serif", color:'#1e293b',
              background:'#fff', boxSizing:'border-box', outline:'none',
              marginBottom:6,
            }}
          />
          {allProfiles === null ? (
            <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", padding:'6px 2px' }}>
              読み込み中…
            </div>
          ) : candidates.length === 0 ? (
            <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", padding:'6px 2px' }}>
              該当するユーザーがいません
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:2, maxHeight:180, overflowY:'auto' }}>
              {candidates.map(p => (
                <button key={p.id} onClick={() => addMember(p.id)} style={{
                  display:'flex', alignItems:'center', gap:8, textAlign:'left',
                  padding:'7px 8px', borderRadius:8, border:'none',
                  background:'transparent', cursor:'pointer',
                }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#1e293b', fontFamily:"'Kiwi Maru',serif" }}>
                    {p.name || '（名前未設定）'}
                  </span>
                  <span style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {p.email}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
