'use client'

import { useEffect } from 'react'

export default function ErudaLoader() {
  useEffect(() => {
    import('eruda').then(m => m.default.init())
  }, [])
  return null
}
