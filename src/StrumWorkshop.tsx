// ── "Strum Score của tôi" — danh sách bài học sinh tự soạn + mở trình vạch nhịp ─
// Route /strum-builder render màn này. 2 khu: "Bài hát của tôi" (đã hoàn tất —
// mở thẳng Toàn màn hình để tập) và "Đang soạn" (mở màn vạch nhịp như cũ).
import { useEffect, useState } from 'react'
import StrumBuilder from './StrumBuilder'
import { listMyDrafts, createDraft, deleteDraft, type StrumDraft } from './strumDrafts'

const A = { accent: '#4F46E5', border: '#E4E4E7', sub: '#71717A', ink: '#27272A', bg: '#F4F4F5' }

export default function StrumWorkshop({ onExit }: { onExit?: () => void }) {
  const [drafts, setDrafts] = useState<StrumDraft[] | null>(null)   // null = đang tải
  const [current, setCurrent] = useState<StrumDraft | null>(null)
  const [openDone, setOpenDone] = useState(false)   // mở thẳng Toàn màn hình (bài đã hoàn tất)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    try { setErr(null); setDrafts(await listMyDrafts()) }
    catch (e: any) { setErr(friendly(e)); setDrafts([]) }
  }
  useEffect(() => { reload() }, [])

  const onNew = async () => {
    setBusy(true)
    try { setCurrent(await createDraft()); setOpenDone(false) }
    catch (e: any) { setErr(friendly(e)) }
    finally { setBusy(false) }
  }

  const openDraft = (d: StrumDraft) => { setCurrent(d); setOpenDone(d.status === 'done') }

  const onDelete = async (d: StrumDraft) => {
    if (!confirm(`Xoá bài "${d.title}"?`)) return
    try { await deleteDraft(d.id); reload() } catch (e: any) { setErr(e?.message || 'Không xoá được') }
  }

  if (current) return <StrumBuilder draft={current} openDone={openDone} onBack={() => { setCurrent(null); reload() }} />

  const songs = (drafts ?? []).filter((d) => d.status === 'done')
  const inProgress = (drafts ?? []).filter((d) => d.status !== 'done')

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
            : <>
                {songs.length > 0 && (
                  <Section title="🎵 Bài hát của tôi" hint="Đã vạch nhịp xong — bấm để tập">
                    {songs.map((d) => <DraftRow key={d.id} d={d} onOpen={() => openDraft(d)} onDelete={() => onDelete(d)} />)}
                  </Section>
                )}
                {inProgress.length > 0 && (
                  <Section title="✎ Đang soạn">
                    {inProgress.map((d) => <DraftRow key={d.id} d={d} onOpen={() => openDraft(d)} onDelete={() => onDelete(d)} />)}
                  </Section>
                )}
              </>}
      </div>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: A.ink }}>{title}</div>
        {hint && <div style={{ fontSize: 12, color: A.sub }}>{hint}</div>}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
    </div>
  )
}

function DraftRow({ d, onOpen, onDelete }: { d: StrumDraft; onOpen: () => void; onDelete: () => void }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${A.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div onClick={onOpen} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</div>
        <div style={{ fontSize: 12.5, color: A.sub, marginTop: 3 }}>{(d.cuts.length + 1)} ô · nhịp {d.meter}/4{d.updated_at ? ' · ' + fmtDate(d.updated_at) : ''}</div>
      </div>
      <button onClick={onOpen} style={{ background: '#EEF2FF', color: A.accent, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{d.status === 'done' ? 'Tập' : 'Mở'}</button>
      <button onClick={onDelete} title="Xoá" style={{ background: 'none', border: `1px solid ${A.border}`, borderRadius: 8, padding: '8px 11px', fontSize: 14, color: '#9CA3AF', cursor: 'pointer' }}>🗑</button>
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
