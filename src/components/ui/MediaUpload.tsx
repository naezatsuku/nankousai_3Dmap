'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseUploadError } from '@/lib/uploadError'
import ImageMosaicModal from './ImageMosaicModal'

interface Props {
  value: string
  onChange: (url: string) => void
  /** Storage パス（拡張子なし）例: "notices/abc-123/item-def-456" */
  storagePath: string
  /** 受け付けるファイル種別 */
  accept?: 'image' | 'video' | 'any'
  label?: string
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
  const [pendingFile, setPendingFile] = useState<File | null>(null)

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

    const MAX_VIDEO_BYTES = 100 * 1024 * 1024
    if (isVidFile && file.size > MAX_VIDEO_BYTES) {
      setError(`動画は100MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      return
    }

    setError('')

    if (isImg) {
      // 画像はモザイクモーダルを経由してアップロード
      setPendingFile(file)
      return
    }

    // 動画は即アップロード
    setUploading(true)
    setProgress(10)
    try {
      const supabase  = createClient()
      const ext       = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
      const fullPath  = `${storagePath}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('media')
        .upload(fullPath, file, { contentType: file.type, upsert: true })
      if (uploadErr) throw uploadErr
      setProgress(90)
      const { data } = supabase.storage.from('media').getPublicUrl(fullPath)
      onChange(`${data.publicUrl}?t=${Date.now()}`)
      setProgress(100)
    } catch (e) {
      setError(parseUploadError(e))
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const handleMosaicConfirm = async (blob: Blob) => {
    setPendingFile(null)
    setError('')
    setUploading(true)
    setProgress(10)
    try {
      const supabase = createClient()
      const fullPath = `${storagePath}.webp`
      setProgress(40)
      const { error: uploadErr } = await supabase.storage
        .from('media')
        .upload(fullPath, blob, { contentType: 'image/webp', upsert: true })
      if (uploadErr) throw uploadErr
      setProgress(90)
      const { data } = supabase.storage.from('media').getPublicUrl(fullPath)
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

  const icon = accept === 'video' ? '🎬' : accept === 'image' ? '🖼' : '📎'
  const hint =
    accept === 'video' ? 'MP4 / WebM / MOV（最大50MB）' :
    accept === 'image' ? 'PNG / JPEG / WebP → WebP自動変換（最大1280px）' :
    '画像（→ WebP変換）または動画'

  return (
    <>
    {pendingFile && (
      <ImageMosaicModal
        file={pendingFile}
        onConfirm={handleMosaicConfirm}
        onCancel={() => setPendingFile(null)}
      />
    )}
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
    </>
  )
}
