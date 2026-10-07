// Class Universal Share — dựng CARD của tin share từ object GỐC, theo LOẠI tham chiếu. Chat chỉ lưu tham chiếu; ở đây đọc object theo LÔ
// (một truy vấn mỗi loại mỗi nhịp, không N+1) qua RLS hiện có của chính object — KHÔNG RPC share nào được dùng để lách quyền.
// Không đọc được (đã xoá / không có quyền / dữ liệu hỏng) → null = "Nội dung này không còn khả dụng" (không phân biệt lý do).
// Card dùng lại ToolShareView + describeToolShare của Tool Share. supabase nạp ĐỘNG: component lá test được trên Node.
import { useEffect, useSyncExternalStore } from 'react'
import { BookOpen, GraduationCap } from 'lucide-react'
import { describeToolShare, type ToolShareView } from '../class-social/toolshare/registry'
import { classPath, sessionPath } from '../class-social/resolveMeRoute'
import { refId, type ShareRef, type ShareRefType } from './shareRef'

export const UNAVAILABLE_TEXT = 'Nội dung này không còn khả dụng'

// ── Artifact (BMS | Nhịp & Phách) ────────────────────────────────────────────
/** Hàng đọc từ tool_artifacts: chỉ các trường cần cho card — KHÔNG kéo lời bài hát / MusicXML */
export type ArtifactCardRow = {
  id: string; tool: string; kind: string; title: string | null
  video_id?: string | null; bpm?: string | number | null; ts?: string | number | null; chords?: unknown
  meter?: string | null; level?: string | null
}
export const ARTIFACT_CARD_SELECT = 'id,tool,kind,title,video_id:data->>video_id,bpm:data->fit->>bpm,ts:data->>time_signature,chords:data->chords,meter:data->>meter,level:data->settings->>countingLevel'

/** Hàng artifact → view card (THUẦN) theo tool. Tool/kind lạ hoặc dữ liệu không qua kiểm registry → null. */
export function artifactCardView(row: ArtifactCardRow | null | undefined): ToolShareView | null {
  if (!row) return null
  if (row.tool === 'bms' && row.kind === 'song') {
    const bpm = Math.round(Number(row.bpm)), beats = Number(row.ts)
    const names = new Set<string>()
    if (Array.isArray(row.chords)) for (const c of row.chords) { const n = (c as { name?: unknown })?.name; if (typeof n === 'string' && n) names.add(n) }
    return describeToolShare({
      v: 1, tool: 'bms', kind: 'song', artifact_id: row.id, title: row.title ?? '', video_id: row.video_id ?? '',
      bpm: Number.isFinite(bpm) ? bpm : null, beats_per_bar: Number.isFinite(beats) ? beats : null, chord_count: names.size,
    })
  }
  if (row.tool === 'nhipphach' && row.kind === 'score') {
    return describeToolShare({ v: 1, tool: 'nhipphach', kind: 'score', artifact_id: row.id, title: row.title ?? '', meter: row.meter ?? null, counting_level: row.level ?? '' })
  }
  return null
}
/** Tương thích Chat V1b */
export const bmsCardView = artifactCardView
export type BmsArtifactCardRow = ArtifactCardRow

// ── Lớp học / Buổi học: tham chiếu thuần; metadata công khai (tên lớp, số buổi) — nội dung do trang đích + RLS quyết ──
export type ClassCardRow = { id: string; name: string | null; code?: string | null }
export type SessionCardRow = { id: string; class_id: string; session_number: number | string | null; title: string | null; event_type: string | null }

export function classCardView(row: ClassCardRow | null | undefined): ToolShareView | null {
  const name = (row?.name ?? '').trim()
  if (!row || !name || name.length > 200) return null
  return {
    tool: 'class', toolLabel: 'Lớp học', icon: GraduationCap, kindLabel: 'Lớp', headline: name, detail: row.code?.trim() || null,
    thumbnail: null, note: null, action: { label: 'Mở lớp', href: classPath(row.id) },
  }
}

export function sessionCardView(row: SessionCardRow | null | undefined, className: string | null | undefined): ToolShareView | null {
  const n = Number(row?.session_number)
  if (!row || row.event_type !== 'lesson' || !Number.isInteger(n) || n < 0 || n > 9999) return null
  const cname = (className ?? '').trim()
  const title = (row.title ?? '').trim()
  return {
    tool: 'class_session', toolLabel: 'Buổi học', icon: BookOpen, kindLabel: cname || 'Lớp học', headline: title || `Buổi ${n}`,
    detail: title ? `Buổi ${n}` : null, thumbnail: null, note: null, action: { label: 'Mở buổi học', href: sessionPath(row.class_id, n) },
  }
}

