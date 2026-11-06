// Contextual Share V3.1 — chọn CÁI GÌ dựng trong thẻ Feed của một vùng khoanh (thuần, test được trên Node).
// Mặc định gọn: tối đa 3 khối đầu và 1 bản nhạc sống (alphaTab nặng); "Xem đầy đủ": mọi khối (tối đa 12) và mọi bản nhạc (mỗi khối tối đa 1 bản nhạc được vẽ trích đoạn).
import { marksByLeaf, type RegionPart, type RegionScore } from './regionAnchor'
import { scoreTexAt } from './scoreExcerpt'
import { textContextHasMore } from './textAnchor'

export const REGION_COMPACT_PARTS = 3
export type RegionPartView = { part: RegionPart; marks: Map<string, [number, number][]>; blocksAt: number[]; approx: boolean; score?: RegionScore; tex?: string }

export function regionViews(sections: unknown[], parts: RegionPart[], expanded: boolean): { shown: RegionPartView[]; hidden: number } {
  const list = expanded ? parts : parts.slice(0, REGION_COMPACT_PARTS)
  let live = 0
  const shown = list.map(part => {
    const marks = marksByLeaf([part])
    const blocksAt = [...new Set(part.leaves.map(l => (l.p[0] === 'blocks' ? Number(l.p[1]) : NaN)).filter(n => Number.isInteger(n)))]
    const sc = part.scores[0]
    const tex = sc && (expanded || live === 0) ? scoreTexAt(sections, { section: part.sec, path: sc.p as never }) ?? undefined : undefined
    if (tex) live++
    return { part, marks, blocksAt, approx: !part.leaves.length && !part.scores.length, score: tex ? sc : undefined, tex } as RegionPartView
  })
  return { shown, hidden: parts.length - list.length }
}

/** Có gì để "Xem đầy đủ"? khối ẩn, cửa sổ study rộng hơn, hoặc bản nhạc chưa dựng (compact chỉ 1 bản nhạc sống). */
export function regionHasMore(sections: unknown[], parts: RegionPart[]): boolean {
  if (parts.length > REGION_COMPACT_PARTS) return true
  if (parts.filter(p => p.scores.length > 0).length > 1) return true
  return parts.some(p => p.leaves.some(l => textContextHasMore(sections[p.sec], { path: l.p })))
}
