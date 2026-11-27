// LESSON_HOLD_V2 — thanh CHỈ THẦY thấy đầu trang buổi: buổi đang khoá hay mở, và nút đổi. Luôn hỏi xác nhận (bấm 2 bước),
// để không mở bài cho cả lớp vì chạm nhầm trên điện thoại. Quyền thật do server (class_lesson_set_hold) quyết.
import { useState } from 'react'
import { pad2, type SessionState } from '../../classLearning/progress'

export default function TeacherLockBar({ s, onSet, onDone }: {
  s: Pick<SessionState, 'no' | 'held' | 'published' | 'stageStart'>
  onSet: (held: boolean) => Promise<{ ok: true } | { ok: false; message: string }>
  onDone: () => void
}) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const held = !!s.held
  if (!s.published && !held) return null
  const apply = async () => {
    setBusy(true); setError('')
    const r = await onSet(!held)
    setBusy(false)
    if (!r.ok) { setError(r.message); return }
    setAsking(false); onDone()
  }
  const n = pad2(s.no)
  return (
    <section className="cs-card cs-lock-bar" aria-label="Khoá hoặc mở buổi học (chỉ giáo viên)">
      <p className="cs-lock-bar-state" role="status">
        {held ? <><b>🔒 Buổi {n} đang khoá.</b> Học viên không đọc được.</> : <><b>🔓 Buổi {n} không khoá.</b> {s.stageStart ? 'Cả lớp vào học được.' : 'Học viên đọc được khi tới lượt.'}</>}
      </p>
      {asking ? (
        <div>
          <p className="cs-lock-bar-note">{held
            ? s.stageStart
              ? 'Mở cho cả lớp? Đây là buổi mở đầu chặng: mọi học viên của lớp vào học được ngay, không cần hoàn thành chặng trước. Tiến độ chặng cũ giữ nguyên.'
              : 'Mở khoá cho lớp? Học viên đã hoàn thành buổi trước sẽ thấy ngay; người chưa trả đủ bài buổi trước sẽ thấy sau khi trả đủ.'
            : 'Khoá lại? Học viên mất quyền đọc ngay, kể cả người đã mở. Tiến độ và bài đã Đạt được giữ nguyên.'}</p>
          <div className="cs-lock-bar-actions">
            <button type="button" className="cs-btn cs-btn-primary cs-btn-sm" disabled={busy} onClick={() => void apply()}>
              {busy ? 'Đang lưu…' : held ? `Xác nhận mở Buổi ${n}` : `Xác nhận khoá Buổi ${n}`}
            </button>
            <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" disabled={busy} onClick={() => { setAsking(false); setError('') }}>Thôi</button>
          </div>
        </div>
      ) : (
        <div className="cs-lock-bar-actions">
          <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm" onClick={() => setAsking(true)}>{held ? 'Mở khoá cho lớp' : 'Khoá buổi này'}</button>
        </div>
      )}
      {error && <p className="cs-lock-bar-error" role="alert">{error}</p>}
    </section>
  )
}