// ── Resolver theo loại: keys[] → Map<key, view | null>. Lỗi mạng ném ra (KHÔNG coi là "đã xoá") ───────────────
type Resolver = (keys: string[]) => Promise<Map<string, ToolShareView | null>>
type Db = { from: (t: string) => { select: (c: string) => { in: (col: string, v: string[]) => PromiseLike<{ data: unknown[] | null; error: { code?: string; message?: string } | null }> } } }
const db = async (): Promise<Db> => (await import('../supabase')).supabase as unknown as Db

async function fetchRows<T>(table: string, cols: string, ids: string[]): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const { data, error } = await (await db()).from(table).select(cols).in('id', ids.slice(i, i + 50))
    if (error) { if (import.meta.env.DEV) console.warn('[share] card', table, error.code, error.message); throw new Error(error.message ?? 'card') }
    out.push(...((data ?? []) as T[]))
  }
  return out
}

export const REF_RESOLVERS: Record<ShareRefType, Resolver> = {
  tool_artifact: async keys => {
    const m = new Map<string, ToolShareView | null>(keys.map(k => [k, null]))
    for (const r of await fetchRows<ArtifactCardRow>('tool_artifacts', ARTIFACT_CARD_SELECT, keys)) m.set(r.id.toLowerCase(), artifactCardView(r))
    return m
  },
  class: async keys => {
    const m = new Map<string, ToolShareView | null>(keys.map(k => [k, null]))
    for (const r of await fetchRows<ClassCardRow>('class_schedule', 'id,name,code', keys)) m.set(r.id.toLowerCase(), classCardView(r))
    return m
  },
  class_session: async keys => {
    const m = new Map<string, ToolShareView | null>(keys.map(k => [k, null]))
    const rows = await fetchRows<SessionCardRow>('class_sessions', 'id,class_id,session_number,title,event_type', keys)
    const names = new Map<string, string>()
    for (const c of await fetchRows<ClassCardRow>('class_schedule', 'id,name', [...new Set(rows.map(r => r.class_id))])) names.set(c.id.toLowerCase(), c.name ?? '')
    for (const r of rows) m.set(r.id.toLowerCase(), sessionCardView(r, names.get(r.class_id.toLowerCase())))
    return m
  },
}

// ── Cache ngắn + gom lô (card luôn phản ánh object hiện tại; mở lại hội thoại sau 60 s thì đọc mới) ──
const TTL_MS = 60_000
type Entry = { at: number; view: ToolShareView | null }
const cache = new Map<string, Entry>()
const pending = new Map<string, ShareRef>()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null
let version = 0

async function flush() {
  timer = null
  const batch = [...pending.values()]; pending.clear()
  const byType = new Map<ShareRefType, string[]>()
  for (const r of batch) byType.set(r.type, [...(byType.get(r.type) ?? []), r.key])
  await Promise.all([...byType].map(async ([type, keys]) => {
    try {
      const got = await REF_RESOLVERS[type](keys)
      for (const k of keys) cache.set(refId({ type, key: k }), { at: Date.now(), view: got.get(k) ?? null })
    } catch { /* lỗi mạng: KHÔNG ghi cache, lần sau đọc lại */ }
  }))
  version++
  listeners.forEach(l => l())
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const snapshot = () => version

/** undefined = đang tải · null = không khả dụng · ToolShareView = hiển thị được */
export function useSharedRefView(ref: ShareRef): ToolShareView | null | undefined {
  const v = useSyncExternalStore(subscribe, snapshot, () => 0)
  const id = refId(ref)
  const { type, key } = ref
  useEffect(() => {
    const hit = cache.get(id)
    if ((hit && Date.now() - hit.at < TTL_MS) || pending.has(id)) return
    pending.set(id, { type, key })
    if (!timer) timer = setTimeout(() => void flush(), 0)
  }, [id, type, key, v])
  const hit = cache.get(id)
  return hit ? hit.view : undefined
}

/** Chỉ cho test: xoá cache */
export function _resetShareCardCache() { cache.clear(); pending.clear(); version++ }
