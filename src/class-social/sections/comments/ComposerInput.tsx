// Ô nhập bình luận DÙNG CHUNG cho cả hai hệ (bài Social: CommentComposer · thread/TeamLab: Composer) — Feed Composer Lát A.
//  • Giữ focus + bàn phím khi gửi: KHÔNG disabled/readOnly ô nhập (iOS đóng bàn phím khi ô mất focus). Trong lúc gửi, thay đổi chữ bị bỏ qua
//    (ô controlled tự hoàn nguyên) + aria-busy; nút gửi không cướp focus (mousedown không đổi focus) và ô được lấy lại focus ngay trong cử chỉ bấm.
//  • Chống gửi trùng: cờ inFlight (ref) chặn mọi lần bấm / ⌘↵ trong lúc đang gửi — kể cả bấm liên tục trước khi React kịp render lại.
//  • Đang gửi: nút gửi đổi thành biểu tượng xoay (không đổi kích thước → không nhảy bố cục) + vùng đọc cho trình đọc màn hình.
//  • Thất bại: GIỮ nguyên chữ, hiện lỗi + nút "Gửi lại". Thành công: xoá ô, thu gọn chiều cao, giữ focus.
//  • Enter = xuống dòng; ⌘/Ctrl+Enter = gửi (không đổi).
import { useRef, useState, type RefObject } from 'react'
import { Loader2, SendHorizontal } from 'lucide-react'

export type BodyCheck = (body: string) => { ok: true; body: string } | { ok: false; error: string }
export const SEND_FAILED_TEXT = 'Chưa gửi được. Thử lại sau — nội dung của bạn vẫn được giữ.'

export type ComposerState = {
  body: string
  setBody: (v: string) => void
  sending: boolean
  error: { text: string; retry: boolean } | null
  submit: () => Promise<void>
  taRef: RefObject<HTMLTextAreaElement | null>
}

/** `run(body)` trả null = thành công, chuỗi = thông báo lỗi (nội dung giữ nguyên để gửi lại). */
export function useCommentSubmit({ initial = '', check, run }: { initial?: string; check: BodyCheck; run: (body: string) => Promise<string | null> }): ComposerState {
  const [body, setBodyState] = useState(initial)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<ComposerState['error']>(null)
  const inFlight = useRef(false)
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  const setBody = (v: string) => {
    if (inFlight.current) return          // đang gửi: bỏ qua thay đổi (ô controlled hoàn nguyên, vẫn giữ focus)
    setBodyState(v)
    setError(e => (e ? null : e))
  }

  const submit = async () => {
    if (inFlight.current) return
    const chk = check(body)
    if (!chk.ok) { setError({ text: chk.error, retry: false }); return }
    inFlight.current = true; setSending(true); setError(null)
    taRef.current?.focus({ preventScroll: true })      // còn trong cử chỉ người dùng → giữ / mở lại bàn phím
    let err: string | null
    try { err = await run(chk.body) } catch { err = SEND_FAILED_TEXT }
    inFlight.current = false; setSending(false)
    if (err) { setError({ text: err, retry: true }); return }   // giữ nguyên nội dung
    setBodyState('')
    const ta = taRef.current
    if (ta) { ta.style.height = ''; ta.focus({ preventScroll: true }) }
  }

  return { body, setBody, sending, error, submit, taRef }
}

export function CommentInputBox({ id, label, placeholder, maxLength, state, autoFocus }: {
  id: string; label: string; placeholder: string; maxLength: number; state: ComposerState; autoFocus?: boolean
}) {
  const { body, setBody, sending, error, submit, taRef } = state
  const errId = `${id}-err`
  return (
    <>
      <div className="cs-cmt-inputwrap">
        <textarea ref={taRef} id={id} className="cs-cmt-input" rows={1} maxLength={maxLength} placeholder={placeholder}
          value={body} autoFocus={autoFocus} aria-busy={sending} aria-describedby={error ? errId : undefined}
          onChange={e => setBody(e.target.value)}
          onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 180) + 'px' }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit() } }} />
        <button type="submit" className={'cs-cmt-send' + (sending ? ' is-sending' : '')} disabled={!body.trim()} aria-busy={sending}
          aria-label={sending ? 'Đang gửi…' : label}
          onMouseDown={e => e.preventDefault()}>
          {sending ? <Loader2 size={18} className="cs-spin" aria-hidden="true" /> : <SendHorizontal size={18} />}
        </button>
      </div>
      <span className="cs-sr-only" role="status">{sending ? 'Đang gửi bình luận…' : ''}</span>
      {error && (
        <p className="cs-form-error" role="alert" id={errId}>
          {error.text}
          {error.retry && <>{' '}<button type="button" className="cs-link-btn cs-cmt-retry" onClick={() => void submit()}>Gửi lại</button></>}
        </p>
      )}
    </>
  )
}

/** Đưa bình luận vừa gửi vào vùng nhìn: chỉ cuộn khi nó đang ngoài màn hình (block 'nearest') → không nhảy trang khi đã thấy. */
export function revealComment(id: string, attempts = 8) {
  if (typeof document === 'undefined' || typeof requestAnimationFrame === 'undefined' || !/^[0-9a-f-]{8,64}$/i.test(id)) return
  const tryScroll = (left: number) => {
    const el = document.querySelector(`[data-comment-id="${id}"]`)
    if (el) {
      const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView?.({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
    } else if (left > 0) requestAnimationFrame(() => tryScroll(left - 1))
  }
  requestAnimationFrame(() => tryScroll(attempts))
}
