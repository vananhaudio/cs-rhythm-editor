import { useEffect } from 'react'
import type { RefObject } from 'react'

export function useAudioContextResume(ref: RefObject<AudioContext | null>) {
  useEffect(() => {
    const resume = () => {
      const ctx = ref.current
      if (!ctx || ctx.state !== 'suspended') return
      ctx.resume().catch(err => console.error('Resume AudioContext lỗi:', err?.message ?? err))
    }

    const onVisibility = () => {
      if (!document.hidden) resume()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', resume)
    window.addEventListener('focus', resume)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', resume)
      window.removeEventListener('focus', resume)
    }
  }, [ref])
}
