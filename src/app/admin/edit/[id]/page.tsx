'use client'

import PageLoader from '@/components/ui/PageLoader'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ImageUpload from '@/components/ui/ImageUpload'
import BandMemberAssign from '@/components/admin/BandMemberAssign'
import { logActivity } from '@/lib/activity-log'

function fmtTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── 型 ────────────────────────────────────────────────────────
type BodySegment =
  | { type:'text'; text:string }
  | { type:'link'; label:string; href:string }
  | { type:'break' }

interface SectionMediaItem  { id:string; url:string; type:'image'|'video'; caption:string; order_index:number }
interface Section          { id:string; heading:string; body:BodySegment[]; order:number; media:SectionMediaItem[] }
interface MenuItem         { id:string; name:string; price:number; description:string; image_url:string; stock:number; is_selling:boolean; sold_count:number }
interface BandScheduleItem { id:string; day:'sat'|'sun'; start_at:string; end_at:string; stage:string }
interface BandItem         { id:string; name:string; members:string[]; instagram:string; thumbnail_url:string; schedules:BandScheduleItem[]; enable_announcement:boolean; announcement_color:string }
interface SpecialScheduleItem { id:string; day:'sat'|'sun'; start_at:string; end_at:string; location:string; note:string }
interface Comment           { id:string; user_id:string; body:string; author_name?:string|null; is_approved:boolean; created_at:string }

interface ExhibitFormState {
  name:string; catch_copy:string; description:string
  cover_url:string; thumbnail_url:string
  room_display:string; floor:number
  sections:Section[]
  has_wait_time:boolean
  time_per_group:number
  queue_count:number
  type:'class'|'food'|'band'|'special'|'cafeteria'
  is_stamp_target:boolean
  enable_announcement:boolean
  announcement_color:string
}

const PRESET_COLORS = [
  { name:'レッド',    hex:'#FF4444' },
  { name:'オレンジ',  hex:'#FF8C00' },
  { name:'ゴールド',  hex:'#F59E0B' },
  { name:'グリーン',  hex:'#10B981' },
  { name:'シアン',   hex:'#38BDF8' },
  { name:'ブルー',   hex:'#3B82F6' },
  { name:'パープル', hex:'#A855F7' },
  { name:'ピンク',   hex:'#EC4899' },
  { name:'ホワイト', hex:'#F0F0F0' },
  { name:'ブラック', hex:'#1A1A1A' },
] as const

const INIT: ExhibitFormState = {
  name:'', catch_copy:'', description:'',
  cover_url:'', thumbnail_url:'', room_display:'', floor:1,
  sections:[], has_wait_time:true, time_per_group:5, queue_count:0, type:'class',
  is_stamp_target:false,
  enable_announcement:false, announcement_color:'#FF8C00',
}

const calcWait = (tpg:number, qc:number) => Math.max(0, tpg * qc)

const EDIT_TABS = [
  { id:'basic',   icon:'📝', label:'基本' },
  { id:'content', icon:'📖', label:'詳細' },
  { id:'special', icon:'🎪', label:'催し' },
  { id:'quick',   icon:'⚡', label:'更新' },
] as const

