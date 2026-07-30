// ── Nhận giọng nói để kể chuyện ──
// Dùng Web Speech API sẵn có của trình duyệt: KHÔNG tốn API, không gửi
// audio lên server. Trình duyệt không hỗ trợ → supported=false (ẩn nút micro).
// Lời nói CHỈ đổ vào ô soạn thảo — người kể đọc lại và tự bấm gửi.
import { useCallback, useEffect, useRef, useState } from 'react'

// Web Speech API chưa có trong lib.dom mặc định → khai báo tối thiểu.
type SpeechResult = { isFinal: boolean; 0: { transcript: string } }
type SpeechEvent = { resultIndex: number; results: { length: number } & Record<number, SpeechResult> }
type SpeechErrEvent = { error: string }
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SpeechEvent) => void) | null
  onerror: ((e: SpeechErrEvent) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Đang chạy trong app TVA Guitar (vỏ Capacitor) hay trong trình duyệt? */
function inNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as { Capacitor?: unknown }).Capacitor
}

/** Nối lời vừa nói vào phần đã có, tự thêm khoảng trắng. */
export function appendSpoken(prev: string, spoken: string): string {
  const add = spoken.trim()
  if (!add) return prev
  if (!prev) return add
  return /[\s\n]$/.test(prev) ? prev + add : prev + ' ' + add
}

export function useVoiceInput(onFinal: (text: string) => void) {
  const [supported] = useState(() => getCtor() !== null)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')

  const recRef = useRef<Recognition | null>(null)
  const wantRef = useRef(false)          // người dùng CÒN muốn nghe không (để tự bật lại)
  const onFinalRef = useRef(onFinal)
  useEffect(() => { onFinalRef.current = onFinal }, [onFinal])

  const stop = useCallback(() => {
    wantRef.current = false
    setListening(false)
    setInterim('')
    try { recRef.current?.stop() } catch { /* đang dừng sẵn */ }
  }, [])

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor || wantRef.current) return
    setError('')
    const rec = new Ctor()
    rec.lang = 'vi-VN'
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (e) => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) onFinalRef.current(r[0].transcript)
        else live += r[0].transcript
      }
      setInterim(live)
    }

    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return   // im lặng một lúc — không phải lỗi
      wantRef.current = false
      setListening(false)
      setInterim('')
      const denied = e.error === 'not-allowed' || e.error === 'service-not-allowed'
      setError(
        !denied
          ? 'Micro đang trục trặc. Bạn thử lại, hoặc cứ gõ chữ cũng được.'
          : inNativeApp()
            // Trong app: nguyên nhân hay gặp nhất là app chưa cập nhật (bản cũ
            // chưa khai quyền nhận diện giọng nói nên iOS im lặng từ chối).
            ? 'Chưa dùng được micro. Bạn vào App Store cập nhật app TVA Guitar lên bản mới nhất rồi thử lại nhé — nếu đã cập nhật rồi thì bật "Micro" và "Nhận diện giọng nói" trong Cài đặt → TVA Guitar.'
            : 'Trình duyệt chưa cho phép dùng micro. Bạn bật quyền micro cho trang này rồi thử lại nhé.'
      )
    }

    // Trình duyệt tự ngắt sau một khoảng im lặng → bật lại nếu người kể vẫn đang nói dở
    rec.onend = () => {
      setInterim('')
      if (wantRef.current) {
        try { rec.start() } catch { wantRef.current = false; setListening(false) }
      } else setListening(false)
    }

    recRef.current = rec
    wantRef.current = true
    try {
      rec.start()
      setListening(true)
    } catch {
      wantRef.current = false
      setListening(false)
      setError('Không mở được micro. Bạn thử lại nhé.')
    }
  }, [])

  const toggle = useCallback(() => { if (wantRef.current) stop(); else start() }, [start, stop])

  // Rời trang → tắt micro
  useEffect(() => () => { wantRef.current = false; try { recRef.current?.abort() } catch { /* noop */ } }, [])

  return { supported, listening, interim, error, start, stop, toggle, clearError: () => setError('') }
}
