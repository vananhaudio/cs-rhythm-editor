// ── "Strum Score của tôi" — danh sách bài học sinh tự soạn + mở trình vạch nhịp ─
// Route /strum-builder render màn này. Chọn/ tạo bài → mở StrumBuilder.
import { useEffect, useState } from 'react'
import StrumBuilder from './StrumBuilder'
import { listMyDrafts, createDraft, deleteDraft, type StrumDraft } from './strumDrafts'

const A = { accent: '#4F46E5', border: '#E4E4E7', sub: '#71717A', ink: '#27272A', bg: '#F4F4F5' }

export default function StrumWorkshop({ onExit }: { onExit?: () => void }) {
  const [drafts, setDrafts] = useState<StrumDraft[] | null>(null)   // null = đang tải
  const [current, setCurrent] = useState<StrumDraft | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    try { setErr(null); setDrafts(await listMyDrafts()) }
    catch (e: any) { setErr(friendly(e)); setDrafts([]) }
  }
  useEffect(() => { reload() }, [])

  const onNew = async () => {
    setBusy(true)
    try { setCurrent(await createDraft()) }
    catch (e: any) { setErr(friendly(e)) }
    finally { setBusy(false) }
  }

  const onDelete = async (d: StrumDraft) => {
    if (!confirm(`Xoá bài "${d.title}"?`)) return
    try { await deleteDraft(d.id); reload() } catch (e: any) { setErr(e?.message || 'Không xoá được') }
  }

  if (current) return <StrumBuilder draft={current} onBack={() => { setCurrent(null); reload() }} />

  return (
    <div style={{ minHeight: '100vh', background: A.bg, fontFamily: 'Inter, system-ui, sans-serif', color: A.ink }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: '#fff', borderBottom: `1px solid ${A.border}`, position: 'sticky', top: 0, zIndex: 1 }}>
        {onExit && <button onClick={onExit} style={{ background: 'none', border: `1px solid ${A.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, color: A.sub, cursor: 'pointer' }}>←</button>}
        <div style={{ fontSize: 17, fontWeight: 800 }}>🎼 Strum Score của tôi</div>
        <div style={{ flex: 1 }} />
        <button onClick={onNew} disabled={busy}
          style={{ background: A.accent, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1 }}>+ Tạo bài mới</button>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '18px 16px 60px' }}>
        <p style={{ fontSize: 13.5, color: A.sub, lineHeight: 1.7, margin: '0 0 16px' }}>
          Dán lời-hợp âm bài bạn thích, nhìn sheet để vạch nhịp — tạo bản nhạc cho người quạt của riêng bạn để luyện gảy theo.
        </p>

        {err && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, marginBottom: 16 }}>{err}</div>}

        {drafts === null
          ? <div style={{ color: A.sub, fontSize: 14, padding: '30px 0', textAlign: 'center' }}>Đang tải…</div>
          : drafts.length === 0
            ? <div style={{ color: A.sub, fontSize: 14, padding: '40px 0', textAlign: 'center', lineHeight: 1.8 }}>
                Chưa có bài nào.<br />Bấm <b style={{ color: A.accent }}>+ Tạo bài mới</b> để bắt đầu.
              </div>
            : <div style={{ display: 'grid', gap: 10 }}>
                {drafts.map((d) => (
                  <div key={d.id} style={{ background: '#fff', border: `1px solid ${A.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div onClick={() => setCurrent(d)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                      <div style={{ fontSize: 15.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</div>
                      <div style={{ fontSize: 12.5, color: A.sub, marginTop: 3 }}>{(d.cuts.length + 1)} ô · nhịp {d.meter}/4{d.updated_at ? ' · ' + fmtDate(d.updated_at) : ''}</div>
                    </div>
                    <button onClick={() => setCurrent(d)} style={{ background: '#EEF2FF', color: A.accent, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Mở</button>
                    <button onClick={() => onDelete(d)} title="Xoá" style={{ background: 'none', border: `1px solid ${A.border}`, borderRadius: 8, padding: '8px 11px', fontSize: 14, color: '#9CA3AF', cursor: 'pointer' }}>🗑</button>
                  </div>
                ))}
              </div>}
      </div>
    </div>
  )
}

// Đổi lỗi kỹ thuật → câu tiếng Việt dễ hiểu
function friendly(e: any): string {
  const m = (e?.message || '').toLowerCase()
  if (m.includes('permission') || m.includes('jwt') || m.includes('not authenticated') || m.includes('row-level security')) return 'Bạn cần đăng nhập để tạo và lưu bài.'
  if (m.includes('schema cache') || m.includes('does not exist')) return 'Tính năng chưa sẵn sàng (thiếu bảng dữ liệu). Báo thầy nhé.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Mất kết nối mạng. Thử lại sau.'
  return e?.message || 'Có lỗi xảy ra, thử lại nhé.'
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) } catch { return '' }
}
