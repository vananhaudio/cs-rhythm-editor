// ============================================================
// Song Builder — lưu nháp nhiều bài (local-first).
// Bọc localStorage sau một service nhỏ để sau này đổi sang
// IndexedDB / server mà không phải sửa UI.
// ============================================================
import type { TempoFit } from './tempoFit'
import type { Anchor, SongChord } from './songBuilder'

export interface SongDraft {
  id: string
  title: string
  youtubeUrl: string
  videoId: string | null
  thumbnail: string | null
  lyricsText: string
  fit: TempoFit | null          // chứa bpm, beatDuration, gridOffset
  timeSignature: number         // beatsPerBar
  downbeatPosition: number      // strongBeatRemainder = downbeatPosition - 1
  groupBeats: boolean | null
  anchors: Anchor[]
  chords?: SongChord[]          // hợp âm gán theo từ (tùy chọn — tương thích bài cũ)
  step: number                  // currentStep
  createdAt: number
  updatedAt: number
}

export interface DraftSummary {
  id: string
  title: string
  youtubeUrl: string
  thumbnail: string | null
  updatedAt: number
  progressPercent: number
}

const STORE_KEY = 'csre-sb-drafts-v1'
const CURRENT_KEY = 'csre-sb-current-id'
const LEGACY_KEY = 'csre-song-builder-draft-v1'
const TOTAL_STEPS = 6

type DraftMap = Record<string, SongDraft>

function readMap(): DraftMap {
  try {
    const r = localStorage.getItem(STORE_KEY)
    const m = r ? JSON.parse(r) as DraftMap : {}
    return m && typeof m === 'object' ? m : {}
  } catch { return {} }
}
function writeMap(m: DraftMap) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(m)) } catch { /* sandbox / quota */ }
}

export function newDraftId(): string {
  return 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// Tính % hoàn thành dựa trên các mốc đã đạt (không chỉ theo bước).
export function progressOf(d: SongDraft): number {
  let done = 0
  if (d.videoId) done++              // đã có video
  if (d.lyricsText.trim()) done++    // đã có lời
  if (d.fit?.ok) done++              // đã bắt được nhịp
  if (d.anchors.length > 0) done++   // đã gắn mốc
  if (d.groupBeats !== null) done++  // đã chọn nhịp
  return Math.round((done / 5) * 100)
}

// Một draft "có nội dung" mới đáng lưu / hiển thị.
export function hasContent(d: SongDraft): boolean {
  return !!(d.videoId || d.lyricsText.trim() || d.anchors.length || d.fit)
}

export function saveDraft(draft: SongDraft): SongDraft {
  const m = readMap()
  const saved: SongDraft = { ...draft, updatedAt: Date.now() }
  m[saved.id] = saved
  writeMap(m)
  return saved
}

export function loadDraft(id: string): SongDraft | null {
  return readMap()[id] ?? null
}

export function listDrafts(): DraftSummary[] {
  const m = readMap()
  return Object.values(m)
    .filter(hasContent)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(d => ({
      id: d.id,
      title: d.title || 'Bài chưa đặt tên',
      youtubeUrl: d.youtubeUrl,
      thumbnail: d.thumbnail,
      updatedAt: d.updatedAt,
      progressPercent: progressOf(d),
    }))
}

export function deleteDraft(id: string) {
  const m = readMap()
  delete m[id]
  writeMap(m)
  if (getCurrentId() === id) clearCurrentId()
}

export function renameDraft(id: string, title: string): SongDraft | null {
  const m = readMap()
  const d = m[id]
  if (!d) return null
  d.title = title
  d.updatedAt = Date.now()
  writeMap(m)
  return d
}

export function duplicateDraft(id: string): SongDraft | null {
  const src = loadDraft(id)
  if (!src) return null
  const now = Date.now()
  const copy: SongDraft = {
    ...src,
    id: newDraftId(),
    title: (src.title || 'Bài chưa đặt tên') + ' (bản sao)',
    createdAt: now,
    updatedAt: now,
  }
  const m = readMap()
  m[copy.id] = copy
  writeMap(m)
  return copy
}

export function getLatestDraft(): SongDraft | null {
  const m = readMap()
  const list = Object.values(m).filter(hasContent).sort((a, b) => b.updatedAt - a.updatedAt)
  return list[0] ?? null
}

// Lưu draft đang làm + ghi nhớ nó là draft hiện tại.
export function autosaveCurrentDraft(draft: SongDraft): SongDraft {
  const saved = saveDraft(draft)
  setCurrentId(saved.id)
  return saved
}

export function getCurrentId(): string | null {
  try { return localStorage.getItem(CURRENT_KEY) } catch { return null }
}
export function setCurrentId(id: string) {
  try { localStorage.setItem(CURRENT_KEY, id) } catch { /* sandbox */ }
}
export function clearCurrentId() {
  try { localStorage.removeItem(CURRENT_KEY) } catch { /* sandbox */ }
}

// ── Xuất / Nhập file .bms (chia sẻ bài, local-first) ──
export function serializeDraft(d: SongDraft): string {
  return JSON.stringify(d, null, 2)
}

/** Nhập 1 file .bms (JSON) → lưu thành bài MỚI (id mới, không đè bài cũ). */
export function importDraftJSON(text: string): SongDraft | null {
  try {
    const o = JSON.parse(text) as Partial<SongDraft>
    if (typeof o.lyricsText !== 'string' && !o.videoId && !Array.isArray(o.anchors)) return null
    const now = Date.now()
    const d: SongDraft = {
      id: newDraftId(),
      title: o.title || 'Bài nhập',
      youtubeUrl: o.youtubeUrl ?? '',
      videoId: o.videoId ?? null,
      thumbnail: o.thumbnail ?? null,
      lyricsText: o.lyricsText ?? '',
      fit: o.fit ?? null,
      timeSignature: o.timeSignature ?? 4,
      downbeatPosition: o.downbeatPosition ?? 0,
      groupBeats: o.groupBeats ?? null,
      anchors: o.anchors ?? [],
      chords: o.chords ?? [],
      step: o.step ?? 0,
      createdAt: now,
      updatedAt: now,
    }
    if (!hasContent(d)) return null
    return saveDraft(d)
  } catch { return null }
}

// Chuyển draft đơn cũ (1 bài) sang kho nhiều bài — chạy 1 lần.
export function migrateLegacyDraft(): void {
  try {
    const r = localStorage.getItem(LEGACY_KEY)
    if (!r) return
    const old = JSON.parse(r) as Partial<SongDraft>
    const now = Date.now()
    const d: SongDraft = {
      id: newDraftId(),
      title: 'Bài đang làm dở',
      youtubeUrl: old.youtubeUrl ?? '',
      videoId: null,
      thumbnail: null,
      lyricsText: old.lyricsText ?? '',
      fit: old.fit ?? null,
      timeSignature: old.timeSignature ?? 4,
      downbeatPosition: old.downbeatPosition ?? 0,
      groupBeats: old.groupBeats ?? null,
      anchors: old.anchors ?? [],
      step: old.step ?? 0,
      createdAt: now,
      updatedAt: now,
    }
    if (hasContent(d)) { saveDraft(d); setCurrentId(d.id) }
    localStorage.removeItem(LEGACY_KEY)
  } catch { /* bỏ qua */ }
}

export { TOTAL_STEPS }
