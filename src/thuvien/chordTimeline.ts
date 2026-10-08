// Timeline hợp âm THEO PHÁCH của một phiên bản Hợp âm chuẩn hóa — nền của Rhythm Scroll.
//
//   Hợp Âm Việt (lời + [hợp âm] + thứ tự đoạn)  +  vạch nhịp (anchors: ô → chữ)  +  số phách mỗi ô (meter)
//     → mỗi hợp âm có điểm bắt đầu và thời lượng bằng PHÁCH, trên một dòng thời gian duy nhất.
//
// Thuần TS, không DOM, không đồng hồ. Không đổi lời, không đổi chuỗi hợp âm; không tính từng âm tiết.
//
// Bằng chứng nhạc lý (cái gì là CHẮC, cái gì là SUY LUẬN):
//   • Số phách mỗi ô = meter (một ô đầy đủ luôn đúng `beats` phách) → CHẮC. Tổng phách = nhịp lấy đà + ô × beats,
//     nên timeline không thể trôi tích luỹ: mỗi ô bắt đầu đúng ở bội số beats.
//   • Hợp âm đứng ở chữ ĐẦU ô → đổi đúng vạch nhịp (phách 0 của ô) → CHẮC.
//   • Ô không có hợp âm mới → hợp âm trước ngân tiếp qua ô → CHẮC (quy ước bản hợp âm).
//   • Hợp âm đổi GIỮA ô: vị trí chữ trong ô cho biết xấp xỉ; ta làm tròn về phách gần nhất (hợp âm đổi theo phách)
//     → SUY LUẬN, ô đó bị đánh dấu `verified: false` và có cảnh báo `mid_measure_inferred`.
//   • Nhịp lấy đà: số phách suy từ số chữ hát nếu người gọi không cung cấp → `pickup_inferred`.
import { anchorLines } from './chordAnchors.ts'
import type { ChordAnchors, MeasureAnchor } from './chordAnchors.ts'

export type TimelineMeter = { beats: number; beatType: number }

export type TimelineWarningCode =
  | 'meter_missing'          // không có meter → không thể tính phách
  | 'pickup_inferred'        // số phách nhịp lấy đà là suy luận
  | 'mid_measure_inferred'   // hợp âm đổi giữa ô: vị trí phách là suy luận
  | 'too_many_chords'        // ô có nhiều hợp âm hơn số phách: chia đều theo phần phách
  | 'no_chord_at_start'      // bài không mở bằng hợp âm
  | 'no_chords'              // bài không có hợp âm nào

export type TimelineWarning = { code: TimelineWarningCode; message: string; measure?: number }

/** Một ô nhịp trên dòng thời gian (kể cả ô lấy đà nếu có). */
export type TimelineMeasure = {
  /** 0-based trên dòng thời gian; nếu có nhịp lấy đà thì 0 là ô lấy đà. */
  index: number
  startBeat: number
  beats: number
  isPickup: boolean
  anchor: MeasureAnchor
  /** Hợp âm bắt đầu trong ô này, kèm phách trong ô (0-based). */
  changes: { chord: string; beat: number; line: number; token: number; ordinal: number }[]
  /** Số chữ hát thuộc ô này (0 với ô ngân / ô không lời). */
  tokenCount: number
  /** true = vị trí mọi hợp âm trong ô có bằng chứng nhạc lý (không suy luận). */
  verified: boolean
}

export type ChordEvent = {
  chord: string
  /** Phách tuyệt đối từ đầu dòng thời gian (0 = đầu ô lấy đà / ô 1). */
  startBeat: number
  /** Thời lượng bằng phách; các sự kiện nối đuôi nhau tới `totalBeats`. */
  beats: number
  measure: number
  /** Chữ mang hợp âm trong lời chuẩn (để viewer sáng đúng hợp âm). */
  line: number
  token: number
  verified: boolean
}

