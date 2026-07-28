// ── Shared pitch-detection hook — dùng chung cho các step ──
// Sử dụng engine detectPitch có sẵn từ elearn/pitch, không tạo engine mới.

import { useRef, useState, useEffect, useCallback } from 'react'
import { detectPitch, pitchClass } from '../elearn/pitch'

const NOTE_NAMES: Record<number, string> = {
  0: 'Đô', 1: 'Đô#', 2: 'Rê', 3: 'Rê#', 4: 'Mi', 5: 'Fa',
  6: 'Fa#', 7: 'Sol', 8: 'Sol#', 9: 'La', 10: 'La#', 11: 'Si',
}

export function usePitchDetector() {
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const bufRef = useRef<Float32Array | null>(null)

  const start = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      micStreamRef.current = stream
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioCtxRef.current = ctx
      if (ctx.state === 'suspended') { try { await ctx.resume() } catch { /* */ } }
      const src = ctx.createMediaStreamSource(stream)
      const an = ctx.createAnalyser()
      an.fftSize = 2048
      src.connect(an)
      analyserRef.current = an
      bufRef.current = new Float32Array(an.fftSize)
      setListening(true)
      return true
    } catch {
      setListening(false)
      return false
    }
  }, [])

  const stop = useCallback(() => {
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current = null
    try { audioCtxRef.current?.close() } catch { /* */ }
    audioCtxRef.current = null
    analyserRef.current = null
    bufRef.current = null
    setListening(false)
    setHeard(null)
  }, [])

  /** Get current pitch from mic. Returns null if no sound detected. */
  const detect = useCallback((): { freq: number; pc: number; name: string } | null => {
    const an = analyserRef.current
    const buf = bufRef.current
    const ctx = audioCtxRef.current
    if (!an || !buf || !ctx) return null
    an.getFloatTimeDomainData(buf)
    const { freq } = detectPitch(buf, ctx.sampleRate)
    if (freq <= 0) { setHeard(null); return null }
    const pc = pitchClass(freq)
    const name = NOTE_NAMES[pc] ?? '?'
    setHeard(name)
    return { freq, pc, name }
  }, [])

  useEffect(() => () => stop(), [stop])

  return { start, stop, detect, heard, listening }
}
