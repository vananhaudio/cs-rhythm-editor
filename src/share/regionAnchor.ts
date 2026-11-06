// Contextual Share V3.1 — "Khoanh để hỏi": lõi THUẦN (không DOM) biến một KHUNG CHỮ NHẬT người học kéo thành NEO TÀI LIỆU, và ngược lại.
// Neo KHÔNG phải pixel: mỗi khối giáo trình bị khung chạm tới thành một PHẦN gồm
//   • leaves  — các LÁ VĂN BẢN + các ĐOẠN [từ,đến) theo ĐIỂM MÃ (cùng hệ V2) mà khung thực sự bao: chữ nào có tâm nằm trong khung (làm tròn theo TỪ);
//               khoanh nửa đoạn ⇒ chỉ nửa đoạn; khoanh một ô bảng ⇒ chỉ ô đó; khung bao trọn lá ⇒ cả lá;
//   • scores  — bản nhạc + dải ô nhịp (cùng hệ V1.3) mà khung bao ≥ 50% diện tích ô (không lấy cả bản nhạc);
//   • box     — khung theo ‰ của hộp khối: CHỈ để vẽ khi phần đó KHÔNG có phần tử gốc (hình ảnh, khoảng trống…) ⇒ gần đúng, KHÔNG phải neo chính xác.
// Vẽ lại = tra đúng phần tử/đoạn chữ đó trong DOM hiện tại ⇒ chữ tự xuống dòng / đổi font / đổi bề rộng thì vùng đi theo chữ. Server giữ băm từng đoạn (db/drafts/share_region_v3_setup.sql).
import { boundaryOk, cpLen, cpSlice, snapToGraphemes } from './textAnchor'

export type Rect = { x: number; y: number; w: number; h: number }
export type RegionScore = { p: string[]; from: number; to: number }
/** Một lá văn bản + các đoạn [từ, đến) theo ĐIỂM MÃ trong lá (tăng dần, không chồng nhau). */
export type RegionLeaf = { p: string[]; r: [number, number][] }
export type RegionPart = { sec: number; box: [number, number, number, number]; leaves: RegionLeaf[]; scores: RegionScore[] }

/** Giới hạn — khớp server (share_region_build). */
export const REGION_LIMITS = { parts: 12, leaves: 40, ranges: 60, rangesPerLeaf: 12, rangeCp: 1000, scores: 6, bars: 64, minSide: 16, barCover: 0.5, wordCover: 0.5 } as const

/** Một khối trong DOM, dạng THUẦN: hộp, các lá (chuỗi nguồn + hình chữ nhật từng dòng + hộp từng ĐIỂM MÃ — tính LƯỜI), các bản nhạc (hộp từng ô). Mọi toạ độ cùng hệ (vd. client). */
export type SectionProbe = {
  sec: number
  box: Rect
  leaves: { path: string[]; text: string; rects: Rect[]; chars: () => (Rect | null)[] }[]
  scores: { p: string[]; bars: { index: number; rect: Rect }[] }[]   // index: 0-based (masterBar)
}

const area = (r: Rect) => Math.max(0, r.w) * Math.max(0, r.h)
export function intersect(a: Rect, b: Rect): Rect | null {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h)
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null
}
/** Tỉ lệ diện tích `rects` nằm trong `region` (0..1). Không có diện tích ⇒ 0. */
export function coverage(rects: Rect[], region: Rect): number {
  let tot = 0, hit = 0
  for (const r of rects) { tot += area(r); const i = intersect(r, region); if (i) hit += area(i) }
  return tot > 0 ? hit / tot : 0
}
export const normRect = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) })

export type BuildResult = { ok: true; parts: RegionPart[] } | { ok: false; reason: 'tooSmall' | 'empty' | 'tooManyParts' | 'tooManyLeaves' | 'tooManyRanges' | 'tooManyBars' }
export const REGION_HINT: Record<Exclude<BuildResult, { ok: true }>['reason'], string> = {
  tooSmall: 'Khung quá nhỏ. Hãy kéo một khung lớn hơn.',
  empty: 'Khung chưa bao được nội dung nào. Hãy kéo lại, bao trọn phần bạn muốn hỏi.',
  tooManyParts: 'Khung phủ quá nhiều khối. Hãy khoanh nhỏ lại (tối đa 12 khối).',
  tooManyLeaves: 'Khung phủ quá nhiều đoạn chữ trong một khối. Hãy khoanh nhỏ lại.',
  tooManyRanges: 'Khung bao quá nhiều mảnh chữ rời nhau. Hãy khoanh gọn lại.',
  tooManyBars: 'Khung phủ quá nhiều ô nhịp (tối đa 64 ô). Hãy khoanh nhỏ lại.',
}

