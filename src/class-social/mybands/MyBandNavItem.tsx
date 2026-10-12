// Mục "Band của tôi" NGAY DƯỚI mục "Lớp của tôi" trong nhóm LỚP HỌC của menu (sidebar desktop / sheet ☰ mobile) —
// cùng lớp .cs-nav-item (kích thước, khoảng cách, icon 21px, vùng chạm) như "Lớp của tôi".
// Bấm: 1 Band → vào thẳng Band Home TeamLab; nhiều Band → chọn; chưa có → hộp thoại thân thiện; lỗi tải → báo lỗi + Thử lại.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Drum } from 'lucide-react'
import { fetchMyBands } from './myBandsApi'
import { actionFor, bandHomeHref, type MyBand } from './myBandsModel'

type Dialog = { kind: 'empty' } | { kind: 'choose'; bands: MyBand[] } | { kind: 'error'; message: string }

export default function MyBandNavItem({ userId, collapsed = false, go = href => window.location.assign(href) }: {
  userId: string
  collapsed?: boolean
  /** Điều hướng (mặc định tải trang đầy đủ như mục menu "Ban nhạc"); test truyền hàm riêng. */
  go?: (href: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const open = async () => {
    if (busy) return
    setBusy(true)
    const r = await fetchMyBands(userId)
    if (!alive.current) return
    if (!r.ok) { setBusy(false); setDialog({ kind: 'error', message: r.message }); return }
    const a = actionFor(r.value)
    if (a.kind === 'go') { go(a.href); return }   // giữ trạng thái bận tới khi trang đổi (chống bấm đúp)
    setBusy(false)
    setDialog(a.kind === 'none' ? { kind: 'empty' } : { kind: 'choose', bands: a.bands })
  }
  const close = () => setDialog(null)

  return (
    <>
      <button type="button" className="cs-nav-item" title={collapsed ? 'Band của tôi' : undefined} aria-busy={busy} disabled={busy}
        onClick={() => void open()} data-testid="my-band-btn">
        <Drum size={21} strokeWidth={1.9} />
        <span className="cs-nav-text">Band của tôi</span>
      </button>
      {/* portal vào .cs-root: biến màu --cs-* khai ở đó; ra ngoài sheet menu để position:fixed không bị kẹt */}
      {dialog && createPortal(<BandDialog dialog={dialog} onClose={close} onRetry={() => { close(); void open() }} />, document.querySelector('.cs-root') ?? document.body)}
    </>
  )
}

function BandDialog({ dialog, onClose, onRetry }: { dialog: Dialog; onClose: () => void; onRetry: () => void }) {
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => { btn.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const title = dialog.kind === 'empty' ? 'Bạn chưa có Band nào' : dialog.kind === 'choose' ? 'Chọn Band của bạn' : 'Chưa tải được Band'
  return (
    <>
      <div className="cs-dialog-backdrop cs-my-band-backdrop" onClick={onClose} />
      <div className="cs-dialog cs-my-band-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cs-my-band-t" data-testid="my-band-dialog" data-kind={dialog.kind}>
        <h2 id="cs-my-band-t">{title}</h2>
        {dialog.kind === 'empty' && <p>Thầy sẽ sắp xếp Band nhạc cho bạn sau khi tốt nghiệp khóa học, nếu bạn có nguyện vọng tham gia.</p>}
        {dialog.kind === 'error' && <p>{dialog.message}</p>}
        {dialog.kind === 'choose' && (
          <ul className="cs-my-band-list">
            {dialog.bands.map(b => (
              <li key={b.id}><a className="cs-my-band-item" href={bandHomeHref(b.id)} data-testid="my-band-item">{b.name}<ChevronRight size={18} aria-hidden="true" /></a></li>
            ))}
          </ul>
        )}
        {dialog.kind === 'error' && <button type="button" className="cs-btn cs-btn-primary" onClick={onRetry}>Thử lại</button>}
        <button ref={btn} type="button" className={'cs-btn ' + (dialog.kind === 'error' ? 'cs-btn-ghost' : 'cs-btn-primary')} onClick={onClose} data-testid="my-band-ok">
          {dialog.kind === 'empty' ? 'Đã hiểu' : 'Đóng'}
        </button>
      </div>
    </>
  )
}
