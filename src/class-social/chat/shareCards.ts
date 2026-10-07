// Chat V1b — dựng card của tin share từ object GỐC (BMS artifact). Chat chỉ lưu tham chiếu; ở đây đọc object theo LÔ qua
// RLS hiện có của tool_artifacts (không RPC share nào được dùng để "lách" quyền). Không đọc được (đã xoá / không có quyền /
// dữ liệu hỏng) → null = "Nội dung này không còn khả dụng". Dùng lại describeToolShare (registry Tool Share) cho tiêu đề/ảnh/link.
// supabase nạp ĐỘNG: component lá test được trên Node.
import { useEffect, useSyncExternalStore } from 'react'
import { describeToolShare, type ToolShareView } from '../toolshare/registry'

/** Hàng đọc từ tool_artifacts (chỉ các trường cần cho card — KHÔNG kéo lời bài hát) */
export type BmsArtifactCardRow = {
  id: string; tool: string; kind: string; title: string | null
  video_id: string | null; bpm: string | number | null; ts: string | number | null; chords: unknown
}

export const ARTIFACT_CARD_SELECT = 'id,tool,kind,title,video_id:data->>video_id,bpm:data->fit->>bpm,ts:data->>time_signature,chords:data->chords'
export const UNAVAILABLE_TEXT = 'Nội dung này không còn khả dụng'

/** Hàng artifact → view card (THUẦN). Hàng không phải BMS song hoặc dữ liệu không qua kiểm registry → null. */
export function bmsCardView(row: BmsArtifactCardRow | null | undefined): ToolShareView | null {
  if (!row || row.tool !== 'bms' || row.kind !== 'song') return null
  const bpm = Math.round(Number(row.bpm)), beats = Number(row.ts)
  const names = new Set<string>()
  if (Array.isArray(row.chords)) for (const c of row.chords) { const n = (c as { name?: unknown })?.name; if (typeof n === 'string' && n) names.add(n) }
  return describeToolShare({
    v: 1, tool: 'bms', kind: 'song', artifact_id: row.id, title: row.title ?? '', video_id: row.video_id ?? '',
    bpm: Number.isFinite(bpm) ? bpm : null, beats_per_bar: Number.isFinite(beats) ? beats : null, chord_count: names.size,
  })
}

// ── Đọc theo LÔ + cache ngắn (card luôn phản ánh object hiện tại; mở lại hội thoại sau 60 s thì đọc mới) ──
const TTL_MS = 60_000
type Entry = { at: number; view: ToolShareView | null }
const cache = new Map<string, Entry>()
const pending = new Set<string>()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null
let version = 0

async function flush() {
  timer = null
  const ids = [...pending]; pending.clear()
  const got = new Map<string, Entry>()
  try {
    const { supabase } = await import('../../supabase')
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50)
      const { data, error } = await supabase.from('tool_artifacts').select(ARTIFACT_CARD_SELECT).in('id', chunk)
      if (error && import.meta.env.DEV) console.warn('[class-chat] share card:', error.code, error.message)
      // Lỗi mạng ≠ "đã xoá": lỗi thì KHÔNG ghi cache để lần sau đọc lại
      if (error) continue
      for (const r of (data ?? []) as BmsArtifactCardRow[]) got.set(r.id.toLowerCase(), { at: Date.now(), view: bmsCardView(r) })
      for (const id of chunk) if (!got.has(id)) got.set(id, { at: Date.now(), view: null })
    }
  } catch { /* mạng: để lần sau */ }
  for (const [id, e] of got) cache.set(id, e)
  version++
  listeners.forEach(l => l())
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const snapshot = () => version

/** undefined = đang tải · null = không khả dụng · ToolShareView = hiển thị được */
export function useSharedArtifactView(key: string): ToolShareView | null | undefined {
  const v = useSyncExternalStore(subscribe, snapshot, () => 0)
  useEffect(() => {
    const hit = cache.get(key)
    if ((hit && Date.now() - hit.at < TTL_MS) || pending.has(key)) return
    pending.add(key)
    if (!timer) timer = setTimeout(() => void flush(), 0)
  }, [key, v])
  const hit = cache.get(key)
  return hit ? hit.view : undefined
}

/** Chỉ cho test: xoá cache */
export function _resetShareCardCache() { cache.clear(); pending.clear(); version++ }
