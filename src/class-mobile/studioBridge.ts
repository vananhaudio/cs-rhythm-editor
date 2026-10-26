// Studio TeamLab trong Class Mobile (iOS) — phần THUẦN của cầu nối iframe ↔ Class (không DOM/mạng) để test được.
// TeamLab (bản đóng gói chung, cùng origin) nằm trong iframe; giao thức trùng với TeamLab `src/lib/classEmbed.ts`:
//   TeamLab → Class: { source:'teamlab-embed', type:'ready' | 'exit' | 'auth-required' | 'state', ownBack?: boolean }
//   Class → TeamLab: { source:'class-app', type:'back' }
export const STUDIO_PARAM = 'classapp'
export const FROM_STUDIO = 'teamlab-embed'
export const TO_STUDIO = 'class-app'
/** Quá hạn không thấy `ready` → báo lỗi + Thử lại (không quay tải mãi) */
export const STUDIO_READY_TIMEOUT_MS = 25000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Địa chỉ bản TeamLab đóng gói trong app: cùng origin → cùng phiên localStorage. Id lạ → mở danh sách (không ghép chuỗi tuỳ ý vào URL). */
export function studioSrc(projectId?: string | null): string {
  const hash = projectId && UUID_RE.test(projectId) ? `#/project/${encodeURIComponent(projectId)}` : ''
  return `/teamlab/index.html?${STUDIO_PARAM}=1${hash}`
}

export type StudioEvent =
  | { type: 'ready' }
  | { type: 'exit' }
  | { type: 'auth-required' }
  | { type: 'state'; ownBack: boolean }

/** Chỉ nhận tin nhắn từ ĐÚNG iframe Studio, cùng origin, đúng dạng. */
export function parseStudioMessage(ev: { origin: string; source: unknown; data: unknown }, frame: unknown, origin: string): StudioEvent | null {
  if (ev.origin !== origin || !frame || ev.source !== frame) return null
  const d = ev.data as { source?: unknown; type?: unknown; ownBack?: unknown } | null
  if (!d || d.source !== FROM_STUDIO) return null
  switch (d.type) {
    case 'ready': return { type: 'ready' }
    case 'exit': return { type: 'exit' }
    case 'auth-required': return { type: 'auth-required' }
    case 'state': return { type: 'state', ownBack: d.ownBack === true }
    default: return null
  }
}

export type StudioStatus = 'loading' | 'ready' | 'auth' | 'error' | 'offline'
export type StudioState = { status: StudioStatus; ownBack: boolean }
export const INITIAL_STUDIO: StudioState = { status: 'loading', ownBack: false }

/** Chuyển trạng thái theo tin nhắn. `exit` do khung xử lý (không đổi trạng thái ở đây). */
export function reduceStudio(s: StudioState, e: StudioEvent | { type: 'timeout' } | { type: 'retry' } | { type: 'offline' }): StudioState {
  switch (e.type) {
    case 'ready': return { ...s, status: 'ready' }
    case 'state': return { ...s, ownBack: e.ownBack }
    case 'auth-required': return { status: 'auth', ownBack: false }
    case 'timeout': return s.status === 'ready' ? s : { status: 'error', ownBack: false }
    case 'offline': return s.status === 'ready' ? s : { status: 'offline', ownBack: false }
    case 'retry': return INITIAL_STUDIO
    default: return s
  }
}

/** Nút Quay lại của KHUNG: hiện khi Studio chưa có nút riêng (hoặc đang tải/lỗi). Bấm: Studio sẵn sàng → nhờ Studio lùi một cấp; còn lại → thoát luôn. */
export const showShellBack = (s: StudioState): boolean => s.status !== 'ready' || !s.ownBack
export const backAction = (s: StudioState): 'ask-studio' | 'exit' => (s.status === 'ready' ? 'ask-studio' : 'exit')
