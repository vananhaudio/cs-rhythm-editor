// "Hỏi Mira" — gọi Edge Function mira-student-chat bằng JWT của chính học viên (supabase-js tự gắn). Mira CHỈ ĐỌC, không lưu lịch sử.
// Cờ build VITE_MIRA_STUDENT_ENABLED=1 mới có mục Mira; mặc định TẮT (không gọi mạng, không hiện gì). Pilot do server quyết (mira_student_pilot_enabled).
import { useEffect, useState } from 'react'

/** Đường truyền: mặc định tải supabase lười (chỉ khi cờ bật); kiểm thử thay bằng giả. */
export interface MiraTransport {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
  invoke: (fn: string, body: unknown) => Promise<{ data: unknown; error: unknown }>
}
let transport: MiraTransport = {
  rpc: async (fn, args) => (await import('../../supabase')).supabase.rpc(fn, args),
  invoke: async (fn, body) => (await import('../../supabase')).supabase.functions.invoke(fn, { body: body as Record<string, unknown> }),
}
export function setMiraTransport(t: MiraTransport) { transport = t }

export const MIRA_CONVERSATION_ID = 'mira'
export const MIRA_NAME = 'Mira'
export const MIRA_MAX_CHARS = 1200
export const buildEnabled = (): boolean => import.meta.env?.VITE_MIRA_STUDENT_ENABLED === '1'
/** Cờ build "xem trước": chỉ để admin THẤY mục Mira ở trạng thái "đang chuẩn bị" (không có AI, không gọi mạng). Độc lập với buildEnabled. */
export const previewBuild = (): boolean => import.meta.env?.VITE_MIRA_STUDENT_PREVIEW === '1'
/** Quyền HIỂN THỊ (không phải quyền gọi AI): cờ build xem trước VÀ tài khoản là admin (app_users.role='admin' từ phiên đăng nhập hiện có). Mọi giá trị khác → false. */
export const miraPreviewVisible = (build: boolean, isAdmin: boolean | undefined): boolean => build === true && isAdmin === true

export interface MiraAction { label: string; path: string }
export interface MiraReply {
  status: 'ok' | 'rate_limit' | 'forbidden' | 'consent_required' | 'unauthorized' | 'bad_request' | 'context_unavailable' | 'model_error' | 'wrong_user' | 'disabled' | 'network'
  reply: string
  actions: MiraAction[]
  ctxFp: string
}
export interface MiraTurn { role: 'user' | 'assistant'; text: string }

export async function fetchMiraPilot(): Promise<boolean> {
  if (!buildEnabled()) return false
  try {
    const { data, error } = await transport.rpc('mira_student_pilot_enabled')
    return !error && data === true
  } catch { return false }
}

export async function askMira(args: { message: string; history: MiraTurn[]; historyFp: string }): Promise<MiraReply> {
  const fail = (status: MiraReply['status'], reply = ''): MiraReply => ({ status, reply, actions: [], ctxFp: '' })
  try {
    const { data, error } = await transport.invoke('mira-student-chat', { message: args.message, history: args.history, history_fp: args.historyFp })
    let j = data as Partial<{ status: MiraReply['status']; reply: string; actions: MiraAction[]; ctx_fp: string }> | null
    if (error) {
      // supabase-js ném FunctionsHttpError cho 4xx/5xx; thân JSON nằm trong error.context (Response)
      const ctx = (error as { context?: unknown }).context
      if (ctx instanceof Response) { try { j = await ctx.clone().json() } catch { j = null } }
      if (!j?.status) return fail('network')
    }
    if (!j || typeof j.status !== 'string') return fail('network')
    const actions = Array.isArray(j.actions) ? j.actions.filter((a): a is MiraAction => !!a && typeof a.label === 'string' && /^\/me\/classes\/[0-9a-f-]{36}$/i.test(a.path ?? '')) : []
    return { status: j.status, reply: typeof j.reply === 'string' ? j.reply : '', actions, ctxFp: typeof j.ctx_fp === 'string' ? j.ctx_fp : '' }
  } catch { return fail('network') }
}

let pilotCache: Promise<boolean> | null = null
/** Mục Mira có hiện không: cờ build + pilot do server quyết. Chưa biết/lỗi/không được → false (DOM y như cũ). */
export function useMiraEnabled(allow = true): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!buildEnabled() || !allow) return
    let live = true
    pilotCache ??= fetchMiraPilot()
    void pilotCache.then(v => { if (live) setOn(v) })
    return () => { live = false }
  }, [allow])
  return on
}
export function resetMiraPilotCache() { pilotCache = null }

// ── Đồng ý tham gia (V1.1). Mọi quyết định do SERVER: nội dung/phiên bản/trạng thái lấy từ ai_consent_status; client chỉ gửi "đồng ý phiên bản N" hoặc "rút lại". ──
export type MiraConsentState = 'none' | 'granted' | 'withdrawn' | 'outdated' | 'unavailable'
export interface MiraNotice { version: number; title: string; body: string; scope: string[] }
export interface MiraConsent { state: MiraConsentState; notice: MiraNotice | null }
const STATES: readonly string[] = ['none', 'granted', 'withdrawn', 'outdated', 'unavailable']
const FEATURE = 'mira_student'

function parseConsent(data: unknown): MiraConsent | null {
  if (!data || typeof data !== 'object') return null
  const d = data as { state?: unknown; notice?: unknown }
  if (typeof d.state !== 'string' || !STATES.includes(d.state)) return null
  let notice: MiraNotice | null = null
  const n = d.notice as Partial<MiraNotice> | null | undefined
  if (n && typeof n === 'object' && typeof n.version === 'number' && typeof n.title === 'string' && typeof n.body === 'string') {
    notice = { version: n.version, title: n.title, body: n.body, scope: Array.isArray(n.scope) ? n.scope.filter((x): x is string => typeof x === 'string') : [] }
  }
  return { state: d.state as MiraConsentState, notice }
}
/** null = lỗi mạng/định dạng lạ (giao diện coi như CHƯA có đồng ý và cho thử lại; KHÔNG BAO GIỜ suy ra "đã đồng ý" từ lỗi) */
export async function fetchMiraConsent(): Promise<MiraConsent | null> {
  try { const { data, error } = await transport.rpc('ai_consent_status', { p_feature: FEATURE }); return error ? null : parseConsent(data) } catch { return null }
}
export async function grantMiraConsent(version: number): Promise<MiraConsent | null> {
  try { const { data, error } = await transport.rpc('ai_consent_grant', { p_feature: FEATURE, p_version: version }); return error ? null : parseConsent(data) } catch { return null }
}
/** true khi server xác nhận đã rút lại (hoặc vốn chưa đồng ý) */
export async function withdrawMiraConsent(): Promise<boolean> {
  try { const { data, error } = await transport.rpc('ai_consent_withdraw', { p_feature: FEATURE }); return !error && !!data && typeof data === 'object' && ['withdrawn', 'none'].includes((data as { state?: string }).state ?? '') } catch { return false }
}
