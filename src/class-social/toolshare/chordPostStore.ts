// Play Scroll Share V2 — nạp nội dung hợp âm cho bài đăng trên Feed: MỘT yêu cầu một lúc (hàng đợi), cache theo version_id,
// chỉ chạy khi thẻ gần vào khung nhìn. Quyền đọc do RPC chord_sheet_get quyết (bản approved) — không đọc được → null (không khả dụng).
// Lỗi mạng KHÔNG cache (lần sau thử lại). Thư viện nạp ĐỘNG để component lá test được trên Node.
import type { ChordSheetDetail } from '../../thuvien/chordLibrary'

const cache = new Map<string, ChordSheetDetail | null>()
let tail: Promise<unknown> = Promise.resolve()

export type ChordLoad = { ok: true; detail: ChordSheetDetail | null } | { ok: false }

export function loadChordDetail(versionId: string): Promise<ChordLoad> {
  if (cache.has(versionId)) return Promise.resolve({ ok: true, detail: cache.get(versionId) ?? null })
  const run = async (): Promise<ChordLoad> => {
    if (cache.has(versionId)) return { ok: true, detail: cache.get(versionId) ?? null }
    try {
      const { getChordLibrary } = await import('../../thuvien/chordLibrary')
      const detail = await getChordLibrary().getChordSheet(versionId)
      cache.set(versionId, detail)
      return { ok: true, detail }
    } catch (e) {
      const m = String((e as { message?: string })?.message ?? '')
      if (/Không tìm thấy bài này|không có quyền với Thư viện hợp âm|chưa được bật/i.test(m)) { cache.set(versionId, null); return { ok: true, detail: null } }
      return { ok: false }
    }
  }
  const next = tail.then(run, run)
  tail = next.catch(() => undefined)
  return next
}

export function resetChordPostStore() { cache.clear(); tail = Promise.resolve() }