export type ChordTimeline = {
  meter: TimelineMeter
  /** 0 = không có nhịp lấy đà. */
  pickupBeats: number
  totalBeats: number
  measures: TimelineMeasure[]
  events: ChordEvent[]
  /** Chỉ số các ô có phần suy luận. */
  unverifiedMeasures: number[]
  warnings: TimelineWarning[]
}

export type TimelineOptions = {
  /** Số phách nhịp lấy đà nếu đã biết từ sheet; bỏ trống → suy luận. */
  pickupBeats?: number
}

const same = (a: MeasureAnchor, b: MeasureAnchor) => a.line === b.line && a.token === b.token

/** Thứ tự đọc: a đứng TRƯỚC b hoặc bằng b (cả hai đều có lời). */
const notAfter = (a: { line: number; token: number }, b: { line: number; token: number }) =>
  a.line < b.line || (a.line === b.line && a.token <= b.token)

type Slot = { chord: string; line: number; token: number; ordinal: number }

/**
 * Các chữ thuộc ô `i`: từ neo của ô tới neo CÓ LỜI khác kế tiếp theo thứ tự đọc. Neo kế đi lùi (điệp khúc/lời 2 quay về
 * dòng cũ) hoặc không có → hết dòng hiện tại. Ô ngân (neo trùng ô trước) và ô không lời không sở hữu chữ nào.
 */
function tokensOfMeasure(lines: ReturnType<typeof anchorLines>, timeline: MeasureAnchor[], i: number): { line: number; token: number; chord: string | null }[] {
  const here = timeline[i]
  if (here.line === null || here.token === null) return []
  if (i > 0 && same(timeline[i - 1], here)) return []
  let next: MeasureAnchor | undefined
  for (let k = i + 1; k < timeline.length; k += 1) {
    if (timeline[k].line !== null && !same(timeline[k], here)) { next = timeline[k]; break }
  }
  const start = { line: here.line, token: here.token }
  const forward = next && next.line !== null && next.token !== null && notAfter(start, { line: next.line, token: next.token }) ? { line: next.line, token: next.token } : null
  const out: { line: number; token: number; chord: string | null }[] = []
  const lastLine = forward ? forward.line : here.line
  for (let line = here.line; line <= lastLine; line += 1) {
    const tokens = lines[line]?.tokens ?? []
    const from = line === here.line ? here.token : 0
    const to = forward && line === forward.line ? forward.token : tokens.length
    for (let token = from; token < to; token += 1) out.push({ line, token, chord: tokens[token].chord })
  }
  return out
}

const isMeter = (meter: unknown): meter is TimelineMeter =>
  !!meter && typeof meter === 'object' && Number.isInteger((meter as TimelineMeter).beats) && (meter as TimelineMeter).beats >= 1

/** Phách của từng hợp âm trong ô dài `beats` phách; tăng nghiêm ngặt, vừa trong [0, beats). */
export function placeChords(slots: Slot[], total: number, beats: number): { beat: number; exact: boolean; crowded: boolean }[] {
  if (!slots.length) return []
  // Hợp âm ĐẦU ô đổi đúng vạch nhịp — không suy luận.
  const raw = slots.map(slot => (slot.ordinal / total) * beats)
  if (slots.length > beats) {
    // Nhiều hợp âm hơn số phách: chia đều ô theo số hợp âm (phần phách). Không có căn cứ chắc.
    return slots.map((_, k) => ({ beat: (k * beats) / slots.length, exact: false, crowded: true }))
  }
  const beat: number[] = []
  raw.forEach((value, k) => {
    const snapped = Math.min(beats - 1, Math.max(0, Math.round(value)))
    beat.push(k === 0 ? snapped : Math.max(snapped, beat[k - 1] + 1))
  })
  // Đẩy ngược nếu bị dồn quá cuối ô (đã đảm bảo slots.length ≤ beats nên luôn vừa).
  for (let k = beat.length - 1; k >= 0; k -= 1) beat[k] = Math.min(beat[k], beats - (beat.length - k))
  return beat.map((value, k) => ({ beat: value, exact: slots[k].ordinal === 0 && value === 0, crowded: false }))
}

