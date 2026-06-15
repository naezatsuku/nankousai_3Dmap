'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { fetchNotices, formatDate, type NoticeItem, type NoticeMedia } from '@/lib/notices'
import { getExhibit, fetchExhibitDetail, type ExhibitDetail } from '@/lib/exhibits'
import NotifyButton from '@/components/ui/NotifyButton'
import AddToScheduleButton from '@/components/ui/AddToScheduleButton'
import ClassPageContent from '@/components/exhibit/ClassPageContent'
import type { ExhibitType } from '@/types'

const PAGE_SIZE = 20

const TYPE_LABEL: Record<ExhibitType, string> = {
  class: '展示', food: 'フード', band: '軽音楽部', special: 'スペシャル', cafeteria: '食堂',
}

const HERO_CONFIG: Record<ExhibitType, { emoji: string; bg: string }> = {
  class:     { emoji:'🎨', bg:'linear-gradient(135deg,#FF6B00,#FFAA28)' },
  food:      { emoji:'🍱', bg:'linear-gradient(135deg,#f59e0b,#fcd34d)' },
  band:      { emoji:'🎸', bg:'linear-gradient(135deg,#7c3aed,#a78bfa)' },
  special:   { emoji:'⭐', bg:'linear-gradient(135deg,#0284c7,#38bdf8)' },
  cafeteria: { emoji:'🍜', bg:'linear-gradient(135deg,#16a34a,#86efac)' },
}

export type ProfileTab = 'page' | 'notice' | 'comment'

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'page',    label: 'クラスページ' },
  { key: 'notice',  label: 'お知らせ' },
  { key: 'comment', label: 'コメント' },
]

interface RawComment {
  id:          string
  body:        string
  author_name: string | null
  created_at:  string
}

interface FeedbackData {
  likeCount:     number
  showLikeCount: boolean
  userLiked:     boolean
  userHasStamp:  boolean
}

interface LikeState { count: number; liked: boolean }

