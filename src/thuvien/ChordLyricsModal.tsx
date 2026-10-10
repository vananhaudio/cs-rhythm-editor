import { useEffect, useRef, useState } from 'react'
import { canonicalChordText, chordTextIssues } from './chordText.ts'

// Cửa sổ "Nạp lời & hợp âm": soạn / dán cả bài trong một bản nháp RIÊNG của cửa sổ.
// Chỉ "Áp dụng" mới đưa chữ vào bản nhạc (chưa ghi DB — Lưu mới ghi). Hủy / Esc / bấm nền / ✕ không đổi bản nhạc;
// nếu đang có chữ chưa áp dụng thì hỏi lại trước khi bỏ.

type Props = {
  /** Lời + hợp âm hiện có trong trình sửa lúc mở cửa sổ. */
  initial: string
  onApply: (text: string) => void
  onClose: () => void
  /** Bước đầu của "Nạp hợp âm mới": cùng ô dán + cùng cảnh báo, nhưng nằm thẳng trong trang (không cửa sổ), nút "Tiếp tục". */
  inline?: boolean
}

const FOCUSABLE = 'button:not([disabled]), textarea, input, [href], select, [tabindex]:not([tabindex="-1"])'

export default function ChordLyricsModal({ initial, onApply, onClose, inline = false }: Props) {
  const [draft, setDraft] = useState(initial)
  const box = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const changed = draft !== initial
  const issues = chordTextIssues(draft)

  // Giữ hàm đóng mới nhất cho trình nghe phím (không đăng ký lại mỗi lần gõ).
  const latest = useRef({ changed, onClose })
  latest.current = { changed, onClose }
  const requestClose = () => {
    if (latest.current.changed && !window.confirm('Có phần lời đang soạn chưa áp dụng. Bỏ phần này? (Bản nhạc sẽ không đổi.)')) return
    latest.current.onClose()
  }

  useEffect(() => {
    if (inline) { area.current?.focus(); return }
    const before = document.activeElement as HTMLElement | null
    area.current?.focus()
    const scroll = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); requestClose(); return }
      if (event.key !== 'Tab' || !box.current) return
      const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = scroll; before?.focus?.() }
  }, [])

  if (inline) {
    return <section className="cl-paste-step" aria-label="Dán lời và hợp âm">
      <p className="cl-lead"><strong>Dán lời và hợp âm chuẩn của bài hát</strong> (từ Hợp Âm Việt hoặc nguồn tương đương).</p>
      <p className="cl-help">Đặt hợp âm trong ngoặc vuông, ngay trước chữ đổi hợp âm: <code>Chiều [Am] nao, tiễn nhau [E7] đi</code>. Mỗi câu một dòng. Nhãn như <code>1.</code> hay <code>ĐK:</code> viết ở đầu dòng.</p>
      <textarea ref={area} value={draft} onChange={event => setDraft(event.target.value)} aria-label="Ô soạn lời và hợp âm"
        spellCheck={false} rows={14} placeholder={'1. [C] Câu hát đầu [Am] tiên\n[F] Câu tiếp [G] theo'} />
      {issues.length > 0 && <p className="cl-warn" role="note">Dòng {issues.join(', ')}: còn ngoặc vuông chưa thành hợp âm (thiếu ngoặc đóng, hoặc để trống).</p>}
      <div className="cl-paste-actions">
        <button type="button" className="cl-primary" disabled={!canonicalChordText(draft).trim()} onClick={() => onApply(draft)}>Tiếp tục</button>
      </div>
    </section>
  }

  return <div className="cl-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) requestClose() }}>
    <div className="cl-modal" role="dialog" aria-modal="true" aria-labelledby="cl-modal-title" ref={box}>
      <header className="cl-modal-head">
        <h2 id="cl-modal-title">Nạp lời &amp; hợp âm</h2>
        <button type="button" className="cl-link" onClick={requestClose} aria-label="Đóng cửa sổ">✕</button>
      </header>
      <div className="cl-modal-body">
        <p className="cl-lead"><strong>Dán lời và hợp âm chuẩn của bài hát</strong> (từ Hợp Âm Việt hoặc nguồn tương đương). Đây là lời và hợp âm cuối cùng của bài — sheet chỉ dùng để xác định ô nhịp.</p>
        <p className="cl-help">Đặt hợp âm trong ngoặc vuông, ngay trước chữ đổi hợp âm: <code>Chiều [Am] nao, tiễn nhau [E7] đi</code>. Mỗi câu một dòng. Nhãn như <code>1.</code> hay <code>ĐK:</code> viết ở đầu dòng.</p>
        <textarea ref={area} value={draft} onChange={event => setDraft(event.target.value)} aria-label="Ô soạn lời và hợp âm"
          spellCheck={false} rows={14} placeholder={'1. [C] Câu hát đầu [Am] tiên\n[F] Câu tiếp [G] theo'} />
        {issues.length > 0 && <p className="cl-warn" role="note">Dòng {issues.join(', ')}: còn ngoặc vuông chưa thành hợp âm (thiếu ngoặc đóng, hoặc để trống).</p>}
      </div>
      <footer className="cl-modal-foot">
        <span className="cl-help">{changed ? 'Chưa áp dụng — bản nhạc chưa đổi.' : canonicalChordText(draft) ? 'Chưa có thay đổi.' : ''}</span>
        <button type="button" className="cl-secondary" onClick={requestClose}>Hủy</button>
        <button type="button" className="cl-primary" onClick={() => onApply(draft)}>Áp dụng</button>
      </footer>
    </div>
  </div>
}