/**
 * Dựng timeline. `meter` null/sai → timeline rỗng kèm cảnh báo `meter_missing` (không bịa số phách).
 */
export function buildChordTimeline(text: string, anchors: ChordAnchors, meter: TimelineMeter | null, options: TimelineOptions = {}): ChordTimeline {
  const warnings: TimelineWarning[] = []
  if (!isMeter(meter)) {
    return { meter: { beats: 0, beatType: 0 }, pickupBeats: 0, totalBeats: 0, measures: [], events: [], unverifiedMeasures: [], warnings: [{ code: 'meter_missing', message: 'Bài chưa có số chỉ nhịp nên chưa tính được phách.' }] }
  }
  const lines = anchorLines(text)
  const timeline: MeasureAnchor[] = [...(anchors.pickup ? [anchors.pickup] : []), ...anchors.measures]
  const hasPickup = !!anchors.pickup

  // Nhịp lấy đà: số phách = người gọi cho, hoặc suy ra theo tỉ lệ chữ so với ô đầy đủ đầu tiên (≥ 1, < beats).
  let pickupBeats = 0
  if (hasPickup) {
    if (options.pickupBeats !== undefined && options.pickupBeats > 0 && options.pickupBeats < meter.beats) pickupBeats = options.pickupBeats
    else {
      const pickupTokens = tokensOfMeasure(lines, timeline, 0).length
      const firstTokens = tokensOfMeasure(lines, timeline, 1).length
      const guess = firstTokens > 0 ? Math.round((meter.beats * pickupTokens) / (pickupTokens + firstTokens)) : 1
      pickupBeats = Math.min(meter.beats - 1, Math.max(1, guess))
      warnings.push({ code: 'pickup_inferred', measure: 0, message: `Nhịp lấy đà dài ${pickupBeats}/${meter.beats} phách là suy luận từ số chữ — cần đối chiếu sheet.` })
    }
  }

  const measures: TimelineMeasure[] = []
  let cursor = 0
  timeline.forEach((anchor, index) => {
    const isPickup = hasPickup && index === 0
    const beats = isPickup ? pickupBeats : meter.beats
    const owned = tokensOfMeasure(lines, timeline, index)
    const slots: Slot[] = owned.flatMap((token, ordinal) => (token.chord ? [{ chord: token.chord, line: token.line, token: token.token, ordinal }] : []))
    const placed = placeChords(slots, owned.length || 1, beats)
    let verified = true
    placed.forEach(spot => {
      if (!spot.exact) verified = false
      if (spot.crowded) warnings.push({ code: 'too_many_chords', measure: index, message: `Ô ${index + 1} có ${slots.length} hợp âm trong ${beats} phách: chia đều theo phần phách.` })
    })
    if (placed.some(spot => !spot.exact && !spot.crowded)) {
      warnings.push({ code: 'mid_measure_inferred', measure: index, message: `Ô ${index + 1}: hợp âm đổi giữa ô, vị trí phách suy từ vị trí chữ (chưa xác minh).` })
    }
    measures.push({
      index, startBeat: cursor, beats, isPickup, anchor,
      changes: slots.map((slot, k) => ({ chord: slot.chord, beat: placed[k].beat, line: slot.line, token: slot.token, ordinal: slot.ordinal })),
      tokenCount: owned.length,
      verified,
    })
    cursor += beats
  })

  const totalBeats = cursor
  const starts: Omit<ChordEvent, 'beats'>[] = []
  for (const measure of measures) {
    for (const change of measure.changes) {
      starts.push({ chord: change.chord, startBeat: measure.startBeat + change.beat, measure: measure.index, line: change.line, token: change.token, verified: measure.verified })
    }
  }
  const events: ChordEvent[] = starts.map((event, k) => ({ ...event, beats: (k + 1 < starts.length ? starts[k + 1].startBeat : totalBeats) - event.startBeat }))
  if (!events.length) warnings.push({ code: 'no_chords', message: 'Bài không có hợp âm nào.' })
  else if (events[0].startBeat > 0) warnings.push({ code: 'no_chord_at_start', message: `Hợp âm đầu tiên bắt đầu ở phách ${events[0].startBeat}, trước đó chưa có hợp âm.` })

  return { meter, pickupBeats, totalBeats, measures, events, unverifiedMeasures: measures.filter(m => !m.verified).map(m => m.index), warnings }
}

