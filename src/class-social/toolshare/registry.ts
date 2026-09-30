// TOOL SHARE V1 — DANH SÁCH CÔNG CỤ chia sẻ được lên Feed (THUẦN, test được). Mỗi công cụ tự khai báo:
// nhãn · icon · đọc + kiểm payload (không tin dữ liệu lạ) · dòng tóm tắt · hành động "thử lại" (deep link đã kiểm).
// Feed/PostCard chỉ gọi describeToolShare() — không if/else theo từng công cụ. Server kiểm lại payload khi ghi
// (db/social_tool_share_v1_setup.sql). Thêm BMS / Nhịp & Phách / Ban nhạc = thêm MỘT mục ở đây + một nhánh ở RPC.
import type { LucideIcon } from 'lucide-react'
import { Timer } from 'lucide-react'

export type ToolShareView = {
  tool: string
  toolLabel: string           // "Metronome"
  icon: LucideIcon
  kindLabel: string           // "Luyện tập"
  headline: string            // "80 BPM · 10 phút"
  note: string | null         // "Hoàn thành một phiên luyện tập"
  action: { label: string; href: string } | null   // "Thử ở 80 BPM" → /metronome?tempo=80
}

type ToolDef = { describe: (raw: Record<string, unknown>) => ToolShareView | null }

export const METRONOME_MIN_BPM = 30
export const METRONOME_MAX_BPM = 260
export const MIN_SHARE_SECONDS = 60

const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null)

/** Deep link /metronome?tempo=N — chỉ nhận số nguyên thuần trong dải Metronome; sai → null (Metronome dùng mặc định). */
export function parseMetronomeTempo(search: string): number | null {
  const p = new URLSearchParams(search).get('tempo')
  if (!p || !/^[0-9]{1,3}$/.test(p)) return null
  const n = Number(p)
  return n >= METRONOME_MIN_BPM && n <= METRONOME_MAX_BPM ? n : null
}

/** "10 phút" · "1 giờ 5 phút" — chỉ từ số giây đo thật. */
export function formatPracticeDuration(seconds: number): string {
  const m = Math.max(1, Math.floor(seconds / 60))
  if (m < 60) return `${m} phút`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h} giờ ${r} phút` : `${h} giờ`
}

export const TOOL_REGISTRY: Record<string, ToolDef> = {
  metronome: {
    describe: raw => {
      const bpm = int(raw.bpm), seconds = int(raw.seconds)
      if (raw.kind !== 'practice_session' || bpm === null || seconds === null) return null
      if (bpm < METRONOME_MIN_BPM || bpm > METRONOME_MAX_BPM || seconds < MIN_SHARE_SECONDS) return null
      return {
        tool: 'metronome', toolLabel: 'Metronome', icon: Timer, kindLabel: 'Luyện tập',
        headline: `${bpm} BPM · ${formatPracticeDuration(seconds)}`,
        note: 'Hoàn thành một phiên luyện tập',
        action: { label: `Thử ở ${bpm} BPM`, href: `/metronome?tempo=${bpm}` },
      }
    },
  },
}

/** Payload (jsonb tool_share) → cách hiển thị; công cụ lạ / payload hỏng → null (card hiện nhẹ, không lỗi). */
export function describeToolShare(raw: unknown): ToolShareView | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const def = typeof o.tool === 'string' && Object.hasOwn(TOOL_REGISTRY, o.tool) ? TOOL_REGISTRY[o.tool] : undefined
  if (!def || typeof o.v !== 'number' || o.v < 1) return null
  return def.describe(o)
}
