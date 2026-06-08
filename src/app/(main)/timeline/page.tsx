'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  getReadIds, markAllAsRead, formatDate,
  type NoticeItem, type NoticeMedia,
} from '@/lib/notices'
import { fetchFeedPage, type FeedItem } from '@/lib/feed'
import MarqueeText   from '@/components/ui/MarqueeText'
import PullToRefresh from '@/components/ui/PullToRefresh'

const PAGE_SIZE = 20

type FilterType = 'all' | 'notice' | 'comment'
type NoticeFeedItem  = Extract<FeedItem, { kind: 'notice' }>
type CommentFeedItem = Extract<FeedItem, { kind: 'comment' }>

interface LikeState { count: number; liked: boolean }

const TABS: { key: FilterType; label: string }[] = [
  { key: 'all',     label: 'すべて' },
  { key: 'notice',  label: 'お知らせ' },
  { key: 'comment', label: 'みんなの声' },
]

export default function TimelinePage() {
  const router = useRouter()

  const [userId] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    let uid = localStorage.getItem('stamp_user_id')
    if (!uid) {
      uid = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
      localStorage.setItem('stamp_user_id', uid)
    }
    return uid
  })

  const [items, setItems]             = useState<FeedItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore]         = useState(true)

  const [readIds, setReadIds]       = useState<Set<string>>(() => getReadIds())
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [likes, setLikes]           = useState<Record<string, LikeState>>({})

  const itemsRef    = useRef<FeedItem[]>([])
  const seenIds     = useRef<Set<string>>(new Set())
  const cursorRef   = useRef<string | null>(null)
  const hasMoreRef  = useRef(true)
  const loadingRef  = useRef(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // ── いいね状態のバッチ取得 ──────────────────────────────────
  const fetchLikesFor = useCallback((noticeIds: string[]) => {
    if (!noticeIds.length) return
    const qs = new URLSearchParams({ ids: noticeIds.join(',') })
    if (userId) qs.set('userId', userId)
    fetch(`/api/notice-like?${qs.toString()}`)
      .then(res => (res.ok ? res.json() : null))
      .then((json: { counts: Record<string, number>; liked: string[] } | null) => {
        if (!json) return
        setLikes(prev => {
          const next = { ...prev }
          for (const id of noticeIds) {
            next[id] = { count: json.counts[id] ?? 0, liked: json.liked.includes(id) }
          }
          return next
        })
      })
      .catch(() => {})
  }, [userId])

  // ── フィードページ読み込み ──────────────────────────────────
  const loadPage = useCallback(async (cursor: string | null, isInitial: boolean) => {
    if (loadingRef.current) return
    loadingRef.current = true
    if (isInitial) setLoading(true)
    else setLoadingMore(true)

    try {
      const page = await fetchFeedPage(cursor, PAGE_SIZE, seenIds.current)
      page.items.forEach(it => seenIds.current.add(it.id))

      const merged = isInitial ? page.items : [...itemsRef.current, ...page.items]
      itemsRef.current = merged
      setItems(merged)

      // 既読管理は notices のみ・読み込み済み分が対象
      const noticeIds = merged.filter((i): i is NoticeFeedItem => i.kind === 'notice').map(i => i.notice.id)
      if (noticeIds.length) {
        markAllAsRead(noticeIds)
        setReadIds(new Set(noticeIds))
      }

      // 新たに読み込んだお知らせ分のいいね状態を取得
      const newNoticeIds = page.items.filter((i): i is NoticeFeedItem => i.kind === 'notice').map(i => i.notice.id)
      fetchLikesFor(newNoticeIds)

      cursorRef.current  = page.nextCursor
      hasMoreRef.current = page.hasMore
      setHasMore(page.hasMore)
    } finally {
      loadingRef.current = false
      if (isInitial) setLoading(false)
      else setLoadingMore(false)
    }
  }, [fetchLikesFor])

  // 初回ロード
  useEffect(() => { loadPage(null, true) }, [loadPage])

  // 引っ張って更新（カードエリアの PullToRefresh から発火する 'app-refresh' を受けて先頭から取り直す）
  const refreshFeed = useCallback(() => {
    seenIds.current     = new Set()
    cursorRef.current   = null
    hasMoreRef.current  = true
    loadPage(null, true)
  }, [loadPage])

  useEffect(() => {
    window.addEventListener('app-refresh', refreshFeed)
    return () => window.removeEventListener('app-refresh', refreshFeed)
  }, [refreshFeed])

  // 無限スクロール（番兵が画面内に入ったら次ページを取得）
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    if (!node) return
    observerRef.current = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && hasMoreRef.current && !loadingRef.current) {
        loadPage(cursorRef.current, false)
      }
    }, { rootMargin: '200px' })
    observerRef.current.observe(node)
  }, [loadPage])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  // ── ハンドラ ───────────────────────────────────────────────
  const handleMarkAll = useCallback(() => {
    const noticeIds = itemsRef.current.filter((i): i is NoticeFeedItem => i.kind === 'notice').map(i => i.notice.id)
    markAllAsRead(noticeIds)
    setReadIds(new Set(noticeIds))
  }, [])

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
      .then(res => (res.ok ? res.json() : Promise.reject(res)))
      .then((json: { liked: boolean; likeCount: number }) => {
        setLikes(prev => ({ ...prev, [noticeId]: { count: json.likeCount, liked: json.liked } }))
      })
      .catch(() => {
        // 失敗時はロールバック
        setLikes(prev => ({ ...prev, [noticeId]: flip(prev[noticeId]) }))
      })
  }, [userId])

  // ── 表示用データ ───────────────────────────────────────────
  const noticeItems  = items.filter((i): i is NoticeFeedItem  => i.kind === 'notice')
  const commentItems = items.filter((i): i is CommentFeedItem => i.kind === 'comment')
  const unreadCount  = noticeItems.filter(i => !readIds.has(i.id)).length

  const filtered =
    filterType === 'notice'  ? noticeItems :
    filterType === 'comment' ? commentItems :
    items

  return (
    <>
      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        .feed-row  { transition: background 0.15s; }
        .feed-row:active { background: #fff8f4 !important; }
        .comment-row:active { background: #f2f5ff !important; }
        .like-btn  { transition: transform 0.12s; }
        .like-btn:active { transform: scale(0.82); }
        .tab-btn:active { background: rgba(0,0,0,0.035) !important; }
      `}</style>

      <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#f5f3ef' }}>
      <div style={{ width:'100%', maxWidth:640, margin:'0 auto', display:'flex', flexDirection:'column', height:'100%', background:'#fff', boxShadow:'0 0 24px rgba(0,0,0,0.04)' }}>

        {/* ── ヘッダー＋タブバー（引っ張って更新の影響を受けない固定エリア） ── */}
        <div style={{
          flexShrink: 0,
          background:'rgba(255,255,255,0.95)',
          backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
          borderBottom:'1px solid #eee',
          zIndex: 40,
        }}>
          {unreadCount > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px 5px' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#FF6B00', fontFamily:"'Kiwi Maru',serif" }}>
                未読 {unreadCount} 件
              </span>
              <button onClick={handleMarkAll} style={{
                marginLeft:'auto', fontSize:10.5, padding:'4px 10px', borderRadius:20,
                background:'#f3f3f3', color:'#999', border:'none', cursor:'pointer',
                fontFamily:"'Kiwi Maru',serif", fontWeight:700,
              }}>
                すべて既読
              </button>
            </div>
          )}

          {/* タブバー（X風・均等幅＋アンダーラインインジケーター） */}
          <div style={{ display:'flex' }}>
            {TABS.map(tab => {
              const isActive = filterType === tab.key
              return (
                <button
                  key={tab.key}
                  className="tab-btn"
                  onClick={() => setFilterType(tab.key)}
                  style={{
                    flex:1, position:'relative',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:4,
                    padding:'11px 0', border:'none', background:'transparent', cursor:'pointer',
                    fontFamily:"'Kiwi Maru',serif",
                  }}
                >
                  <span style={{ position:'relative', fontSize:13, fontWeight: isActive ? 700 : 600, color: isActive ? '#1a1a1a' : '#999', transition:'color 0.15s' }}>
                    {tab.label}
                    {tab.key === 'notice' && unreadCount > 0 && (
                      <span style={{
                        position:'absolute', top:-1, right:-8,
                        width:7, height:7, borderRadius:'50%',
                        background:'#FF6B00', border:'1.5px solid #fff',
                      }} />
                    )}
                  </span>
                  <span style={{
                    position:'absolute', bottom:0, left:'50%',
                    width:36, height:3, borderRadius:99,
                    background:'linear-gradient(90deg,#FF6B00,#FFAA28)',
                    transform: isActive ? 'translateX(-50%) scaleX(1)' : 'translateX(-50%) scaleX(0)',
                    transition:'transform 0.2s ease',
                  }} />
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 一覧（このエリアだけ引っ張って更新できる） ── */}
        <PullToRefresh disabled={false}>
        <div>
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:1, padding:'2px 0' }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ display:'flex', gap:12, padding:'14px 16px' }}>
                  <div style={{ width:42, height:42, borderRadius:'50%', background:'#f0f0f0', flexShrink:0, animation:'pulse 1.5s ease infinite' }} />
                  <div style={{ flex:1, display:'flex', flexDirection:'column', gap:7, paddingTop:4 }}>
                    <div style={{ width:'40%', height:11, borderRadius:6, background:'#f0f0f0', animation:'pulse 1.5s ease infinite' }} />
                    <div style={{ width:'75%', height:13, borderRadius:6, background:'#f0f0f0', animation:'pulse 1.5s ease infinite' }} />
                    <div style={{ width:'90%', height:11, borderRadius:6, background:'#f0f0f0', animation:'pulse 1.5s ease infinite' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {filtered.map((item, i) =>
                item.kind === 'notice' ? (
                  <NoticeCard
                    key={item.id}
                    item={item}
                    index={i}
                    isRead={readIds.has(item.id)}
                    like={likes[item.notice.id]}
                    onToggleLike={handleToggleLike}
                    onOpen={() => router.push(`/news/${item.notice.id}`)}
                  />
                ) : (
                  <CommentCard
                    key={item.id}
                    item={item}
                    index={i}
                    onOpen={() => router.push(`/exhibit/${item.comment.exhibit_id}`)}
                  />
                )
              )}

              {filtered.length === 0 && (
                hasMore
                  ? <LoadingMoreHint filterType={filterType} />
                  : <EmptyState filterType={filterType} />
              )}

              {hasMore && <div ref={sentinelRef} style={{ height:1 }} />}

              {loadingMore && (
                <div style={{ display:'flex', justifyContent:'center', padding:'20px 0' }}>
                  <div style={{
                    width:22, height:22, borderRadius:'50%',
                    border:'3px solid #f0f0f0', borderTopColor:'#FF8C00',
                    animation:'spin 0.7s linear infinite',
                  }} />
                </div>
              )}

              {!hasMore && filtered.length > 0 && (
                <div style={{ padding:'24px 0', textAlign:'center', fontSize:11, color:'#ccc', fontFamily:"'Kiwi Maru',serif" }}>
                  ── これ以上の投稿はありません ──
                </div>
              )}
            </>
          )}
        </div>
        </PullToRefresh>
      </div>
      </div>
    </>
  )
}

// ─── お知らせカード ────────────────────────────────────────────

function NoticeCard({ item, index, isRead, like, onToggleLike, onOpen }: {
  item:         NoticeFeedItem
  index:        number
  isRead:       boolean
  like?:        LikeState
  onToggleLike: (noticeId: string) => void
  onOpen:       () => void
}) {
  const notice   = item.notice
  const hasMedia = notice.media.length > 0

  return (
    <div
      className="feed-row"
      style={{
        position:'relative',
        background: isRead ? '#fff' : '#fffbf7',
        borderBottom:'1px solid #f5f5f5',
        animation: `fadeUp ${Math.min(0.05 + index * 0.04, 0.6)}s ease both`,
      }}
    >
      {notice.is_urgent && (
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'linear-gradient(180deg,#FF6B00,#FFAA28)' }} />
      )}

      <button onClick={onOpen} style={{ width:'100%', background:'transparent', border:'none', cursor:'pointer', textAlign:'left', padding:0, display:'block' }}>
        <div style={{ display:'flex', gap:12, padding:'14px 16px 8px', alignItems:'flex-start' }}>
          {/* アバター */}
          <div style={{ position:'relative', flexShrink:0 }}>
            <div style={{
              width:42, height:42, borderRadius:'50%',
              background: notice.is_urgent
                ? 'linear-gradient(135deg,#FF6B00,#FFAA28)'
                : 'linear-gradient(135deg,#e2e8f0,#cbd5e1)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:18, overflow:'hidden',
            }}>
              {notice.sender_thumbnail
                ? <img src={notice.sender_thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <SenderIcon sender={notice.sender} />
              }
            </div>
            {!isRead && (
              <div style={{ position:'absolute', bottom:1, right:1, width:10, height:10, borderRadius:'50%', background:'#FF6B00', border:'2px solid #fff' }} />
            )}
          </div>

          {/* 本文 */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
              <span style={{
                fontSize:13, fontWeight: isRead ? 500 : 700,
                color: isRead ? '#555' : '#1a1a1a',
                fontFamily:"'Kiwi Maru',serif",
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                maxWidth:'42%',
              }}>
                {notice.sender}
              </span>
              <span style={{
                fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:99,
                background:'linear-gradient(135deg,#FF6B00,#FFAA28)', color:'#fff',
                flexShrink:0, fontFamily:"'Kiwi Maru',serif", letterSpacing:'0.05em',
              }}>
                公式
              </span>
              <span style={{ fontSize:11, color:'#bbb', flexShrink:0, fontFamily:"'Kiwi Maru',serif", marginLeft:'auto' }}>
                {formatDate(notice.created_at)}
              </span>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
              {notice.is_urgent && (
                <span style={{
                  fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99,
                  background:'#FF6B00', color:'#fff', flexShrink:0,
                  fontFamily:"'Kiwi Maru',serif",
                }}>重要</span>
              )}
              <MarqueeText style={{
                fontSize:14, fontWeight: isRead ? 500 : 700,
                color: isRead ? '#555' : '#1a1a1a',
                fontFamily:"'Kaisei Decol',serif",
              }}>
                {notice.title}
              </MarqueeText>
            </div>

            <p style={{
              fontSize:12.5, lineHeight:1.5, color:'#999', margin:'0 0 8px',
              fontFamily:"'Kiwi Maru',serif",
              display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
            }}>
              {extractPreview(notice)}
            </p>
          </div>
        </div>

        {hasMedia && (
          <div style={{ padding:'0 16px 12px', marginLeft:54 }}>
            <MediaCluster media={notice.media} />
          </div>
        )}
      </button>

      {/* いいねアクション */}
      <div style={{ display:'flex', alignItems:'center', padding:'0 16px 12px', marginLeft:54 }}>
        <LikeButton noticeId={notice.id} like={like} onToggle={onToggleLike} />
      </div>
    </div>
  )
}

function LikeButton({ noticeId, like, onToggle }: {
  noticeId: string
  like?:    LikeState
  onToggle: (noticeId: string) => void
}) {
  const liked = like?.liked ?? false
  const count = like?.count ?? 0
  return (
    <button
      className="like-btn"
      onClick={() => onToggle(noticeId)}
      style={{
        display:'flex', alignItems:'center', gap:5,
        background:'transparent', border:'none', cursor:'pointer', padding:'4px 8px 4px 0',
        color: liked ? '#FF6B00' : '#bbb',
        fontFamily:"'Kiwi Maru',serif", fontSize:12, fontWeight:700,
      }}
    >
      <span style={{ fontSize:17, lineHeight:1 }}>{liked ? '♥' : '♡'}</span>
      <span>{count > 0 ? count : 'いいね'}</span>
    </button>
  )
}

// ─── Instagram風メディアクラスタ ───────────────────────────────

function MediaCluster({ media }: { media: NoticeMedia[] }) {
  const valid = media.filter(m => m.url)

  if (!valid.length) {
    return (
      <div style={{
        display:'inline-flex', alignItems:'center', gap:4,
        fontSize:11, color:'#bbb', fontFamily:"'Kiwi Maru',serif",
        background:'#f8f8f8', padding:'4px 10px', borderRadius:99,
      }}>
        📎 添付 {media.length}件
      </div>
    )
  }

  if (valid.length === 1) {
    return (
      <div style={{ borderRadius:14, overflow:'hidden', aspectRatio:'16/9', background:'#f0f0f0' }}>
        <MediaThumb item={valid[0]} />
      </div>
    )
  }

  if (valid.length <= 3) {
    return (
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${valid.length},1fr)`, gap:4, borderRadius:14, overflow:'hidden' }}>
        {valid.map(m => (
          <div key={m.id} style={{ aspectRatio:'1/1', background:'#f0f0f0', overflow:'hidden' }}>
            <MediaThumb item={m} />
          </div>
        ))}
      </div>
    )
  }

  const shown = valid.slice(0, 4)
  const extra = valid.length - 3
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:4, borderRadius:14, overflow:'hidden' }}>
      {shown.map((m, i) => (
        <div key={m.id} style={{ position:'relative', aspectRatio:'1/1', background:'#f0f0f0', overflow:'hidden' }}>
          <MediaThumb item={m} />
          {i === 3 && extra > 0 && (
            <div style={{
              position:'absolute', inset:0, background:'rgba(0,0,0,0.45)',
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'#fff', fontSize:18, fontWeight:700, fontFamily:"'Kiwi Maru',serif",
            }}>
              +{extra}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function MediaThumb({ item }: { item: NoticeMedia }) {
  if (item.type === 'video') {
    return (
      <div style={{ position:'relative', width:'100%', height:'100%' }}>
        <video src={item.url} muted style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.15)' }}>
          <span style={{ fontSize:26, color:'#fff' }}>▶</span>
        </div>
      </div>
    )
  }
  return <img src={item.url} alt={item.caption ?? ''} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
}

// ─── コメントカード（みんなの声） ───────────────────────────────

function CommentCard({ item, index, onOpen }: {
  item:   CommentFeedItem
  index:  number
  onOpen: () => void
}) {
  const c = item.comment
  return (
    <button
      onClick={onOpen}
      className="feed-row comment-row"
      style={{
        width:'100%', background:'#fafbff', border:'none', cursor:'pointer', textAlign:'left',
        padding:0, display:'block',
        borderBottom:'1px solid #f5f5f5',
        animation: `fadeUp ${Math.min(0.05 + index * 0.04, 0.6)}s ease both`,
      }}
    >
      <div style={{ display:'flex', gap:12, padding:'14px 16px', alignItems:'flex-start' }}>
        <div style={{
          width:38, height:38, borderRadius:'50%', flexShrink:0, overflow:'hidden',
          background:'linear-gradient(135deg,#dbeafe,#e0e7ff)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
        }}>
          {c.exhibit_thumbnail
            ? <img src={c.exhibit_thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <span>💬</span>
          }
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#475569', fontFamily:"'Kiwi Maru',serif" }}>
              {c.author_name?.trim() || 'ゲスト'}
            </span>
            <span style={{
              fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:99,
              background:'#e0e7ff', color:'#6366f1', flexShrink:0,
              fontFamily:"'Kiwi Maru',serif", letterSpacing:'0.05em',
            }}>
              みんなの声
            </span>
            <span style={{ fontSize:11, color:'#bbb', flexShrink:0, fontFamily:"'Kiwi Maru',serif", marginLeft:'auto' }}>
              {formatDate(c.created_at)}
            </span>
          </div>

          <div style={{
            fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif", marginBottom:5,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          }}>
            💭 {c.exhibit_name} への声
          </div>

          <p style={{
            fontSize:13, lineHeight:1.55, color:'#475569', margin:0,
            fontFamily:"'Kiwi Maru',serif",
            display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden',
          }}>
            {c.body}
          </p>
        </div>
      </div>
    </button>
  )
}

// ─── 空状態・読み込みヒント ────────────────────────────────────

function EmptyState({ filterType }: { filterType: FilterType }) {
  const msg =
    filterType === 'notice'  ? 'お知らせはまだありません' :
    filterType === 'comment' ? 'コメントはまだ投稿されていません' :
    'まだ投稿がありません'
  return (
    <div style={{ padding:'64px 20px', textAlign:'center' }}>
      <div style={{ fontSize:36, marginBottom:10 }}>🌤️</div>
      <p style={{ fontSize:13, color:'#bbb', fontFamily:"'Kiwi Maru',serif" }}>{msg}</p>
    </div>
  )
}

function LoadingMoreHint({ filterType }: { filterType: FilterType }) {
  const msg = filterType === 'all' ? '読み込み中…' : '該当する投稿を探しています…'
  return (
    <div style={{ padding:'48px 20px', textAlign:'center' }}>
      <div style={{
        width:22, height:22, margin:'0 auto 12px', borderRadius:'50%',
        border:'3px solid #f0f0f0', borderTopColor:'#FF8C00',
        animation:'spin 0.7s linear infinite',
      }} />
      <p style={{ fontSize:12, color:'#ccc', fontFamily:"'Kiwi Maru',serif" }}>{msg}</p>
    </div>
  )
}

// ─── ヘルパー ──────────────────────────────────────────────────

/** 本文からテキストプレビューを抽出 */
function extractPreview(notice: NoticeItem): string {
  const parts = notice.body
    .filter((s) => s.type === 'text')
    .map((s) => (s as { type:'text'; text:string }).text.replace(/\n/g, ' '))
    .join(' ')
  return parts.slice(0, 60) + (parts.length > 60 ? '…' : '')
}

/** 送信者名から絵文字アイコンを生成 */
function SenderIcon({ sender }: { sender: string }) {
  const emoji =
    sender.includes('軽音') ? '🎸' :
    sender.includes('ダンス') ? '💃' :
    sender.includes('演劇') ? '🎭' :
    sender.includes('食堂') ? '🍜' :
    sender.includes('高3') ? '🍳' :
    sender.includes('高2') ? '🎨' :
    sender.includes('高1') ? '📚' : '📣'
  return <span style={{ fontSize:20 }}>{emoji}</span>
}
