'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  value: string
  onChange: (url: string) => void
  /** Storage パス（拡張子なし）例: "notices/abc-123/item-def-456" */
  storagePath: string
  /** 受け付けるファイル種別 */
  accept?: 'image' | 'video' | 'any'
  label?: string
}

function convertImageToWebP(file: File, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const maxW = 1280, maxH = 960
      const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.naturalWidth  * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas error')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url)
        blob ? resolve(blob) : reject(new Error('WebP変換失敗'))
      }, 'image/webp', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像読み込み失敗')) }
    img.src = url
  })
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|avi|mkv)(\?|$)/i.test(url)
}

export default function MediaUpload({
  value, onChange, storagePath, accept = 'any', label,
}: Props) {
  const inputRef              = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState(0)
  const [error, setError]         = useState('')

  const isVid = value ? isVideoUrl(value) : false

  const acceptAttr =
    accept === 'image' ? 'image/*' :
    accept === 'video' ? 'video/*' :
    'image/*,video/*'

  const handleFile = async (file: File) => {
    const isImg = file.type.startsWith('image/')
    const isVidFile = file.type.startsWith('video/')
    if (!isImg && !isVidFile) { setError('画像または動画ファイルを選択してください'); return }
    if (accept === 'image' && !isImg)    { setError('画像ファイルを選択してください'); return }
    if (accept === 'video' && !isVidFile){ setError('動画ファイルを選択してください'); return }

    setError('')
    setUploading(true)
    setProgress(10)

    try {
      const supabase = createClient()
      let uploadBlob: Blob
      let fullPath: string
      let contentType: string

      if (isImg) {
        uploadBlob  = await convertImageToWebP(file)
        fullPath    = `${storagePath}.webp`
        contentType = 'image/webp'
      } else {
        uploadBlob  = file
        const ext   = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
        fullPath    = `${storagePath}.${ext}`
        contentType = file.type
      }

      setProgress(40)

      const { error: uploadErr } = await supabase.storage
        .from('media')
        .upload(fullPath, uploadBlob, { contentType, upsert: true })
      if (uploadErr) throw uploadErr

      setProgress(90)

      const { data } = supabase.storage.from('media').getPublicUrl(fullPath)
      onChange(`${data.publicUrl}?t=${Date.now()}`)
      setProgress(100)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アップロード失敗')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const icon = accept === 'video' ? '🎬' : accept === 'image' ? '🖼' : '📎'
  const hint =
    accept === 'video' ? 'MP4 / WebM / MOV（最大50MB）' :
    accept === 'image' ? 'PNG / JPEG / WebP → WebP自動変換（最大1280px）' :
    '画像（→ WebP変換）または動画'

  return (
    <div>
      {label && (
        <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>
          {label}
        </div>
      )}

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          borderRadius:12,
          border:`2px dashed ${uploading ? '#FF8C00' : '#e2e8f0'}`,
          background: uploading ? '#fff8f4' : '#fafafa',
          cursor: uploading ? 'not-allowed' : 'pointer',
          overflow:'hidden',
        }}
      >
        {/* プレビュー */}
        {value ? (
          isVid ? (
            <video
              src={value}
              style={{ width:'100%', maxHeight:220, objectFit:'cover', display:'block' }}
              muted playsInline preload="metadata"
            />
          ) : (
            <img src={value} alt="" style={{ width:'100%', maxHeight:220, objectFit:'cover', display:'block' }} />
          )
        ) : (
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', padding:'28px 16px', gap:6,
          }}>
            <span style={{ fontSize:28, color:'#cbd5e1' }}>{icon}</span>
            <div style={{ fontSize:12, fontWeight:700, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>
              クリックまたはドロップ
            </div>
            <div style={{ fontSize:10, color:'#cbd5e1', fontFamily:"'Kiwi Maru',serif", textAlign:'center' }}>
              {hint}
            </div>
          </div>
        )}

        {/* プログレスバー */}
        {uploading && (
          <div style={{ padding:'8px 12px', background:'#fff8f4' }}>
            <div style={{ fontSize:11, color:'#FF8C00', marginBottom:4, fontFamily:"'Kiwi Maru',serif" }}>
              アップロード中… {progress}%
            </div>
            <div style={{ height:3, borderRadius:99, background:'#f1f5f9', overflow:'hidden' }}>
              <div style={{
                height:'100%', borderRadius:99,
                width:`${progress}%`,
                background:'linear-gradient(90deg,#FF6B00,#FFAA28)',
                transition:'width 0.3s ease',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* エラー・削除 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
        <div style={{ fontSize:11, color:'#ef4444', fontFamily:"'Kiwi Maru',serif" }}>{error}</div>
        {value && !uploading && (
          <button
            onClick={e => { e.stopPropagation(); onChange('') }}
            style={{
              fontSize:11, color:'#ef4444', background:'none', border:'none',
              cursor:'pointer', fontFamily:"'Kiwi Maru',serif", padding:'2px 4px',
            }}
          >
            ✕ 削除
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        style={{ display:'none' }}
        onChange={handleChange}
      />
    </div>
  )
}
