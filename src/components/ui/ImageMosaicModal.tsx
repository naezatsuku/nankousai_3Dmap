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

    // image load
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const maxW = 600, maxH = 460
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

    // helpers
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

    // mouse
    const onMouseDown = (e: MouseEvent) => {
      dragging.current = true
      startRef.current = getPos(e.clientX, e.clientY)
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const cur = getPos(e.clientX, e.clientY)
      drawRect(startRef.current.x, startRef.current.y, cur.x, cur.y)
    }
    const onMouseUp = (e: MouseEvent) => {
      if (!dragging.current) return
      dragging.current = false
      const cur = getPos(e.clientX, e.clientY)
      clearOverlay()
      applyMosaic(startRef.current.x, startRef.current.y, cur.x, cur.y)
    }
    const onMouseLeave = () => {
      if (!dragging.current) return
      dragging.current = false
      clearOverlay()
    }

    // touch — passive: false で preventDefault を有効にする
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const t = e.touches[0]
      dragging.current = true
      startRef.current = getPos(t.clientX, t.clientY)
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (!dragging.current) return
      const t = e.touches[0]
      const cur = getPos(t.clientX, t.clientY)
      drawRect(startRef.current.x, startRef.current.y, cur.x, cur.y)
    }
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      if (!dragging.current) return
      dragging.current = false
      const t = e.changedTouches[0]
      const cur = getPos(t.clientX, t.clientY)
      clearOverlay()
      applyMosaic(startRef.current.x, startRef.current.y, cur.x, cur.y)
    }

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

  const handleConfirm = () => {
    canvasRef.current!.toBlob(blob => { if (blob) onConfirm(blob) }, 'image/webp', 0.85)
  }

  const btn = (onClick: () => void, label: string, primary = false, disabled = false) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 18px', borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: "'Kiwi Maru',serif", fontSize: 13, fontWeight: primary ? 700 : 400,
        background: disabled ? '#334155' : primary ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : '#334155',
        color: disabled ? '#475569' : '#fff',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: '#1e293b', borderRadius: 16, padding: 20,
        display: 'flex', flexDirection: 'column', gap: 14,
        maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ color: '#f1f5f9', fontFamily: "'Kiwi Maru',serif", fontSize: 14, fontWeight: 700 }}>
          モザイクをかけたい範囲をドラッグで選択
        </div>

        <div style={{ position: 'relative', display: 'inline-block', cursor: 'crosshair', lineHeight: 0 }}>
          <canvas
            ref={canvasRef}
            style={{ display: 'block', borderRadius: 8, maxWidth: 'min(600px, 80vw)' }}
          />
          <canvas
            ref={overlayRef}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 8, touchAction: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {btn(handleUndo, '↩ 元に戻す', false, !canUndo)}
          {btn(onCancel, 'キャンセル')}
          {btn(handleConfirm, '確定してアップロード', true)}
        </div>
      </div>
    </div>
  )
}
