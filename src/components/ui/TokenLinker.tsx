'use client'

import { useEffect } from 'react'

// ログイン済みユーザーの FCM トークンに user_id を紐付ける。
// localStorage に fcm_token が保存済みの場合、起動時にサーバー API 経由で更新する。
// サーバー側で auth を確認するため RLS の影響を受けない。
export default function TokenLinker() {
  useEffect(() => {
    const token = localStorage.getItem('fcm_token')
    if (!token) return

    fetch('/api/link-fcm-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fcm_token: token }),
    }).catch(() => {/* ネットワークエラーは無視 */})
  }, [])

  return null
}
