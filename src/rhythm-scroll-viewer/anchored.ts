// ── RHYTHM SCROLL — PROTOTYPE "measure anchors" (V2 thử nghiệm, KHÔNG phải hợp đồng production) ──
// V1 (src/rhythm-scroll) chỉ biết "đoạn này N ô". Ở đây mỗi Ô NHỊP biết nó bắt đầu ở CHỮ nào của lời,
// đúng như vạch nhịp trên bản nhạc. Ball đi từ chữ neo của ô này tới chữ neo của ô kế.
// File này thuần TS (không React/DOM), nằm ngoài lõi V1 để V1 giữ nguyên.
import type { RhythmScrollMeter, RhythmScrollProvenance, RhythmScrollState } from '../rhythm-scroll/index.ts'

/**
 * Chỗ một vạch nhịp rơi vào lời.
 * - `line`: dòng (0-based) trong văn bản lời + hợp âm chuẩn.
 * - `token`: chữ ĐẦU TIÊN hát sau vạch nhịp, đếm trong dòng SAU KHI bỏ [hợp âm].
 *   `token` = số chữ của dòng nghĩa là "hết dòng" (ô ngân sau chữ cuối).
 * - `line: null`: ô không lời (dạo, gian tấu).
 * Hai ô liên tiếp có cùng neo = ô NGÂN: không có chữ mới, ball đứng tại chỗ và vẫn nảy.
 */
export interface MeasureAnchor {
  line: number | null
  token: number | null
}

export interface RhythmScrollAnchoredData {
  version: 2
  /** Luôn true: hình dạng này mới chỉ để thử trải nghiệm. */
  prototype: true
  songId: string
  lyricsHash: string
  meter: RhythmScrollMeter
  /**
   * Nhịp lấy đà: chữ hát TRƯỚC vạch nhịp đầu tiên. Có trường này thì bài mở bằng MỘT ô dẫn vào,
   * neo ở chữ lấy đà; ball đi từ chữ đó tới neo của ô đầy đủ đầu tiên. Không phải engine anacrusis tổng quát.
   */
  pickup?: MeasureAnchor
  /** Mỗi phần tử = MỘT ô nhịp đầy đủ, theo thứ tự biểu diễn. */
  measures: MeasureAnchor[]
  provenance: RhythmScrollProvenance
}

export interface AnchoredPosition {
  state: RhythmScrollState
  /** 0-based trên dòng thời gian; nếu có nhịp lấy đà thì 0 là ô dẫn vào. */
  measureIndex: number
  /** 0..1 trong ô hiện tại. */
  measureProgress: number
  /** Neo của ô hiện tại và của ô kế tiếp (ô cuối: chính nó). */
  current: MeasureAnchor
  next: MeasureAnchor
  isPickup: boolean
}

export interface AnchoredScroll {
  /** Tổng số ô trên dòng thời gian, gồm cả ô dẫn vào nếu có. */
  readonly totalMeasures: number
  readonly hasPickup: boolean
  locate(measurePosition: number): AnchoredPosition
}

const isIndex = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0
const anchorIssue = (anchor: MeasureAnchor | undefined, at: string): string | null => {
  if (!anchor || typeof anchor !== 'object') return `${at} phải là { line, token }.`
  if (anchor.line === null) return anchor.token === null ? null : `${at}: ô không lời thì token cũng phải null.`
  return isIndex(anchor.line) && isIndex(anchor.token) ? null : `${at}: line và token phải là số nguyên ≥ 0.`
}

/** Engine thuần như V1: không timer, không BPM — consumer đưa vị trí ô nhịp vào. */
export function createAnchoredScroll(data: RhythmScrollAnchoredData): AnchoredScroll {
  if (data.version !== 2 || !Array.isArray(data.measures) || data.measures.length === 0) {
    throw new RangeError('RhythmScrollAnchoredData cần version 2 và ít nhất một ô nhịp.')
  }
  const anchors = (data.pickup ? [data.pickup] : []).concat(data.measures).map(anchor => ({ ...anchor }))
  anchors.forEach((anchor, index) => {
    const issue = anchorIssue(anchor, `anchor[${index}]`)
    if (issue) throw new RangeError(issue)
  })
  const total = anchors.length
  const hasPickup = !!data.pickup
  const at = (index: number, state: RhythmScrollState, progress: number): AnchoredPosition => ({
    state, measureIndex: index, measureProgress: progress,
    current: anchors[index], next: anchors[Math.min(index + 1, total - 1)],
    isPickup: hasPickup && index === 0,
  })
  return {
    totalMeasures: total,
    hasPickup,
    locate(measurePosition: number): AnchoredPosition {
      if (typeof measurePosition !== 'number' || Number.isNaN(measurePosition)) throw new RangeError('measurePosition phải là một số.')
      if (measurePosition < 0) return at(0, 'before', 0)
      if (measurePosition >= total) return at(total - 1, 'ended', 1)
      const index = Math.floor(measurePosition)
      return at(index, 'active', measurePosition - index)
    },
  }
}

/** Kiểm neo với văn bản thật: mỗi neo phải trỏ vào một chữ có thật (hoặc "hết dòng"). */
export function anchorTextIssues(data: RhythmScrollAnchoredData, wordsPerLine: readonly number[]): string[] {
  const issues: string[] = []
  const all = (data.pickup ? [data.pickup] : []).concat(data.measures)
  all.forEach((anchor, index) => {
    if (anchor.line === null) return
    const count = wordsPerLine[anchor.line]
    if (count === undefined || count === 0) issues.push(`anchor[${index}] trỏ tới dòng ${anchor.line} không có lời.`)
    else if ((anchor.token ?? 0) > count) issues.push(`anchor[${index}] trỏ tới chữ ${anchor.token} nhưng dòng ${anchor.line} chỉ có ${count} chữ.`)
  })
  return issues
}
