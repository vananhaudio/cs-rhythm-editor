// Trải phẳng THỨ TỰ BIỂU DIỄN cho Rhythm Scroll: điệp khúc / lời 2 hát lại dòng cũ thì viewer phải vẽ dòng đó LẦN NỮA
// (cuộn không bao giờ lùi). Văn bản chuẩn và timeline hợp âm vẫn theo dòng thật; chỉ lớp hiển thị dùng dòng ảo.
//
//   dòng thật (văn bản chuẩn) ──▶ dòng ảo (thứ tự hát) ; neo {line, token} đổi sang dòng ảo cùng token.
//
// Một "lượt" mới bắt đầu khi neo kế tiếp ĐI LÙI theo thứ tự đọc (quay về dòng cũ). Trong một lượt, đi tới dòng L thì
// mọi dòng thật chưa vẽ từ dòng kế sau dòng đã vẽ cuối tới L đều được vẽ (kể cả dòng nhãn/dòng trống nằm giữa).
import { anchorLines } from './chordAnchors.ts'
import type { ChordAnchors, MeasureAnchor } from './chordAnchors.ts'

export type ScriptWord = { text: string; chord: string | null }
export type ScriptLine = { index: number; words: ScriptWord[] }

export type PerformanceScript = {
  /** Dòng ảo theo thứ tự hát (index = vị trí trong mảng). */
  lines: ScriptLine[]
  /** Nhãn đầu dòng ("1.", "ĐK:") theo dòng ẢO — chỉ để trình bày. */
  labels: Record<number, string>
  /** Neo đã đổi sang dòng ảo (cùng số ô, cùng token). */
  anchors: ChordAnchors
  /** Dòng thật `line` mà ô `measure` (chỉ số trên dòng thời gian, gồm lấy đà) đang hát → dòng ảo. */
  virtualLine(measure: number, line: number): number
  /** Số lượt hát (≥ 1). */
  passes: number
}

const behind = (next: { line: number; token: number }, prev: { line: number; token: number }) =>
  next.line < prev.line || (next.line === prev.line && next.token < prev.token)

export function buildPerformanceScript(text: string, anchors: ChordAnchors): PerformanceScript {
  const real = anchorLines(text)
  const lines: ScriptLine[] = []
  const labels: Record<number, string> = {}
  const timeline: MeasureAnchor[] = [...(anchors.pickup ? [anchors.pickup] : []), ...anchors.measures]
  const passMaps: Map<number, number>[] = []
  const passOfMeasure: number[] = []

  const append = (realLine: number, map: Map<number, number>) => {
    const view = real[realLine]
    const index = lines.length
    lines.push({ index, words: view.tokens.map(token => ({ text: token.word, chord: token.chord })) })
    if (view.label) labels[index] = view.label
    map.set(realLine, index)
  }

  let map = new Map<number, number>()
  passMaps.push(map)
  let drawnUpTo = -1                 // dòng thật cuối cùng đã vẽ trong lượt hiện tại
  let prev: { line: number; token: number } | null = null
  const remapped: MeasureAnchor[] = []
  timeline.forEach((anchor, at) => {
    if (anchor.line === null || anchor.token === null) {
      passOfMeasure.push(passMaps.length - 1)
      remapped.push({ line: null, token: null })
      return
    }
    const here = { line: anchor.line, token: anchor.token }
    if (prev && behind(here, prev)) {
      map = new Map()
      passMaps.push(map)
      drawnUpTo = here.line - 1
    }
    for (let line = drawnUpTo + 1; line <= here.line; line += 1) append(line, map)
    drawnUpTo = Math.max(drawnUpTo, here.line)
    prev = here
    passOfMeasure.push(passMaps.length - 1)
    remapped.push({ line: map.get(here.line)!, token: here.token })
    void at
  })
  // Bài chạy một lượt mà văn bản còn dòng chưa có vạch nhịp: vẽ nốt để người hát vẫn thấy.
  // Có lượt hát lại thì phần sau điệp khúc không thuộc lượt đó → không vẽ thêm.
  if (passMaps.length === 1) for (let line = drawnUpTo + 1; line < real.length; line += 1) append(line, map)

  const hasPickup = !!anchors.pickup
  return {
    lines, labels, passes: passMaps.length,
    anchors: { ...(hasPickup ? { pickup: remapped[0] } : {}), measures: hasPickup ? remapped.slice(1) : remapped },
    virtualLine(measure, line) {
      const target = passMaps[passOfMeasure[measure] ?? passMaps.length - 1]
      return target?.get(line) ?? line
    },
  }
}
