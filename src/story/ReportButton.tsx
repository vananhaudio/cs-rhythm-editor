// ── Báo cáo nội dung câu chuyện ──
// Đáp ứng App Store Guideline 1.2: người đọc phải có cách báo nội dung
// không phù hợp, và được cam kết thời gian xử lý.
// Ai cũng báo cáo được — kể cả khách chưa đăng nhập.
import { useState } from 'react'
import { supabase } from '../supabase'

const REASONS = [
  { key: 'khong-phu-hop', label: 'Nội dung không phù hợp' },
  { key: 'khong-that', label: 'Không phải câu chuyện thật, hoặc quảng cáo' },
  { key: 'lo-thong-tin', label: 'Làm lộ thông tin cá nhân của người khác' },
  { key: 'xuc-pham', label: 'Xúc phạm, công kích người khác' },
  { key: 'ban-quyen', label: 'Vi phạm bản quyền' },
  { key: 'khac', label: 'Lý do khác' },
]

export default function ReportButton({ storyId }: { storyId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const close = () => {
    setOpen(false)
    setTimeout(() => { setReason(''); setNote(''); setDone(false); setErr('') }, 200)
  }

  const submit = async () => {
    if (!reason || busy) return
    setBusy(true); setErr('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('story_reports').insert({
        story_id: storyId,
        reporter_id: user?.id ?? null,
        reason,
        note: note.trim() || null,
      })
      if (error) throw error
      setDone(true)
    } catch (e) {
      console.error('story report', e)
      setErr('Chưa gửi được. Bạn thử lại, hoặc nhắn Zalo cho thầy Văn Anh giúp mình nhé.')
    } finally { setBusy(false) }
  }

  return (
    <>
      <button className="rp-trigger" onClick={() => setOpen(true)}>
        ⚑ Báo cáo nội dung
      </button>

      {open && (
        <div className="rp-overlay" onClick={close} role="dialog" aria-modal="true" aria-label="Báo cáo nội dung">
          <div className="rp-card" onClick={e => e.stopPropagation()}>
            {done ? (
              <>
                <div className="rp-done-icon">✓</div>
                <h3>Cảm ơn bạn đã báo</h3>
                <p className="rp-done-text">
                  Ban biên tập sẽ xem lại câu chuyện này <b>trong vòng 24 giờ</b> và gỡ xuống
                  nếu nội dung thật sự không phù hợp.
                </p>
                <button className="rp-btn rp-btn-primary" onClick={close}>Đóng</button>
              </>
            ) : (
              <>
                <h3>Báo cáo câu chuyện này</h3>
                <p className="rp-sub">Bạn thấy điều gì không ổn? Ban biên tập sẽ đọc lại trong vòng 24 giờ.</p>

                <div className="rp-reasons">
                  {REASONS.map(r => (
                    <label key={r.key} className={`rp-reason ${reason === r.key ? 'on' : ''}`}>
                      <input type="radio" name="rp-reason" checked={reason === r.key}
                        onChange={() => setReason(r.key)} />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>

                <textarea
                  className="rp-note" rows={3} maxLength={500} value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Mô tả thêm nếu cần (không bắt buộc)…"
                  aria-label="Mô tả thêm"
                />

                {err && <div className="rp-err">{err}</div>}

                <button className="rp-btn rp-btn-primary" onClick={submit} disabled={!reason || busy}>
                  {busy ? 'Đang gửi…' : 'Gửi báo cáo'}
                </button>
                <button className="rp-btn" onClick={close} disabled={busy}>Đóng</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export const REPORT_CSS = `
.rp-trigger { background: none; border: none; color: #8E8E93; font-size: 13.5px; font-family: inherit; cursor: pointer; padding: 6px 10px; border-radius: 8px; }
.rp-trigger:hover { color: #FF3B30; background: rgba(255,59,48,.07); }
.rp-overlay { position: fixed; inset: 0; background: rgba(20,18,16,.55); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 16px; }
.rp-card { background: #fff; border-radius: 18px; padding: 24px; width: 100%; max-width: 420px; max-height: 88vh; overflow-y: auto; box-shadow: 0 24px 60px rgba(0,0,0,.28); text-align: left; font-family: inherit; }
.rp-card h3 { font-size: 19px; font-weight: 700; margin: 0 0 6px; color: #1A1A1A; }
.rp-sub { font-size: 14px; color: #6B6B70; margin: 0 0 16px; line-height: 1.5; }
.rp-reasons { display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px; }
.rp-reason { display: flex; align-items: center; gap: 11px; padding: 11px 13px; border: 1.5px solid #E5E5EA; border-radius: 11px; cursor: pointer; font-size: 14.5px; color: #1A1A1A; line-height: 1.35; }
.rp-reason.on { border-color: #FF3B30; background: #FFF5F4; }
.rp-reason input { accent-color: #FF3B30; width: 17px; height: 17px; flex: none; cursor: pointer; }
.rp-note { width: 100%; box-sizing: border-box; padding: 11px 13px; border: 1.5px solid #E5E5EA; border-radius: 11px; font-size: 14.5px; font-family: inherit; resize: none; outline: none; color: #1A1A1A; }
.rp-note:focus { border-color: #FF3B30; }
.rp-err { background: #FFF0EF; color: #C0342B; border-radius: 10px; padding: 10px 12px; font-size: 13.5px; margin-top: 10px; line-height: 1.45; }
.rp-btn { width: 100%; border: none; background: #F2F2F7; color: #1A1A1A; border-radius: 12px; padding: 13px; font-size: 15px; font-weight: 500; font-family: inherit; cursor: pointer; margin-top: 9px; }
.rp-btn-primary { background: #FF3B30; color: #fff; font-weight: 600; }
.rp-btn:disabled { opacity: .45; cursor: not-allowed; }
.rp-done-icon { width: 46px; height: 46px; border-radius: 999px; background: #E9F7EC; color: #2E7D3A; font-size: 24px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
.rp-done-text { font-size: 14.5px; color: #4A4A4F; line-height: 1.55; margin: 0 0 6px; }
`
