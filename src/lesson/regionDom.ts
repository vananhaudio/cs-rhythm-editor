// Cầu nối DOM ⇄ lõi thuần regionAnchor: đọc hộp khối / dòng chữ của lá / ô nhịp của bản nhạc trong giáo trình ĐANG HIỂN THỊ (toạ độ client).
// Bản nhạc (alphaTab) tự đăng ký vào sổ này (ScoreShareLayer) vì ô nhịp chỉ biết qua api.renderer.boundsLookup.
import type { Rect, RegionPart, SectionProbe } from '../share/regionAnchor'
import { cpLen, cpToUtf16, leafTextAt } from '../share/textAnchor'

export type ScoreProbe = { sec: number; p: string[]; el: HTMLElement; bars: () => { index: number; rect: Rect }[]; rectsFor: (from0: number, to0: number) => Rect[] }
const scores = new Map<string, ScoreProbe>()
const idOf = (sec: number, p: string[]) => `${sec}:${p.join('.')}`
export function registerScoreProbe(pr: ScoreProbe): () => void {
  const id = idOf(pr.sec, pr.p)
  scores.set(id, pr)
  notifyLayoutChange()
  return () => { if (scores.get(id) === pr) scores.delete(id) }
}

const r2 = (r: DOMRect | DOMRectReadOnly): Rect => ({ x: r.left, y: r.top, w: r.width, h: r.height })
const leafPath = (tp: string) => tp.slice(tp.indexOf(':') + 1).split('.')

// ── Thông báo bố cục đổi (thay vòng hỏi 250 ms): bản nhạc khắc xong, font nạp xong… ──
const layoutSubs = new Set<() => void>()
export const onLayoutChange = (fn: () => void): (() => void) => { layoutSubs.add(fn); return () => { layoutSubs.delete(fn) } }
export const notifyLayoutChange = () => { layoutSubs.forEach(f => f()) }

/** Các nút văn bản của lá (thứ tự tài liệu) kèm độ dời UTF-16 đầu mỗi nút trong chuỗi nối lại. */
function textNodes(el: HTMLElement): { node: Text; start: number }[] {
  const out: { node: Text; start: number }[] = []
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let off = 0
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { out.push({ node: n as Text, start: off }); off += (n as Text).data.length }
  return out
}
const rangeRects = (nodes: { node: Text; start: number }[], u0: number, u1: number): Rect[] => {
  const find = (u: number, end: boolean) => nodes.find(n => (end ? u > n.start && u <= n.start + n.node.data.length : u >= n.start && u < n.start + n.node.data.length)) ?? nodes[nodes.length - 1]
  const a = find(u0, false), b = find(u1, true)
  if (!a || !b) return []
  const rg = document.createRange()
  try { rg.setStart(a.node, Math.min(a.node.data.length, u0 - a.start)); rg.setEnd(b.node, Math.min(b.node.data.length, u1 - b.start)) } catch { return [] }
  return Array.from(rg.getClientRects()).map(r2).filter(r => r.w > 0 && r.h > 0)
}
/** Hộp từng ĐIỂM MÃ của lá (null = không có hộp: khoảng trắng gập dòng…). Chỉ gọi khi khung chạm lá. */
function charRects(el: HTMLElement): (Rect | null)[] {
  const nodes = textNodes(el)
  const out: (Rect | null)[] = []
  const rg = document.createRange()
  for (const { node } of nodes) {
    let u = 0
    for (const ch of node.data) {
      try { rg.setStart(node, u); rg.setEnd(node, u + ch.length); const r = rg.getClientRects()[0]; out.push(r && r.width > 0 && r.height > 0 ? r2(r) : null) } catch { out.push(null) }
      u += ch.length
    }
  }
  return out
}

/** Mọi khối + lá + bản nhạc đang có trong `root` (client coords). `sections` = dữ liệu giáo trình nguồn: lá chỉ được nhận khi chữ trên màn hình KHỚP chuỗi nguồn (không khớp ⇒ bỏ qua, fail-closed). */
export function probeSections(root: HTMLElement, sections: unknown): SectionProbe[] {
  const out: SectionProbe[] = []
  root.querySelectorAll<HTMLElement>('[data-sec]').forEach(el => {
    const sec = Number(el.dataset.sec)
    if (!Number.isInteger(sec)) return
    const leaves = Array.from(el.querySelectorAll<HTMLElement>('[data-tp]')).flatMap(l => {
      const path = leafPath(l.dataset.tp ?? '')
      const text = leafTextAt(sections, { section: sec, path })
      if (text === null || l.textContent !== text || path.length < 1) return []
      const rects = Array.from(l.getClientRects()).map(r2).filter(r => r.w > 0 && r.h > 0)
      if (!rects.length) return []
      let cache: (Rect | null)[] | null = null
      return [{ path, text, rects, chars: () => (cache ??= charRects(l)) }]
    })
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
    leaf: (sec: number, path: string[], ranges: [number, number][]): Rect[] => {
      const e = root.querySelector<HTMLElement>(`[data-tp="${sec}:${path.join('.')}"]`)
      if (!e) return []
      const nodes = textNodes(e)
      const text = nodes.map(n => n.node.data).join('')
      const out: Rect[] = []
      for (const [a, b] of ranges) {
        if (b > cpLen(text)) return []                        // DOM không còn đủ chữ ⇒ không vẽ gì (không đoán)
        const u0 = cpToUtf16(text, a), u1 = cpToUtf16(text, b)
        if (u0 < 0 || u1 < 0) return []
        out.push(...rangeRects(nodes, u0, u1))
      }
      return out
    },
    bars: (sec: number, p: string[], from: number, to: number): Rect[] => scores.get(idOf(sec, p))?.rectsFor(from - 1, to - 1) ?? [],
  }
}

/** Phần có còn tra được mọi phần tử gốc trong DOM hiện tại không (bản nhạc có thể chưa khắc xong). */
export function partsReady(parts: RegionPart[], root: HTMLElement): boolean {
  const lk = lookupFor(root)
  return parts.every(p => p.leaves.every(l => lk.leaf(p.sec, l.p, l.r).length > 0) && p.scores.every(s => lk.bars(p.sec, s.p, s.from, s.to).length > 0))
}
