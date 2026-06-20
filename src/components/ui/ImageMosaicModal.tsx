'use client'

import { useRef, useState, useEffect } from 'react'

interface Props {
  file: File
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

const BLOCK = 18

export default function ImageMosaicModal({ file, onConfirm, onCancel }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const historyRef = useRef<ImageData[]>([])
  const dragging   = useRef(false)
  const startRef   = useRef({ x: 0, y: 0 })
  const [canUndo, setCanUndo] = useState(false)

  useEffect(() => {
    const canvas  = canvasRef.current
    const overlay = overlayRef.current
    if (!canvas || !overlay) return

    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      // フルスクリーン用に大きめのサイズを許容し、CSS側で収める
      const maxW = 1600, maxH = 1600
      const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight)
      const W = Math.round(img.naturalWidth  * scale)
      const H = Math.round(img.naturalHeight * scale)
      canvas.width = overlay.width = W
      canvas.height = overlay.height = H
      canvas.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0, W, H)
      URL.revokeObjectURL(url)
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url

    const getPos = (clientX: number, clientY: number) => {
      const rect = overlay.getBoundingClientRect()
      return {
        x: (clientX - rect.left) * (overlay.width  / rect.width),
        y: (clientY - rect.top)  * (overlay.height / rect.height),
      }
    }

    const drawRect = (x1: number, y1: number, x2: number, y2: number) => {
      const ctx = overlay.getContext('2d')!
      ctx.clearRect(0, 0, overlay.width, overlay.height)
      const x = Math.min(x1, x2), y = Math.min(y1, y2)
      const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1)
      ctx.fillStyle = 'rgba(255,255,255,0.10)'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 3])
      ctx.strokeRect(x + 0.5, y + 0.5, w, h)
    }

    const applyMosaic = (x1: number, y1: number, x2: number, y2: number) => {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      const x = Math.round(Math.min(x1, x2)), y = Math.round(Math.min(y1, y2))
      const w = Math.round(Math.abs(x2 - x1)), h = Math.round(Math.abs(y2 - y1))
      if (w < 4 || h < 4) return
      historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
      setCanUndo(true)
      for (let bx = x; bx < x + w; bx += BLOCK) {
        for (let by = y; by < y + h; by += BLOCK) {
          const bw = Math.min(BLOCK, x + w - bx)
          const bh = Math.min(BLOCK, y + h - by)
          const data = ctx.getImageData(bx, by, bw, bh).data
          let r = 0, g = 0, b = 0
          const n = bw * bh
          for (let i = 0; i < data.length; i += 4) {
            r += data[i]; g += data[i + 1]; b += data[i + 2]
          }
          ctx.fillStyle = `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`
          ctx.fillRect(bx, by, bw, bh)
        }
      }
    }

    const clearOverlay = () => overlay.getContext('2d')!.clearRect(0, 0, overlay.width, overlay.height)

    const onMouseDown  = (e: MouseEvent) => { dragging.current = true; startRef.current = getPos(e.clientX, e.clientY) }
    const onMouseMove  = (e: MouseEvent) => { if (!dragging.current) return; const c = getPos(e.clientX, e.clientY); drawRect(startRef.current.x, startRef.current.y, c.x, c.y) }
    const onMouseUp    = (e: MouseEvent) => { if (!dragging.current) return; dragging.current = false; const c = getPos(e.clientX, e.clientY); clearOverlay(); applyMosaic(startRef.current.x, startRef.current.y, c.x, c.y) }
    const onMouseLeave = () => { if (!dragging.current) return; dragging.current = false; clearOverlay() }

    const onTouchStart = (e: TouchEvent) => { e.preventDefault(); const t = e.touches[0]; dragging.current = true; startRef.current = getPos(t.clientX, t.clientY) }
    const onTouchMove  = (e: TouchEvent) => { e.preventDefault(); if (!dragging.current) return; const t = e.touches[0]; const c = getPos(t.clientX, t.clientY); drawRect(startRef.current.x, startRef.current.y, c.x, c.y) }
    const onTouchEnd   = (e: TouchEvent) => { e.preventDefault(); if (!dragging.current) return; dragging.current = false; const t = e.changedTouches[0]; const c = getPos(t.clientX, t.clientY); clearOverlay(); applyMosaic(startRef.current.x, startRef.current.y, c.x, c.y) }

    overlay.addEventListener('mousedown',  onMouseDown)
    overlay.addEventListener('mousemove',  onMouseMove)
    overlay.addEventListener('mouseup',    onMouseUp)
    overlay.addEventListener('mouseleave', onMouseLeave)
    overlay.addEventListener('touchstart', onTouchStart, { passive: false })
    overlay.addEventListener('touchmove',  onTouchMove,  { passive: false })
    overlay.addEventListener('touchend',   onTouchEnd,   { passive: false })

    return () => {
      overlay.removeEventListener('mousedown',  onMouseDown)
      overlay.removeEventListener('mousemove',  onMouseMove)
      overlay.removeEventListener('mouseup',    onMouseUp)
      overlay.removeEventListener('mouseleave', onMouseLeave)
      overlay.removeEventListener('touchstart', onTouchStart)
      overlay.removeEventListener('touchmove',  onTouchMove)
      overlay.removeEventListener('touchend',   onTouchEnd)
    }
  }, [file])

  const handleUndo = () => {
    const prev = historyRef.current.pop()
    if (prev) canvasRef.current!.getContext('2d', { willReadFrequently: true })!.putImageData(prev, 0, 0)
    setCanUndo(historyRef.current.length > 0)
  }

  const handleRotate = () => {
    const canvas  = canvasRef.current!
    const overlay = overlayRef.current!
    const W = canvas.width, H = canvas.height

    const temp = document.createElement('canvas')
    temp.width = H
    temp.height = W
    const tctx = temp.getContext('2d')!
    tctx.translate(H, 0)
    tctx.rotate(Math.PI / 2)
    tctx.drawImage(canvas, 0, 0)

    canvas.width = H
    canvas.height = W
    canvas.getContext('2d', { willReadFrequently: true })!.drawImage(temp, 0, 0)

    overlay.width = H
    overlay.height = W
    overlay.getContext('2d')!.clearRect(0, 0, overlay.width, overlay.height)

    historyRef.current = []
    setCanUndo(false)
  }

  const handleConfirm = () => {
    canvasRef.current!.toBlob(blob => { if (blob) onConfirm(blob) }, 'image/webp', 0.85)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', zIndex: 9999 }}>

      {/* ── ヘッダーバー ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', flexShrink: 0,
        background: '#111827',
        borderBottom: '1px solid #1f2937',
      }}>
        {/* 左: キャンセル */}
        <button
          onClick={onCancel}
          style={{
            background: 'none', border: 'none', color: '#9ca3af',
            fontSize: 14, cursor: 'pointer', padding: '4px 0',
            fontFamily: "'Kiwi Maru',serif",
          }}
        >
          キャンセル
        </button>

        {/* 中央: タイトル */}
        <span style={{ color: '#f9fafb', fontSize: 15, fontWeight: 700, fontFamily: "'Kiwi Maru',serif" }}>
          モザイク
        </span>

        {/* 右: 回転 + 元に戻す + 完了 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleRotate}
            title="90度回転"
            style={{
              background: '#1f2937',
              border: 'none',
              borderRadius: 8,
              color: '#f9fafb',
              fontSize: 18, cursor: 'pointer',
              padding: '4px 8px', lineHeight: 1,
            }}
          >
            ↻
          </button>
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            title="元に戻す"
            style={{
              background: canUndo ? '#1f2937' : 'none',
              border: 'none',
              borderRadius: 8,
              color: canUndo ? '#f9fafb' : '#374151',
              fontSize: 18, cursor: canUndo ? 'pointer' : 'not-allowed',
              padding: '4px 8px', lineHeight: 1,
            }}
          >
            ↩
          </button>
          <button
            onClick={handleConfirm}
            style={{
              background: 'linear-gradient(135deg,#FF6B00,#FFAA28)',
              border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', padding: '6px 16px',
              fontFamily: "'Kiwi Maru',serif",
            }}
          >
            完了
          </button>
        </div>
      </div>

      {/* ── キャンバスエリア（残り全高） ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0a', overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0, cursor: 'crosshair' }}>
          <canvas
            ref={canvasRef}
            style={{ display: 'block', maxWidth: '100vw', maxHeight: 'calc(100dvh - 108px)' }}
          />
          <canvas
            ref={overlayRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
          />
        </div>
      </div>

      {/* ── フッターヒント ── */}
      <div style={{
        textAlign: 'center', padding: '10px 16px', flexShrink: 0,
        background: '#111827', borderTop: '1px solid #1f2937',
        color: '#6b7280', fontSize: 11, fontFamily: "'Kiwi Maru',serif",
      }}>
        ドラッグして範囲を選択 → モザイクをかけます
      </div>

    </div>
  )
}
