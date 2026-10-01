// TOOL SHARE V1 — DANH SÁCH CÔNG CỤ chia sẻ được lên Feed (THUẦN, test được). Mỗi công cụ tự khai báo:
// nhãn · icon · đọc + kiểm payload (không tin dữ liệu lạ) · dòng tóm tắt · hành động "thử lại" (deep link đã kiểm).
// Feed/PostCard chỉ gọi describeToolShare() — không if/else theo từng công cụ. Server kiểm lại payload khi ghi
// (db/social_tool_share_v1_setup.sql). Thêm BMS / Nhịp & Phách / Ban nhạc = thêm MỘT mục ở đây + một nhánh ở RPC.
import type { LucideIcon } from 'lucide-react'
import { ListMusic, Music4, Timer } from 'lucide-react'

export type ToolShareView = {
  tool: string
  toolLabel: string           // "Metronome"
  icon: LucideIcon
  kindLabel: string           // "Luyện tập"
  headline: string            // "80 BPM · 10 phút" · tên bài (BMS)
  detail?: string | null      // BMS: "76 BPM · 4/4 · 3 hợp âm"
  thumbnail?: string | null   // BMS: ảnh YouTube dựng từ video id đã kiểm (không nhận URL tuỳ ý)
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/

/** BMS: bài đã dựng được chia sẻ → artifact (tool_artifacts). Payload Feed CHỈ có tham chiếu + tóm tắt. */
TOOL_REGISTRY.bms = {
  describe: raw => {
    const bpm = int(raw.bpm), beats = int(raw.beats_per_bar), chordCount = int(raw.chord_count)
    const id = raw.artifact_id, vid = raw.video_id, title = raw.title
    if (raw.kind !== 'song' || typeof id !== 'string' || !UUID_RE.test(id) || typeof vid !== 'string' || !YT_ID_RE.test(vid)) return null
    if (typeof title !== 'string' || !title.trim() || title.length > 120) return null
    if (bpm === null || bpm < METRONOME_MIN_BPM || bpm > METRONOME_MAX_BPM || beats === null || beats < 2 || beats > 12 || chordCount === null || chordCount < 0) return null
    return {
      tool: 'bms', toolLabel: 'BMS', icon: Music4, kindLabel: 'Dựng bài hát',
      headline: title.trim(),
      detail: [`${bpm} BPM`, `${beats}/4`, chordCount > 0 ? `${chordCount} hợp âm` : null].filter(Boolean).join(' · '),
      thumbnail: `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`,
      note: null,
      action: { label: 'Luyện bài này', href: `/song-builder?artifact=${id.toLowerCase()}` },
    }
  },
}

/** Nhịp & Phách: bản nhạc đã đánh số phách → artifact (MusicXML + thiết lập). Feed chỉ có tham chiếu + tóm tắt thật. */
export const COUNTING_LEVEL_LABEL: Record<string, string> = { beats: 'Đếm phách', eighths: 'Chia đôi', sixteenths: 'Chia tư' }
const METER_RE = /^[0-9]{1,2}(\+[0-9]{1,2}){0,5}\/[0-9]{1,2}$/
TOOL_REGISTRY.nhipphach = {
  describe: raw => {
    const id = raw.artifact_id, title = raw.title, meter = raw.meter, level = raw.counting_level
    if (raw.kind !== 'score' || typeof id !== 'string' || !UUID_RE.test(id)) return null
    if (typeof title !== 'string' || !title.trim() || title.length > 120) return null
    if (meter != null && (typeof meter !== 'string' || !METER_RE.test(meter))) return null
    if (typeof level !== 'string' || !Object.hasOwn(COUNTING_LEVEL_LABEL, level)) return null
    return {
      tool: 'nhipphach', toolLabel: 'Nhịp & Phách', icon: ListMusic, kindLabel: 'Bản nhạc',
      headline: title.trim(),
      detail: [typeof meter === 'string' ? `Nhịp ${meter}` : null, COUNTING_LEVEL_LABEL[level]].filter(Boolean).join(' · '),
      thumbnail: null, note: null,
      action: { label: 'Xem bản nhạc', href: `/nhipphach?artifact=${id.toLowerCase()}` },
    }
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
