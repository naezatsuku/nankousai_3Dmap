'use client'

import { useEffect, useRef } from 'react'

/**
 * アプリがバックグラウンドから戻ったとき、
 * idleMs 以上経過していれば callback を呼ぶ
 */
export function useRefreshOnFocus(callback: () => void, idleMs = 3 * 60 * 1000) {
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now()
      } else {
        if (hiddenAt.current !== null && Date.now() - hiddenAt.current >= idleMs) {
          callback()
        }
        hiddenAt.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [callback, idleMs])
}
