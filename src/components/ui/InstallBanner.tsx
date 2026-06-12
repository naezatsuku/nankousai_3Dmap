'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'install_banner_dismissed_v1'

function detectPlatform(): 'android' | 'ios' | null {
  if (typeof window === 'undefined') return null
  if (window.matchMedia('(display-mode: standalone)').matches) return null
  if ((navigator as { standalone?: boolean }).standalone) return null
  if (localStorage.getItem(STORAGE_KEY)) return null
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) {
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
    return isSafari ? 'ios' : null
  }
  if (/Android/.test(ua)) return 'android'
  return null
}

export default function InstallBanner() {
  const [platform]                         = useState(detectPlatform)
  const [visible,        setVisible]       = useState(platform === 'ios')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showGuide,      setShowGuide]     = useState(false)

  useEffect(() => {
    if (platform !== 'android') return
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [platform])

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  const handleAdd = async () => {
    if (platform === 'android' && deferredPrompt) {
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice
      dismiss()
    } else if (platform === 'ios') {
      setShowGuide(true)
    }
  }

  if (!visible) return null

  return (
    <>
      {/* バナー */}
      <div style={{
        margin: '10px 16px 2px',
        background: 'linear-gradient(135deg,#fff8f0,#fff3e0)',
        border: '1.5px solid rgba(255,140,0,0.35)',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 2px 8px rgba(255,107,0,0.08)',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/nanpen.png" alt="" style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 1 }}>
            ホーム画面に追加しよう
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>
            アプリとして使うとより快適に
          </div>
        </div>
        <button
          onClick={handleAdd}
          style={{
            padding: '6px 13px', borderRadius: 99, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#FF6B00,#FFAA28)',
            color: '#fff', fontSize: 11, fontWeight: 700,
            fontFamily: "'Kiwi Maru',serif", flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {platform === 'android' ? '追加する' : '方法を見る'}
        </button>
        <button onClick={dismiss} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#cbd5e1', fontSize: 18, flexShrink: 0, padding: '0 2px', lineHeight: 1,
        }}>×</button>
      </div>

      {/* iOS 手順モーダル */}
      {showGuide && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'flex-end',
          }}
          onClick={() => setShowGuide(false)}
        >
          <div
            style={{
              width: '100%', background: '#fff',
              borderRadius: '20px 20px 0 0',
              padding: '24px 20px max(32px, env(safe-area-inset-bottom))',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontFamily: "'Kaisei Decol',serif", fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
              ホーム画面に追加する方法
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif", marginBottom: 20 }}>
              Safari でこのページを開いている場合
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { icon: '1', text: '画面下部の 共有ボタン（□↑）をタップ' },
                { icon: '2', text:'スクロールして「ホーム画面に追加」を選ぶ' },
                { icon: '3', text: '右上の「追加」をタップして完了' },
              ].map(s => (
                <div key={s.icon} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg,#FF6B00,#FFAA28)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: "'Kaisei Decol',serif",
                  }}>{s.icon}</div>
                  <div style={{ fontSize: 13, color: '#374151', fontFamily: "'Kiwi Maru',serif", lineHeight: 1.65, paddingTop: 3 }}>
                    {s.text}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setShowGuide(false); dismiss() }}
              style={{
                marginTop: 24, width: '100%', padding: '13px',
                background: 'linear-gradient(135deg,#FF6B00,#FFAA28)',
                color: '#fff', border: 'none', borderRadius: 12,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Kaisei Decol',serif",
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  )
}