const isWs = (c: string) => /\s/u.test(c)
const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })
const inside = (p: { x: number; y: number }, g: Rect) => p.x >= g.x && p.x <= g.x + g.w && p.y >= g.y && p.y <= g.y + g.h

/** Lá + hộp từng điểm mã + khung ⇒ các đoạn [từ,đến) mà khung bao. Chữ tính theo TỪ: từ nào có ≥ 50% ký tự (có hộp) với tâm nằm trong khung thì lấy cả từ;
 *  các từ LIÊN TIẾP được nối thành một đoạn (gồm khoảng trắng giữa chúng); đoạn dài > 1000 điểm mã được cắt ở khoảng trắng. */
export function pickRanges(text: string, chars: (Rect | null)[], region: Rect): [number, number][] {
  const cps = Array.from(text)
  const words: [number, number][] = []
  for (let i = 0; i < cps.length;) {
    if (isWs(cps[i])) { i++; continue }
    let j = i
    while (j < cps.length && !isWs(cps[j])) j++
    words.push([i, j]); i = j
  }
  const sel = words.map(([a, b]) => {
    let n = 0, hit = 0
    for (let k = a; k < b; k++) { const r = chars[k]; if (!r) continue; n++; if (inside(center(r), region)) hit++ }
    return n > 0 && hit / n >= REGION_LIMITS.wordCover
  })
  const out: [number, number][] = []
  for (let w = 0; w < words.length;) {
    if (!sel[w]) { w++; continue }
    let e = w
    while (e + 1 < words.length && sel[e + 1]) e++
    out.push(...splitLong(cps, words[w][0], words[e][1]))
    w = e + 1
  }
  return out.map(([a, b]) => snapToGraphemes(text, a, b)).filter(([a, b]) => b > a && boundaryOk(text, a, b))
}
function splitLong(cps: string[], a: number, b: number): [number, number][] {
  const out: [number, number][] = []
  let lo = a
  while (b - lo > REGION_LIMITS.rangeCp) {
    let cut = lo + REGION_LIMITS.rangeCp
    while (cut > lo + 1 && !isWs(cps[cut - 1]) && !isWs(cps[cut])) cut--
    if (cut <= lo + 1) cut = lo + REGION_LIMITS.rangeCp
    let end = cut; while (end > lo && isWs(cps[end - 1])) end--
    if (end > lo) out.push([lo, end])
    lo = cut; while (lo < b && isWs(cps[lo])) lo++
  }
  if (b > lo) out.push([lo, b])
  return out
}
/** Khung bao TRỌN lá (mọi dòng) ⇒ cả lá, không cần đo từng ký tự. */
const fullyInside = (rects: Rect[], g: Rect) => rects.length > 0 && rects.every(r => r.x >= g.x - 1 && r.y >= g.y - 1 && r.x + r.w <= g.x + g.w + 1 && r.y + r.h <= g.y + g.h + 1)

