'use client'

import { useEffect, useRef, useId } from 'react'

interface Props {
  onResult: (text: string) => void
  onCancel: () => void
}

export default function QrScanner({ onResult, onCancel }: Props) {
  const divId  = useId()
  const stopFn = useRef<() => void>(() => {})

  useEffect(() => {
    let done = false

    async function start() {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode(divId)
      stopFn.current = () => scanner.stop().catch(() => {})

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            if (done) return
            done = true
            scanner.stop().catch(() => {})
            onResult(text)
          },
          () => {}, // per-frame error は無視
        )
      } catch {
        if (!done) onCancel()
      }
    }

    start()
    return () => { done = true; stopFn.current() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position:        'fixed',
      inset:           0,
      background:      'rgba(0,0,0,0.93)',
      zIndex:          200,
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         24,
    }}>
      <p style={{
        color:       '#fff',
        fontSize:    15,
        fontWeight:  700,
        marginBottom: 20,
        fontFamily:  "'Kiwi Maru',serif",
        textAlign:   'center',
      }}>
        展示の QR コードに<br />カメラを向けてください
      </p>

      {/* html5-qrcode はこの div を乗っ取ってカメラ映像を描画する */}
      <div
        id={divId}
        style={{
          width:        '100%',
          maxWidth:     340,
          borderRadius: 16,
          overflow:     'hidden',
          background:   '#111',
        }}
      />

      <button
        onClick={() => { stopFn.current(); onCancel() }}
        style={{
          marginTop:    28,
          padding:      '12px 36px',
          borderRadius: 99,
          border:       'none',
          background:   'rgba(255,255,255,0.13)',
          color:        '#fff',
          fontSize:     14,
          fontFamily:   "'Kiwi Maru',serif",
          cursor:       'pointer',
        }}
      >
        キャンセル
      </button>
    </div>
  )
}
