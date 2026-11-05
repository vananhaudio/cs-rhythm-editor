// Deep link Share Note V1: /me/classes/<lớp>/sessions/<buổi>?note=<id> — trang Buổi mở đúng bản nhạc + tô dải ô (THUẦN).
import { sessionPath } from '../class-social/resolveMeRoute'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const SHARE_NOTE_PARAM = 'note'
export function shareNoteHref(classId: string, sessionNo: number, noteId: string): string {
  return `${sessionPath(classId, sessionNo)}?${SHARE_NOTE_PARAM}=${noteId.toLowerCase()}`
}
/** ?note=<uuid> → id (chữ thường) hoặc null — không nhận giá trị lạ. */
export function shareNoteIdFromSearch(search: string): string | null {
  const v = new URLSearchParams(search).get(SHARE_NOTE_PARAM) ?? ''
  return UUID_RE.test(v) ? v.toLowerCase() : null
}