/** KHUNG → NEO. Chỉ giữ khối mà khung thực sự bao một phần tử; trong khối chỉ giữ ĐÚNG đoạn chữ / ô nhịp được bao. */
export function buildParts(region: Rect, secs: SectionProbe[]): BuildResult {
  if (region.w < REGION_LIMITS.minSide || region.h < REGION_LIMITS.minSide) return { ok: false, reason: 'tooSmall' }
  const parts: RegionPart[] = []
  let ranges = 0
  for (const s of secs) {
    const cut = intersect(s.box, region)
    if (!cut) continue
    const leaves: RegionLeaf[] = []
    for (const l of s.leaves) {
      if (coverage(l.rects, region) <= 0) continue
      const total = cpLen(l.text)
      let r: [number, number][]
      if (fullyInside(l.rects, region)) {
        const cps = Array.from(l.text); let a = 0, b = cps.length
        while (a < b && isWs(cps[a])) a++
        while (b > a && isWs(cps[b - 1])) b--
        r = b > a ? splitLong(cps, a, b) : []
      } else r = total > 0 ? pickRanges(l.text, l.chars(), region) : []
      if (!r.length) continue
      if (r.length > REGION_LIMITS.rangesPerLeaf) return { ok: false, reason: 'tooManyRanges' }
      ranges += r.length
      leaves.push({ p: l.path, r })
    }
    if (leaves.length > REGION_LIMITS.leaves) return { ok: false, reason: 'tooManyLeaves' }
    const scores: RegionScore[] = []
    for (const sc of s.scores) {
      const hit = sc.bars.filter(b => coverage([b.rect], region) >= REGION_LIMITS.barCover).map(b => b.index)
      if (!hit.length) continue
      const from = Math.min(...hit) + 1, to = Math.max(...hit) + 1
      if (to - from + 1 > REGION_LIMITS.bars) return { ok: false, reason: 'tooManyBars' }
      scores.push({ p: sc.p, from, to })
    }
    if (scores.length > REGION_LIMITS.scores) return { ok: false, reason: 'tooManyBars' }
    // Khối có phần tử gốc nhưng khung không bao cái nào (chỉ chạm lề / khoảng trống) ⇒ KHÔNG đưa vào. Khối KHÔNG có phần tử gốc (hình ảnh…) ⇒ giữ bằng hộp.
    const hasAnchors = s.leaves.length > 0 || s.scores.length > 0
    if (hasAnchors && !leaves.length && !scores.length) continue
    const box: [number, number, number, number] = [
      permille((cut.x - s.box.x) / s.box.w), permille((cut.y - s.box.y) / s.box.h),
      permille((cut.x + cut.w - s.box.x) / s.box.w), permille((cut.y + cut.h - s.box.y) / s.box.h),
    ]
    if (box[2] <= box[0]) box[2] = Math.min(1000, box[0] + 1)
    if (box[3] <= box[1]) box[3] = Math.min(1000, box[1] + 1)
    parts.push({ sec: s.sec, box, leaves, scores })
  }
  if (!parts.length) return { ok: false, reason: 'empty' }
  if (parts.length > REGION_LIMITS.parts) return { ok: false, reason: 'tooManyParts' }
  if (ranges > REGION_LIMITS.ranges) return { ok: false, reason: 'tooManyRanges' }
  return { ok: true, parts }
}
const permille = (f: number) => Math.max(0, Math.min(1000, Math.round(f * 1000)))

export type DrawnPart = { sec: number; rects: Rect[]; outline: Rect | null; approx: boolean }
/** NEO → HÌNH VẼ (theo DOM hiện tại). `approx` = phần không có phần tử gốc, vẽ bằng ‰ của hộp khối (gần đúng). */
export function drawParts(parts: RegionPart[], lookup: {
  section: (sec: number) => Rect | null
  leaf: (sec: number, path: string[], ranges: [number, number][]) => Rect[]
  bars: (sec: number, p: string[], from: number, to: number) => Rect[]
}): DrawnPart[] {
  const out: DrawnPart[] = []
  for (const p of parts) {
    const rects: Rect[] = []
    for (const l of p.leaves) rects.push(...lookup.leaf(p.sec, l.p, l.r))
    for (const s of p.scores) rects.push(...lookup.bars(p.sec, s.p, s.from, s.to))
    let approx = false
    if (!p.leaves.length && !p.scores.length) {
      const sb = lookup.section(p.sec)
      if (sb) { approx = true; rects.push({ x: sb.x + sb.w * p.box[0] / 1000, y: sb.y + sb.h * p.box[1] / 1000, w: sb.w * (p.box[2] - p.box[0]) / 1000, h: sb.h * (p.box[3] - p.box[1]) / 1000 }) }
    }
    out.push({ sec: p.sec, rects, outline: unionRect(rects, 6), approx })
  }
  return out
}
export function unionRect(rs: Rect[], pad = 0): Rect | null {
  if (!rs.length) return null
  const x0 = Math.min(...rs.map(r => r.x)), y0 = Math.min(...rs.map(r => r.y))
  const x1 = Math.max(...rs.map(r => r.x + r.w)), y1 = Math.max(...rs.map(r => r.y + r.h))
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad }
}