export default function ExhibitProfilePage({ initialTab }: { initialTab: ProfileTab }) {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [userId] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    let uid = localStorage.getItem('stamp_user_id')
    if (!uid) {
      uid = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
      localStorage.setItem('stamp_user_id', uid)
    }
    return uid
  })

  const [exhibit, setExhibit] = useState<ExhibitDetail | null>(() => getExhibit(id))
  const [tab, setTab]         = useState<ProfileTab>(initialTab)

  // ── exhibit detail（セクション・メディア込み） ────────────────
  useEffect(() => {
    fetchExhibitDetail(id).then(data => { if (data) setExhibit(data) })
  }, [id])

  // ── 展示へのいいね ────────────────────────────────────────────
  const [feedback, setFeedback] = useState<FeedbackData | null>(null)
  useEffect(() => {
    let alive = true
    const qs = userId ? `?userId=${userId}` : ''
    fetch(`/api/exhibit-feedback/${id}${qs}`)
      .then(r => r.json())
      .then((d: FeedbackData) => { if (alive) setFeedback(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [id, userId])

  // ── notices ─────────────────────────────────────────────────
  const [notices,        setNotices]       = useState<NoticeItem[]>([])
  const [noticeLoading,  setNoticeLoading] = useState(true)
  const [noticeHasMore,  setNoticeHasMore] = useState(true)
  const noticeCursorRef  = useRef<string | null>(null)
  const noticeLoadingRef = useRef(false)

  // ── comments ─────────────────────────────────────────────────
  const [comments,       setComments]       = useState<RawComment[]>([])
  const [commentLoading, setCommentLoading] = useState(true)
  const [commentHasMore, setCommentHasMore] = useState(true)
  const commentCursorRef  = useRef<string | null>(null)
  const commentLoadingRef = useRef(false)

  // ── likes ────────────────────────────────────────────────────
  const [likes, setLikes] = useState<Record<string, LikeState>>({})

  // ── IntersectionObserver ─────────────────────────────────────
  const noticeObsRef  = useRef<IntersectionObserver | null>(null)
  const commentObsRef = useRef<IntersectionObserver | null>(null)

  // ── fetch likes ──────────────────────────────────────────────
  const fetchLikesFor = useCallback((ids: string[]) => {
    if (!ids.length) return
    const qs = new URLSearchParams({ ids: ids.join(',') })
    if (userId) qs.set('userId', userId)
    fetch(`/api/notice-like?${qs.toString()}`)
      .then(r => (r.ok ? r.json() : null))
      .then((json: { counts: Record<string, number>; liked: string[] } | null) => {
        if (!json) return
        setLikes(prev => {
          const next = { ...prev }
          for (const nid of ids) {
            next[nid] = { count: json.counts[nid] ?? 0, liked: json.liked.includes(nid) }
          }
          return next
        })
      })
      .catch(() => {})
  }, [userId])

  // ── load notices ─────────────────────────────────────────────
  const loadNotices = useCallback(async (isInitial: boolean) => {
    if (noticeLoadingRef.current) return
    noticeLoadingRef.current = true
    if (isInitial) setNoticeLoading(true)
    try {
      const items = await fetchNotices({
        limit: PAGE_SIZE, before: noticeCursorRef.current ?? undefined, exhibitId: id,
      })
      setNotices(prev => isInitial ? items : [...prev, ...items])
      setNoticeHasMore(items.length >= PAGE_SIZE)
      if (items.length > 0) noticeCursorRef.current = items[items.length - 1].created_at
      fetchLikesFor(items.map(n => n.id))
    } finally {
      noticeLoadingRef.current = false
      if (isInitial) setNoticeLoading(false)
    }
  }, [id, fetchLikesFor])

  // ── load comments ────────────────────────────────────────────
  const loadComments = useCallback(async (isInitial: boolean) => {
    if (commentLoadingRef.current) return
    commentLoadingRef.current = true
    if (isInitial) setCommentLoading(true)
    try {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE), exhibitId: id })
      if (commentCursorRef.current) qs.set('before', commentCursorRef.current)
      const res   = await fetch(`/api/comments-feed?${qs.toString()}`)
      const json  = await res.json() as { comments: RawComment[] }
      const items = json.comments ?? []
      setComments(prev => isInitial ? items : [...prev, ...items])
      setCommentHasMore(items.length >= PAGE_SIZE)
      if (items.length > 0) commentCursorRef.current = items[items.length - 1].created_at
    } finally {
      commentLoadingRef.current = false
      if (isInitial) setCommentLoading(false)
    }
  }, [id])

  useEffect(() => {
    noticeCursorRef.current  = null
    commentCursorRef.current = null
    const id = setTimeout(() => { loadNotices(true); loadComments(true) }, 0)
    return () => clearTimeout(id)
  }, [loadNotices, loadComments])

  // ── sentinel callback refs ───────────────────────────────────
  const noticeSentinel = useCallback((node: HTMLDivElement | null) => {
    noticeObsRef.current?.disconnect()
    if (!node) return
    noticeObsRef.current = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting && !noticeLoadingRef.current) loadNotices(false)
    }, { rootMargin: '200px' })
    noticeObsRef.current.observe(node)
  }, [loadNotices])

  const commentSentinel = useCallback((node: HTMLDivElement | null) => {
    commentObsRef.current?.disconnect()
    if (!node) return
    commentObsRef.current = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting && !commentLoadingRef.current) loadComments(false)
    }, { rootMargin: '200px' })
    commentObsRef.current.observe(node)
  }, [loadComments])

  useEffect(() => () => {
    noticeObsRef.current?.disconnect()
    commentObsRef.current?.disconnect()
  }, [])

  // ── like toggle ──────────────────────────────────────────────
  const handleToggleLike = useCallback((noticeId: string) => {
    if (!userId) return
    const flip = (s: LikeState | undefined): LikeState => {
      const cur = s ?? { count: 0, liked: false }
      return { count: cur.count + (cur.liked ? -1 : 1), liked: !cur.liked }
    }
    setLikes(prev => ({ ...prev, [noticeId]: flip(prev[noticeId]) }))
    fetch('/api/notice-like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noticeId, userId }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((json: { liked: boolean; likeCount: number }) => {
        setLikes(prev => ({ ...prev, [noticeId]: { count: json.likeCount, liked: json.liked } }))
      })
      .catch(() => {
        setLikes(prev => ({ ...prev, [noticeId]: flip(prev[noticeId]) }))
      })
  }, [userId])

  const hero      = HERO_CONFIG[exhibit?.type ?? 'class'] ?? HERO_CONFIG.class
  const thumbnail = exhibit?.thumbnail_url ?? exhibit?.cover_url ?? null

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .ef-row:active     { background: #fff8f4 !important; }
        .ef-comment:active { background: #f2f5ff !important; }
        .ef-tab:active     { background: rgba(0,0,0,.035) !important; }
        .ef-like           { transition: transform .12s; }
        .ef-like:active    { transform: scale(.82); }
        .ef-back:active    { background: rgba(0,0,0,.45) !important; }
      `}</style>

      <div style={{ height:'100dvh', display:'flex', flexDirection:'column', background:'#f5f3ef' }}>
      <div style={{ width:'100%', maxWidth:640, margin:'0 auto', display:'flex', flexDirection:'column', height:'100%', background:'#fff', boxShadow:'0 0 24px rgba(0,0,0,.04)' }}>

        {/* ── スティッキーヘッダー ── */}
        <div style={{
          flexShrink:0, zIndex:40,
          background:'rgba(255,255,255,.95)',
          backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
          borderBottom:'1px solid #eee',
        }}>
          {/* 戻るボタン行 */}
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px 4px' }}>
            <button
              className="ef-back"
              onClick={() => router.back()}
              style={{
                background:'transparent', border:'none', cursor:'pointer',
                width:34, height:34, borderRadius:'50%', flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:19, color:'#1a1a1a',
              }}
            >
              ←
            </button>
            <div style={{ minWidth:0 }}>
              <div style={{
                fontSize:14, fontWeight:700, color:'#1a1a1a',
                fontFamily:"'Kaisei Decol',serif",
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              }}>
                {exhibit?.class_label ?? exhibit?.name ?? ''}
              </div>
              {exhibit?.name && exhibit?.class_label && (
                <div style={{ fontSize:10, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
                  {exhibit.name}
                </div>
              )}
            </div>
          </div>

          <div style={{ display:'flex' }}>
            {TABS.map(t => {
              const active = tab === t.key
              return (
                <button key={t.key} className="ef-tab" onClick={() => setTab(t.key)} style={{
                  flex:1, position:'relative', display:'flex', alignItems:'center', justifyContent:'center',
                  padding:'11px 0', border:'none', background:'transparent', cursor:'pointer',
                  fontFamily:"'Kiwi Maru',serif",
                }}>
                  <span style={{ fontSize:13, fontWeight: active ? 700 : 600, color: active ? '#1a1a1a' : '#999', transition:'color .15s' }}>
                    {t.label}
                  </span>
                  <span style={{
                    position:'absolute', bottom:0, left:'50%',
                    width:36, height:3, borderRadius:99,
                    background:'linear-gradient(90deg,#FF6B00,#FFAA28)',
                    transform: active ? 'translateX(-50%) scaleX(1)' : 'translateX(-50%) scaleX(0)',
                    transition:'transform .2s ease',
                  }} />
                </button>
              )
            })}
          </div>
        </div>

        {/* ── スクロールエリア（カバー＋プロフィール＋タブコンテンツ） ── */}
        <div style={{ flex:1, overflowY:'auto' }}>

          {/* カバー画像 */}
          <div style={{ position:'relative', height:168, flexShrink:0, overflow:'hidden' }}>
            {exhibit?.cover_url ? (
              <img src={exhibit.cover_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            ) : (
              <div style={{ width:'100%', height:'100%', background: hero.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:64, opacity:.5 }}>
                {hero.emoji}
              </div>
            )}
            {/* グラデーションオーバーレイ */}
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,.55) 0%, transparent 55%)' }} />

            {/* ← 戻るボタン（カバー左上） */}
            <button
              className="ef-back"
              onClick={() => router.back()}
              style={{
                position:'absolute', top:12, left:12,
                width:34, height:34, borderRadius:'50%',
                background:'rgba(0,0,0,.32)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
                border:'none', cursor:'pointer', color:'#fff', fontSize:18,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}
            >
              ←
            </button>
          </div>

          {/* プロフィールセクション */}
          <div style={{ padding:'0 16px 0', position:'relative' }}>

            {/* アバター（カバー画像にオーバーラップ） */}
            <div style={{
              position:'absolute', top:-28, left:16,
              width:56, height:56, borderRadius:'50%',
              border:'3px solid #fff', overflow:'hidden',
              background: thumbnail ? '#f0f0f0' : hero.bg,
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 2px 12px rgba(0,0,0,.18)',
            }}>
              {thumbnail
                ? <img src={thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <span style={{ fontSize:26 }}>{hero.emoji}</span>
              }
            </div>

            {/* アクションボタン（右寄せ） */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, paddingTop:10, paddingBottom:4 }}>
              <NotifyButton exhibitId={id} exhibitType={exhibit?.type} variant="pill" />
            </div>

            {/* 名前・バッジ */}
            <div style={{ marginTop:28, marginBottom:6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{
                  fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#0f172a',
                }}>
                  {exhibit?.name ?? '…'}
                </span>
                {exhibit?.type && (
                  <span style={{
                    fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:99,
                    background:'linear-gradient(135deg,#FF6B00,#FFAA28)', color:'#fff',
                    fontFamily:"'Kiwi Maru',serif",
                  }}>
                    {TYPE_LABEL[exhibit.type]}
                  </span>
                )}
              </div>
              {exhibit?.class_label && (
                <div style={{ fontSize:13, color:'#64748b', fontFamily:"'Kiwi Maru',serif", marginTop:2 }}>
                  {exhibit.class_label}
                </div>
              )}
            </div>

            {/* キャッチコピー・説明 */}
            {(exhibit?.catch_copy || exhibit?.description) && (
              <p style={{
                margin:'8px 0 10px', fontSize:13.5, lineHeight:1.65,
                color:'#334155', fontFamily:"'Kiwi Maru',serif",
              }}>
                {exhibit.catch_copy
                  ? <><em style={{ fontStyle:'normal', fontWeight:700 }}>{exhibit.catch_copy}</em>{exhibit.description ? `\n${exhibit.description}` : ''}</>
                  : exhibit.description
                }
              </p>
            )}

            {/* 場所・日程チップ */}
            {exhibit && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                {exhibit.room_display && (
                  <span style={{
                    display:'inline-flex', alignItems:'center', gap:5,
                    padding:'5px 12px', borderRadius:99,
                    background:'#f1f5f9', border:'1px solid #e2e8f0',
                    fontSize:12, color:'#475569', fontFamily:"'Kiwi Maru',serif",
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    {exhibit.room_display}{exhibit.floor != null ? ` · ${exhibit.floor}F` : ''}
                  </span>
                )}
                <span style={{
                  display:'inline-flex', alignItems:'center', gap:5,
                  padding:'5px 12px', borderRadius:99,
                  background:'#f1f5f9', border:'1px solid #e2e8f0',
                  fontSize:12, color:'#475569', fontFamily:"'Kiwi Maru',serif",
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  {{ both:'土・日 両日', sat:'土曜日のみ', sun:'日曜日のみ' }[exhibit.day]}
                  &nbsp;· 9:00〜16:00
                </span>
              </div>
            )}

            {/* 予定に追加 */}
            {exhibit && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                {(exhibit.day === 'sat' || exhibit.day === 'both') && (
                  <AddToScheduleButton
                    title={exhibit.name}
                    date="sat"
                    startTime="09:00"
                    endTime="16:00"
                    location={exhibit.room_display ?? undefined}
                    exhibitId={exhibit.id}
                    color="#FF6B00"
                    label={exhibit.day === 'both' ? '土曜に追加' : '予定に追加'}
                  />
                )}
                {(exhibit.day === 'sun' || exhibit.day === 'both') && (
                  <AddToScheduleButton
                    title={exhibit.name}
                    date="sun"
                    startTime="09:00"
                    endTime="16:00"
                    location={exhibit.room_display ?? undefined}
                    exhibitId={exhibit.id}
                    color="#FF6B00"
                    label={exhibit.day === 'both' ? '日曜に追加' : '予定に追加'}
                  />
                )}
              </div>
            )}

            {/* 展示へのいいね */}
            {feedback && <ExhibitLikeRow feedback={feedback} userId={userId} exhibitId={id} />}
          </div>

          {/* セパレーター */}
          <div style={{ height:8, background:'#f5f3ef', borderTop:'1px solid #f0f0f0', borderBottom:'1px solid #f0f0f0' }} />

          {/* タブコンテンツ */}
          {tab === 'page' && (
            exhibit
              ? <ClassPageContent exhibit={exhibit} />
              : <SkeletonList />
          )}

          {tab === 'notice' && (
            noticeLoading ? <SkeletonList /> : notices.length === 0 ? (
              <EmptyState icon="📭" msg="お知らせはまだありません" />
            ) : (
              <>
                {notices.map((n, i) => (
                  <NoticeCard
                    key={n.id}
                    notice={n}
                    index={i}
                    like={likes[n.id]}
                    onToggleLike={handleToggleLike}
                    onOpen={() => router.push(`/news/${n.id}`)}
                  />
                ))}
                {noticeHasMore  && <div ref={noticeSentinel}  style={{ height:1 }} />}
                {!noticeHasMore && <EndMarker />}
              </>
            )
          )}

          {tab === 'comment' && (
            commentLoading ? <SkeletonList /> : comments.length === 0 ? (
              <EmptyState icon="💬" msg="コメントはまだありません" />
            ) : (
              <>
                {comments.map((c, i) => (
                  <CommentCard key={c.id} comment={c} index={i} />
                ))}
                {commentHasMore  && <div ref={commentSentinel}  style={{ height:1 }} />}
                {!commentHasMore && <EndMarker />}
              </>
            )
          )}
        </div>
      </div>
      </div>
    </>
  )
}

// ─── 展示へのいいね（全タブ共通・プロフィール下） ─────────────

function ExhibitLikeRow({ feedback, userId, exhibitId }: { feedback: FeedbackData; userId: string; exhibitId: string }) {
  const [likeCount, setLikeCount] = useState(feedback.likeCount)
  const [liked,     setLiked]     = useState(feedback.userLiked)
  const [popping,   setPopping]   = useState(false)
  const [floatKey,  setFloatKey]  = useState(0)
  const userHasStamp = feedback.userHasStamp

  const handleLike = async () => {
    if (!userId || !userHasStamp) return
    const nowLiked = !liked
    if (nowLiked) { setPopping(true); setFloatKey(k => k + 1); setTimeout(() => setPopping(false), 700) }
    // 楽観的更新: 先にUIへ反映し、応答で補正・失敗時は巻き戻す
    setLiked(nowLiked)
    setLikeCount(c => c + (nowLiked ? 1 : -1))
    try {
      const res = await fetch('/api/exhibit-like', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exhibitId, userId }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json() as { liked: boolean; likeCount: number }
      setLiked(json.liked)
      setLikeCount(json.likeCount)
    } catch {
      setLiked(!nowLiked)
      setLikeCount(c => c + (nowLiked ? -1 : 1))
    }
  }

  return (
    <div style={{ paddingBottom:16 }}>
      <style>{`
        @keyframes heart-pop {
          0%   { transform: scale(1); }
          20%  { transform: scale(1.5); }
          40%  { transform: scale(0.88); }
          60%  { transform: scale(1.18); }
          80%  { transform: scale(0.96); }
          100% { transform: scale(1); }
        }
        @keyframes heart-float {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          60%  { opacity: 0.8; }
          100% { opacity: 0; transform: translateY(-28px) scale(0.7); }
        }
        @keyframes count-bump {
          0%   { transform: translateY(0); }
          35%  { transform: translateY(-5px); }
          65%  { transform: translateY(1px); }
          100% { transform: translateY(0); }
        }
      `}</style>

      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ position:'relative', display:'inline-flex', alignItems:'center' }}>
          <button
            type="button"
            onClick={userHasStamp ? handleLike : undefined}
            disabled={!userHasStamp}
            style={{
              background: liked ? '#fff0f3' : '#f8f9fa',
              border: `1.5px solid ${liked ? '#ff2d55' : '#e0e0e0'}`,
              borderRadius: 99,
              padding: '7px 16px 7px 10px',
              cursor: !userHasStamp ? 'default' : 'pointer',
              display:'flex', alignItems:'center', gap: 6,
              animation: popping ? 'heart-pop 0.65s cubic-bezier(.36,.07,.19,.97)' : undefined,
              opacity: !userHasStamp ? 0.4 : 1,
              transition: 'background 0.2s, border-color 0.2s',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24"
              fill={liked ? '#ff2d55' : 'none'}
              stroke={liked ? '#ff2d55' : '#aaa'}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              style={{ transition:'fill 0.15s, stroke 0.15s', flexShrink: 0 }}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span style={{
              fontSize: 12, fontWeight: 700, fontFamily: "'Kiwi Maru',serif",
              color: liked ? '#ff2d55' : '#aaa',
              transition: 'color 0.2s',
            }}>
              {liked ? 'いいねを取り消す' : 'いいねする'}
            </span>
          </button>

          {/* 浮き上がりハート */}
          {popping && (
            <div key={floatKey} style={{
              position:'absolute', top:0, left:'50%',
              transform:'translateX(-50%)',
              pointerEvents:'none',
              animation:'heart-float 0.65s ease-out forwards',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#ff2d55">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
          )}
        </div>

        {/* カウント（サイト設定の like_count_visible が true の場合のみ） */}
        {feedback.showLikeCount && (
          <span style={{
            fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700,
            color: liked ? '#ff2d55' : '#aaa',
            transition:'color 0.2s',
            animation: popping ? 'count-bump 0.5s ease' : undefined,
            minWidth:16,
          }}>
            {likeCount > 0 ? likeCount : ''}
          </span>
        )}
      </div>

      {!userHasStamp && (
        <div style={{ fontSize:11, color:'#bbb', fontFamily:"'Kiwi Maru',serif", lineHeight:1.65, marginTop:4 }}>
          この展示を訪れて QR を読み込むといいねができます
        </div>
      )}
    </div>
  )
}

// ─── お知らせカード ────────────────────────────────────────────

function NoticeCard({ notice, index, like, onToggleLike, onOpen }: {
  notice:       NoticeItem
  index:        number
  like?:        LikeState
  onToggleLike: (id: string) => void
  onOpen:       () => void
}) {
  const hasMedia = notice.media.length > 0
  const preview  = notice.body
    .filter(s => s.type === 'text')
    .map(s => (s as { type: 'text'; text: string }).text.replace(/\n/g, ' '))
    .join(' ')

  return (
    <div
      className="ef-row"
      style={{
        position:'relative', borderBottom:'1px solid #f5f5f5', background:'#fff',
        animation:`fadeUp ${Math.min(0.05 + index * 0.04, 0.6)}s ease both`,
      }}
    >
      {notice.is_urgent && (
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'linear-gradient(180deg,#FF6B00,#FFAA28)' }} />
      )}

      <button onClick={onOpen} style={{ width:'100%', background:'transparent', border:'none', cursor:'pointer', textAlign:'left', padding:0, display:'block' }}>
        <div style={{ display:'flex', gap:12, padding:'14px 16px 6px', alignItems:'flex-start' }}>
          <div style={{
            width:42, height:42, borderRadius:'50%', flexShrink:0, overflow:'hidden',
            background: notice.is_urgent ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : 'linear-gradient(135deg,#e2e8f0,#cbd5e1)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            {notice.sender_thumbnail
              ? <img src={notice.sender_thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <span style={{ fontSize:20 }}>📣</span>
            }
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:2 }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', fontFamily:"'Kiwi Maru',serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'45%' }}>
                {notice.sender}
              </span>
              {notice.is_urgent && (
                <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99, background:'#FF6B00', color:'#fff', fontFamily:"'Kiwi Maru',serif", flexShrink:0 }}>重要</span>
              )}
              <span style={{ fontSize:11, color:'#bbb', marginLeft:'auto', flexShrink:0, fontFamily:"'Kiwi Maru',serif" }}>
                {formatDate(notice.created_at)}
              </span>
            </div>
            <p style={{ margin:'0 0 3px', fontSize:14, fontWeight:700, color:'#1a1a1a', fontFamily:"'Kaisei Decol',serif", lineHeight:1.4 }}>
              {notice.title}
            </p>
            <p style={{
              margin:0, fontSize:12.5, color:'#999', lineHeight:1.5, fontFamily:"'Kiwi Maru',serif",
              display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
            }}>
              {preview.slice(0, 80)}{preview.length > 80 ? '…' : ''}
            </p>
          </div>
        </div>
        {hasMedia && (
          <div style={{ padding:'4px 16px 8px', marginLeft:54 }}>
            <MediaCluster media={notice.media} />
          </div>
        )}
      </button>

      <div style={{ padding:'2px 16px 10px', marginLeft:54 }}>
        <LikeButton noticeId={notice.id} like={like} onToggle={onToggleLike} />
      </div>
    </div>
  )
}

function LikeButton({ noticeId, like, onToggle }: {
  noticeId: string; like?: LikeState; onToggle: (id: string) => void
}) {
  const liked = like?.liked ?? false
  const count = like?.count ?? 0
  return (
    <button className="ef-like" onClick={() => onToggle(noticeId)} style={{
      display:'flex', alignItems:'center', gap:5, background:'transparent', border:'none',
      cursor:'pointer', padding:'3px 6px 3px 0',
      color: liked ? '#FF6B00' : '#bbb',
      fontFamily:"'Kiwi Maru',serif", fontSize:12, fontWeight:700,
    }}>
      <span style={{ fontSize:17, lineHeight:1 }}>{liked ? '♥' : '♡'}</span>
      <span>{count > 0 ? count : 'いいね'}</span>
    </button>
  )
}

function MediaCluster({ media }: { media: NoticeMedia[] }) {
  const valid = media.filter(m => m.url)
  if (!valid.length) return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#bbb', fontFamily:"'Kiwi Maru',serif", background:'#f8f8f8', padding:'4px 10px', borderRadius:99 }}>
      📎 添付 {media.length}件
    </span>
  )
  if (valid.length === 1) return (
    <div style={{ borderRadius:12, overflow:'hidden', aspectRatio:'16/9', background:'#f0f0f0' }}>
      <MediaThumb item={valid[0]} />
    </div>
  )
  const shown = valid.slice(0, 4)
  const extra = valid.length - 3
  return (
    <div style={{ display:'grid', gridTemplateColumns: valid.length <= 3 ? `repeat(${valid.length},1fr)` : 'repeat(2,1fr)', gap:3, borderRadius:12, overflow:'hidden' }}>
      {shown.map((m, i) => (
        <div key={m.id} style={{ position:'relative', aspectRatio:'1/1', background:'#f0f0f0', overflow:'hidden' }}>
          <MediaThumb item={m} />
          {i === 3 && extra > 0 && (
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:18, fontWeight:700 }}>
              +{extra}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function MediaThumb({ item }: { item: NoticeMedia }) {
  if (item.type === 'video') return (
    <div style={{ position:'relative', width:'100%', height:'100%' }}>
      <video src={item.url} muted style={{ width:'100%', height:'100%', objectFit:'cover' }} />
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.15)' }}>
        <span style={{ fontSize:26, color:'#fff' }}>▶</span>
      </div>
    </div>
  )
  return <img src={item.url} alt={item.caption ?? ''} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
}

// ─── コメントカード ───────────────────────────────────────────

function CommentCard({ comment, index }: { comment: RawComment; index: number }) {
  return (
    <div
      className="ef-comment"
      style={{
        display:'flex', gap:12, padding:'14px 16px',
        borderBottom:'1px solid #f5f5f5', background:'#fafbff',
        animation:`fadeUp ${Math.min(0.05 + index * 0.04, 0.6)}s ease both`,
      }}
    >
      <div style={{
        width:38, height:38, borderRadius:'50%', flexShrink:0,
        background:'linear-gradient(135deg,#dbeafe,#e0e7ff)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
      }}>
        💬
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
          <span style={{ fontSize:13, fontWeight:600, color:'#475569', fontFamily:"'Kiwi Maru',serif" }}>
            {comment.author_name?.trim() || 'ゲスト'}
          </span>
          <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:99, background:'#e0e7ff', color:'#6366f1', fontFamily:"'Kiwi Maru',serif" }}>
            みんなの声
          </span>
          <span style={{ fontSize:11, color:'#bbb', marginLeft:'auto', flexShrink:0, fontFamily:"'Kiwi Maru',serif" }}>
            {formatDate(comment.created_at)}
          </span>
        </div>
        <p style={{ margin:0, fontSize:13.5, lineHeight:1.6, color:'#334155', fontFamily:"'Kiwi Maru',serif" }}>
          {comment.body}
        </p>
      </div>
    </div>
  )
}

// ─── ユーティリティ ────────────────────────────────────────────

function SkeletonList() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:1, padding:'2px 0' }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ display:'flex', gap:12, padding:'14px 16px' }}>
          <div style={{ width:42, height:42, borderRadius:'50%', background:'#f0f0f0', flexShrink:0, animation:'pulse 1.5s ease infinite' }} />
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:7, paddingTop:4 }}>
            <div style={{ width:'35%', height:10, borderRadius:6, background:'#f0f0f0', animation:'pulse 1.5s ease infinite' }} />
            <div style={{ width:'70%', height:13, borderRadius:6, background:'#f0f0f0', animation:'pulse 1.5s ease infinite' }} />
            <div style={{ width:'90%', height:10, borderRadius:6, background:'#f0f0f0', animation:'pulse 1.5s ease infinite' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ icon, msg }: { icon: string; msg: string }) {
  return (
    <div style={{ padding:'64px 20px', textAlign:'center' }}>
      <div style={{ fontSize:36, marginBottom:10 }}>{icon}</div>
      <p style={{ fontSize:13, color:'#bbb', fontFamily:"'Kiwi Maru',serif" }}>{msg}</p>
    </div>
  )
}

function EndMarker() {
  return (
    <div style={{ padding:'28px 0', textAlign:'center', fontSize:11, color:'#ccc', fontFamily:"'Kiwi Maru',serif" }}>
      ── これ以上の投稿はありません ──
    </div>
  )
}
