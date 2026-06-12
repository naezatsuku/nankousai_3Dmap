'use client'

import { useState } from 'react'

function detectPlatform(): 'ios' | 'android' | 'other' {
  if (typeof window === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  )
}

export default function NotificationHelp() {
  const [open,         setOpen]      = useState(false)
  const [platform]                   = useState(detectPlatform)
  const [isStandalone]               = useState(detectStandalone)

  // iOS でスタンドアロンでない場合は「まずインストールを」という案内を追加表示
  const needsInstall = platform === 'ios' && !isStandalone

  return (
    <div style={{ margin: '0 0 20px' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0',
          background: open ? '#fffbeb' : '#f8fafc',
          cursor: 'pointer', transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📖</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', fontFamily: "'Kiwi Maru',serif" }}>
            通知をオンにするには
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#94a3b8', transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {open && (
        <div style={{
          border: '1px solid #e2e8f0', borderTop: 'none',
          borderRadius: '0 0 12px 12px',
          background: '#fff', padding: '16px',
        }}>
          {platform === 'ios' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {needsInstall && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: '#fff8f0', border: '1px solid rgba(255,140,0,0.3)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#FF6B00', fontFamily: "'Kiwi Maru',serif", marginBottom: 4 }}>
                    ⚠ まずホーム画面への追加が必要です
                  </div>
                  <div style={{ fontSize: 11, color: '#92400e', fontFamily: "'Kiwi Maru',serif", lineHeight: 1.65 }}>
                    iPhoneでプッシュ通知を受け取るには、このサイトをホーム画面に追加してからアプリとして起動する必要があります。
                  </div>
                </div>
              )}
              <Step n={1} text={needsInstall ? 'Safari で画面下の共有ボタン（□↑）をタップ → 「ホーム画面に追加」' : 'ホーム画面のアイコンからアプリを起動'} />
              <Step n={2} text="「通知設定」ページで「許可する」をタップ" />
              <Step n={3} text="ポップアップが出たら「許可」を選択" />
              {needsInstall && (
                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", lineHeight: 1.6 }}>
                  ※ Safari のブラウザ上では通知を受け取れません。ホーム画面から起動した場合のみ有効です。
                </div>
              )}
            </div>
          )}

          {platform === 'android' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Step n={1} text="Chrome でこのページを開く" />
              <Step n={2} text="上部の「通知設定」で「許可する」をタップ" />
              <Step n={3} text='ポップアップ「〇〇からの通知を許可しますか？」→「許可」' />
              <Step n={4} text="ホーム画面に追加するとアプリとして使えて便利です" />
            </div>
          )}

          {platform === 'other' && (
            <div style={{ fontSize: 12, color: '#64748b', fontFamily: "'Kiwi Maru',serif", lineHeight: 1.7 }}>
              スマートフォン（iPhone / Android）からアクセスし、ブラウザの通知許可ダイアログで「許可」を選択してください。
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg,#FF6B00,#FFAA28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: "'Kaisei Decol',serif",
      }}>{n}</div>
      <div style={{ fontSize: 12, color: '#374151', fontFamily: "'Kiwi Maru',serif", lineHeight: 1.65, paddingTop: 3 }}>
        {text}
      </div>
    </div>
  )
}
