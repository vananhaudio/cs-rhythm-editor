// Ô soạn tin: textarea tự giãn (tối đa ~5 dòng), Gửi cố định. Chỉ text — không ảnh/file/sticker/mic.
// Desktop: Enter gửi, Shift+Enter xuống dòng. Cảm ứng: Enter xuống dòng, bấm Gửi. Đang gõ IME (Telex) thì Enter KHÔNG gửi.
import { useEffect, useRef, useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import { MAX_BODY, canSendBody, normalizeBody } from './chatModel'

const isCoarse = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches

export default function Composer({ onSend, placeholder = 'Nhập tin nhắn…', autoFocus = false, label = 'Tin nhắn' }: {
  /** true = đã nhận (xoá ô); false = giữ nguyên chữ để thử lại */
  onSend: (text: string) => Promise<boolean> | boolean
  placeholder?: string
  autoFocus?: boolean
  label?: string
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  const len = [...text].length
  const ok = canSendBody(text)

  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 132) + 'px'
  }, [text])
  useEffect(() => { if (autoFocus && !isCoarse()) ta.current?.focus() }, [autoFocus])

  const submit = async () => {
    if (!ok || busy) return
    setBusy(true)
    const sent = await onSend(normalizeBody(text))
    setBusy(false)
    if (sent) { setText(''); ta.current?.focus() }
  }

  return (
    <form className="cs-chat-composer" onSubmit={e => { e.preventDefault(); void submit() }}>
      <textarea ref={ta} className="cs-chat-input" rows={1} value={text} placeholder={placeholder} aria-label={label}
        maxLength={MAX_BODY * 2} enterKeyHint="send" autoComplete="off"
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isCoarse()) { e.preventDefault(); void submit() }
        }} />
      {len > MAX_BODY - 200 && (
        <span className={'cs-chat-count' + (len > MAX_BODY ? ' is-over' : '')} aria-live="polite">{len}/{MAX_BODY}</span>
      )}
      <button type="submit" className="cs-chat-send" disabled={!ok || busy} aria-label="Gửi"
        onPointerDown={e => e.preventDefault()}>
        <SendHorizontal size={20} aria-hidden="true" />
      </button>
    </form>
  )
}
