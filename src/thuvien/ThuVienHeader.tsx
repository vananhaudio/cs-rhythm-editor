import { useState } from 'react'
import { NEW_CHORD_SHEET, chordSheetFromSearch, sectionFromSearch, uploadFromSearch } from './sections.ts'

// Header của website THƯ VIỆN ÂM NHẠC: một thanh điều hướng thống nhất cho mọi trang của /thuvien.
// Chỉ ĐIỀU HƯỚNG — không giữ dữ liệu, không có logic nghiệp vụ. Mỗi mục là một địa chỉ (xem sections.ts);
// trang đích tự lo phần của nó. Là <header> (không phải <div>) để không lọt vào các selector theo vị trí của ThuVienPage.css.

export type HeaderItem = 'chords' | 'musicxml' | 'new-chords' | 'upload-musicxml'

const ITEMS: { id: HeaderItem; label: string }[] = [
  { id: 'chords', label: 'Danh sách bài hát có hợp âm' },
  { id: 'musicxml', label: 'Danh sách bản nhạc MusicXML' },
  { id: 'new-chords', label: 'Nạp hợp âm mới' },
  { id: 'upload-musicxml', label: 'Nạp bản nhạc mới' },
]

/** Mục đang mở của Header, suy ra từ địa chỉ (thuần, test được). */
export function activeHeaderItem(search: string): HeaderItem {
  if (sectionFromSearch(search) === 'chords') return chordSheetFromSearch(search) === NEW_CHORD_SHEET ? 'new-chords' : 'chords'
  return uploadFromSearch(search) ? 'upload-musicxml' : 'musicxml'
}

export type HeaderAccount = { state: 'loading' } | { state: 'out' } | { state: 'in'; label: string }

type Props = {
  active: HeaderItem | null
  onNavigate: (item: HeaderItem) => void
  account: HeaderAccount
}

export default function ThuVienHeader({ active, onNavigate, account }: Props) {
  const [menu, setMenu] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const go = (item: HeaderItem) => { setMenu(false); setAdvanced(false); if (item !== active) onNavigate(item) }

  return <header className="tv-site" data-menu={menu}>
    <div className="tv-site-top">
      <a className="tv-site-name" href="/thuvien" onClick={event => { event.preventDefault(); go('chords') }}>THƯ VIỆN ÂM NHẠC</a>
      <button type="button" className="tv-site-burger" aria-expanded={menu} aria-controls="tv-site-nav" onClick={() => setMenu(open => !open)}>
        {menu ? 'Đóng' : 'Menu'}
      </button>
      <span className="tv-site-more">
        <button type="button" className="tv-site-link" aria-expanded={advanced} onClick={() => setAdvanced(open => !open)}>Nâng cao</button>
        {advanced && <span className="tv-site-pop" role="menu">
          <a role="menuitem" href="/admin">Quản trị</a>
        </span>}
      </span>
      <div className="tv-site-account">
        {account.state === 'in' && <a href="/me" title="Tài khoản">{account.label}</a>}
        {account.state === 'out' && <a href="/start">Đăng nhập</a>}
        {account.state === 'loading' && <span aria-live="polite">…</span>}
      </div>
    </div>
    <nav id="tv-site-nav" className="tv-site-nav" aria-label="Điều hướng thư viện">
      {ITEMS.map(item => <button key={item.id} type="button" className="tv-site-link" aria-current={item.id === active ? 'page' : undefined} onClick={() => go(item.id)}>{item.label}</button>)}
    </nav>
  </header>
}
