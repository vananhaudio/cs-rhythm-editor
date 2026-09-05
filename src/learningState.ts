// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL LEARNING STATE — client của RPC my_learning_state() (db/learning_state_setup.sql)
//
// NGUỒN SỰ THẬT DUY NHẤT về quyền học: server quyết định course/bài nào hiện,
// mở, khoá, vì sao. Client CHỈ RENDER kết quả này.
//
// RULE (docs/SERVER_DRIVEN_ARCHITECTURE.md): client MUST NOT tự suy luận quyền
// từ enrollment/packages/policy. Muốn đổi luật quyền → sửa RPC, không sửa app.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase'

export type SrvAccess = 'open' | 'upgrade' | 'coming_soon' | 'hidden' | 'prereq'

export type SrvLesson = {
  id: string; module_id: string; title: string; order_index: number
  lesson_type: string | null; content_url: string | null
  visible: boolean; access: SrvAccess; completed: boolean
  free?: boolean          // chương free / bài free / khoá free — chỉ để UI badge "MIỄN PHÍ"
}
export type SrvModule = { id: string; name: string; order_index: number; level: number | null; is_free?: boolean }
export type SrvCourse = {
  id: string; name: string; code: string | null; track: string | null; type: string
  icon: string | null; image_url: string | null; sort_order: number | null
  status: string | null; is_free: boolean | null
  subject: string | null; level: number | null; journey_order: number | null
  enrolled: boolean; granted: boolean; source: string
  visible: boolean; access: SrvAccess; missing_prereqs: string[]; completed: boolean
  modules: SrvModule[]; lessons: SrvLesson[]
}
export type LearningState = {
  enabled: boolean
  mode: 'guest' | 'student' | 'teacher'
  student_id: string | null
  effective_tier: 'free' | 'khoi_dau_99' | 'can_ban_396' | 'nang_cao_499'
  ht_member: boolean
  tracks: { key: string; title: string; hint: string }[]
  courses: SrvCourse[]
  completed_lesson_ids: string[]
  flags: { tools: Record<string, boolean> }
  valid_until?: string | null
  generated_at: string
}

const CACHE_KEY = 'tva_learning_state_v1'
export const LEARNING_STATE_TTL_MS = 5 * 60 * 1000

type CacheShape = { state: LearningState; userKey: string; at: number }

function readCache(userKey: string): LearningState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as CacheShape
    return c.userKey === userKey && c.state?.courses && Date.now()-c.at<LEARNING_STATE_TTL_MS && (!c.state.valid_until || Date.parse(c.state.valid_until)>Date.now()) ? c.state : null
  } catch { return null }
}

// Fetch canonical state. userKey phân biệt cache theo user (guest = 'guest').
// Trả null khi RPC lỗi hoặc server tắt chế độ ('learning_state_mode' != 'server')
// → caller dùng đường legacy. KHÔNG dùng cache thay cho quyết định enable/disable.
export async function fetchLearningState(userKey: string): Promise<LearningState | null> {
  const { data, error } = await supabase.rpc('my_learning_state')
  if (error || !data || typeof data !== 'object') {
    if (error) console.warn('[learningState] RPC lỗi → fallback legacy:', error.message)
    return null
  }
  const state = data as LearningState
  if (!state.enabled) return null
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ state, userKey, at: Date.now() } satisfies CacheShape)) } catch { /* quota */ }
  return state
}

// Cache gần nhất (chỉ để không trắng màn hình khi mạng yếu — quyền vẫn do lần fetch mới quyết)
export function cachedLearningState(userKey: string): LearningState | null {
  return readCache(userKey)
}
