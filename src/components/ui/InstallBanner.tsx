'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'install_banner_dismissed_v1'
const INSTALLED_KEY = 'pwa_installed_v1'
const OPEN_DISMISSED_SESSION_KEY = 'open_banner_dismissed'

type Mode = 'install' | 'open'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    !!(navigator as { standalone?: boolean }).standalone
  )
}

function isMobile() {
  return /Android|iPad|iPhone|iPod/.test(navigator.userAgent)
}

async function detectPwaInstalled(): Promise<boolean> {
  if (localStorage.getItem(INSTALLED_KEY)) return true

  const nav = navigator as {
    getInstalledRelatedApps?: () => Promise<{ platform: string }[]>
  }
  if (typeof nav.getInstalledRelatedApps === 'function') {
    try {
      const apps = await nav.getInstalledRelatedApps()
      return apps.length > 0
    } catch {
      // API unsupported or permission denied
    }
  }

  return false
}

function detectInstallPlatform(): 'android' | 'ios' | null {
  if (localStorage.getItem(DISMISSED_KEY)) return null
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) {
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
    return isSafari ? 'ios' : null
  }
  if (/Android/.test(ua)) return 'android'
  return null
}

export default function InstallBanner() {
  const [mode,           setMode]           = useState<Mode | null>(null)
  const [platform,       setPlatform]       = useState<'android' | 'ios' | null>(null)
  const [visible,        setVisible]        = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showGuide,      setShowGuide]      = useState(false)

  useEffect(() => {
    if (!isMobile() || isStandalone()) return

    // インストール完了時にフラグを記録
    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, '1')
      // インストール直後はアプリが起動するので、ここではバナーは変更しない
    }
    window.addEventListener('appinstalled', onInstalled)

    // インストール済み確認 → "アプリで開こう" バナーを優先表示
    detectPwaInstalled().then(installed => {
      if (installed) {
        if (sessionStorage.getItem(OPEN_DISMISSED_SESSION_KEY)) return
        setMode('open')
        setVisible(true)
        return
      }

      // 未インストール → インストール促進バナー
      const p = detectInstallPlatform()
      setPlatform(p)
      if (p === 'ios') {
        setMode('install')
        setVisible(true)
      }
    })

    // Android: インストールプロンプトをキャプチャ
    const onPrompt = (e: Event) => {
      e.preventDefault()
      const prompt = e as BeforeInstallPromptEvent
      setDeferredPrompt(prompt)
      detectPwaInstalled().then(installed => {
        if (installed) return // 既にインストール済みならプロンプトは出さない
        setPlatform('android')
        setMode('install')
        setVisible(true)
      })
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismissInstall = () => {
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  const dismissOpen = () => {
    setVisible(false)
    sessionStorage.setItem(OPEN_DISMISSED_SESSION_KEY, '1')
  }

  const handleAdd = async () => {
    if (platform === 'android' && deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        localStorage.setItem(INSTALLED_KEY, '1')
      }
      dismissInstall()
    } else if (platform === 'ios') {
      setShowGuide(true)
    }
  }

  if (!visible) return null

  // ── アプリインストール済み → "アプリで開こう" バナー ──────────────
  if (mode === 'open') {
    return (
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
            アプリ版で開こう
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>
            ホーム画面のアイコンをタップ
          </div>
        </div>
        <button onClick={dismissOpen} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#cbd5e1', fontSize: 18, flexShrink: 0, padding: '0 2px', lineHeight: 1,
        }}>×</button>
      </div>
    )
  }

  // ── 未インストール → インストール促進バナー ────────────────────────
  return (
    <>
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
        <button onClick={dismissInstall} style={{
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
                { icon: '2', text: 'スクロールして「ホーム画面に追加」を選ぶ' },
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
              onClick={() => { setShowGuide(false); dismissInstall() }}
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
