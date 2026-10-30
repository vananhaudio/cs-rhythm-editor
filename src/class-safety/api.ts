// Class UGC Safety V1 — gọi RPC theo hợp đồng docs/CLASS-UGC-SAFETY-V1.md. Server tự lấy auth.uid(); client không ghi bảng trực tiếp.
import { supabase } from '../supabase'
import {
  cleanNote, parseUgcStatus, safetyErrorText, validateReport,
  type ReportInput, type ResolveAction, type UgcStatus,
} from './model'

export type Result<T> = { ok: true; value: T } | { ok: false; message: string }

const offline = () => (typeof navigator === 'undefined' ? false : navigator.onLine === false)

async function call<T>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  try {
    const { data, error, status } = await supabase.rpc(fn, args)
    if (error) {
      if (import.meta.env.DEV) console.warn(`[class-safety] ${fn}:`, error.code, error.message)
      return { ok: false, message: safetyErrorText({ ...error, status }, offline()) }
    }
    return { ok: true, value: data as T }
  } catch (e) {
    return { ok: false, message: safetyErrorText(e as Error, offline()) }
  }
}

export async function submitReport(i: ReportInput): Promise<Result<number | null>> {
  const bad = validateReport(i)
  if (bad) return { ok: false, message: bad }
  const r = i.via === 'feed_comment'
    ? await call<number | string | null>('feed_comment_report', { p_comment: i.targetId, p_reason: i.reason, p_note: cleanNote(i.note) })
    : await call<number | string | null>('class_report_submit', {
      p_kind: i.kind, p_target_id: i.targetId, p_reason: i.reason, p_note: cleanNote(i.note),
    })
  return r.ok ? { ok: true, value: r.value == null ? null : Number(r.value) } : r
}

export async function blockUser(userId: string): Promise<Result<null>> {
  const r = await call<unknown>('class_block_user', { p_user_id: userId })
  return r.ok ? { ok: true, value: null } : r
}

export async function unblockUser(userId: string): Promise<Result<null>> {
  const r = await call<unknown>('class_unblock_user', { p_user_id: userId })
  return r.ok ? { ok: true, value: null } : r
}

export type BlockedUser = { userId: string; name: string; avatarUrl: string | null; createdAt: string }
type BlockRow = { user_id: string; name: string | null; avatar_url: string | null; created_at: string }

export async function fetchMyBlocks(): Promise<Result<BlockedUser[]>> {
  const r = await call<BlockRow[] | null>('class_my_blocks', {})
  if (!r.ok) return r
  return {
    ok: true,
    value: (r.value ?? []).filter(x => x?.user_id).map(x => ({
      userId: x.user_id, name: (x.name ?? '').trim() || 'Thành viên', avatarUrl: x.avatar_url ?? null, createdAt: x.created_at,
    })),
  }
}

export async function fetchUgcStatus(): Promise<Result<UgcStatus>> {
  const r = await call<unknown>('class_ugc_status', {})
  if (!r.ok) return r
  const s = parseUgcStatus(r.value)
  return s ? { ok: true, value: s } : { ok: false, message: 'Chưa kiểm tra được quy tắc cộng đồng. Hãy thử lại.' }
}

export async function acceptUgc(version: number): Promise<Result<null>> {
  const r = await call<unknown>('class_ugc_accept', { p_version: version })
  return r.ok ? { ok: true, value: null } : r
}

// ── Thầy: xử lý báo cáo Class ──
export type ClassReport = {
  id: number; kind: string; targetId: string; targetUserId: string | null; targetUserName: string | null
  reporterName: string | null; reason: string; note: string | null; status: string
  createdAt: string; handledAt: string | null; handledAction: string | null; excerpt: string | null
}
type ReportRow = {
  id: number | string; kind: string; target_id: string; target_user_id: string | null; target_user_name: string | null
  reporter_name: string | null; reason: string; note: string | null; status: string
  created_at: string; handled_at: string | null; handled_action: string | null; excerpt: string | null
}

export async function listClassReports(status: 'new' | 'handled' | 'dismissed' | 'all'): Promise<Result<ClassReport[]>> {
  const r = await call<ReportRow[] | null>('class_reports_list', { p_status: status, p_limit: 100 })
  if (!r.ok) return r
  return {
    ok: true,
    value: (r.value ?? []).map(x => ({
      id: Number(x.id), kind: x.kind, targetId: x.target_id, targetUserId: x.target_user_id, targetUserName: x.target_user_name,
      reporterName: x.reporter_name, reason: x.reason, note: x.note, status: x.status, createdAt: x.created_at,
      handledAt: x.handled_at, handledAction: x.handled_action, excerpt: x.excerpt,
    })),
  }
}

export async function resolveClassReport(id: number, action: ResolveAction, note?: string): Promise<Result<null>> {
  const r = await call<unknown>('class_report_resolve', { p_id: id, p_action: action, p_note: note?.trim() || null })
  return r.ok ? { ok: true, value: null } : r
}
