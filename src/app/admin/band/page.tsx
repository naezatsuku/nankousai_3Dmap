'use client'

import PageLoader from '@/components/ui/PageLoader'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import ImageUpload from '@/components/ui/ImageUpload'
import MediaUpload, { isVideoUrl } from '@/components/ui/MediaUpload'
import { logActivity } from '@/lib/activity-log'

// ── 型 ────────────────────────────────────────────────────────

interface BandSchedule {
  id?:      string
  day:      'sat' | 'sun'
  start_at: string
  end_at:   string
  stage:    string
}

interface MyBand {
  id:                  string
  exhibit_id:          string
  name:                string
  members:             string[]
  instagram:           string
  thumbnail_url:       string
  enable_announcement: boolean
  announcement_color:  string
  schedules:           BandSchedule[]
}

type NoticeStatus = 'pending' | 'approved' | 'rejected'

interface BandNotice {
  id:         string
  band_id:    string
  title:      string
  body:       string
  is_urgent:  boolean
  status:     NoticeStatus
  created_at: string
}

interface NoticeMediaItem {
  id?:     string   // 既存 notice_media.id
  url:     string
  caption: string
  type:    'image' | 'video'
  key:     string   // React key（クライアント生成）
}

interface NoticeDraft {
  bandId:     string
  noticeId:   string | null   // null = 新規
  /** ストレージパス・新規 insert の id に使用 */
  noticeUuid: string
  title:      string
  body:       string
  is_urgent:  boolean
  media:      NoticeMediaItem[]
}

type BandTab = 'basic' | 'schedule' | 'notice'

const BAND_TABS: { id: BandTab; icon: string; label: string; short: string }[] = [
  { id:'basic',    icon:'📋', label:'基本情報',           short:'基本情報' },
  { id:'schedule', icon:'🎤', label:'スケジュール・演出', short:'スケジュール' },
  { id:'notice',   icon:'🔔', label:'お知らせ',           short:'お知らせ' },
]

const PRESET_COLORS = [
  { name:'パープル', hex:'#A855F7' }, { name:'ブルー', hex:'#3B82F6' },
  { name:'ピンク',   hex:'#EC4899' }, { name:'レッド', hex:'#EF4444' },
  { name:'オレンジ', hex:'#FF8C00' }, { name:'グリーン', hex:'#22C55E' },
]

// ── 共通スタイル ───────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background:'#fff', borderRadius:16, padding:'20px',
  boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9',
  marginBottom:16,
}
const labelStyle: React.CSSProperties = {
  fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6,
  fontFamily:"'Kiwi Maru',serif", display:'block',
}
const inputStyle: React.CSSProperties = {
  width:'100%', padding:'10px 12px', borderRadius:10,
  border:'1.5px solid #e2e8f0', fontSize:13, fontFamily:"'Kiwi Maru',serif",
  color:'#1e293b', background:'#fff', boxSizing:'border-box', outline:'none',
}

const STATUS_BADGE: Record<NoticeStatus, { label: string; bg: string; color: string }> = {
  approved: { label:'✓ 承認済み', bg:'#dcfce7', color:'#16a34a' },
  pending:  { label:'⏳ 審査待ち', bg:'#fef9c3', color:'#92400e' },
  rejected: { label:'✕ 却下',     bg:'#fee2e2', color:'#dc2626' },
}