/** Tóm tắt cho người soạn: "3 khối · 2 đoạn chữ · 1 bản nhạc (ô 2–5)". */
export function summarize(parts: RegionPart[]): string {
  const ranges = parts.reduce((n, p) => n + p.leaves.reduce((m, l) => m + l.r.length, 0), 0)
  const scores = parts.flatMap(p => p.scores)
  const areas = parts.filter(p => !p.leaves.length && !p.scores.length).length
  const bits = [`${parts.length} khối`]
  if (ranges) bits.push(`${ranges} đoạn chữ`)
  if (scores.length) bits.push(scores.length === 1 ? `bản nhạc (${scores[0].from === scores[0].to ? 'ô ' + scores[0].from : `ô ${scores[0].from}–${scores[0].to}`})` : `${scores.length} bản nhạc`)
  if (areas) bits.push(`${areas} vùng hình/khoảng trống (gần đúng)`)
  return bits.join(' · ')
}

/** Đoạn chữ cần tô theo từng lá: khoá `${sec}:${path}` (cùng hệ data-tp). */
export function marksByLeaf(parts: RegionPart[]): Map<string, [number, number][]> {
  const m = new Map<string, [number, number][]>()
  for (const p of parts) for (const l of p.leaves) m.set(`${p.sec}:${l.p.join('.')}`, l.r)
  return m
}
/** Cắt chuỗi lá thành các đoạn [thường | tô | thường | …] theo ĐIỂM MÃ; trả null nếu đoạn không khớp lá (fail-closed: không tô). */
export function splitByRanges(text: string, ranges: [number, number][]): { t: string; hl: boolean }[] | null {
  const n = cpLen(text)
  let prev = 0
  const out: { t: string; hl: boolean }[] = []
  for (const [a, b] of ranges) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < prev || b <= a || b > n || !boundaryOk(text, a, b)) return null
    if (a > prev) out.push({ t: cpSlice(text, prev, a), hl: false })
    out.push({ t: cpSlice(text, a, b), hl: true })
    prev = b
  }
  if (prev < n) out.push({ t: cpSlice(text, prev, n), hl: false })
  return out
}

/** Kiểm dữ liệu phần do server trả (dữ liệu lạ ⇒ null, không đoán). */
export function parseRegionParts(raw: unknown): RegionPart[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > REGION_LIMITS.parts) return null
  const pathOk = (p: unknown): p is string[] => Array.isArray(p) && p.length >= 1 && p.length <= 5 && p.every(x => typeof x === 'string' && /^(text|items|steps|blocks|rows|tex|layers|pieces|[0-9]{1,3})$/.test(x))
  const out: RegionPart[] = []
  for (const e of raw as Record<string, unknown>[]) {
    if (!e || !Number.isInteger(e.sec) || (e.sec as number) < 0) return null
    const b = e.box
    if (!Array.isArray(b) || b.length !== 4 || !b.every(n => Number.isInteger(n) && n >= 0 && n <= 1000) || b[0] >= b[2] || b[1] >= b[3]) return null
    if (!Array.isArray(e.leaves) || e.leaves.length > REGION_LIMITS.leaves) return null
    for (const l of e.leaves as Record<string, unknown>[]) {
      if (!l || !pathOk(l.p) || !Array.isArray(l.r) || l.r.length < 1 || l.r.length > REGION_LIMITS.rangesPerLeaf) return null
      let prev = 0
      for (const r of l.r as unknown[]) {
        if (!Array.isArray(r) || r.length !== 2 || !Number.isInteger(r[0]) || !Number.isInteger(r[1]) || r[0] < prev || r[1] <= r[0]) return null
        prev = r[1]
      }
    }
    if (!Array.isArray(e.scores) || e.scores.length > REGION_LIMITS.scores) return null
    for (const s of e.scores as Record<string, unknown>[]) if (!s || !pathOk(s.p) || !Number.isInteger(s.from) || !Number.isInteger(s.to) || (s.from as number) < 1 || (s.to as number) < (s.from as number)) return null
    out.push({ sec: e.sec as number, box: b as RegionPart['box'], leaves: e.leaves as RegionLeaf[], scores: e.scores as RegionScore[] })
  }
  return out
}
