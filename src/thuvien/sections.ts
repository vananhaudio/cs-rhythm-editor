// Hai mục của /thuvien và địa chỉ của chúng. Thuần TS để test được mà không cần trình duyệt.
//   /thuvien                         → Bản nhạc / MusicXML (mặc định; `?bai=<id>` như cũ)
//   /thuvien?muc=hopam               → Hợp âm chuẩn hóa — danh sách
//   /thuvien?muc=hopam&hopam=moi     → thêm bài
//   /thuvien?muc=hopam&hopam=<id>    → mở một bài (id = phiên bản đang dùng)
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
  if (section === 'chords') url.searchParams.set('muc', 'hopam')
  else url.searchParams.delete('muc')
  if (section === 'chords' && chordSheet) url.searchParams.set('hopam', chordSheet)
  return url.pathname + url.search
}