export default function MyBandPage() {
  const [bands, setBands]       = useState<MyBand[]>([])
  const [notices, setNotices]   = useState<BandNotice[]>([])
  const [loading, setLoading]   = useState(true)
  const [userId, setUserId]     = useState<string | null>(null)
  const [isAdmin, setIsAdmin]   = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId]   = useState<string | null>(null)
  const [error, setError]       = useState('')

  // 表示中のバンドとタブ
  const [activeBandId, setActiveBandId] = useState<string | null>(null)
  const [tab, setTab]                   = useState<BandTab>('basic')

  // お知らせ作成・編集モーダル
  const [draft, setDraft]               = useState<NoticeDraft | null>(null)
  const [noticeSaving, setNoticeSaving] = useState(false)

  // ── 読み込み ──────────────────────────────────────────────────
  const loadNotices = useCallback(async (bandIds: string[]) => {
    if (bandIds.length === 0) { setNotices([]); return }
    const { data } = await createClient()
      .from('notices')
      .select('id, band_id, title, body, is_urgent, status, created_at')
      .in('band_id', bandIds)
      .order('created_at', { ascending: false })
    if (data) setNotices(data as BandNotice[])
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const role = (profile as { role: string } | null)?.role
      const admin = role === 'admin'
      setIsAdmin(admin)

      // admin は全バンド、それ以外は band_editors に割り当てられたバンドのみ
      let query = supabase.from('bands').select('*, band_schedules(*)').order('name')
      if (!admin) {
        const { data: assignments } = await supabase
          .from('band_editors').select('band_id').eq('user_id', user.id)
        const ids = (assignments ?? []).map((a: { band_id: string }) => a.band_id)
        if (ids.length === 0) { setBands([]); setLoading(false); return }
        query = query.in('id', ids)
      }

      const { data } = await query
      type RawB = {
        id: string; exhibit_id: string; name: string; members: string[] | null
        instagram: string | null; thumbnail_url: string | null
        enable_announcement: boolean | null; announcement_color: string | null
        band_schedules: { id: string; day: 'sat'|'sun'; start_at: string; end_at: string; stage: string | null }[]
      }
      const loaded = ((data ?? []) as unknown as RawB[]).map((b): MyBand => ({
        id:                  b.id,
        exhibit_id:          b.exhibit_id,
        name:                b.name,
        members:             b.members ?? [],
        instagram:           b.instagram ?? '',
        thumbnail_url:       b.thumbnail_url ?? '',
        enable_announcement: b.enable_announcement ?? false,
        announcement_color:  b.announcement_color ?? '#A855F7',
        schedules: (b.band_schedules ?? []).map(s => ({
          id: s.id, day: s.day,
          start_at: s.start_at.slice(0, 5), end_at: s.end_at.slice(0, 5),
          stage: s.stage ?? '',
        })),
      }))
      setBands(loaded)
      setActiveBandId(loaded[0]?.id ?? null)
      await loadNotices(loaded.map(b => b.id))
      setLoading(false)
    })
  }, [loadNotices])

  const update = (id: string, patch: Partial<MyBand>) =>
    setBands(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b))

  // ── バンド保存 ────────────────────────────────────────────────
  const saveBand = async (band: MyBand) => {
    if (!band.name.trim()) { setError('バンド名を入力してください'); return }
    setSavingId(band.id)
    setError('')
    const supabase = createClient()
    try {
      const { error: e1 } = await supabase.from('bands').update({
        name:                band.name.trim(),
        members:             band.members,
        instagram:           band.instagram.trim() || null,
        thumbnail_url:       band.thumbnail_url || null,
        enable_announcement: band.enable_announcement,
        announcement_color:  band.enable_announcement ? band.announcement_color || null : null,
      }).eq('id', band.id)
      if (e1) throw e1

      // スケジュールは全削除→再挿入（このバンドの分のみ）
      const { error: e2 } = await supabase.from('band_schedules').delete().eq('band_id', band.id)
      if (e2) throw e2
      const rows = band.schedules
        .filter(s => s.start_at && s.end_at)
        .map(s => ({ band_id: band.id, day: s.day, start_at: s.start_at, end_at: s.end_at, stage: s.stage || null }))
      if (rows.length > 0) {
        const { error: e3 } = await supabase.from('band_schedules').insert(rows)
        if (e3) throw e3
      }

      if (userId) {
        logActivity(band.exhibit_id, userId, 'content_edited', `バンド「${band.name.trim()}」の情報を更新しました`).catch(() => {})
      }

      setSavedId(band.id)
      setTimeout(() => setSavedId(null), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSavingId(null)
    }
  }

  // ── お知らせモーダルを開く ────────────────────────────────────
  const openNewNotice = (bandId: string) => {
    setDraft({
      bandId, noticeId: null, noticeUuid: crypto.randomUUID(),
      title:'', body:'', is_urgent:false, media: [],
    })
  }

  const openEditNotice = async (bandId: string, n: BandNotice) => {
    // 既存メディアを読み込んでからモーダルを開く
    const { data } = await createClient()
      .from('notice_media')
      .select('id, url, type, caption, order_index')
      .eq('notice_id', n.id)
      .order('order_index')
    type RawM = { id: string; url: string | null; type: 'image'|'video' | null; caption: string | null }
    const media: NoticeMediaItem[] = ((data ?? []) as RawM[]).map(m => ({
      id: m.id, url: m.url ?? '', caption: m.caption ?? '', type: m.type ?? 'image', key: m.id,
    }))
    setDraft({
      bandId, noticeId: n.id, noticeUuid: n.id,
      title: n.title, body: n.body, is_urgent: n.is_urgent, media,
    })
  }

  // ── お知らせ保存 ──────────────────────────────────────────────
  const saveNotice = async () => {
    if (!draft) return
    if (!draft.title.trim()) { setError('タイトルを入力してください'); return }
    const band = bands.find(b => b.id === draft.bandId)
    if (!band) return

    setNoticeSaving(true)
    setError('')
    const supabase = createClient()
    try {
      if (draft.noticeId === null) {
        // 新規: admin は即承認、それ以外は審査待ち
        const status: NoticeStatus = isAdmin ? 'approved' : 'pending'
        const { error: e } = await supabase.from('notices').insert({
          id:          draft.noticeUuid,
          exhibit_id:  band.exhibit_id,
          band_id:     band.id,
          title:       draft.title.trim(),
          body:        draft.body.trim(),
          sender_name: band.name,
          is_urgent:   draft.is_urgent,
          status,
        })
        if (e) throw e
        if (isAdmin) {
          fetch('/api/notice-notify', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              title:      draft.title.trim(),
              body:       draft.body.trim(),
              senderName: band.name,
              exhibitId:  band.exhibit_id,
            }),
          }).catch(() => {})
        }
        if (userId) {
          logActivity(band.exhibit_id, userId, 'notice_posted', `「${draft.title.trim()}」を投稿しました（${band.name}）`).catch(() => {})
        }
      } else {
        const { error: e } = await supabase.from('notices').update({
          title:     draft.title.trim(),
          body:      draft.body.trim(),
          is_urgent: draft.is_urgent,
        }).eq('id', draft.noticeId)
        if (e) throw e
        // 既存メディアを一括削除してから再挿入
        await supabase.from('notice_media').delete().eq('notice_id', draft.noticeId)
        if (userId) {
          logActivity(band.exhibit_id, userId, 'notice_edited', `「${draft.title.trim()}」を編集しました（${band.name}）`).catch(() => {})
        }
      }

      // メディア挿入
      const validMedia = draft.media.filter(m => m.url)
      if (validMedia.length > 0) {
        const { error: e } = await supabase.from('notice_media').insert(
          validMedia.map((m, i) => ({
            notice_id:   draft.noticeUuid,
            url:         m.url,
            type:        m.type,
            caption:     m.caption.trim() || null,
            order_index: i,
          }))
        )
        if (e) throw e
      }

      setDraft(null)
      await loadNotices(bands.map(b => b.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setNoticeSaving(false)
    }
  }

  const deleteNotice = async (notice: BandNotice) => {
    if (!confirm(`「${notice.title}」を削除しますか？`)) return
    await createClient().from('notices').delete().eq('id', notice.id)
    await loadNotices(bands.map(b => b.id))
  }

  // ── ドラフトのメディア操作 ────────────────────────────────────
  const addDraftMedia = () =>
    setDraft(d => d && ({ ...d, media: [...d.media, { url:'', caption:'', type:'image' as const, key: crypto.randomUUID() }] }))

  const updateDraftMedia = (key: string, patch: Partial<NoticeMediaItem>) =>
    setDraft(d => d && ({ ...d, media: d.media.map(m => m.key === key ? { ...m, ...patch } : m) }))

  const removeDraftMedia = (key: string) =>
    setDraft(d => d && ({ ...d, media: d.media.filter(m => m.key !== key) }))

  // ── レンダー ──────────────────────────────────────────────────
  if (loading) return <PageLoader />

  const band = bands.find(b => b.id === activeBandId) ?? bands[0] ?? null
  const bandNotices = band ? notices.filter(n => n.band_id === band.id) : []
  const hasRejected = bandNotices.some(n => n.status === 'rejected')
  const saving = band !== null && savingId === band.id

  const saveButton = band && (
    <button
      onClick={() => saveBand(band)}
      disabled={saving}
      style={{
        width:'100%', padding:'12px 0', borderRadius:12, marginTop:6,
        background: saving ? '#e2e8f0' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
        color: saving ? '#94a3b8' : '#fff',
        fontSize:13, fontWeight:700, border:'none', cursor: saving ? 'not-allowed' : 'pointer',
        fontFamily:"'Kiwi Maru',serif",
        boxShadow: saving ? 'none' : '0 4px 14px rgba(255,107,0,0.3)',
      }}
    >
      {saving ? '保存中…' : savedId === band.id ? '✓ 保存しました' : 'バンド情報を保存'}
    </button>
  )

  return (
    <>
      <style>{`
        .myband-page{ padding-bottom:84px; }
        .myband-desktop-tabs{ display:none; }
        @media (min-width:900px){
          .myband-mobile-tabs{ display:none!important; }
          .myband-page{ padding-bottom:0; }
          .myband-desktop-tabs{ display:flex!important; }
        }
      `}</style>

      <div className="myband-page" style={{ maxWidth:760 }}>
        <div style={{ marginBottom:24 }}>
          <h2 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
            🎸 マイバンド
          </h2>
          <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
            担当バンドの情報編集とお知らせ投稿ができます
          </div>
        </div>

        {error && (
          <div style={{
            marginBottom:12, padding:'10px 16px', borderRadius:10,
            background:'#fef2f2', border:'1px solid #fecaca',
            fontSize:12, color:'#ef4444', fontFamily:"'Kiwi Maru',serif",
          }}>
            {error}
          </div>
        )}

        {!band ? (
          <div style={{ ...cardStyle, textAlign:'center', padding:'48px 20px' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>🎸</div>
            <div style={{ fontSize:13, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", lineHeight:1.8 }}>
              担当バンドがまだ割り当てられていません。<br />
              軽音楽部の管理者に割り当てを依頼してください。
            </div>
          </div>
        ) : (
          <>
            {/* ── バンド切り替え（複数担当時のみ） ── */}
            {bands.length > 1 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                {bands.map(b => {
                  const active = b.id === band.id
                  return (
                    <button key={b.id} onClick={() => setActiveBandId(b.id)} style={{
                      padding:'7px 16px', borderRadius:99, border:'none', cursor:'pointer',
                      background: active ? 'linear-gradient(135deg,#a855f7,#c084fc)' : '#fff',
                      color: active ? '#fff' : '#64748b',
                      boxShadow: active ? '0 2px 8px rgba(168,85,247,0.3)' : 'inset 0 0 0 1px #e2e8f0',
                      fontSize:12, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                      transition:'all 0.15s',
                    }}>
                      🎸 {b.name || '（名称未設定）'}
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── PC用タブバー（カードの外・上部） ── */}
            <div className="myband-desktop-tabs" style={{ gap:4, borderBottom:'2px solid #f1f5f9', marginBottom:16 }}>
              {BAND_TABS.map(({ id, icon, label }) => {
                const active = tab === id
                return (
                  <button key={id} onClick={() => setTab(id)} style={{
                    display:'flex', alignItems:'center', gap:6,
                    padding:'10px 20px', marginBottom:-2,
                    border:'none', borderBottom: active ? '2px solid #FF6B00' : '2px solid transparent',
                    background:'none', cursor:'pointer',
                    color: active ? '#FF6B00' : '#94a3b8',
                    fontWeight: active ? 700 : 400, fontSize:14,
                    fontFamily:"'Kiwi Maru',serif",
                    transition:'all 0.15s', position:'relative',
                  }}>
                    <span>{icon}</span>{label}
                    {id === 'notice' && hasRejected && (
                      <span style={{ width:7, height:7, borderRadius:'50%', background:'#ef4444', flexShrink:0 }} />
                    )}
                  </button>
                )
              })}
            </div>

            <div style={cardStyle}>
              {/* バンド名ヘッダー */}
              <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:16, fontWeight:700, color:'#1e293b', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                🎸 {band.name || '（バンド名未設定）'}
                <span style={{ fontSize:11, fontWeight:400, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                  {BAND_TABS.find(t => t.id === tab)?.label}
                </span>
              </div>

              {/* ── 基本情報タブ ── */}
              {tab === 'basic' && (
                <div>
                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>バンド名</label>
                    <input type="text" value={band.name}
                      onChange={e => update(band.id, { name: e.target.value })}
                      placeholder="例: The Crimson" style={inputStyle} />
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>メンバー（1行1人）</label>
                    <textarea
                      value={band.members.join('\n')}
                      onChange={e => update(band.id, { members: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                      rows={3}
                      placeholder={'田中 颯\n鈴木 葵\n佐藤 陸'}
                      style={{ ...inputStyle, resize:'vertical', lineHeight:1.7 }}
                    />
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>Instagram（@なし）</label>
                    <input type="text" value={band.instagram}
                      onChange={e => update(band.id, { instagram: e.target.value })}
                      placeholder="例: the_crimson_band" style={inputStyle} />
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <ImageUpload
                      label="バンド写真"
                      value={band.thumbnail_url}
                      onChange={v => update(band.id, { thumbnail_url: v })}
                      storagePath={`bands/${band.exhibit_id}/${band.id}/thumbnail`}
                      aspect="square"
                    />
                  </div>

                  {saveButton}
                </div>
              )}

              {/* ── スケジュール・演出タブ ── */}
              {tab === 'schedule' && (
                <div>
                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>公演スケジュール</label>
                    <ScheduleEditor
                      schedules={band.schedules}
                      onChange={scheds => update(band.id, { schedules: scheds })}
                    />
                    <div style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginTop:6 }}>
                      ⚠️ 他のバンドと時間枠が重ならないか確認してから保存してください
                    </div>
                  </div>

                  <div style={{ marginBottom:14, padding:'12px 14px', background:'#fafafa', borderRadius:10, border:'1px solid #f1f5f9' }}>
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
                      <div style={{ marginTop:10, display:'flex', flexWrap:'wrap', gap:6 }}>
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
                    )}
                  </div>

                  {saveButton}
                </div>
              )}

              {/* ── お知らせタブ ── */}
              {tab === 'notice' && (
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#64748b', fontFamily:"'Kiwi Maru',serif" }}>
                      🔔 {band.name} のお知らせ
                    </div>
                    <button
                      onClick={() => openNewNotice(band.id)}
                      style={{
                        padding:'7px 16px', borderRadius:8, border:'none', cursor:'pointer',
                        background:'linear-gradient(135deg,#a855f7,#c084fc)', color:'#fff',
                        fontSize:11, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
                      }}
                    >
                      ＋ 投稿する
                    </button>
                  </div>

                  {bandNotices.length === 0 ? (
                    <div style={{
                      textAlign:'center', padding:'28px 0',
                      color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif", fontSize:12,
                      border:'2px dashed #f1f5f9', borderRadius:12,
                    }}>
                      まだお知らせはありません
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {bandNotices.map(n => {
                        const badge = STATUS_BADGE[n.status]
                        return (
                          <div key={n.id} style={{
                            display:'flex', alignItems:'center', gap:8,
                            padding:'10px 12px', borderRadius:10,
                            background:'#fafafa', border:'1px solid #f1f5f9',
                          }}>
                            <button
                              onClick={() => openEditNotice(band.id, n)}
                              style={{ flex:1, minWidth:0, textAlign:'left', background:'transparent', border:'none', cursor:'pointer', padding:0 }}
                            >
                              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                                {n.is_urgent && (
                                  <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99, background:'#FF6B00', color:'#fff', fontFamily:"'Kiwi Maru',serif", flexShrink:0 }}>重要</span>
                                )}
                                <span style={{ fontSize:12, fontWeight:700, color:'#1e293b', fontFamily:"'Kiwi Maru',serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                  {n.title}
                                </span>
                              </div>
                              <span style={{
                                fontSize:9, fontWeight:700, padding:'1px 8px', borderRadius:99,
                                background: badge.bg, color: badge.color, fontFamily:"'Kiwi Maru',serif",
                              }}>
                                {badge.label}
                              </span>
                            </button>
                            <button
                              onClick={() => deleteNotice(n)}
                              style={{
                                padding:'4px 10px', borderRadius:6, flexShrink:0,
                                border:'1px solid #fee2e2', background:'#fff', color:'#ef4444',
                                fontSize:10, cursor:'pointer', fontFamily:"'Kiwi Maru',serif",
                              }}
                            >
                              削除
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── お知らせ作成・編集モーダル ── */}
        {draft && (
          <div style={{
            position:'fixed', inset:0, zIndex:100,
            background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:20,
          }}
            onClick={e => { if (e.target === e.currentTarget) setDraft(null) }}
          >
            <div style={{ background:'#fff', borderRadius:20, padding:'24px', width:'100%', maxWidth:480, maxHeight:'85vh', overflowY:'auto' }}>
              <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:17, fontWeight:700, color:'#1e293b', marginBottom:4 }}>
                {draft.noticeId === null ? 'お知らせを投稿' : 'お知らせを編集'}
              </div>
              <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:16 }}>
                {bands.find(b => b.id === draft.bandId)?.name} 名義で投稿されます
                {!isAdmin && '（公開には管理者の承認が必要です）'}
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={labelStyle}>タイトル（必須）</label>
                <input type="text" value={draft.title}
                  onChange={e => setDraft(d => d && ({ ...d, title: e.target.value }))}
                  placeholder="例：本日のライブ開始時刻のお知らせ" style={inputStyle} />
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={labelStyle}>本文</label>
                <textarea value={draft.body}
                  onChange={e => setDraft(d => d && ({ ...d, body: e.target.value }))}
                  rows={5} placeholder="お知らせの内容を入力してください"
                  style={{ ...inputStyle, resize:'vertical', lineHeight:1.7 }} />
              </div>

              {/* メディア */}
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <label style={{ ...labelStyle, marginBottom:0 }}>
                    🖼 メディア{draft.media.length > 0 ? `（${draft.media.length}件）` : ''}
                  </label>
                  <button
                    onClick={addDraftMedia}
                    style={{
                      padding:'5px 12px', borderRadius:8,
                      border:'1.5px dashed #e2e8f0',
                      background:'#fafafa', color:'#64748b',
                      fontSize:11, cursor:'pointer',
                      fontFamily:"'Kiwi Maru',serif", fontWeight:700,
                    }}
                  >
                    ＋ 追加
                  </button>
                </div>

                {draft.media.length === 0 ? (
                  <div style={{
                    textAlign:'center', padding:'16px 0',
                    color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif", fontSize:11,
                    border:'2px dashed #f1f5f9', borderRadius:12,
                  }}>
                    「＋ 追加」から画像または動画を添付できます
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {draft.media.map((item, i) => (
                      <div key={item.key} style={{
                        padding:12, borderRadius:12,
                        border:'1px solid #f1f5f9', background:'#fafafa',
                      }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                          <span style={{
                            fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
                            background: item.type === 'video' ? '#e0f2fe' : '#f0fdf4',
                            color:      item.type === 'video' ? '#0284c7' : '#16a34a',
                            fontFamily:"'Kiwi Maru',serif",
                          }}>
                            {item.type === 'video' ? '🎬 動画' : '🖼 画像'} #{i + 1}
                          </span>
                          <button onClick={() => removeDraftMedia(item.key)}
                            style={{ padding:'3px 10px', borderRadius:6, border:'1px solid #fee2e2', background:'#fff', color:'#ef4444', fontSize:10, cursor:'pointer' }}>
                            削除
                          </button>
                        </div>
                        <MediaUpload
                          value={item.url}
                          storagePath={`notices/${draft.noticeUuid}/${item.key}`}
                          accept="any"
                          onChange={url => updateDraftMedia(item.key, {
                            url,
                            type: url ? (isVideoUrl(url) ? 'video' : 'image') : item.type,
                          })}
                        />
                        <input
                          type="text"
                          value={item.caption}
                          onChange={e => updateDraftMedia(item.key, { caption: e.target.value })}
                          placeholder="キャプション（任意）"
                          style={{
                            width:'100%', padding:'7px 10px', borderRadius:8, marginTop:8,
                            border:'1px solid #e2e8f0', fontSize:11,
                            fontFamily:"'Kiwi Maru',serif", color:'#475569',
                            background:'#fff', boxSizing:'border-box',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                onClick={() => setDraft(d => d && ({ ...d, is_urgent: !d.is_urgent }))}
                style={{
                  display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                  borderRadius:10, border:`1.5px solid ${draft.is_urgent ? '#FF8C00' : '#e2e8f0'}`,
                  background: draft.is_urgent ? '#fff8f4' : '#fafafa',
                  cursor:'pointer', userSelect:'none', marginBottom:18,
                }}
              >
                <div style={{
                  width:18, height:18, borderRadius:5, border:'2px solid',
                  borderColor: draft.is_urgent ? '#FF8C00' : '#cbd5e1',
                  background: draft.is_urgent ? '#FF8C00' : '#fff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:10, color:'#fff', flexShrink:0,
                }}>
                  {draft.is_urgent ? '✓' : ''}
                </div>
                <span style={{ fontSize:12, fontWeight:700, color: draft.is_urgent ? '#FF8C00' : '#475569', fontFamily:"'Kiwi Maru',serif" }}>
                  ⚠️ 重要なお知らせ
                </span>
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setDraft(null)} style={{
                  flex:1, padding:'11px 0', borderRadius:10, border:'1px solid #e2e8f0',
                  background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
                  fontFamily:"'Kiwi Maru',serif", color:'#64748b',
                }}>
                  キャンセル
                </button>
                <button onClick={saveNotice} disabled={noticeSaving} style={{
                  flex:2, padding:'11px 0', borderRadius:10, border:'none',
                  background: noticeSaving ? '#e2e8f0' : 'linear-gradient(135deg,#FF6B00,#FFAA28)',
                  color: noticeSaving ? '#94a3b8' : '#fff',
                  fontSize:13, fontWeight:700, cursor: noticeSaving ? 'not-allowed' : 'pointer',
                  fontFamily:"'Kiwi Maru',serif",
                }}>
                  {noticeSaving ? '保存中…' : draft.noticeId === null ? '投稿する' : '変更を保存'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── モバイル: 画面下固定タブバー（/admin/edit 準拠） ── */}
      {band && (
        <nav className="myband-mobile-tabs" style={{
          position:'fixed', left:0, right:0, bottom:0, zIndex:50,
          display:'flex', alignItems:'center',
          background:'rgba(255,255,255,0.97)',
          backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
          borderTop:'1px solid rgba(255,140,0,0.10)',
          padding:'6px 0 max(6px, env(safe-area-inset-bottom))',
        }}>
          {/* スライドインジケーター */}
          <div style={{
            position:'absolute', top:0, height:2.5, width:'25%',
            background:'linear-gradient(90deg,#FF6B00,#FFB347)',
            borderRadius:'0 0 4px 4px',
            left:`${BAND_TABS.findIndex(t => t.id === tab) * 33.333 + 4.166}%`,
            transition:'left 0.32s cubic-bezier(0.34,1.3,0.64,1)',
          }} />

          {BAND_TABS.map(({ id, icon, short }) => {
            const active = tab === id
            return (
              <button key={id} onClick={() => setTab(id)} style={{
                flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                background:'none', border:'none', cursor:'pointer', padding:'4px 0',
                transition:'transform 0.15s ease',
                transform: active ? 'translateY(-1px)' : 'translateY(0)',
              }} aria-label={short}>
                <span style={{ position:'relative', fontSize:20, filter: active ? 'none' : 'grayscale(1) opacity(0.55)', transition:'filter 0.2s' }}>
                  {icon}
                  {id === 'notice' && hasRejected && (
                    <span style={{
                      position:'absolute', top:-2, right:-6,
                      width:8, height:8, borderRadius:'50%',
                      background:'#ef4444', border:'1.5px solid #fff',
                    }} />
                  )}
                </span>
                <span style={{
                  fontSize:10, fontFamily:"'Kiwi Maru',serif",
                  color: active ? '#FF6B00' : '#bbb',
                  fontWeight: active ? 'bold' : 'normal',
                  transition:'color 0.2s',
                }}>
                  {short}
                </span>
              </button>
            )
          })}
        </nav>
      )}
    </>
  )
}

// ─── スケジュール編集 ──────────────────────────────────────────
function ScheduleEditor({ schedules, onChange }: {
  schedules: BandSchedule[]
  onChange:  (v: BandSchedule[]) => void
}) {
  const update = (i: number, patch: Partial<BandSchedule>) =>
    onChange(schedules.map((s, idx) => idx === i ? { ...s, ...patch } : s))

  const remove = (i: number) => onChange(schedules.filter((_, idx) => idx !== i))

  const add = () => onChange([...schedules, { day:'sat', start_at:'10:00', end_at:'10:20', stage:'' }])

  const selStyle: React.CSSProperties = {
    padding:'7px 8px', borderRadius:8, border:'1px solid #e2e8f0',
    fontSize:12, fontFamily:"'Kiwi Maru',serif", color:'#1e293b', background:'#fff',
  }

  return (
    <div>
      {schedules.map((s, i) => (
        <div key={s.id ?? i} style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:6, marginBottom:6 }}>
          <select value={s.day} onChange={e => update(i, { day: e.target.value as 'sat'|'sun' })} style={selStyle}>
            <option value="sat">土曜</option>
            <option value="sun">日曜</option>
          </select>
          <input type="time" value={s.start_at} onChange={e => update(i, { start_at: e.target.value })} style={selStyle} />
          <span style={{ fontSize:12, color:'#94a3b8' }}>〜</span>
          <input type="time" value={s.end_at} onChange={e => update(i, { end_at: e.target.value })} style={selStyle} />
          <input type="text" value={s.stage} onChange={e => update(i, { stage: e.target.value })}
            placeholder="ステージ名" style={{ ...selStyle, flex:1, minWidth:100 }} />
          <button onClick={() => remove(i)} style={{
            padding:'6px 10px', borderRadius:6, border:'1px solid #fee2e2',
            background:'#fff', color:'#ef4444', fontSize:11, cursor:'pointer',
          }}>
            ✕
          </button>
        </div>
      ))}
      <button onClick={add} style={{
        width:'100%', padding:'9px', borderRadius:8, border:'1.5px dashed #e2e8f0',
        background:'#fafafa', cursor:'pointer', fontSize:12, color:'#94a3b8',
        fontFamily:"'Kiwi Maru',serif", fontWeight:700, marginTop:2,
      }}>
        ＋ 公演枠を追加
      </button>
    </div>
  )
}
