// Giữ vị trí cuộn khi QUAY LẠI Feed (từ trang đọc truyện, bài Trả bài, trang cá nhân…) — phần THUẦN.
// Chỉ lưu trong sessionStorage của tab: khoá mục đang ở đầu màn hình + toạ độ + số mục đã tải. KHÔNG lưu nội dung bài.
// Chỉ khôi phục khi người dùng thật sự "quay lại"; bấm "Trang chủ" trong menu vẫn về đầu Feed như cũ.
export type FeedPosition = { owner: string; key: string | null; offset: number; y: number; count: number; at: number }

export const POSITION_TTL_MS = 30 * 60_000
const RESUME_TTL_MS = 60_000
const RESUME = 'cs:feed-resume'
const posKey = (id: string) => `cs:feed-pos:${id}`

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const store = (): Store | null => { try { return window.sessionStorage } catch { return null } }

export function savePosition(id: string, p: FeedPosition, s: Store | null = store()) {
  try { s?.setItem(posKey(id), JSON.stringify(p)) } catch { /* đầy / bị chặn → bỏ qua */ }
}

export function readPosition(id: string, owner: string, now = Date.now(), s: Store | null = store()): FeedPosition | null {
  try {
    const p = JSON.parse(s?.getItem(posKey(id)) ?? 'null') as FeedPosition | null
    if (!p || p.owner !== owner || !Number.isFinite(p.y) || !Number.isFinite(p.offset) || now - p.at > POSITION_TTL_MS) return null
    return p
  } catch { return null }
}

/** Gọi khi người dùng bấm quay lại (nút ‹ ở trang đọc, Back trong /me). */
export function requestResume(now = Date.now(), s: Store | null = store()) {
  try { s?.setItem(RESUME, String(now)) } catch { /* bỏ qua */ }
}

let navigationUsed = false
/** Trang vừa được mở bằng Back/Forward của trình duyệt (chỉ tính một lần cho mỗi lần tải trang). */
function cameBackByBrowser(): boolean {
  if (navigationUsed) return false
  navigationUsed = true
  try { return (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'back_forward' } catch { return false }
}

export function consumeResume(now = Date.now(), s: Store | null = store(), byBrowser: () => boolean = cameBackByBrowser): boolean {
  const back = byBrowser()
  let asked = false
  try {
    const at = Number(s?.getItem(RESUME))
    asked = at > 0 && now - at < RESUME_TTL_MS
    s?.removeItem(RESUME)
  } catch { /* bỏ qua */ }
  return asked || back
}

/** Mục đầu tiên còn nhìn thấy dưới thanh trên cùng. */
export function anchorIndex(bottoms: number[], topInset = 60): number {
  return bottoms.findIndex(b => b > topInset)
}
