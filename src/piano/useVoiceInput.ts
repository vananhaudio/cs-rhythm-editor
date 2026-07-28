// ── Voice input 3 tầng — dùng cho Piano Journey (trẻ nói → text) ──────────────
//
// TẦNG 1 — Web Speech API: có sẵn, miễn phí, hiện chữ ngay khi trẻ đang nói.
//          Chỉ tồn tại trong Safari/Chrome mở bằng TRÌNH DUYỆT.
// TẦNG 2 — MediaRecorder + Whisper (edge function `piano-stt`): chạy trong MỌI
//          WebView, kể cả vỏ Capacitor iOS/Android (nơi Tầng 1 KHÔNG tồn tại).
//          Nhờ vậy giữ được `server.url` → deploy web là app tự cập nhật.
// TẦNG 3 — gõ text (do component lo, không nằm trong hook này).
//
// Tự động tụt tầng: không có Web Speech → Tầng 2. Có nhưng lỗi (iOS Safari hay
// trả 'not-allowed' cho riêng speech recognition, Chrome bản rút gọn trả
// 'service-not-allowed') → cũng tụt xuống Tầng 2 chứ không bỏ trẻ lại với ô gõ.

import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase'

export type VoiceState = 'idle' | 'listening' | 'transcribing'
export type VoiceTier  = 'speech' | 'record' | 'none'

// ── Ngưỡng thời gian — chỉnh cho trẻ 5–12 tuổi (nói chậm, hay ngập ngừng) ──
const WAIT_FIRST_MS = 7000   // chờ trẻ bắt đầu nói
const SILENCE_MS    = 1500   // nói xong, im bao lâu thì chốt
const MAX_MS        = 20000  // trần cứng, tránh thu vô tận
const MIN_BLOB      = 1200   // blob nhỏ hơn = chưa kịp thu gì
const MAX_RESTARTS  = 2      // số lần tự nghe lại khi 'no-speech'

// ── Kiểu tối thiểu cho Web Speech API (lib.dom chưa có sẵn) ──
interface SpeechAlt { transcript: string }
interface SpeechResult { 0: SpeechAlt; isFinal: boolean }
interface SpeechResultList { length: number; [i: number]: SpeechResult }
interface SpeechResultEvent { resultIndex: number; results: SpeechResultList }
interface SpeechErrorEvent { error?: string }