/** Kiểm bất biến — dùng trong test và trước khi phát: các hợp âm nối đuôi khít tới hết bài, mỗi ô đúng số phách. */
export function timelineProblems(timeline: ChordTimeline): string[] {
  const problems: string[] = []
  let cursor = 0
  for (const measure of timeline.measures) {
    if (measure.startBeat !== cursor) problems.push(`ô ${measure.index} bắt đầu ở phách ${measure.startBeat}, đáng lẽ ${cursor}`)
    cursor += measure.beats
  }
  if (cursor !== timeline.totalBeats) problems.push(`tổng phách ${timeline.totalBeats} ≠ tổng các ô ${cursor}`)
  let at = timeline.events.length ? timeline.events[0].startBeat : 0
  for (const event of timeline.events) {
    if (event.startBeat !== at) problems.push(`hợp âm ${event.chord} ở ${event.startBeat}, đáng lẽ ${at}`)
    if (!(event.beats > 0)) problems.push(`hợp âm ${event.chord} ở ${event.startBeat} có thời lượng ${event.beats}`)
    at = event.startBeat + event.beats
  }
  if (timeline.events.length && at !== timeline.totalBeats) problems.push(`hợp âm cuối kết thúc ở ${at}, đáng lẽ ${timeline.totalBeats}`)
  return problems
}

export type TimelinePosition = {
  state: 'before' | 'active' | 'ended'
  /** Ô hiện tại trên dòng thời gian (0-based). */
  measureIndex: number
  /** 0..1 trong ô hiện tại — dùng chung cho ball. */
  measureProgress: number
  /** Vị trí liên tục theo Ô (mỗi ô = 1) — đưa thẳng vào viewer. */
  measurePosition: number
  /** Chỉ số sự kiện hợp âm đang vang; -1 = chưa có hợp âm. */
  chordIndex: number
}

/** Một phép đổi DUY NHẤT từ phách → vị trí: ball, cuộn lời và hợp âm đều đọc từ đây. */
export function locateBeat(timeline: ChordTimeline, beat: number): TimelinePosition {
  const { measures, events, totalBeats } = timeline
  if (!measures.length || typeof beat !== 'number' || Number.isNaN(beat) || beat < 0) {
    return { state: 'before', measureIndex: 0, measureProgress: 0, measurePosition: -1, chordIndex: -1 }
  }
  if (beat >= totalBeats) {
    return { state: 'ended', measureIndex: measures.length - 1, measureProgress: 1, measurePosition: measures.length, chordIndex: events.length - 1 }
  }
  let low = 0
  let high = measures.length - 1
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (measures[mid].startBeat <= beat) low = mid
    else high = mid - 1
  }
  const measure = measures[low]
  const progress = (beat - measure.startBeat) / measure.beats
  let chordIndex = -1
  let a = 0
  let b = events.length - 1
  while (a <= b) {
    const mid = (a + b) >> 1
    if (events[mid].startBeat <= beat) { chordIndex = mid; a = mid + 1 } else b = mid - 1
  }
  return { state: 'active', measureIndex: low, measureProgress: progress, measurePosition: low + progress, chordIndex }
}

/** Giây → phách. BPM đếm theo một đơn vị `beatType` (cùng quy ước rhythm-scroll/time.ts và TeamLab). */
export const beatsAtSeconds = (seconds: number, bpm: number): number => (seconds * bpm) / 60
