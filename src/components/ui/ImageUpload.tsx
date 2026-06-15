'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseUploadError } from '@/lib/uploadError'

interface Props {
  value:    string
  onChange: (url: string) => void
  /** Storage パス（拡張子なし）例: "exhibits/abc-123/thumbnail" */
  storagePath: string
  /** square=1:1サムネイル用(400px), wide=カバー用(1200px) */
  aspect?: 'square' | 'wide'
  label?: string
}

/** Canvas で WebP に変換し、指定最大幅にリサイズ */
function convertToWebP(file: File, maxW: number, maxH: number, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale  = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight)
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

export default function ImageUpload({ value, onChange, storagePath, aspect = 'square', label }: Props) {
  const inputRef            = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [progress, setProgress]   = useState(0)

  const isWide   = aspect === 'wide'
  const maxW     = isWide ? 1200 : 400
  const maxH     = isWide ? 675  : 400
  const previewH = isWide ? 120  : 100
  const previewW = isWide ? 'auto' : 100

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください')
      return
    }
    setError('')
    setUploading(true)
    setProgress(10)

    try {
      const blob = await convertToWebP(file, maxW, maxH)
      setProgress(50)

      const supabase  = createClient()
      const fullPath  = `${storagePath}.webp`

      const { error: uploadErr } = await supabase.storage
        .from('images')
        .upload(fullPath, blob, {
          contentType: 'image/webp',
          upsert: true,
        })

      if (uploadErr) throw uploadErr
      setProgress(90)

      const { data } = supabase.storage.from('images').getPublicUrl(fullPath)
      // キャッシュバスト用にタイムスタンプを付与
      onChange(`${data.publicUrl}?t=${Date.now()}`)
      setProgress(100)
    } catch (e) {
      setError(parseUploadError(e))
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

  return (
    <div>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, fontFamily: "'Kiwi Maru',serif" }}>
          {label}
        </div>
      )}

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: 12,
          borderRadius: 12,
          border: `2px dashed ${uploading ? '#FF8C00' : '#e2e8f0'}`,
          background: uploading ? '#fff8f4' : '#fafafa',
          cursor: uploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {/* プレビュー */}
        <div style={{
          width:        previewW,
          height:       previewH,
          borderRadius: isWide ? 10 : '50%',
          flexShrink:   0,
          background:   value ? 'transparent' : 'linear-gradient(135deg,#f1f5f9,#e2e8f0)',
          overflow:     'hidden',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontSize: 28,
        }}>
          {value
            ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: '#cbd5e1' }}>{isWide ? '🖼' : '📷'}</span>
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {uploading ? (
            <>
              <div style={{ fontSize: 12, color: '#FF8C00', fontFamily: "'Kiwi Maru',serif", marginBottom: 8 }}>
                WebP変換・アップロード中… {progress}%
              </div>
              <div style={{ height: 4, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg,#FF6B00,#FFAA28)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', fontFamily: "'Kiwi Maru',serif", marginBottom: 3 }}>
                {value ? '変更する' : 'クリックまたはドロップ'}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Kiwi Maru',serif" }}>
                PNG / JPEG / WebP → WebPに自動変換（最大{isWide ? '1200×675' : '400×400'}px）
              </div>
              {value && (
                <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {value}
                </div>
              )}
            </>
          )}
          {error && (
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontFamily: "'Kiwi Maru',serif" }}>{error}</div>
          )}
        </div>

        {/* 削除ボタン */}
        {value && !uploading && (
          <button
            onClick={e => { e.stopPropagation(); onChange('') }}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: '1px solid #fee2e2',
              background: '#fff', color: '#ef4444', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </div>
  )
}
