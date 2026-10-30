// Báo cáo nội dung Class (Guideline 1.2): chọn lý do + ghi chú tuỳ chọn → class_report_submit.
// Chống bấm đúp bằng ref khoá đồng bộ (không chỉ state).
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { submitReport } from './api'
import { NOTE_MAX, REPORT_KIND_LABEL, REPORT_REASONS, type ReportKind, type ReportReason } from './model'

export default function ReportSheet({ kind, targetId, via, onClose }: { kind: ReportKind; targetId: string; via?: 'feed_comment'; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [err, setErr] = useState('')
  const lock = useRef(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !lock.current) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const send = async () => {
    if (!reason || lock.current) return
    lock.current = true
    setState('sending'); setErr('')
    const r = await submitReport({ kind, targetId, reason, note, via })
    lock.current = false
    if (r.ok) setState('done')
    else { setState('idle'); setErr(r.message) }
  }

  return createPortal(
    <div className="csafe-layer" onClick={() => { if (!lock.current) onClose() }}>
      <div className="csafe-sheet" role="dialog" aria-modal="true" aria-label="Báo cáo nội dung" onClick={e => e.stopPropagation()}>
        {state === 'done' ? (
          <>
            <div className="csafe-ok" aria-hidden="true">✓</div>
            <h2>Cảm ơn bạn đã báo cáo</h2>
            <p className="csafe-sub">Thầy sẽ xem lại và xử lý nếu nội dung vi phạm quy tắc cộng đồng.</p>
            <button type="button" className="csafe-btn primary" onClick={onClose}>Đóng</button>
          </>
        ) : (
          <>
            <h2>Báo cáo {REPORT_KIND_LABEL[kind]}</h2>
            <p className="csafe-sub">Chọn lý do. Thầy sẽ xem lại báo cáo của bạn.</p>
            <div className="csafe-reasons" role="radiogroup" aria-label="Lý do báo cáo">
              {REPORT_REASONS.map(r => (
                <label key={r.key} className={'csafe-reason' + (reason === r.key ? ' on' : '')}>
                  <input type="radio" name="csafe-reason" checked={reason === r.key} onChange={() => setReason(r.key)} disabled={state === 'sending'} />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
            <textarea className="csafe-note" rows={3} maxLength={NOTE_MAX} value={note} onChange={e => setNote(e.target.value)}
              placeholder="Mô tả thêm nếu cần (không bắt buộc)" aria-label="Mô tả thêm" disabled={state === 'sending'} />
            {err && <div className="csafe-err" role="alert">{err}</div>}
            <button type="button" className="csafe-btn danger" onClick={() => void send()} disabled={!reason || state === 'sending'}>
              {state === 'sending' ? 'Đang gửi…' : err ? 'Gửi lại' : 'Gửi báo cáo'}
            </button>
            <button type="button" className="csafe-btn" onClick={onClose} disabled={state === 'sending'}>Huỷ</button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