interface SpeechRecognizer {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: SpeechResultEvent) => void) | null
  onerror: ((e: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type SpeechCtor = new () => SpeechRecognizer

interface VoiceWindow {
  SpeechRecognition?: SpeechCtor
  webkitSpeechRecognition?: SpeechCtor
  webkitAudioContext?: typeof AudioContext
}
const vw = (): VoiceWindow => window as unknown as VoiceWindow

const speechCtor = (): SpeechCtor | undefined =>
  typeof window === 'undefined' ? undefined : (vw().SpeechRecognition || vw().webkitSpeechRecognition)

const audioCtor = (): typeof AudioContext | undefined =>
  typeof window === 'undefined' ? undefined : (window.AudioContext || vw().webkitAudioContext)

export const hasWebSpeech = () => !!speechCtor()

export const canRecord = () =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined'

// Safari/WKWebView chỉ có audio/mp4; Chrome có webm/opus. Whisper nhận cả hai.
const MIME_CANDIDATES: [string, string][] = [
  ['audio/webm;codecs=opus', 'webm'],
  ['audio/webm',             'webm'],
  ['audio/mp4',              'mp4'],
  ['audio/aac',              'aac'],
  ['audio/ogg;codecs=opus',  'ogg'],
]

function pickMime(): { mime: string; ext: string } {
  if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
    for (const [mime, ext] of MIME_CANDIDATES) {
      try { if (MediaRecorder.isTypeSupported(mime)) return { mime, ext } } catch { /* */ }
    }
  }
  return { mime: '', ext: 'webm' }   // để browser tự chọn
}

const initialTier = (): VoiceTier => hasWebSpeech() ? 'speech' : canRecord() ? 'record' : 'none'

interface Options {
  /** Gọi khi đã có câu nói hoàn chỉnh. */
  onFinal: (text: string) => void
  lang?: string
}

export function useVoiceInput({ onFinal, lang = 'vi-VN' }: Options) {
  const [state, setState]           = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError]           = useState('')
  const [level, setLevel]           = useState(0)             // 0..1 — cường độ mic thật
  const [tier, setTier]             = useState<VoiceTier>(initialTier)

  // ── Refs: nguồn sự thật ĐỒNG BỘ. Bug cũ là đọc state qua closure/effect nên
  //    câu nói bị mất trắng ở onend. Mọi handler dưới đây chỉ đọc ref. ──
  const stateRef      = useRef<VoiceState>('idle')
  const transcriptRef = useRef('')
  const onFinalRef    = useRef(onFinal)
  const forceRecord   = useRef(false)   // đã tụt xuống Tầng 2 thì ở luôn đó

  const recRef    = useRef<SpeechRecognizer | null>(null)
  const mrRef     = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef    = useRef<AudioContext | null>(null)
  const rafRef    = useRef(0)
  const timersRef = useRef<number[]>([])

  useEffect(() => { onFinalRef.current = onFinal }, [onFinal])

  const go = useCallback((s: VoiceState) => { stateRef.current = s; setState(s) }, [])

  // Đọc qua hàm để TS không "nhớ" giá trị cũ — go() đổi ref mà TS không thấy được
  const cur = useCallback((): VoiceState => stateRef.current, [])

  const setText = useCallback((t: string) => { transcriptRef.current = t; setTranscript(t) }, [])

  // ── Dọn dẹp audio graph + timer ──
  const cleanupAudio = useCallback(() => {
    timersRef.current.forEach(clearTimeout); timersRef.current = []
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null
    try { ctxRef.current?.close() } catch { /* */ }
    ctxRef.current = null
    setLevel(0)
  }, [])

  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms))
  }, [])

  // ── Gửi audio lên Whisper qua edge function ──
  const transcribe = useCallback(async (blob: Blob, ext: string): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || SUPABASE_ANON_KEY   // chưa đăng nhập vẫn dùng được

    const fd = new FormData()
    fd.append('audio', blob, `speech.${ext}`)

    const res = await fetch(`${SUPABASE_URL}/functions/v1/piano-stt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      body: fd,
    })
    if (!res.ok) throw new Error(`STT ${res.status}`)
    const data = await res.json()
    return (typeof data?.text === 'string' ? data.text : '').trim()
  }, [])

  // ── TẦNG 2: thu âm + tự chốt khi trẻ nói xong ──
  const startRecording = useCallback(async () => {
    forceRecord.current = true
    setTier('record')
    go('listening'); setText(''); setError('')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch {
      setError('Chưa được dùng micro — bấm cho phép, hoặc gõ yêu cầu bên dưới nhé ✍️')
      go('idle'); return
    }
    streamRef.current = stream

    const { mime, ext } = pickMime()
    let mr: MediaRecorder
    try {
      mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    } catch {
      cleanupAudio(); setError('Micro không dùng được — gõ bên dưới nhé ✍️'); go('idle'); return
    }
    mrRef.current = mr

    const chunks: Blob[] = []
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data) }

    mr.onstop = async () => {
      cleanupAudio()
      mrRef.current = null
      if (cur() !== 'listening') return                  // đã bị cancel

      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' })
      if (blob.size < MIN_BLOB) {
        setError('Chưa nghe rõ — thử lại hoặc gõ bên dưới nhé ✍️'); go('idle'); return
      }

      go('transcribing')
      try {
        const text = await transcribe(blob, ext)
        if (cur() !== 'transcribing') return             // đã bị cancel
        if (!text) { setError('Chưa nghe rõ — thử lại nhé 🎤'); go('idle'); return }
        setText(text); go('idle'); onFinalRef.current(text)
      } catch {
        setError('Không gửi được lời con đi — gõ bên dưới nhé ✍️'); go('idle')
      }
    }

    mr.start(250)

    const stopRec = () => { try { if (mr.state === 'recording') mr.stop() } catch { /* */ } }

    // ── Phát hiện im lặng: chốt 1.5s sau khi trẻ nói xong ──
    const Ctor = audioCtor()
    if (!Ctor) { later(stopRec, 6000); return }          // không đo được thì thu 6s rồi chốt
    const ctx = new Ctor()
    ctxRef.current = ctx
    if (ctx.state === 'suspended') { try { await ctx.resume() } catch { /* */ } }
    const an = ctx.createAnalyser()
    an.fftSize = 2048
    ctx.createMediaStreamSource(stream).connect(an)
    const buf = new Float32Array(new ArrayBuffer(an.fftSize * 4))

    let floor = 0.004, floorN = 0
    let spoke = false, quietSince = 0, lastPaint = 0
    const t0 = performance.now()

    const watch = () => {
      if (cur() !== 'listening') return
      an.getFloatTimeDomainData(buf as Float32Array<ArrayBuffer>)
      let sum = 0
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
      const rms = Math.sqrt(sum / buf.length)
      const now = performance.now()

      // 400ms đầu: đo nền phòng để ngưỡng tự thích ứng (phòng ồn vẫn chạy đúng)
      if (now - t0 < 400) { floor = (floor * floorN + rms) / (floorN + 1); floorN++ }
      const gate = Math.max(0.012, floor * 2.5)

      if (now - lastPaint > 100) { setLevel(Math.min(1, rms / 0.12)); lastPaint = now }

      if (rms > gate) { spoke = true; quietSince = 0 }
      else if (spoke) {
        if (!quietSince) quietSince = now
        else if (now - quietSince > SILENCE_MS) { stopRec(); return }
      }

      rafRef.current = requestAnimationFrame(watch)
    }
    rafRef.current = requestAnimationFrame(watch)

    later(() => { if (!spoke) stopRec() }, WAIT_FIRST_MS)   // trẻ không nói gì
    later(stopRec, MAX_MS)                                  // trần cứng
  }, [go, cur, setText, cleanupAudio, transcribe, later])

  // ── TẦNG 1: Web Speech API ──
  // BẮT BUỘC gọi rec.start() ĐỒNG BỘ trong user gesture. Commit 05adc37 await
  // getUserMedia trước start() → mất user-activation → iOS chặn. Đừng await ở đây.
  const startWebSpeech = useCallback((Ctor: SpeechCtor) => {
    const rec = new Ctor()
    rec.lang = lang
    rec.interimResults = true
    rec.continuous = false

    let wantRestart = false, restarts = 0, fatal = ''

    rec.onresult = e => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setText(t)                       // ← ghi vào ref, onend đọc lại được
    }

    rec.onerror = e => {
      const err = e?.error
      if (err === 'no-speech')  { wantRestart = restarts < MAX_RESTARTS; return }
      if (err === 'aborted')    return
      fatal = err || 'unknown'         // xử lý ở onend (onerror luôn chạy TRƯỚC onend)
    }

    // Toàn bộ quyết định nằm ở onend — không restart trong onerror như code cũ,
    // vì lúc đó recognition chưa end, start() sẽ throw InvalidStateError.
    rec.onend = () => {
      if (cur() !== 'listening') return                   // đã bị cancel

      if (wantRestart) {
        wantRestart = false; restarts++
        try { rec.start(); return } catch { /* rơi xuống dưới */ }
      }

      if (fatal) {
        const f = fatal; fatal = ''
        // Tụt xuống Tầng 2 — thu âm + Whisper. Bao cả 'not-allowed' vì iOS Safari
        // chặn riêng speech recognition trong khi micro vẫn cho dùng.
        if (canRecord()) { void startRecording(); return }
        setError(f === 'not-allowed'
          ? 'Chưa được dùng micro — bấm cho phép, hoặc gõ bên dưới nhé ✍️'
          : 'Micro không dùng được — gõ bên dưới nhé ✍️')
        go('idle'); return
      }

      const text = transcriptRef.current.trim()
      go('idle')
      if (text) onFinalRef.current(text)
      else setError('Chưa nghe rõ — thử lại hoặc gõ bên dưới nhé ✍️')
    }

    recRef.current = rec
    go('listening'); setText(''); setError('')
    try {
      rec.start()
    } catch {
      // start() throw ngay (thường do gọi 2 lần) → thử Tầng 2
      if (canRecord()) { void startRecording(); return }
      setError('Micro không dùng được — gõ bên dưới nhé ✍️'); go('idle')
    }
  }, [lang, go, cur, setText, startRecording])

  // ── API công khai — GỌI TRỰC TIẾP TRONG onClick, đừng bọc async ──
  const start = useCallback(() => {
    if (stateRef.current !== 'idle') return
    const Ctor = speechCtor()
    if (Ctor && !forceRecord.current) { startWebSpeech(Ctor); return }
    if (canRecord()) { void startRecording(); return }
    setError('Thiết bị không có micro — gõ yêu cầu bên dưới nhé ✍️')
  }, [startWebSpeech, startRecording])

  /** Trẻ bấm lần nữa để chốt sớm, không cần chờ hết im lặng. */
  const stop = useCallback(() => {
    if (stateRef.current !== 'listening') return
    try { recRef.current?.stop() } catch { /* */ }
    try { if (mrRef.current?.state === 'recording') mrRef.current.stop() } catch { /* */ }
  }, [])

  const cancel = useCallback(() => {
    go('idle')
    try { recRef.current?.abort() } catch { /* */ }
    try { if (mrRef.current?.state === 'recording') mrRef.current.stop() } catch { /* */ }
    mrRef.current = null
    cleanupAudio(); setText('')
  }, [go, cleanupAudio, setText])

  // Rời màn hình khi đang nghe → nhả micro, không để đèn mic sáng mãi
  useEffect(() => () => {
    try { recRef.current?.abort() } catch { /* */ }
    try { if (mrRef.current?.state === 'recording') mrRef.current.stop() } catch { /* */ }
    cleanupAudio()
  }, [cleanupAudio])

  return { state, transcript, error, level, tier, start, stop, cancel, setError }
}
