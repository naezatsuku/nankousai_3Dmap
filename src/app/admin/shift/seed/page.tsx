'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageLoader from '@/components/ui/PageLoader'
import NotificationBanner from '@/components/ui/NotificationBanner'

interface Exhibit { id: string; name: string; class_label: string | null }

type ResultState = { type: 'success' | 'error'; msg: string; detail?: string[] }

export default function ShiftSeedPage() {
  const router = useRouter()
  const [exhibits,   setExhibits]   = useState<Exhibit[]>([])
  const [exhibitId,  setExhibitId]  = useState<string>('')
  const [loading,    setLoading]    = useState(true)
  const [running,    setRunning]    = useState(false)
  const [result,     setResult]     = useState<ResultState | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }

      const { data: p } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if ((p as { role: string } | null)?.role !== 'admin') {
        router.replace('/admin'); return
      }

      const { data: exs } = await supabase
        .from('exhibits').select('id, name, class_label')
        .order('class_label', { nullsFirst: false })
      const arr = (exs ?? []) as Exhibit[]
      setExhibits(arr)
      if (arr.length > 0) setExhibitId(arr[0].id)
      setLoading(false)
    }
    init()
  }, [router])

  const handleSeed = async () => {
    setRunning(true); setResult(null)
    try {
      const res  = await fetch('/api/shift/seed', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ exhibitId }),
      })
      const json = await res.json() as {
        ok?: boolean; error?: string
        studentCount?: number; slotCount?: number; prefCount?: number
      }
      if (!res.ok || !json.ok) {
        setResult({ type: 'error', msg: json.error ?? `エラー (HTTP ${res.status})` })
      } else {
        const ex = exhibits.find(e => e.id === exhibitId)
        setResult({
          type: 'success',
          msg:  '✓ テストデータを投入しました',
          detail: [
            `対象展示: ${ex?.class_label ?? ex?.name ?? exhibitId}`,
            `生徒アカウント: ${json.studentCount}人`,
            `シフトコマ: ${json.slotCount}コマ（土曜16・日曜16）`,
            `アンケート回答: ${json.prefCount}件`,
          ],
        })
      }
    } catch (e) {
      setResult({ type: 'error', msg: String(e) })
    }
    setRunning(false)
  }

  const handleCleanup = async () => {
    if (!confirm('モックデータ（mock-student-01〜40）とシフト設定を削除しますか？')) return
    setRunning(true); setResult(null)
    try {
      const res  = await fetch('/api/shift/seed', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ exhibitId }),
      })
      const json = await res.json() as { ok?: boolean; error?: string; deleted?: number }
      if (!res.ok || !json.ok) {
        setResult({ type: 'error', msg: json.error ?? `エラー (HTTP ${res.status})` })
      } else {
        setResult({
          type: 'success',
          msg:  `✓ ${json.deleted}件のモックユーザーを削除しました（シフト設定も削除）`,
        })
      }
    } catch (e) {
      setResult({ type: 'error', msg: String(e) })
    }
    setRunning(false)
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ maxWidth: 640 }}>
      <NotificationBanner />

      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: "'Kaisei Decol',serif", fontSize: 22,
          fontWeight: 700, color: '#1e293b', marginBottom: 4,
        }}>
          🧪 シフトテストデータ
        </h1>
        <p style={{ fontSize: 13, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>
          自動割当機能のテスト用に 40 人分の模擬データを投入・削除します。
        </p>
      </div>

      {/* 内容説明 */}
      <div style={{
        background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
        padding: '14px 18px', marginBottom: 20,
        fontFamily: "'Kiwi Maru',serif", fontSize: 12,
        color: '#92400e', lineHeight: 1.9,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>投入されるデータ</div>
        <div>• <strong>40人</strong>の模擬 student アカウント（mock-student-01〜40@shift-test.local）</div>
        <div>• 選択した展示へのメンバー登録</div>
        <div>• 土日 各 <strong>16コマ</strong>（09:00〜17:00、30分刻み、必要人数 3）</div>
        <div>• 5パターンのアンケート回答（朝型・午後型・昼回避・フレキシブル・終盤回避）</div>
        <div style={{ marginTop: 8, padding: '8px 12px', background: '#fef3c7', borderRadius: 8, color: '#78350f' }}>
          ⚠ 投入時に選択した展示の既存シフト設定は上書きされます
        </div>
      </div>

      {/* 展示選択 */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: 20,
        border: '1px solid #f1f5f9', marginBottom: 16,
      }}>
        <label style={{
          display: 'block', fontSize: 11, fontWeight: 700,
          color: '#64748b', marginBottom: 8, fontFamily: "'Kiwi Maru',serif",
        }}>
          対象の展示
        </label>
        {exhibits.length === 0 ? (
          <div style={{ fontSize: 13, color: '#dc2626', fontFamily: "'Kiwi Maru',serif" }}>
            展示が登録されていません。先に展示を作成してください。
          </div>
        ) : (
          <select
            value={exhibitId}
            onChange={e => setExhibitId(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              border: '1px solid #e2e8f0', background: '#fff',
              fontSize: 13, color: '#1e293b', fontFamily: "'Kiwi Maru',serif",
            }}
          >
            {exhibits.map(ex => (
              <option key={ex.id} value={ex.id}>
                {ex.class_label ?? ex.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 操作ボタン */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          onClick={handleSeed}
          disabled={running || !exhibitId}
          style={{
            flex: 1, padding: '13px 0', borderRadius: 12, border: 'none',
            cursor: (running || !exhibitId) ? 'not-allowed' : 'pointer',
            background: 'linear-gradient(135deg,#6366f1,#818cf8)',
            color: '#fff', fontSize: 14, fontWeight: 700,
            fontFamily: "'Kaisei Decol',serif",
            opacity: (running || !exhibitId) ? 0.6 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {running ? '処理中…（30秒ほどかかります）' : '🚀 テストデータを投入'}
        </button>

        <button
          onClick={handleCleanup}
          disabled={running}
          style={{
            padding: '13px 18px', borderRadius: 12,
            border: '1px solid #fca5a5', cursor: running ? 'not-allowed' : 'pointer',
            background: '#fff', color: '#dc2626', fontSize: 13, fontWeight: 700,
            fontFamily: "'Kiwi Maru',serif",
            opacity: running ? 0.6 : 1, transition: 'opacity 0.2s',
          }}
        >
          🗑 クリーンアップ
        </button>
      </div>

      {/* 結果 */}
      {result && (
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: result.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${result.type === 'success' ? '#86efac' : '#fca5a5'}`,
          fontFamily: "'Kiwi Maru',serif",
          marginBottom: 20,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: result.type === 'success' ? '#166534' : '#991b1b',
            marginBottom: result.detail ? 8 : 0,
          }}>
            {result.msg}
          </div>
          {result.detail && (
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
              {result.detail.map((d, i) => <div key={i}>• {d}</div>)}
            </div>
          )}
        </div>
      )}

      {/* 次のステップ（成功後のみ表示） */}
      {result?.type === 'success' && result.detail && (
        <div style={{
          background: '#f0f9ff', borderRadius: 12, padding: '16px 18px',
          border: '1px solid #bae6fd',
          fontFamily: "'Kiwi Maru',serif", fontSize: 12,
          color: '#0c4a6e', lineHeight: 2,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>次のステップ</div>
          <div>
            1.{' '}
            <a href="/admin/shift/edit" style={{ color: '#0284c7', fontWeight: 700 }}>
              シフト編集ページ
            </a>
            {' '}を開く
          </div>
          <div>2. 上で選んだ展示を選択する</div>
          <div>3. タブ② <strong>アンケート確認</strong> でアンケート結果を確認（40人×16コマ）</div>
          <div>4. タブ③ <strong>シフト割当</strong> → 「🤖 自動割当」ボタンをクリック</div>
          <div>5. 割当結果・警告・過負荷メンバーを確認</div>
        </div>
      )}

      {/* アカウント仕様メモ */}
      <div style={{
        marginTop: 24, padding: '12px 16px', borderRadius: 10,
        background: '#f8fafc', border: '1px solid #e2e8f0',
        fontFamily: "'Kiwi Maru',serif", fontSize: 11, color: '#94a3b8',
        lineHeight: 1.8,
      }}>
        <div style={{ fontWeight: 700, color: '#64748b', marginBottom: 4 }}>モックアカウント仕様</div>
        <div>メール: mock-student-01〜40@shift-test.local</div>
        <div>パスワード: MockPass1234!</div>
        <div>ロール: student / 高1-1 / 出席番号1〜40</div>
        <div>パターン: 朝型8人・午後型8人・昼回避8人・フレキシブル8人・終盤回避8人</div>
      </div>
    </div>
  )
}
