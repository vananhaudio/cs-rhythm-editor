import type { ThuVienSection } from './sections.ts'

const TABS: { id: ThuVienSection; label: string }[] = [
  { id: 'musicxml', label: 'Bản nhạc / MusicXML' },
  { id: 'chords', label: 'Hợp âm chuẩn hóa' },
]

/** Thanh chuyển mục của /thuvien. Là <nav> (không phải <div>) để không lọt vào các selector theo vị trí của ThuVienPage.css. */
export default function ThuVienTabs({ section, onChange }: { section: ThuVienSection; onChange: (next: ThuVienSection) => void }) {
  return <nav className="tv-tabs" aria-label="Mục của thư viện">
    {TABS.map(tab => <button key={tab.id} type="button" className="tv-tab" aria-current={tab.id === section ? 'page' : undefined}
      onClick={() => { if (tab.id !== section) onChange(tab.id) }}>{tab.label}</button>)}
  </nav>
}
