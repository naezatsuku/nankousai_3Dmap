'use client'

import { useRouter } from 'next/navigation'

interface BackButtonProps {
  /** 指定するとそのパスに遷移、未指定は history.back() */
  fallbackHref?: string
  className?: string
}

export default function BackButton({ fallbackHref, className }: BackButtonProps) {
  const router = useRouter()

  const handleBack = () => {
    if (fallbackHref) {
      router.push(fallbackHref)
    } else {
      router.back()
    }
  }

  return (
    <button
      onClick={handleBack}
      aria-label="前のページに戻る"
      className={className}
      style={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: 'rgba(0,0,0,0.06)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background 0.15s',
      }}
    >
      <svg
        width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="#555" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
    </button>
  )
}
