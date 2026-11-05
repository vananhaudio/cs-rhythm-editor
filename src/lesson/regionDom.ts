// Cầu nối DOM ⇄ lõi thuần regionAnchor: đọc hộp khối / dòng chữ của lá / ô nhịp của bản nhạc trong giáo trình ĐANG HIỂN THỊ (toạ độ client).
// Bản nhạc (alphaTab) tự đăng ký vào sổ này (ScoreShareLayer) vì ô nhịp chỉ biết qua api.renderer.boundsLookup.
import type { Rect, RegionPart, SectionProbe } from '../share/regionAnchor'

export type ScoreProbe = { sec: number; p: string[]; el: HTMLElement; bars: () => { index: number; rect: Rect }[]; rectsFor: (from0: number, to0: number) => Rect[] }
const scores = new Map<string, ScoreProbe>()
const idOf = (sec: number, p: string[]) => `${sec}:${p.join('.')}`
export function registerScoreProbe(pr: ScoreProbe): () => void {
  const id = idOf(pr.sec, pr.p)
  scores.set(id, pr)
  return () => { if (scores.get(id) === pr) scores.delete(id) }
}

const r2 = (r: DOMRect | DOMRectReadOnly): Rect => ({ x: r.left, y: r.top, w: r.width, h: r.height })
const leafPath = (tp: string) => tp.slice(tp.indexOf(':') + 1).split('.')

/** Mọi khối + lá + bản nhạc đang có trong `root` (client coords). Khối đứng ngoài màn hình vẫn được đo (toạ độ có thể âm). */
export function probeSections(root: HTMLElement): SectionProbe[] {
  const out: SectionProbe[] = []
  root.querySelectorAll<HTMLElement>('[data-sec]').forEach(el => {
    const sec = Number(el.dataset.sec)
    if (!Number.isInteger(sec)) return
    const leaves = Array.from(el.querySelectorAll<HTMLElement>('[data-tp]')).map(l => ({
      path: leafPath(l.dataset.tp ?? ''), rects: Array.from(l.getClientRects()).map(r2).filter(r => r.w > 0 && r.h > 0),
    })).filter(l => l.path.length >= 1 && l.rects.length > 0)
    const sc = Array.from(scores.values()).filter(s => s.sec === sec && el.contains(s.el)).map(s => ({ p: s.p, bars: s.bars() }))
    out.push({ sec, box: r2(el.getBoundingClientRect()), leaves, scores: sc })
  })
  return out
}

/** Tra cứu cho drawParts (client coords). */
export function lookupFor(root: HTMLElement) {
  const secEl = (sec: number) => root.querySelector<HTMLElement>(`[data-sec="${sec}"]`)
  return {
    section: (sec: number) => { const e = secEl(sec); return e ? r2(e.getBoundingClientRect()) : null },
    leaf: (sec: number, path: string[]): Rect[] => {
      const e = root.querySelector<HTMLElement>(`[data-tp="${sec}:${path.join('.')}"]`)
      return e ? Array.from(e.getClientRects()).map(r2).filter(r => r.w > 0 && r.h > 0) : []
    },
    bars: (sec: number, p: string[], from: number, to: number): Rect[] => scores.get(idOf(sec, p))?.rectsFor(from - 1, to - 1) ?? [],
  }
}

/** Phần có còn tra được mọi phần tử gốc trong DOM hiện tại không (bản nhạc có thể chưa khắc xong). */
export function partsReady(parts: RegionPart[], root: HTMLElement): boolean {
  const lk = lookupFor(root)
  return parts.every(p => p.leaves.every(l => lk.leaf(p.sec, l).length > 0) && p.scores.every(s => lk.bars(p.sec, s.p, s.from, s.to).length > 0))
}
