import { useEffect, useRef, useState } from 'react'
import type { ChordAnchors } from './chordAnchors.ts'
import { lyricTokens } from './chordAnchors.ts'
import { chordTextIssues } from './chordText.ts'
import { copyLines, countBarsInLines, deleteLines, draftOf, editLine, insertLines, repairAnchors, textOf } from './lineEdit.ts'
import type { LineDraft, LineEditResult } from './lineEdit.ts'

// "Chỉnh sửa lời bài hát": sửa chữ, thêm / xoá dòng, chép một đoạn dòng — trên BẢN NHÁP riêng của cửa sổ.
// Chỉ "Áp dụng" mới đưa lời + vạch nhịp vào bản nhạc (chưa ghi DB — Lưu mới ghi, một phiên bản). Hủy / Esc không đổi gì.
// Mọi logic vạch nhịp ở lineEdit.ts (thuần); component này chỉ gọi và hiện cảnh báo.

type Props = {
  text: string
  bars: ChordAnchors | null
  onApply: (text: string, bars: ChordAnchors | null, notes: string[]) => void
  onClose: () => void
}

const FOCUSABLE = 'button:not([disabled]), textarea, input, select, [href], [tabindex]:not([tabindex="-1"])'

export default function ChordLineEditor({ text, bars, onApply, onClose }: Props) {
  const initial = useRef(draftOf(text, bars))
  const [draft, setDraft] = useState<LineDraft>(initial.current)
  const [notes, setNotes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const [target, setTarget] = useState<string>('')
  const box = useRef<HTMLDivElement>(null)
  const changed = textOf(draft) !== textOf(initial.current) || JSON.stringify(draft.anchors) !== JSON.stringify(initial.current.anchors)
  const issues = chordTextIssues(textOf(draft))

  const latest = useRef({ changed, onClose })
  latest.current = { changed, onClose }
  const requestClose = () => {
    if (latest.current.changed && !window.confirm('Có chỉnh sửa lời chưa áp dụng. Bỏ các chỉnh sửa này? (Bản nhạc sẽ không đổi.)')) return
    latest.current.onClose()
  }
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
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

  /** Áp một thao tác; thành công → thay bản nháp + GHI THÊM cảnh báo; lỗi → báo, bản nháp không đổi. */
  function run(result: LineEditResult, then?: () => void) {
    if (!result.ok) { setError(result.reason); return }
    setError('')
    setDraft(result.draft)
    if (result.notes.length) setNotes(current => [...current, ...result.notes])
    then?.()
  }

  const count = (line: string) => lyricTokens(line).tokens.length
  const barsOn = (line: number) => countBarsInLines(draft, line, line)
  const picks = [...picked].sort((a, b) => a - b)
  const contiguous = picks.length > 0 && picks.every((value, at) => at === 0 || value === picks[at - 1] + 1)
  const toggle = (line: number) => setPicked(current => (current.includes(line) ? current.filter(value => value !== line) : [...current, line]))

  function remove(from: number, to: number) {
    const removedBars = countBarsInLines(draft, from, to)
    const label = from === to ? `dòng ${from + 1}` : `các dòng ${from + 1}–${to + 1}`
    const message = removedBars > 0
      ? `Xoá ${label}? ${removedBars} vạch nhịp nằm trong ${from === to ? 'dòng' : 'các dòng'} này sẽ bị xoá cùng (các vạch phía sau được giữ và dời lên). Không hoàn tác được sau khi Lưu.`
      : `Xoá ${label}?`
    if (!window.confirm(message)) return
    run(deleteLines(draft, from, to), () => setPicked([]))
  }

  function copy() {
    if (!contiguous) { setError('Chọn các dòng liền nhau để chép.'); return }
    const at = target === '' ? draft.lines.length : Number(target)
    run(copyLines(draft, picks[0], picks[picks.length - 1], at), () => setPicked([]))
  }

  function apply() {
    const repaired = repairAnchors(draft)
    onApply(textOf(repaired.draft), repaired.draft.anchors, [...notes, ...repaired.notes])
  }

  return <div className="cl-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) requestClose() }}>
    <div className="cl-modal cl-le-modal" role="dialog" aria-modal="true" aria-labelledby="cl-lines-title" ref={box}>
      <header className="cl-modal-head">
        <h2 id="cl-lines-title">Chỉnh sửa lời bài hát</h2>
        <button type="button" className="cl-link" onClick={requestClose} aria-label="Đóng cửa sổ">✕</button>
      </header>
      <div className="cl-modal-body">
        <p className="cl-help">Sửa chữ ngay trong từng dòng (giữ nguyên <code>[hợp âm]</code>). Chọn các dòng liền nhau để chép vào chỗ khác — vạch nhịp của đoạn được nhân đôi theo. Chưa ghi gì cho tới khi bấm “Áp dụng” rồi “Lưu”.</p>
        <ol className="cl-le-list" aria-label="Các dòng lời">
          {draft.lines.map((line, index) => <li key={`${index}:${line}`} className={`cl-le-row${picked.includes(index) ? ' is-picked' : ''}`}>
            <label className="cl-le-pick">
              <input type="checkbox" checked={picked.includes(index)} onChange={() => toggle(index)} aria-label={`Chọn dòng ${index + 1}`} />
              <span className="cl-le-no">{index + 1}</span>
            </label>
            <input className="cl-le-text" defaultValue={line} spellCheck={false} aria-label={`Lời dòng ${index + 1}`} placeholder="(dòng trống)"
              onBlur={event => { if (event.target.value !== line) run(editLine(draft, index, event.target.value)) }}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); (event.target as HTMLInputElement).blur() } }} />
            <span className="cl-le-meta" title="Số chữ hát · số vạch nhịp bắt đầu ở dòng này">{count(line)} chữ{barsOn(index) ? ` · ${barsOn(index)} vạch` : ''}</span>
            <span className="cl-le-actions">
              <button type="button" className="cl-secondary" onClick={() => run(insertLines(draft, index + 1))} aria-label={`Thêm dòng trống sau dòng ${index + 1}`}>+ Dòng</button>
              <button type="button" className="cl-secondary" onClick={() => remove(index, index)} disabled={draft.lines.length <= 1} aria-label={`Xoá dòng ${index + 1}`}>Xoá</button>
            </span>
          </li>)}
        </ol>
        <div className="cl-le-tools" role="group" aria-label="Chép đoạn đã chọn">
          <span className="cl-help">{picks.length ? `Đã chọn ${picks.length} dòng${contiguous ? '' : ' (chưa liền nhau)'}` : 'Tích ô đầu dòng để chọn đoạn cần chép hoặc xoá.'}</span>
          <label>Chép vào <select value={target} onChange={event => setTarget(event.target.value)} aria-label="Vị trí chèn bản sao">
            <option value="">cuối bài</option>
            {draft.lines.map((_, index) => <option key={index} value={String(index)}>trước dòng {index + 1}</option>)}
          </select></label>
          <button type="button" className="cl-secondary" disabled={!picks.length} onClick={copy}>Chép đoạn đã chọn</button>
          <button type="button" className="cl-secondary" disabled={!contiguous} onClick={() => remove(picks[0], picks[picks.length - 1])}>Xoá đoạn đã chọn</button>
        </div>
        {issues.length > 0 && <p className="cl-warn" role="note">Dòng {issues.join(', ')}: còn ngoặc vuông chưa thành hợp âm (thiếu ngoặc đóng, hoặc để trống).</p>}
        {error && <p className="cl-error" role="alert">{error}</p>}
        {notes.length > 0 && <div className="cl-warn" role="status" aria-label="Cần kiểm tra lại vạch nhịp">
          <strong>Cần kiểm tra lại:</strong>
          <ul>{notes.map((note, index) => <li key={`${index}:${note}`}>{note}</li>)}</ul>
        </div>}
      </div>
      <footer className="cl-modal-foot">
        <span className="cl-help">{changed ? 'Chưa áp dụng — bản nhạc chưa đổi.' : 'Chưa có thay đổi.'}</span>
        <button type="button" className="cl-secondary" onClick={requestClose}>Hủy</button>
        <button type="button" className="cl-primary" onClick={apply} disabled={!changed}>Áp dụng</button>
      </footer>
    </div>
  </div>
}
