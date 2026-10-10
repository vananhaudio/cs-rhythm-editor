// Hai mục của /thuvien và địa chỉ của chúng. Thuần TS để test được mà không cần trình duyệt.
//   /thuvien                         → Bản nhạc / MusicXML (mặc định; `?bai=<id>` như cũ)
//   /thuvien?muc=hopam               → Hợp âm chuẩn hóa — danh sách
//   /thuvien?muc=hopam&hopam=moi     → thêm bài
//   /thuvien?muc=hopam&hopam=<id>    → TRÌNH SỬA của một bài (id = phiên bản)
//   /thuvien?muc=hopam&xem=<id>      → TRANG XEM chỉ-đọc của một bài (không có ô nhập, không có trình sửa)
//   /thuvien?nap=nhac                → Nạp bản nhạc MusicXML mới (luồng tải MusicXML sẵn có)
export type ThuVienSection = 'musicxml' | 'chords'

export const NEW_CHORD_SHEET = 'moi'

export function sectionFromSearch(search: string): ThuVienSection {
  return new URLSearchParams(search).get('muc') === 'hopam' ? 'chords' : 'musicxml'
}

/** `null` = đang ở danh sách. */
export function chordSheetFromSearch(search: string): string | null {
  const params = new URLSearchParams(search)
  return params.get('muc') === 'hopam' ? params.get('hopam')?.trim() || null : null
}

/** Địa chỉ của một mục; đổi mục thì bỏ tham số của mục kia (`bai`, `hopam`). */
export function sectionUrl(href: string, section: ThuVienSection, chordSheet: string | null = null): string {
  const url = new URL(href)
  url.searchParams.delete('bai')
  url.searchParams.delete('hopam')
  url.searchParams.delete('xem')
  url.searchParams.delete('nap')
  url.searchParams.delete('chay')
  if (section === 'chords') url.searchParams.set('muc', 'hopam')
  else url.searchParams.delete('muc')
  if (section === 'chords' && chordSheet) url.searchParams.set('hopam', chordSheet)
  return url.pathname + url.search
}

/** `?muc=hopam&hopam=<id>&chay=1` → mở Rhythm Scroll của phiên bản đó (thay cho trình sửa). */
export function rhythmFromSearch(search: string): boolean {
  const params = new URLSearchParams(search)
  return params.get('muc') === 'hopam' && !!params.get('hopam')?.trim() && params.get('chay') === '1'
}

/** Địa chỉ trang Rhythm Scroll của một phiên bản; `on = false` → về trình sửa của chính phiên bản đó. */
export function rhythmUrl(href: string, versionId: string, on = true): string {
  const url = new URL(sectionUrl(href, 'chords', versionId), href)
  if (on) url.searchParams.set('chay', '1')
  return url.pathname + url.search
}

/** `?muc=hopam&xem=<id>` → trang XEM (chỉ đọc) của phiên bản đó; `null` = không ở trang xem. */
export function chordViewFromSearch(search: string): string | null {
  const params = new URLSearchParams(search)
  return params.get('muc') === 'hopam' ? params.get('xem')?.trim() || null : null
}

export function chordViewUrl(href: string, versionId: string): string {
  const url = new URL(sectionUrl(href, 'chords'), href)
  url.searchParams.set('xem', versionId)
  return url.pathname + url.search
}

/** `?nap=nhac` → trang nạp bản nhạc MusicXML mới (thuộc mục MusicXML). */
export function uploadFromSearch(search: string): boolean {
  const params = new URLSearchParams(search)
  return params.get('nap') === 'nhac' && params.get('muc') !== 'hopam'
}

export function uploadUrl(href: string): string {
  const url = new URL(sectionUrl(href, 'musicxml'), href)
  url.searchParams.set('nap', 'nhac')
  return url.pathname + url.search
}