// ── メインページ ───────────────────────────────────────────────
export default function ExhibitEditPage() {
  const { id } = useParams<{ id:string }>()
  const router  = useRouter()
  const [form, setForm]         = useState<ExhibitFormState>(INIT)
  const [tab, setTab]           = useState<'basic'|'content'|'special'|'quick'>('basic')
  const [deskTab, setDeskTab]   = useState<'basic'|'content'|'special'>('basic')
  const [quickTab, setQuickTab] = useState<'wait'|'qr'|'menu'|'comments'|'notices'>('wait')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [menus, setMenus]                         = useState<MenuItem[]>([])
  const [deletedMenuIds, setDeletedMenuIds]       = useState<string[]>([])
  const [bands, setBands]                         = useState<BandItem[]>([])
  const [deletedBandIds, setDeletedBandIds]       = useState<string[]>([])
  const [specials, setSpecials]                   = useState<SpecialScheduleItem[]>([])
  const [deletedSpecialIds, setDeletedSpecialIds] = useState<string[]>([])
  const [deletedSectionIds, setDeletedSectionIds] = useState<string[]>([])
  const [stampSecret,    setStampSecret]    = useState<string | null>(null)
  const [comments,       setComments]       = useState<Comment[]>([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [noticeItems,     setNoticeItems]     = useState<{ id:string; title:string; status:string; created_at:string; review_comment:string|null }[]>([])
  const [noticesLoaded,   setNoticesLoaded]   = useState(false)
  const [queueWarn,       setQueueWarn]       = useState(false)

  // ── データ読み込み ────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const role = (profile as { role: string } | null)?.role
      if (role === 'editor' || role === 'teacher') {
        const { data: assignment } = await supabase
          .from('exhibit_editors')
          .select('exhibit_id')
          .eq('user_id', user.id)
          .eq('exhibit_id', id)
          .single()
        if (!assignment) { router.push('/admin/edit'); return }
      }
    })

    supabase
      .from('exhibits')
      .select('*, sections:exhibit_sections(id, heading, body, order_index, media:exhibit_images(id, url, type, caption, order_index))')
      .eq('id', id)
      .single()
      .then(async ({ data }) => {
        if (data) {
          const waitMin = data.wait_minutes ?? 0
          const tpg     = 5
          setStampSecret(data.stamp_secret ?? null)
          setForm({
            name:          data.name ?? '',
            catch_copy:    data.catch_copy ?? '',
            description:   data.description ?? '',
            cover_url:     data.cover_url ?? '',
            thumbnail_url: data.thumbnail_url ?? '',
            room_display:  data.room_display ?? '',
            floor:         data.floor ?? 1,
            sections: ((data.sections as {id:string;heading:string;body:BodySegment[];order_index:number;media:{id:string;url:string;type:string;caption:string|null;order_index:number}[]}[]) ?? [])
              .sort((a,b) => a.order_index - b.order_index)
              .map(s => ({
                id:s.id, heading:s.heading, body:s.body ?? [], order:s.order_index,
                media: ((s.media ?? []) as {id:string;url:string;type:string;caption:string|null;order_index:number}[])
                  .sort((a,b) => a.order_index - b.order_index)
                  .map(m => ({ id:m.id, url:m.url, type:m.type as 'image'|'video', caption:m.caption ?? '', order_index:m.order_index })),
              })),
            has_wait_time:        data.has_wait_time ?? true,
            time_per_group:       tpg,
            queue_count:          Math.round(waitMin / tpg),
            type:                 data.type,
            is_stamp_target:      data.is_stamp_target ?? false,
            enable_announcement:  data.enable_announcement ?? false,
            announcement_color:   data.announcement_color ?? '#FF8C00',
          })

          if (data.type === 'food' || data.type === 'cafeteria') {
            const { data: menuData } = await supabase
              .from('food_menus')
              .select('id, name, price, description, image_url, stock, is_selling, sold_count')
              .eq('exhibit_id', id)
            if (menuData) setMenus((menuData as Array<MenuItem & { description: string|null; image_url: string|null }>)
              .map(m => ({ ...m, description: m.description ?? '', image_url: m.image_url ?? '' })))
          }

          if (data.type === 'band') {
            const { data: bandData } = await supabase
              .from('bands')
              .select('*, band_schedules(*)')
              .eq('exhibit_id', id)
              .order('name')
            if (bandData) {
              type RawB = { id:string; name:string; members:string[]; instagram:string|null; thumbnail_url:string|null; enable_announcement:boolean|null; announcement_color:string|null; band_schedules:{id:string;day:'sat'|'sun';start_at:string;end_at:string;stage:string|null}[] }
              setBands((bandData as unknown as RawB[]).map(b => ({
                id:                   b.id,
                name:                 b.name,
                members:              b.members ?? [],
                instagram:            b.instagram ?? '',
                thumbnail_url:        b.thumbnail_url ?? '',
                enable_announcement:  b.enable_announcement ?? false,
                announcement_color:   b.announcement_color ?? '#A855F7',
                schedules:     (b.band_schedules ?? []).map(s => ({
                  id:       s.id,
                  day:      s.day,
                  start_at: s.start_at.slice(0, 5),
                  end_at:   s.end_at.slice(0, 5),
                  stage:    s.stage ?? '',
                })),
              })))
            }
          }

          // 催しスケジュール（全type共通）
          const { data: specialData } = await supabase
            .from('special_schedules')
            .select('*')
            .eq('exhibit_id', id)
          if (specialData) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setSpecials((specialData as any[]).map(s => ({
              id:       s.id,
              day:      s.day as 'sat'|'sun',
              start_at: (s.start_at as string).slice(0, 5),
              end_at:   (s.end_at as string).slice(0, 5),
              location: s.location ?? '',
              note:     s.note ?? s.description ?? '',
            })))
          }
        }
        setLoading(false)
      })
  }, [id, router])

  const set = useCallback(<K extends keyof ExhibitFormState>(key:K, val:ExhibitFormState[K]) => {
    setForm(f => ({ ...f, [key]:val }))
  }, [])

  // ── コメント読み込み ────────────────────────────────────────
  useEffect(() => {
    if (quickTab !== 'comments' || commentsLoaded || tab !== 'quick') return
    createClient()
      .from('exhibit_comments')
      .select('id, user_id, body, author_name, is_approved, created_at')
      .eq('exhibit_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) { setComments(data as Comment[]); setCommentsLoaded(true) } })
  }, [quickTab, tab, id, commentsLoaded])

  useEffect(() => {
    if (quickTab !== 'notices' || noticesLoaded) return
    createClient()
      .from('notices')
      .select('id, title, status, created_at, review_comment')
      .eq('exhibit_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setNoticeItems(data as { id:string; title:string; status:string; created_at:string; review_comment:string|null }[])
          setNoticesLoaded(true)
        }
      })
  }, [quickTab, id, noticesLoaded])

  const approveComment = async (commentId: string) => {
    await createClient().from('exhibit_comments').update({ is_approved: true }).eq('id', commentId)
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_approved: true } : c))
  }
  const deleteComment = async (commentId: string) => {
    await createClient().from('exhibit_comments').delete().eq('id', commentId)
    setComments(prev => prev.filter(c => c.id !== commentId))
  }


  // ── 保存 ────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()

    let currentSecret = stampSecret
    if (form.is_stamp_target && !currentSecret) {
      currentSecret = crypto.randomUUID()
      setStampSecret(currentSecret)
    }
    await supabase.from('exhibits').update({
      name:          form.name,
      catch_copy:    form.catch_copy,
      description:   form.description,
      cover_url:     form.cover_url,
      thumbnail_url: form.thumbnail_url,
      room_display:  form.room_display,
      floor:         form.floor,
      has_wait_time:        form.has_wait_time,
      wait_minutes:         waitMin,
      is_stamp_target:      form.is_stamp_target,
      enable_announcement:  form.enable_announcement,
      announcement_color:   form.enable_announcement ? form.announcement_color : null,
      ...(currentSecret && !stampSecret ? { stamp_secret: currentSecret } : {}),
    }).eq('id', id)

    // Delete removed sections (cascades to their exhibit_images)
    if (deletedSectionIds.length > 0) {
      await supabase.from('exhibit_sections').delete().in('id', deletedSectionIds)
      setDeletedSectionIds([])
    }

    const existingSecs = form.sections.filter(s => !s.id.startsWith('new_'))
    const newSecs      = form.sections.filter(s =>  s.id.startsWith('new_'))

    if (existingSecs.length > 0) {
      await supabase.from('exhibit_sections').upsert(
        existingSecs.map(s => ({ id:s.id, exhibit_id:id, heading:s.heading, body:s.body, order_index:s.order }))
      )
    }

    const newSecIdMap: Record<string, string> = {}
    for (const sec of newSecs) {
      const { data: ins } = await supabase
        .from('exhibit_sections')
        .insert({ exhibit_id:id, heading:sec.heading, body:sec.body, order_index:sec.order })
        .select('id').single()
      if (ins) newSecIdMap[sec.id] = ins.id
    }

    // Save section media (delete old + reinsert current)
    const allSecs = [
      ...existingSecs,
      ...newSecs.map(s => ({ ...s, id: newSecIdMap[s.id] ?? s.id })),
    ]
    for (const sec of allSecs) {
      if (sec.id.startsWith('new_')) continue
      await supabase.from('exhibit_images').delete().eq('section_id', sec.id)
      if (sec.media.length > 0) {
        await supabase.from('exhibit_images').insert(
          sec.media.map((m, idx) => ({
            exhibit_id:  id,
            section_id:  sec.id,
            url:         m.url,
            type:        m.type,
            caption:     m.caption || null,
            order_index: idx,
          }))
        )
      }
    }

    if (form.type === 'food' || form.type === 'cafeteria') {
      if (deletedMenuIds.length > 0) {
        await supabase.from('food_menus').delete().in('id', deletedMenuIds)
        setDeletedMenuIds([])
      }
      const newMenus = menus.filter(m => m.id.startsWith('new_')).map(m => ({
        exhibit_id: id, name: m.name, price: m.price,
        description: m.description || null, image_url: m.image_url || null,
        stock: m.stock, is_selling: m.is_selling, sold_count: m.sold_count,
      }))
      const existingMenus = menus.filter(m => !m.id.startsWith('new_')).map(m => ({
        id: m.id, exhibit_id: id, name: m.name, price: m.price,
        description: m.description || null, image_url: m.image_url || null,
        stock: m.stock, is_selling: m.is_selling, sold_count: m.sold_count,
      }))
      if (newMenus.length > 0)      await supabase.from('food_menus').insert(newMenus)
      if (existingMenus.length > 0) await supabase.from('food_menus').upsert(existingMenus)
    }

    if (form.type === 'band') {
      if (deletedBandIds.length > 0) {
        await supabase.from('band_schedules').delete().in('band_id', deletedBandIds)
        await supabase.from('bands').delete().in('id', deletedBandIds)
        setDeletedBandIds([])
      }
      const existingBands = bands.filter(b => !b.id.startsWith('new_'))
      const newBands      = bands.filter(b =>  b.id.startsWith('new_'))
      if (existingBands.length > 0) {
        await supabase.from('bands').upsert(existingBands.map(b => ({
          id: b.id, exhibit_id: id, name: b.name,
          members: b.members, instagram: b.instagram || null, thumbnail_url: b.thumbnail_url || null,
          enable_announcement: b.enable_announcement,
          announcement_color: b.enable_announcement ? b.announcement_color || null : null,
        })))
        await supabase.from('band_schedules').delete().in('band_id', existingBands.map(b => b.id))
        const scheds = existingBands.flatMap(b => b.schedules.map(s => ({
          band_id: b.id, day: s.day, start_at: s.start_at, end_at: s.end_at, stage: s.stage || null,
        })))
        if (scheds.length > 0) await supabase.from('band_schedules').insert(scheds)
      }
      for (const band of newBands) {
        const { data: ins } = await supabase.from('bands').insert({
          exhibit_id: id, name: band.name, members: band.members,
          instagram: band.instagram || null, thumbnail_url: band.thumbnail_url || null,
          enable_announcement: band.enable_announcement,
          announcement_color: band.enable_announcement ? band.announcement_color || null : null,
        }).select('id').single()
        if (ins && band.schedules.length > 0) {
          await supabase.from('band_schedules').insert(band.schedules.map(s => ({
            band_id: ins.id, day: s.day, start_at: s.start_at, end_at: s.end_at, stage: s.stage || null,
          })))
        }
      }
    }

    // 催しスケジュール保存（全type共通）
    if (deletedSpecialIds.length > 0) {
      await supabase.from('special_schedules').delete().in('id', deletedSpecialIds)
      setDeletedSpecialIds([])
    }
    const newSpecials = specials.filter(s => s.id.startsWith('new_')).map(s => ({
      exhibit_id: id, day: s.day, start_at: s.start_at, end_at: s.end_at,
      location: s.location || null, description: s.note || null,
    }))
    const existingSpecials = specials.filter(s => !s.id.startsWith('new_')).map(s => ({
      id: s.id, exhibit_id: id, day: s.day, start_at: s.start_at, end_at: s.end_at,
      location: s.location || null, description: s.note || null,
    }))
    if (newSpecials.length > 0)      await supabase.from('special_schedules').insert(newSpecials)
    if (existingSpecials.length > 0) await supabase.from('special_schedules').upsert(existingSpecials)

    // 保存後に DB から再取得して new_ ID を実 ID に同期（2回目保存で重複しないよう）
    if (form.type === 'band') {
      const { data: bd } = await supabase.from('bands').select('*, band_schedules(*)').eq('exhibit_id', id).order('name')
      if (bd) {
        type RawB = { id:string; name:string; members:string[]; instagram:string|null; thumbnail_url:string|null; enable_announcement:boolean|null; announcement_color:string|null; band_schedules:{id:string;day:'sat'|'sun';start_at:string;end_at:string;stage:string|null}[] }
        setBands((bd as unknown as RawB[]).map(b => ({
          id: b.id, name: b.name, members: b.members ?? [],
          instagram: b.instagram ?? '', thumbnail_url: b.thumbnail_url ?? '',
          enable_announcement: b.enable_announcement ?? false,
          announcement_color:  b.announcement_color  ?? '#A855F7',
          schedules: (b.band_schedules ?? []).map(s => ({
            id: s.id, day: s.day,
            start_at: s.start_at.slice(0,5), end_at: s.end_at.slice(0,5), stage: s.stage ?? '',
          })),
        })))
      }
    }
    if (form.type === 'food' || form.type === 'cafeteria') {
      const { data: md } = await supabase.from('food_menus').select('id, name, price, description, image_url, stock, is_selling, sold_count').eq('exhibit_id', id)
      if (md) setMenus((md as Array<MenuItem & { description: string|null; image_url: string|null }>)
        .map(m => ({ ...m, description: m.description ?? '', image_url: m.image_url ?? '' })))
    }
    const { data: spd } = await supabase.from('special_schedules').select('*').eq('exhibit_id', id)
    if (spd) {
      type SpecialRow = { id: string; day: 'sat'|'sun'; start_at: string; end_at: string; location: string | null; note: string | null; description: string | null }
      setSpecials((spd as unknown as SpecialRow[]).map(s => ({
        id: s.id, day: s.day,
        start_at: s.start_at.slice(0,5), end_at: s.end_at.slice(0,5),
        location: s.location ?? '', note: s.note ?? s.description ?? '',
      })))
    }

    // 変更ログを記録（先生への通知用）
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (currentUser) {
      const actionType = deskTab === 'content' || deskTab === 'special' ? 'content_edited' : 'basic_edited'
      const label = actionType === 'content_edited' ? '詳細コンテンツ' : '基本情報'
      logActivity(id, currentUser.id, actionType, `${form.name} の${label}を編集しました`).catch(() => {})
    }

    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }


  const waitMin = calcWait(form.time_per_group, form.queue_count)

  if (loading) {
    return (
      <PageLoader />
    )
  }

  return (
    <>
      <style>{`
        .edit-mobile-page{ padding-bottom:78px; }
        .edit-header{ display:flex; flex-direction:column; gap:12px; }
        .edit-header-actions .edit-header-btn{ flex:1; text-align:center; }
        .edit-desktop-tabs{ display:none; }
        @media (min-width:900px){
          .edit-mobile-tabs{display:none!important;}
          .edit-mobile-page{ padding-bottom:0; }
          .edit-grid{display:grid!important;}
          .edit-desktop-tabs{ display:flex!important; }
          .sec-basic,.sec-content,.sec-special{display:none!important;}
          .sec-basic[data-active="true"],.sec-content[data-active="true"],.sec-special[data-active="true"]{display:block!important;margin-top:0!important;}
          .sec-quick{display:block!important;}
          .edit-header{ flex-direction:row; align-items:center; }
          .edit-header-actions{ margin-left:auto; }
          .edit-header-actions .edit-header-btn{ flex:initial; }
        }
        .field-input:focus{outline:2px solid #FF8C00;outline-offset:0;border-color:#FF8C00!important;}
        textarea.field-input:focus{outline:2px solid #FF8C00;}
      `}</style>

      <div className="edit-mobile-page" style={{ maxWidth:1200 }}>
        {/* ── ページヘッダー ── */}
        <div className="edit-header" style={{ marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
            <Link href="/admin/edit" style={{ color:'#94a3b8', textDecoration:'none', fontSize:20, flexShrink:0 }}>←</Link>
            <div style={{ minWidth:0 }}>
              <h2 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#1e293b', marginBottom:2, overflowWrap:'break-word' }}>
                {form.name || '（名前未設定）'}
                <span style={{ fontSize:13, fontWeight:400, color:'#94a3b8', marginLeft:10, fontFamily:"'Kiwi Maru',serif" }}>
                  {form.room_display}{form.floor ? ` · ${form.floor}F` : ''}
                </span>
              </h2>
            </div>
          </div>
          <div className="edit-header-actions" style={{ display:'flex', gap:8, alignItems:'center' }}>
            <Link href={`/admin/quick/${id}`} className="edit-header-btn" style={{
              padding:'9px 16px', borderRadius:10, border:'1px solid #e2e8f0',
              background:'#f8fafc', color:'#64748b',
              fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
              textDecoration:'none', whiteSpace:'nowrap',
            }}>
              ⚡ かんたん表示
            </Link>
            <button onClick={handleSave} disabled={saving} className="edit-header-btn" style={{
              padding:'9px 22px', borderRadius:10, border:'none', cursor:'pointer',
              background: saved ? '#10b981' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
              color:'#fff', fontSize:13, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
              transition:'background 0.3s',
            }}>
              {saving ? '保存中…' : saved ? '✓ 保存しました' : '保存'}
            </button>
          </div>
        </div>

        {/* ── モバイル用タブ（下部固定バー / main の TabBar 準拠） ── */}
        <nav className="edit-mobile-tabs" style={{
          position:'fixed', left:0, right:0, bottom:0, zIndex:50,
          display:'flex', alignItems:'center',
          background:'rgba(255,255,255,0.97)',
          backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
          borderTop:'1px solid rgba(255,140,0,0.10)',
          padding:'6px 0 max(6px, env(safe-area-inset-bottom))',
        }}>
          {/* スライドインジケーター */}
          <div style={{
            position:'absolute', top:0, height:2.5, width:'19%',
            background:'linear-gradient(90deg,#FF6B00,#FFB347)',
            borderRadius:'0 0 4px 4px',
            left:`${EDIT_TABS.findIndex(t=>t.id===tab) * 25 + 3}%`,
            transition:'left 0.32s cubic-bezier(0.34,1.3,0.64,1)',
          }} />

          {EDIT_TABS.map(({ id, icon, label })=>{
            const active = tab === id
            return (
              <button key={id} onClick={()=>setTab(id)} style={{
                flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                background:'none', border:'none', cursor:'pointer', padding:'4px 0',
                transition:'transform 0.15s ease',
                transform: active ? 'translateY(-1px)' : 'translateY(0)',
              }} aria-label={label}>
                <span style={{ fontSize:20, filter: active ? 'none' : 'grayscale(1) opacity(0.55)', transition:'filter 0.2s' }}>
                  {icon}
                </span>
                <span style={{
                  fontSize:10, fontFamily:"'Kiwi Maru',serif",
                  color: active ? '#FF6B00' : '#bbb',
                  fontWeight: active ? 'bold' : 'normal',
                  transition:'color 0.2s',
                }}>
                  {label}
                </span>
              </button>
            )
          })}
        </nav>

        {/* ── レイアウト ── */}
        <div>
          <div className="edit-grid" style={{ gridTemplateColumns:'minmax(0,1fr) 340px', gap:20, alignItems:'start' }}>

            {/* ─── 左エリア ─── */}
            <div>

              {/* ── PC用タブバー ── */}
              <div className="edit-desktop-tabs" style={{ gap:4, borderBottom:'2px solid #f1f5f9', marginBottom:20 }}>
                {EDIT_TABS.filter(t => t.id !== 'quick').map(({ id, icon, label }) => {
                  const active = deskTab === id
                  return (
                    <button key={id} onClick={() => setDeskTab(id)} style={{
                      display:'flex', alignItems:'center', gap:6,
                      padding:'10px 20px', marginBottom:-2,
                      border:'none', borderBottom: active ? '2px solid #FF6B00' : '2px solid transparent',
                      background:'none', cursor:'pointer',
                      color: active ? '#FF6B00' : '#94a3b8',
                      fontWeight: active ? 700 : 400, fontSize:14,
                      fontFamily:"'Kiwi Maru',serif",
                      transition:'all 0.15s',
                    }}>
                      <span>{icon}</span>{label}
                    </button>
                  )
                })}
              </div>

              {/* 基本情報タブ */}
              <div className="sec-basic" data-active={deskTab === 'basic'} style={{ display: tab !== 'basic' ? 'none' : undefined }}>
                <Card title="基本情報" icon="📋">
                  <FormField label="展示名">
                    <Input value={form.name} onChange={v=>set('name',v)} />
                  </FormField>
                  <FormField label="キャッチコピー" hint="詳細ページの帯に表示されます">
                    <Input value={form.catch_copy} onChange={v=>set('catch_copy',v)} placeholder="例: この夏だけの、恐怖を。" />
                  </FormField>
                  <FormField label="説明文（概要）">
                    <Textarea value={form.description} onChange={v=>set('description',v)} rows={3} />
                  </FormField>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <FormField label="展示場所">
                      <Input value={form.room_display} onChange={v=>set('room_display',v)} />
                    </FormField>
                    <FormField label="フロア">
                      <select value={form.floor} onChange={e=>set('floor',Number(e.target.value))}
                        className="field-input" style={inputStyle}>
                        {[1,2,3,4,5,6].map(f=><option key={f} value={f}>{f}F</option>)}
                      </select>
                    </FormField>
                  </div>
                </Card>

                <Card title="写真・画像" icon="🖼" style={{ marginTop:16 }}>
                  <ImageUpload
                    label="カバー写真（横長）"
                    value={form.cover_url}
                    onChange={v => set('cover_url', v)}
                    storagePath={`exhibits/${id}/cover`}
                    aspect="wide"
                  />
                  <div style={{ marginTop:14 }}>
                    <ImageUpload
                      label="宣材写真（正方形）"
                      value={form.thumbnail_url}
                      onChange={v => set('thumbnail_url', v)}
                      storagePath={`exhibits/${id}/thumbnail`}
                      aspect="square"
                    />
                  </div>
                </Card>
              </div>

              {/* 詳細タブ */}
              <div className="sec-content" data-active={deskTab === 'content'} style={{ marginTop:16, display: tab !== 'content' ? 'none' : undefined }}>
                <Card title="本文セクション" icon="📖">
                  <SectionsEditor
                    sections={form.sections}
                    exhibitId={id}
                    onChange={v => set('sections', v)}
                    onRemove={sId => {
                      if (!sId.startsWith('new_')) setDeletedSectionIds(prev => [...prev, sId])
                    }}
                  />
                </Card>

                {(form.type === 'food' || form.type === 'cafeteria') && (
                  <Card title="フードメニュー" icon="🍽" style={{ marginTop:16 }}>
                    <MenuEditor
                      exhibitId={id}
                      menus={menus}
                      onChange={setMenus}
                      onRemove={(menuId) => {
                        if (!menuId.startsWith('new_')) setDeletedMenuIds(prev => [...prev, menuId])
                        setMenus(prev => prev.filter(m => m.id !== menuId))
                      }}
                    />
                  </Card>
                )}

                {form.type === 'band' && (
                  <Card title="バンド管理" icon="🎸" style={{ marginTop:16 }}>
                    <BandEditor
                      exhibitId={id}
                      bands={bands}
                      onChange={setBands}
                      onRemove={(bandId) => {
                        if (!bandId.startsWith('new_')) setDeletedBandIds(prev => [...prev, bandId])
                        setBands(prev => prev.filter(b => b.id !== bandId))
                      }}
                    />
                  </Card>
                )}
              </div>

              {/* 催しタブ */}
              <div className="sec-special" data-active={deskTab === 'special'} style={{ marginTop:16, display: tab !== 'special' ? 'none' : undefined }}>

                {/* ── 特殊演出設定カード ── */}
                <Card title="特殊演出設定" icon="🎬" style={{ marginBottom:16 }}>
                  <p style={{ fontSize:12, color:'#94a3b8', marginBottom:14, fontFamily:"'Kiwi Maru',serif", lineHeight:1.7 }}>
                    公演開始N分前にマップ画面へシネマティック演出を表示します（PCのみ）。
                  </p>

                  {/* ON/OFF トグル */}
                  <button
                    onClick={() => set('enable_announcement', !form.enable_announcement)}
                    style={{
                      width:'100%', padding:'10px 14px', borderRadius:10, border:'none',
                      cursor:'pointer', display:'flex', alignItems:'center', gap:10,
                      background: form.enable_announcement ? '#fff8f4' : '#f8fafc',
                      boxShadow: form.enable_announcement ? 'inset 0 0 0 1.5px #FF8C00' : 'inset 0 0 0 1.5px #e2e8f0',
                      marginBottom:16, transition:'all 0.15s',
                    }}
                  >
                    <div style={{
                      width:36, height:20, borderRadius:99, flexShrink:0, position:'relative',
                      background: form.enable_announcement ? '#FF8C00' : '#cbd5e1', transition:'background 0.2s',
                    }}>
                      <div style={{
                        position:'absolute', top:2, borderRadius:'50%', width:16, height:16, background:'#fff',
                        left: form.enable_announcement ? 18 : 2, transition:'left 0.2s',
                        boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif", color: form.enable_announcement ? '#FF6B00' : '#94a3b8' }}>
                      {form.enable_announcement ? '特殊演出 有効' : '特殊演出 無効'}
                    </span>
                  </button>

                  {/* グローカラー選択（有効時のみ）*/}
                  {form.enable_announcement && (
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:8, fontFamily:"'Kiwi Maru',serif" }}>
                        グローカラー
                      </div>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        {PRESET_COLORS.map(({ name, hex }) => (
                          <button
                            key={hex}
                            title={name}
                            onClick={() => set('announcement_color', hex)}
                            style={{
                              width:32, height:32, borderRadius:'50%', border:'none',
                              background: hex, cursor:'pointer', flexShrink:0,
                              outline: form.announcement_color === hex
                                ? `3px solid ${hex === '#F0F0F0' ? '#94a3b8' : hex}`
                                : '2px solid transparent',
                              outlineOffset: 2,
                              boxShadow: form.announcement_color === hex
                                ? `0 0 0 4px white, 0 0 0 6px ${hex === '#F0F0F0' ? '#94a3b8' : hex}`
                                : '0 1px 3px rgba(0,0,0,0.15)',
                              transition:'all 0.15s',
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ fontSize:10, color:'#94a3b8', marginTop:8, fontFamily:"'Kiwi Maru',serif" }}>
                        選択中: {PRESET_COLORS.find(c => c.hex === form.announcement_color)?.name ?? 'カスタム'}
                        <span style={{ marginLeft:8, display:'inline-block', width:10, height:10, borderRadius:'50%', background: form.announcement_color, verticalAlign:'middle', border:'1px solid #e2e8f0' }} />
                      </div>
                    </div>
                  )}
                </Card>

                <Card title="催し・特別スケジュール" icon="🎪">
                  <p style={{ fontSize:12, color:'#94a3b8', marginBottom:16, fontFamily:"'Kiwi Maru',serif", lineHeight:1.7 }}>
                    イベント・公演・実演など、時間帯で区切られた催しを登録できます。全団体共通で利用できます。
                  </p>
                  <SpecialEditor
                    specials={specials}
                    onChange={setSpecials}
                    onRemove={(specialId) => {
                      if (!specialId.startsWith('new_')) setDeletedSpecialIds(prev => [...prev, specialId])
                      setSpecials(prev => prev.filter(s => s.id !== specialId))
                    }}
                  />
                </Card>
              </div>
            </div>

            {/* ─── 右エリア ─── */}
            <div>
              <div className="sec-quick" style={{ display: tab !== 'quick' ? 'none' : undefined }}>

                {/* ── サブタブバー ── */}
                {(() => {
                  const isFood = form.type === 'food' || form.type === 'cafeteria'
                  const tabs = [
                    { key:'wait'     as const, label:'⏱ 待ち時間' },
                    { key:'qr'       as const, label:'🎯 スタンプ QR' },
                    ...(isFood ? [{ key:'menu' as const, label:'🍽 メニュー' }] : []),
                    { key:'comments' as const, label:'💬 コメント' },
                    { key:'notices'  as const, label:'🔔 お知らせ' },
                  ]
                  return (
                    <div style={{ display:'flex', gap:0, marginBottom:16, background:'#f1f5f9', borderRadius:12, padding:4 }}>
                      {tabs.map(({ key, label }) => (
                        <button key={key} onClick={() => setQuickTab(key)} style={{
                          flex:1, padding:'9px 4px', borderRadius:9, border:'none', cursor:'pointer',
                          background: quickTab===key ? '#fff' : 'transparent',
                          color: quickTab===key ? '#1e293b' : '#94a3b8',
                          fontWeight: quickTab===key ? 700 : 400,
                          fontSize: 11, fontFamily:"'Kiwi Maru',serif",
                          boxShadow: quickTab===key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                          transition:'all 0.15s', whiteSpace:'nowrap',
                        }}>{label}</button>
                      ))}
                    </div>
                  )
                })()}

                {/* ── 待ち時間タブ ── */}
                {quickTab === 'wait' && (
                  <Card title="" icon="" accent>
                    <button
                      onClick={() => set('has_wait_time', !form.has_wait_time)}
                      style={{
                        width:'100%', padding:'10px 14px', borderRadius:10, border:'none',
                        cursor:'pointer', display:'flex', alignItems:'center', gap:10,
                        background: form.has_wait_time ? '#f0fdf4' : '#f8fafc',
                        boxShadow: form.has_wait_time ? 'inset 0 0 0 1.5px #86efac' : 'inset 0 0 0 1.5px #e2e8f0',
                        marginBottom:16, transition:'all 0.15s',
                      }}
                    >
                      <div style={{
                        width:36, height:20, borderRadius:99, flexShrink:0, position:'relative',
                        background: form.has_wait_time ? '#22c55e' : '#cbd5e1', transition:'background 0.2s',
                      }}>
                        <div style={{
                          position:'absolute', top:2, borderRadius:'50%', width:16, height:16, background:'#fff',
                          left: form.has_wait_time ? 18 : 2, transition:'left 0.2s',
                          boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                      <span style={{ fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif", color: form.has_wait_time ? '#16a34a' : '#94a3b8' }}>
                        {form.has_wait_time ? '待ち時間機能 有効' : '待ち時間機能 無効'}
                      </span>
                    </button>

                    {form.has_wait_time && (<>
                      <div style={{ background:'linear-gradient(135deg,#0f172a,#1e293b)', borderRadius:14, padding:'20px', textAlign:'center', marginBottom:18 }}>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>現在の待ち時間</div>
                        <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:48, fontWeight:700, color: waitMin>=30?'#fca5a5':waitMin>=15?'#fcd34d':'#86efac', lineHeight:1 }}>{waitMin}</div>
                        <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', marginTop:4, fontFamily:"'Kiwi Maru',serif" }}>分</div>
                      </div>

                      <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f8fafc', borderRadius:12, padding:'14px', marginBottom:16 }}>
                        {[
                          { label:'1組あたり', val:form.time_per_group, key:'time_per_group' as const, unit:'分', min:1 },
                          { label:'待ち組数',   val:form.queue_count,   key:'queue_count'   as const, unit:'組', min:0 },
                        ].map((item, idx) => (
                          <React.Fragment key={item.key}>
                            {idx > 0 && <div style={{ fontSize:20, color:'#cbd5e1', fontWeight:700, flexShrink:0 }}>×</div>}
                            <div style={{ flex:1, textAlign:'center' }}>
                              <div style={{ fontSize:10, color:'#94a3b8', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>{item.label}</div>
                              <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'center' }}>
                                <button onClick={()=>set(item.key, Math.max(item.min, item.val-1))} style={calcBtnStyle}>−</button>
                                <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#1e293b', minWidth:36, textAlign:'center' }}>{item.val}</span>
                                <button onClick={()=>set(item.key, item.val+1)} style={calcBtnStyle}>＋</button>
                              </div>
                              <div style={{ fontSize:10, color:'#94a3b8', marginTop:4, fontFamily:"'Kiwi Maru',serif" }}>{item.unit}</div>
                            </div>
                          </React.Fragment>
                        ))}
                        <div style={{ fontSize:20, color:'#cbd5e1', fontWeight:700, flexShrink:0 }}>=</div>
                        <div style={{ flex:1, textAlign:'center' }}>
                          <div style={{ fontSize:10, color:'#94a3b8', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>待ち時間</div>
                          <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:22, fontWeight:700, color:'#FF6B00' }}>{waitMin}分</div>
                        </div>
                      </div>

                      <div style={{ marginBottom:14 }}>
                        <label style={{ fontSize:11, color:'#94a3b8', display:'block', marginBottom:4, fontFamily:"'Kiwi Maru',serif" }}>または直接入力</label>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <input type="text" inputMode="numeric" value={form.queue_count}
                            onChange={e => {
                              const v = e.target.value
                              if (/[^\x00-\x7F]/.test(v)) { setQueueWarn(true); return }
                              setQueueWarn(false)
                              if (!/^\d*$/.test(v)) return
                              set('queue_count', Number(v))
                            }}
                            className="field-input" style={{ ...inputStyle, flex:1 }} placeholder="待ち組数を入力" />
                          <span style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", flexShrink:0 }}>組</span>
                        </div>
                        {queueWarn && (
                          <div style={{ fontSize:11, color:'#ef4444', fontFamily:"'Kiwi Maru',serif", marginTop:4 }}>半角数字で入力してください</div>
                        )}
                      </div>

                      <button onClick={handleSave} disabled={saving} style={{
                        width:'100%', padding:'12px 0', borderRadius:10, border:'none', cursor:'pointer',
                        background: saved ? '#10b981' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
                        color:'#fff', fontSize:14, fontWeight:700,
                        fontFamily:"'Kaisei Decol',serif", transition:'background 0.3s',
                      }}>
                        {saving ? '更新中…' : saved ? '✓ 更新しました' : '待ち時間を更新する'}
                      </button>
                    </>)}
                  </Card>
                )}

                {/* ── QR タブ ── */}
                {quickTab === 'qr' && (
                  <StampQrCard
                    exhibitId={id}
                    isTarget={form.is_stamp_target}
                    onToggle={() => set('is_stamp_target', !form.is_stamp_target)}
                    onSave={handleSave}
                    saving={saving}
                    saved={saved}
                  />
                )}

                {/* ── メニュータブ ── */}
                {quickTab === 'menu' && (form.type === 'food' || form.type === 'cafeteria') && (
                  <Card title="" icon="">
                    <MenuQuickEditor menus={menus} onChange={setMenus} />
                    <button onClick={handleSave} disabled={saving} style={{
                      width:'100%', padding:'12px 0', borderRadius:10, border:'none', cursor:'pointer',
                      background: saved ? '#10b981' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
                      color:'#fff', fontSize:14, fontWeight:700,
                      fontFamily:"'Kaisei Decol',serif", transition:'background 0.3s', marginTop:8,
                    }}>
                      {saving ? '更新中…' : saved ? '✓ 更新しました' : 'メニューを更新する'}
                    </button>
                  </Card>
                )}

                {/* ── コメントタブ ── */}
                {quickTab === 'comments' && (
                  <Card title="" icon="">

                    {/* コメント一覧 */}
                    <div style={{ fontSize:11, color:'#94a3b8', marginBottom:10, fontFamily:"'Kiwi Maru',serif" }}>
                      コメント（{comments.filter(c => !c.is_approved).length} 件 承認待ち）
                    </div>
                    {comments.length === 0 ? (
                      <div style={{ textAlign:'center', padding:'24px 0', color:'#94a3b8',
                        fontFamily:"'Kiwi Maru',serif", fontSize:12 }}>
                        コメントはまだありません
                      </div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {comments.map(c => (
                          <div key={c.id} style={{
                            borderRadius:12, padding:'12px 14px',
                            border: c.is_approved ? '1px solid #f1f5f9' : '1px solid #fde68a',
                            background: c.is_approved ? '#fff' : '#fffbeb',
                          }}>
                            {c.author_name && (
                              <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:3 }}>
                                {c.author_name}
                              </div>
                            )}
                            <div style={{ fontSize:12, color:'#374151', fontFamily:"'Kiwi Maru',serif",
                              lineHeight:1.6, marginBottom:8 }}>
                              {c.body}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                <span style={{
                                  fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:99,
                                  fontFamily:"'Kiwi Maru',serif",
                                  background: c.is_approved ? '#f0fdf4' : '#fef9c3',
                                  color: c.is_approved ? '#16a34a' : '#92400e',
                                }}>
                                  {c.is_approved ? '✓ 承認済み' : '⏳ 承認待ち'}
                                </span>
                                <span style={{ fontSize:9, color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif" }}>
                                  {fmtTime(c.created_at)}
                                </span>
                              </div>
                              <div style={{ display:'flex', gap:4 }}>
                                {!c.is_approved && (
                                  <button onClick={() => approveComment(c.id)} style={{
                                    padding:'4px 12px', borderRadius:6, border:'none', cursor:'pointer',
                                    background:'#16a34a', color:'#fff',
                                    fontSize:10, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                                  }}>承認</button>
                                )}
                                <button onClick={() => deleteComment(c.id)} style={{
                                  padding:'4px 12px', borderRadius:6, border:'none', cursor:'pointer',
                                  background:'#fee2e2', color:'#dc2626',
                                  fontSize:10, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                                }}>削除</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                {/* ── お知らせタブ ── */}
                {quickTab === 'notices' && (
                  <Card title="" icon="">
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                      <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                        投稿したお知らせ一覧
                      </div>
                      <Link href="/admin/notices/new" style={{
                        padding:'5px 12px', borderRadius:8,
                        background:'linear-gradient(135deg,#FF6B00,#FFAA28)',
                        color:'#fff', textDecoration:'none',
                        fontSize:11, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                      }}>
                        ＋ 新規作成
                      </Link>
                    </div>

                    {!noticesLoaded ? (
                      <div style={{ textAlign:'center', padding:'20px 0', color:'#94a3b8', fontSize:12, fontFamily:"'Kiwi Maru',serif" }}>
                        読み込み中…
                      </div>
                    ) : noticeItems.length === 0 ? (
                      <div style={{ textAlign:'center', padding:'24px 0', color:'#94a3b8', fontSize:12, fontFamily:"'Kiwi Maru',serif" }}>
                        お知らせはまだありません
                      </div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {noticeItems.map(n => (
                          <Link key={n.id} href={`/admin/notices/${n.id}`} style={{
                            display:'block', padding:'10px 12px', borderRadius:10,
                            textDecoration:'none',
                            border: n.status === 'rejected' ? '1px solid #fca5a5' :
                                    n.status === 'pending'  ? '1px solid #fde68a' : '1px solid #f1f5f9',
                            background: n.status === 'rejected' ? '#fef2f2' :
                                        n.status === 'pending'  ? '#fffbeb' : '#fff',
                          }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                              <span style={{
                                fontSize:9, fontWeight:700, padding:'1px 7px', borderRadius:99,
                                fontFamily:"'Kiwi Maru',serif",
                                background: n.status === 'approved' ? '#dcfce7' :
                                            n.status === 'rejected' ? '#fee2e2' : '#fef9c3',
                                color: n.status === 'approved' ? '#16a34a' :
                                       n.status === 'rejected' ? '#dc2626' : '#92400e',
                              }}>
                                {n.status === 'approved' ? '✓ 承認済み' :
                                 n.status === 'rejected' ? '✕ 却下' : '⏳ 審査待ち'}
                              </span>
                              <span style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                                {fmtTime(n.created_at)}
                              </span>
                            </div>
                            <div style={{ fontSize:12, fontWeight:700, color:'#1e293b', fontFamily:"'Kiwi Maru',serif" }}>
                              {n.title}
                            </div>
                            {n.status === 'rejected' && n.review_comment && (
                              <div style={{ fontSize:10, color:'#dc2626', fontFamily:"'Kiwi Maru',serif", marginTop:2 }}>
                                却下理由: {n.review_comment}
                              </div>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── セクション編集 ────────────────────────────────────────────
function SectionsEditor({ sections, exhibitId, onChange, onRemove }: {
  sections: Section[]
  exhibitId: string
  onChange: (v: Section[]) => void
  onRemove: (id: string) => void
}) {
  const sorted = [...sections].sort((a,b) => a.order - b.order)

  const addSection = () => {
    const newSec: Section = { id:`new_${Date.now()}`, heading:'', body:[{type:'text',text:''}], order:sections.length+1, media:[] }
    onChange([...sections, newSec])
  }
  const removeSection = (id: string) => { onRemove(id); onChange(sections.filter(s => s.id !== id)) }
  const moveUp   = (i: number) => { if(i===0)return; const a=[...sorted]; [a[i-1],a[i]]=[a[i],a[i-1]]; onChange(a.map((s,idx)=>({...s,order:idx+1}))) }
  const moveDown = (i: number) => { if(i===sorted.length-1)return; const a=[...sorted]; [a[i],a[i+1]]=[a[i+1],a[i]]; onChange(a.map((s,idx)=>({...s,order:idx+1}))) }
  const updateHeading = (id: string, v: string) => onChange(sections.map(s => s.id===id ? {...s,heading:v} : s))
  const updateText    = (id: string, v: string) => onChange(sections.map(s => s.id===id ? {...s,body:[{type:'text',text:v}]} : s))
  const updateMedia   = (id: string, v: SectionMediaItem[]) => onChange(sections.map(s => s.id===id ? {...s,media:v} : s))

  return (
    <div>
      {sorted.map((sec,i) => (
        <div key={sec.id} style={{ border:'1px solid #e2e8f0', borderRadius:12, padding:'14px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>セクション {i+1}</div>
            <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
              <ToolBtn onClick={()=>moveUp(i)} disabled={i===0}>↑</ToolBtn>
              <ToolBtn onClick={()=>moveDown(i)} disabled={i===sorted.length-1}>↓</ToolBtn>
              <ToolBtn onClick={()=>removeSection(sec.id)} danger>🗑</ToolBtn>
            </div>
          </div>
          <FormField label="見出し">
            <Input value={sec.heading} onChange={v=>updateHeading(sec.id,v)} placeholder="例: 展示内容について" />
          </FormField>
          <FormField label="本文">
            <Textarea value={sec.body.find(b=>b.type==='text') ? (sec.body.find(b=>b.type==='text') as {type:'text';text:string}).text : ''} onChange={v=>updateText(sec.id,v)} rows={4} />
          </FormField>
          <SectionMediaEditor
            sectionId={sec.id}
            exhibitId={exhibitId}
            media={sec.media}
            onChange={v => updateMedia(sec.id, v)}
          />
        </div>
      ))}
      <button onClick={addSection} style={{
        width:'100%', padding:'11px', borderRadius:10, border:'1.5px dashed #e2e8f0',
        background:'#fafafa', cursor:'pointer', fontSize:13, color:'#94a3b8',
        fontFamily:"'Kiwi Maru',serif", fontWeight:700,
      }}>
        ＋ セクションを追加
      </button>
    </div>
  )
}

// ─── セクションメディア編集 ────────────────────────────────────
function convertToWebP(file: File, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const maxW = 1280, maxH = 960
      const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.naturalWidth  * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas error')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url)
        if (blob) resolve(blob); else reject(new Error('WebP変換失敗'))
      }, 'image/webp', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像読み込み失敗')) }
    img.src = url
  })
}

function SectionMediaEditor({ sectionId, exhibitId, media, onChange }: {
  sectionId: string
  exhibitId: string
  media: SectionMediaItem[]
  onChange: (v: SectionMediaItem[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const isImg = file.type.startsWith('image/')
    const isVid = file.type.startsWith('video/')
    if (!isImg && !isVid) { setError('画像または動画を選択してください'); return }

    const MAX_VIDEO_BYTES = 100 * 1024 * 1024
    if (isVid && file.size > MAX_VIDEO_BYTES) {
      setError(`動画は100MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      return
    }

    setError(''); setUploading(true)
    try {
      const supabase = createClient()
      const key = `m${Date.now()}`
      let uploadBlob: Blob
      let fullPath: string
      let contentType: string
      if (isImg) {
        uploadBlob  = await convertToWebP(file)
        fullPath    = `exhibits/${exhibitId}/sections/${sectionId}/${key}.webp`
        contentType = 'image/webp'
      } else {
        uploadBlob  = file
        const ext   = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
        fullPath    = `exhibits/${exhibitId}/sections/${sectionId}/${key}.${ext}`
        contentType = file.type
      }
      const { error: uploadErr } = await supabase.storage.from('media').upload(fullPath, uploadBlob, { contentType, upsert: true })
      if (uploadErr) throw uploadErr
      const { data } = supabase.storage.from('media').getPublicUrl(fullPath)
      onChange([...media, {
        id:          `new_${Date.now()}`,
        url:         `${data.publicUrl}?t=${Date.now()}`,
        type:        isImg ? 'image' : 'video',
        caption:     '',
        order_index: media.length,
      }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アップロード失敗')
    } finally {
      setUploading(false)
    }
  }

  const updateCaption = (id: string, caption: string) =>
    onChange(media.map(m => m.id === id ? { ...m, caption } : m))
  const remove = (id: string) =>
    onChange(media.filter(m => m.id !== id))

  return (
    <div style={{ marginTop:10 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>
        セクション内メディア
      </div>
      {media.map(m => (
        <div key={m.id} style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6, background:'#f8fafc', borderRadius:7, padding:'5px 8px' }}>
          {m.type === 'video' ? (
            <video src={m.url} style={{ width:56, height:42, objectFit:'cover', borderRadius:5, flexShrink:0 }} muted playsInline preload="metadata" />
          ) : (
            <img src={m.url} alt="" style={{ width:56, height:42, objectFit:'cover', borderRadius:5, flexShrink:0 }} />
          )}
          <input
            value={m.caption}
            onChange={e => updateCaption(m.id, e.target.value)}
            placeholder="キャプション（省略可）"
            className="field-input"
            style={{ ...inputStyle, flex:1, fontSize:11 }}
          />
          <button onClick={() => remove(m.id)} style={{ flexShrink:0, background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:14, padding:'4px' }}>✕</button>
        </div>
      ))}
      <button
        onClick={() => !uploading && inputRef.current?.click()}
        disabled={uploading}
        style={{
          display:'flex', alignItems:'center', gap:4, padding:'7px 12px',
          borderRadius:8, border:'1px dashed #e2e8f0',
          background: uploading ? '#f8fafc' : '#fff',
          cursor: uploading ? 'not-allowed' : 'pointer',
          fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif",
        }}
      >
        {uploading ? 'アップロード中…' : '＋ 画像・動画を追加'}
      </button>
      {error && <div style={{ fontSize:11, color:'#ef4444', marginTop:4, fontFamily:"'Kiwi Maru',serif" }}>{error}</div>}
      <input ref={inputRef} type="file" accept="image/*,video/*" style={{ display:'none' }} onChange={handleFile} />
    </div>
  )
}

// ─── UIパーツ ─────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width:'100%', padding:'9px 12px', borderRadius:8,
  border:'1px solid #e2e8f0', background:'#fff',
  fontSize:13, color:'#1e293b', fontFamily:"'Kiwi Maru',serif",
  boxSizing:'border-box',
}

function Card({ title,icon,children,accent=false,style }:{
  title:string; icon:string; children:React.ReactNode; accent?:boolean; style?:React.CSSProperties
}) {
  return (
    <div style={{
      background:'#fff', borderRadius:16, padding:'20px',
      boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:`1px solid ${accent?'rgba(255,107,0,0.2)':'#f1f5f9'}`,
      ...style,
    }}>
      <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700, color:'#1e293b', marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
        {icon && <span>{icon}</span>} {title}
      </div>
      {children}
    </div>
  )
}

function FormField({ label,hint,children }:{label:string;hint?:string;children:React.ReactNode}) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, fontFamily:"'Kiwi Maru',serif" }}>
        {label}
        {hint && <span style={{ fontWeight:400, color:'#94a3b8', marginLeft:6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ value,onChange,placeholder }:{value:string;onChange:(v:string)=>void;placeholder?:string}) {
  return (
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      className="field-input" style={inputStyle} />
  )
}

function Textarea({ value,onChange,rows=3,placeholder }:{value:string;onChange:(v:string)=>void;rows?:number;placeholder?:string}) {
  return (
    <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} placeholder={placeholder}
      className="field-input" style={{ ...inputStyle, resize:'vertical', lineHeight:1.6 }} />
  )
}

function ToolBtn({ onClick,disabled,danger,children }:{onClick:()=>void;disabled?:boolean;danger?:boolean;children:React.ReactNode}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:28, height:28, borderRadius:6, border:'1px solid #e2e8f0',
      background: disabled?'#f8fafc':danger?'#fef2f2':'#fff',
      color: disabled?'#cbd5e1':danger?'#ef4444':'#64748b',
      cursor: disabled?'not-allowed':'pointer', fontSize:12,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>{children}</button>
  )
}

// ─── バンド編集 ────────────────────────────────────────────────
function BandEditor({ exhibitId, bands, onChange, onRemove }: {
  exhibitId: string
  bands: BandItem[]
  onChange: (v: BandItem[]) => void
  onRemove: (id: string) => void
}) {
  const addBand = () => onChange([...bands, {
    id: `new_${Date.now()}`, name: '', members: [], instagram: '', thumbnail_url: '', schedules: [],
    enable_announcement: false, announcement_color: '#A855F7',
  }])

  const update = (id: string, patch: Partial<BandItem>) =>
    onChange(bands.map(b => b.id === id ? { ...b, ...patch } : b))

  return (
    <div>
      {bands.map((band, i) => (
        <div key={band.id} style={{ border:'1px solid #e2e8f0', borderRadius:12, padding:'14px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
              バンド {i+1}
            </div>
            <div style={{ marginLeft:'auto' }}>
              <ToolBtn onClick={() => onRemove(band.id)} danger>🗑</ToolBtn>
            </div>
          </div>

          <FormField label="バンド名">
            <Input value={band.name} onChange={v => update(band.id, { name:v })} placeholder="例: The Crimson" />
          </FormField>

          <FormField label="メンバー（1行1人）">
            <Textarea
              value={band.members.join('\n')}
              onChange={v => update(band.id, { members: v.split('\n').map(s => s.trim()).filter(Boolean) })}
              rows={3}
              placeholder={'田中 颯\n鈴木 葵\n佐藤 陸'}
            />
          </FormField>

          <FormField label="Instagram（@なし）">
            <Input value={band.instagram} onChange={v => update(band.id, { instagram:v })} placeholder="例: the_crimson_band" />
          </FormField>

          <div style={{ marginBottom:14 }}>
            <ImageUpload
              label="バンド写真"
              value={band.thumbnail_url}
              onChange={v => update(band.id, { thumbnail_url:v })}
              storagePath={`bands/${exhibitId}/${band.id}/thumbnail`}
              aspect="square"
            />
          </div>

          <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:8, fontFamily:"'Kiwi Maru',serif" }}>
            公演スケジュール
          </div>
          <BandScheduleSubEditor
            schedules={band.schedules}
            onChange={scheds => update(band.id, { schedules: scheds })}
          />

          {/* 担当者（マイバンド編集権限） */}
          <div style={{ marginTop:14, padding:'12px 14px', background:'#fdfaff', borderRadius:10, border:'1px solid #f3e8ff' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:8, fontFamily:"'Kiwi Maru',serif" }}>
              👤 担当者（マイバンドページで編集・お知らせ投稿ができます）
            </div>
            <BandMemberAssign bandId={band.id} />
          </div>

          {/* 特殊演出設定 */}
          <div style={{ marginTop:14, padding:'12px 14px', background:'#fafafa', borderRadius:10, border:'1px solid #f1f5f9' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:10, fontFamily:"'Kiwi Maru',serif" }}>
              🎬 特殊演出
            </div>
            <button
              type="button"
              onClick={() => update(band.id, { enable_announcement: !band.enable_announcement })}
              style={{
                display:'flex', alignItems:'center', gap:10, width:'100%',
                padding:'10px 12px', borderRadius:10, border:'none', cursor:'pointer',
                background: band.enable_announcement ? '#fff8f4' : '#f8fafc',
                boxShadow: band.enable_announcement ? 'inset 0 0 0 1.5px #A855F7' : 'inset 0 0 0 1.5px #e2e8f0',
              }}
            >
              <div style={{
                width:36, height:20, borderRadius:10, flexShrink:0, position:'relative',
                background: band.enable_announcement ? '#A855F7' : '#cbd5e1', transition:'background 0.2s',
              }}>
                <div style={{
                  position:'absolute', top:2, width:16, height:16, borderRadius:'50%', background:'#fff',
                  left: band.enable_announcement ? 18 : 2, transition:'left 0.2s',
                  boxShadow:'0 1px 3px rgba(0,0,0,0.25)',
                }} />
              </div>
              <span style={{ fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif", color: band.enable_announcement ? '#7c3aed' : '#94a3b8' }}>
                {band.enable_announcement ? '特殊演出 有効' : '特殊演出 無効'}
              </span>
            </button>
            {band.enable_announcement && (
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:7 }}>演出カラー</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {PRESET_COLORS.map(({ name, hex }) => (
                    <button key={hex} type="button"
                      onClick={() => update(band.id, { announcement_color: hex })}
                      title={name}
                      style={{
                        width:24, height:24, borderRadius:'50%', border:'none', cursor:'pointer',
                        background: hex, flexShrink:0,
                        outline: band.announcement_color === hex ? `2.5px solid ${hex}` : '2.5px solid transparent',
                        outlineOffset: 2,
                        boxShadow: band.announcement_color === hex ? `0 0 0 4px ${hex}30` : 'none',
                      }}
                    />
                  ))}
                </div>
                <div style={{ fontSize:10, color:'#94a3b8', marginTop:6, fontFamily:"'Kiwi Maru',serif" }}>
                  選択中: {PRESET_COLORS.find(c => c.hex === band.announcement_color)?.name ?? 'カスタム'}
                  <span style={{ marginLeft:8, display:'inline-block', width:10, height:10, borderRadius:'50%', background: band.announcement_color, verticalAlign:'middle', border:'1px solid #e2e8f0' }} />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      <button onClick={addBand} style={{
        width:'100%', padding:'11px', borderRadius:10, border:'1.5px dashed #e2e8f0',
        background:'#fafafa', cursor:'pointer', fontSize:13, color:'#94a3b8',
        fontFamily:"'Kiwi Maru',serif", fontWeight:700,
      }}>
        ＋ バンドを追加
      </button>
    </div>
  )
}

function BandScheduleSubEditor({ schedules, onChange }: {
  schedules: BandScheduleItem[]
  onChange: (v: BandScheduleItem[]) => void
}) {
  const add = () => onChange([...schedules, {
    id: `new_${Date.now()}`, day: 'sat', start_at: '10:00', end_at: '10:30', stage: '',
  }])
  const remove = (id: string) => onChange(schedules.filter(s => s.id !== id))
  const update = (id: string, patch: Partial<BandScheduleItem>) =>
    onChange(schedules.map(s => s.id === id ? { ...s, ...patch } : s))

  return (
    <div style={{ marginBottom:8 }}>
      {schedules.map(s => (
        <div key={s.id} style={{
          display:'grid', gridTemplateColumns:'48px 1fr 1fr 1fr 28px',
          gap:6, alignItems:'center', marginBottom:6,
          background:'#f8fafc', borderRadius:8, padding:'8px 10px',
        }}>
          <select value={s.day} onChange={e => update(s.id, { day: e.target.value as 'sat'|'sun' })}
            className="field-input" style={{ ...inputStyle, padding:'6px 4px', textAlign:'center' }}>
            <option value="sat">土</option>
            <option value="sun">日</option>
          </select>
          <input type="time" value={s.start_at} onChange={e => update(s.id, { start_at: e.target.value })}
            className="field-input" style={{ ...inputStyle, padding:'6px 8px' }} />
          <input type="time" value={s.end_at} onChange={e => update(s.id, { end_at: e.target.value })}
            className="field-input" style={{ ...inputStyle, padding:'6px 8px' }} />
          <input type="text" value={s.stage} onChange={e => update(s.id, { stage: e.target.value })}
            placeholder="ステージ名" className="field-input" style={{ ...inputStyle, padding:'6px 8px' }} />
          <ToolBtn onClick={() => remove(s.id)} danger>🗑</ToolBtn>
        </div>
      ))}
      <button onClick={add} style={{
        width:'100%', padding:'8px', borderRadius:8, border:'1px dashed #e2e8f0',
        background:'transparent', cursor:'pointer', fontSize:12, color:'#94a3b8',
        fontFamily:"'Kiwi Maru',serif",
      }}>
        ＋ スケジュール追加
      </button>
    </div>
  )
}

// ─── メニュークイック更新 ──────────────────────────────────────
function MenuQuickEditor({ menus, onChange }: { menus: MenuItem[]; onChange: (v: MenuItem[]) => void }) {
  const update = (id: string, patch: Partial<MenuItem>) =>
    onChange(menus.map(m => m.id === id ? { ...m, ...patch } : m))

  return (
    <div>
      {menus.map((menu, i) => (
        <div key={menu.id} style={{ padding:'12px 0', borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
            <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700, color:'#1e293b', flex:1, marginRight:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {menu.name || `メニュー${i+1}`}
            </span>
            <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:13, fontWeight:700, color:'#FF6B00', flexShrink:0 }}>
              ¥{menu.price.toLocaleString()}
            </span>
          </div>

          <button
            onClick={() => update(menu.id, { is_selling: !menu.is_selling })}
            style={{
              width:'100%', padding:'8px', borderRadius:8, border:'none', cursor:'pointer',
              background: menu.is_selling ? '#f0fdf4' : '#f5f5f5',
              color: menu.is_selling ? '#16a34a' : '#94a3b8',
              fontWeight:700, fontSize:12, fontFamily:"'Kiwi Maru',serif",
              boxShadow: menu.is_selling ? 'inset 0 0 0 1px #86efac' : 'inset 0 0 0 1px #e2e8f0',
              marginBottom:8,
            }}
          >
            {menu.is_selling ? '✓ 販売中' : '✗ 販売停止'}
          </button>

          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f8fafc', borderRadius:10, padding:'8px 12px', marginBottom:6 }}>
            <span style={{ flex:1, fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>在庫数</span>
            <button onClick={() => update(menu.id, { stock: Math.max(0, menu.stock - 1) })} style={calcBtnStyle}>−</button>
            <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#1e293b', minWidth:36, textAlign:'center' }}>
              {menu.stock}
            </span>
            <button onClick={() => update(menu.id, { stock: menu.stock + 1 })} style={calcBtnStyle}>＋</button>
          </div>

          {/* 販売数 */}
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff8f0', borderRadius:10, padding:'8px 12px', border:'1px solid #fde68a' }}>
            <span style={{ flex:1, fontSize:11, color:'#92400e', fontFamily:"'Kiwi Maru',serif", fontWeight:700 }}>販売数</span>
            <button onClick={() => update(menu.id, { sold_count: Math.max(0, menu.sold_count - 1) })} style={calcBtnStyle}>−</button>
            <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#FF6B00', minWidth:36, textAlign:'center' }}>
              {menu.sold_count}
            </span>
            <button onClick={() => update(menu.id, { sold_count: menu.sold_count + 1 })} style={calcBtnStyle}>＋</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── メニュー編集 ──────────────────────────────────────────────
function MenuEditor({ exhibitId, menus, onChange, onRemove }: {
  exhibitId: string
  menus: MenuItem[]
  onChange: (v: MenuItem[]) => void
  onRemove: (id: string) => void
}) {
  const [menuWarn, setMenuWarn] = useState<Record<string, 'price'|'stock'|null>>({})

  const addMenu = () => onChange([...menus, {
    id: `new_${Date.now()}`, name: '', price: 0, description: '', image_url: '', stock: 0, is_selling: true, sold_count: 0,
  }])

  const update = (id: string, patch: Partial<MenuItem>) =>
    onChange(menus.map(m => m.id === id ? { ...m, ...patch } : m))

  return (
    <div>
      {menus.map((menu, i) => (
        <div key={menu.id} style={{ border:'1px solid #e2e8f0', borderRadius:12, padding:'14px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
              メニュー {i+1}
            </div>
            <div style={{ marginLeft:'auto' }}>
              <ToolBtn onClick={() => onRemove(menu.id)} danger>🗑</ToolBtn>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <FormField label="メニュー名">
              <Input value={menu.name} onChange={v => update(menu.id, { name:v })} placeholder="例: 焼きそば" />
            </FormField>
            <FormField label="価格（円）">
              <input type="text" inputMode="numeric" value={menu.price}
                onChange={e => {
                  const v = e.target.value
                  if (/[^\x00-\x7F]/.test(v)) { setMenuWarn(w => ({ ...w, [menu.id]: 'price' })); return }
                  if (menuWarn[menu.id] === 'price') setMenuWarn(w => ({ ...w, [menu.id]: null }))
                  if (!/^\d*$/.test(v)) return
                  update(menu.id, { price: Number(v) })
                }}
                className="field-input" style={inputStyle} />
              {menuWarn[menu.id] === 'price' && (
                <div style={{ fontSize:11, color:'#ef4444', fontFamily:"'Kiwi Maru',serif", marginTop:4 }}>半角数字で入力してください</div>
              )}
            </FormField>
          </div>

          <FormField label="説明">
            <Input value={menu.description} onChange={v => update(menu.id, { description:v })} placeholder="例: 秘伝ソースの本格派" />
          </FormField>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <FormField label="在庫数">
              <input type="text" inputMode="numeric" value={menu.stock}
                onChange={e => {
                  const v = e.target.value
                  if (/[^\x00-\x7F]/.test(v)) { setMenuWarn(w => ({ ...w, [menu.id]: 'stock' })); return }
                  if (menuWarn[menu.id] === 'stock') setMenuWarn(w => ({ ...w, [menu.id]: null }))
                  if (!/^\d*$/.test(v)) return
                  update(menu.id, { stock: Number(v) })
                }}
                className="field-input" style={inputStyle} />
              {menuWarn[menu.id] === 'stock' && (
                <div style={{ fontSize:11, color:'#ef4444', fontFamily:"'Kiwi Maru',serif", marginTop:4 }}>半角数字で入力してください</div>
              )}
            </FormField>
            <FormField label="販売状態">
              <label style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', border:'1px solid #e2e8f0', borderRadius:8, cursor:'pointer' }}>
                <input type="checkbox" checked={menu.is_selling}
                  onChange={e => update(menu.id, { is_selling: e.target.checked })}
                  style={{ accentColor:'#FF6B00', width:16, height:16 }} />
                <span style={{ fontSize:13, fontFamily:"'Kiwi Maru',serif", color:'#1e293b' }}>
                  {menu.is_selling ? '販売中' : '販売停止'}
                </span>
              </label>
            </FormField>
          </div>

          <div style={{ marginTop:14 }}>
            <ImageUpload
              label="メニュー写真"
              value={menu.image_url}
              onChange={v => update(menu.id, { image_url:v })}
              storagePath={`food/${exhibitId}/${menu.id}/image`}
              aspect="square"
            />
          </div>
        </div>
      ))}

      <button onClick={addMenu} style={{
        width:'100%', padding:'11px', borderRadius:10, border:'1.5px dashed #e2e8f0',
        background:'#fafafa', cursor:'pointer', fontSize:13, color:'#94a3b8',
        fontFamily:"'Kiwi Maru',serif", fontWeight:700,
      }}>
        ＋ メニューを追加
      </button>
    </div>
  )
}

// ─── 催し編集 ──────────────────────────────────────────────────
function SpecialEditor({ specials, onChange, onRemove }: {
  specials: SpecialScheduleItem[]
  onChange: (v: SpecialScheduleItem[]) => void
  onRemove: (id: string) => void
}) {
  const add = () => onChange([...specials, {
    id: `new_${Date.now()}`, day: 'sat', start_at: '10:00', end_at: '11:00', location: '', note: '',
  }])

  const update = (id: string, patch: Partial<SpecialScheduleItem>) =>
    onChange(specials.map(s => s.id === id ? { ...s, ...patch } : s))

  return (
    <div>
      {specials.map((s, i) => (
        <div key={s.id} style={{ border:'1px solid #e2e8f0', borderRadius:12, padding:'14px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
              催し {i+1}
            </div>
            <div style={{ marginLeft:'auto' }}>
              <ToolBtn onClick={() => onRemove(s.id)} danger>🗑</ToolBtn>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'60px 1fr 1fr', gap:8, marginBottom:2 }}>
            <FormField label="曜日">
              <select value={s.day} onChange={e => update(s.id, { day: e.target.value as 'sat'|'sun' })}
                className="field-input" style={{ ...inputStyle, padding:'6px 4px' }}>
                <option value="sat">土</option>
                <option value="sun">日</option>
              </select>
            </FormField>
            <FormField label="開始">
              <input type="time" value={s.start_at} onChange={e => update(s.id, { start_at: e.target.value })}
                className="field-input" style={inputStyle} />
            </FormField>
            <FormField label="終了">
              <input type="time" value={s.end_at} onChange={e => update(s.id, { end_at: e.target.value })}
                className="field-input" style={inputStyle} />
            </FormField>
          </div>

          <FormField label="場所（省略可）">
            <Input value={s.location} onChange={v => update(s.id, { location:v })} placeholder="例: 体育館ステージ" />
          </FormField>

          <FormField label="メモ・説明（省略可）">
            <Textarea value={s.note} onChange={v => update(s.id, { note:v })} rows={2} placeholder="例: 15分ずつ演奏、入れ替え制" />
          </FormField>
        </div>
      ))}

      <button onClick={add} style={{
        width:'100%', padding:'11px', borderRadius:10, border:'1.5px dashed #e2e8f0',
        background:'#fafafa', cursor:'pointer', fontSize:13, color:'#94a3b8',
        fontFamily:"'Kiwi Maru',serif", fontWeight:700,
      }}>
        ＋ 催しを追加
      </button>
    </div>
  )
}

const calcBtnStyle: React.CSSProperties = {
  width:30, height:30, borderRadius:8, border:'1px solid #e2e8f0',
  background:'#fff', cursor:'pointer', fontSize:16, color:'#64748b',
  display:'flex', alignItems:'center', justifyContent:'center',
  flexShrink:0,
}

// ─── スタンプラリー QR カード ──────────────────────────────────
function StampQrCard({ exhibitId, isTarget, onToggle, onSave, saving, saved }: {
  exhibitId: string
  isTarget:  boolean
  onToggle:  () => void
  onSave:    () => void
  saving:    boolean
  saved:     boolean
}) {
  const [qrUrl,    setQrUrl]    = React.useState<string | null>(null)
  const [qrError,  setQrError]  = React.useState(false)
  const [QrComp,   setQrComp]   = React.useState<React.ComponentType<{ value: string; size: number }> | null>(null)

  // qrcode.react を動的インポート
  React.useEffect(() => {
    import('qrcode.react').then(m => setQrComp(() => m.QRCodeSVG as React.ComponentType<{ value: string; size: number }>))
  }, [])

  // QR URL を取得（60秒ごとに更新）
  React.useEffect(() => {
    if (!isTarget) return
    const fetch_ = async () => {
      try {
        const res  = await fetch(`/api/stamp-qr/${exhibitId}`)
        const json = await res.json() as { url?: string; error?: string }
        if (json.url) { setQrUrl(json.url); setQrError(false) }
        else          { setQrError(true) }
      } catch { setQrError(true) }
    }
    fetch_()
    const timer = setInterval(fetch_, 60_000)
    return () => clearInterval(timer)
  }, [exhibitId, isTarget])

  return (
    <Card title="🎯 スタンプラリー" icon="" style={{ marginBottom:16 }}>
      {/* トグル */}
      <button
        onClick={onToggle}
        style={{
          width:'100%', padding:'10px 14px', borderRadius:10, border:'none',
          cursor:'pointer', display:'flex', alignItems:'center', gap:10,
          background: isTarget ? '#fdf4ff' : '#f8fafc',
          boxShadow:  isTarget ? 'inset 0 0 0 1.5px #a855f7' : 'inset 0 0 0 1.5px #e2e8f0',
          marginBottom:16, transition:'all 0.15s',
        }}
      >
        <div style={{
          width:36, height:20, borderRadius:99, flexShrink:0, position:'relative',
          background: isTarget ? '#a855f7' : '#cbd5e1', transition:'background 0.2s',
        }}>
          <div style={{
            position:'absolute', top:2, borderRadius:'50%',
            width:16, height:16, background:'#fff',
            left: isTarget ? 18 : 2, transition:'left 0.2s',
            boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </div>
        <span style={{ fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif", color: isTarget ? '#7c3aed' : '#94a3b8' }}>
          {isTarget ? 'スタンプラリー 参加中' : 'スタンプラリー 不参加'}
        </span>
      </button>

      {/* 保存ボタン */}
      <button onClick={onSave} disabled={saving} style={{
        width:'100%', padding:'11px 0', borderRadius:10, border:'none', cursor:'pointer',
        background: saved ? '#10b981' : 'linear-gradient(135deg,#a855f7,#7c3aed)',
        color:'#fff', fontSize:13, fontWeight:700,
        fontFamily:"'Kaisei Decol',serif", transition:'background 0.3s', marginBottom:16,
      }}>
        {saving ? '保存中…' : saved ? '✓ 保存しました' : '設定を保存する'}
      </button>

      {/* QR 表示 */}
      {isTarget && (
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:12, fontFamily:"'Kiwi Maru',serif" }}>
            来場者にこの QR を読み取ってもらいます（60秒ごとに更新）
          </div>
          {qrError ? (
            <div style={{ color:'#f87171', fontSize:12, fontFamily:"'Kiwi Maru',serif" }}>
              QR の取得に失敗しました（設定を保存してから再読み込みしてください）
            </div>
          ) : qrUrl && QrComp ? (
            <div style={{
              display:'inline-block', padding:16, background:'#fff',
              borderRadius:12, boxShadow:'0 2px 12px rgba(0,0,0,0.10)',
            }}>
              <QrComp value={qrUrl} size={200} />
            </div>
          ) : (
            <PageLoader />
          )}
        </div>
      )}
    </Card>
  )
}
