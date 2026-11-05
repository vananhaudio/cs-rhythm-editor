// Contextual Share V3 — "Khoanh vùng hỗn hợp": lõi THUẦN (không DOM) biến một KHUNG CHỮ NHẬT người học kéo thành NEO TÀI LIỆU, và ngược lại.
// Neo KHÔNG phải pixel: mỗi khối giáo trình bị khung chạm tới thành một PHẦN gồm
//   • leaves  — đường dẫn các LÁ VĂN BẢN (cùng hệ với V2) bị khung chạm đủ nhiều (≥ 25% diện tích các dòng chữ của lá);
//   • scores  — bản nhạc + dải ô nhịp (cùng hệ với V1.3) mà khung chạm đủ nhiều (≥ 25% diện tích ô);
//   • box     — khung theo ‰ của hộp khối: CHỈ để vẽ khi phần đó KHÔNG có phần tử gốc (hình ảnh, khoảng trống…) ⇒ gần đúng, KHÔNG phải neo chính xác.
// Vẽ lại = tra đúng phần tử đó trong DOM hiện tại ⇒ chữ tự xuống dòng / đổi font / đổi bề rộng thì vùng đi theo phần tử. Server giữ băm toàn khối (xem db/drafts/share_region_v3_setup.sql).
export type Rect = { x: number; y: number; w: number; h: number }
export type RegionScore = { p: string[]; from: number; to: number }
export type RegionPart = { sec: number; box: [number, number, number, number]; leaves: string[][]; scores: RegionScore[] }

/** Giới hạn — khớp server (share_region_build). */
export const REGION_LIMITS = { parts: 12, leaves: 40, scores: 6, bars: 64, minSide: 24, touch: 0.25 } as const

/** Một khối trong DOM, dạng THUẦN: hộp, các lá (hình chữ nhật từng dòng chữ), các bản nhạc (hộp từng ô). Mọi toạ độ cùng hệ (vd. client). */
export type SectionProbe = {
  sec: number
  box: Rect
  leaves: { path: string[]; rects: Rect[] }[]
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

export type BuildResult = { ok: true; parts: RegionPart[] } | { ok: false; reason: 'tooSmall' | 'empty' | 'tooManyParts' | 'tooManyLeaves' | 'tooManyBars' }
export const REGION_HINT: Record<Exclude<BuildResult, { ok: true }>['reason'], string> = {
  tooSmall: 'Khung quá nhỏ. Hãy kéo một khung lớn hơn.',
  empty: 'Khung chưa chạm vào nội dung giáo trình. Hãy kéo lại.',
  tooManyParts: 'Khung phủ quá nhiều khối. Hãy khoanh nhỏ lại (tối đa 12 khối).',
  tooManyLeaves: 'Khung phủ quá nhiều đoạn chữ trong một khối. Hãy khoanh nhỏ lại.',
  tooManyBars: 'Khung phủ quá nhiều ô nhịp (tối đa 64 ô). Hãy khoanh nhỏ lại.',
}

/** KHUNG → NEO. Chỉ giữ khối mà khung thực sự chạm; trong khối chỉ giữ phần tử bị chạm đủ nhiều. */
export function buildParts(region: Rect, secs: SectionProbe[]): BuildResult {
  if (region.w < REGION_LIMITS.minSide || region.h < REGION_LIMITS.minSide) return { ok: false, reason: 'tooSmall' }
  const parts: RegionPart[] = []
  for (const s of secs) {
    const cut = intersect(s.box, region)
    if (!cut) continue
    const leaves = s.leaves.filter(l => coverage(l.rects, region) >= REGION_LIMITS.touch).map(l => l.path)
    if (leaves.length > REGION_LIMITS.leaves) return { ok: false, reason: 'tooManyLeaves' }
    const scores: RegionScore[] = []
    for (const sc of s.scores) {
      const hit = sc.bars.filter(b => coverage([b.rect], region) >= REGION_LIMITS.touch).map(b => b.index)
      if (!hit.length) continue
      const from = Math.min(...hit) + 1, to = Math.max(...hit) + 1
      if (to - from + 1 > REGION_LIMITS.bars) return { ok: false, reason: 'tooManyBars' }
      scores.push({ p: sc.p, from, to })
    }
    if (scores.length > REGION_LIMITS.scores) return { ok: false, reason: 'tooManyBars' }
    // Khối chỉ chạm lề / khoảng trống của khối có phần tử gốc ⇒ KHÔNG đưa vào (tránh neo vào chỗ không có gì). Khối KHÔNG có phần tử gốc nào (hình ảnh…) ⇒ giữ bằng hộp.
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
  return { ok: true, parts }
}
const permille = (f: number) => Math.max(0, Math.min(1000, Math.round(f * 1000)))

export type DrawnPart = { sec: number; rects: Rect[]; outline: Rect | null; approx: boolean }
/** NEO → HÌNH VẼ (theo DOM hiện tại). `approx` = phần không có phần tử gốc, vẽ bằng ‰ của hộp khối (gần đúng). */
export function drawParts(parts: RegionPart[], lookup: {
  section: (sec: number) => Rect | null
  leaf: (sec: number, path: string[]) => Rect[]
  bars: (sec: number, p: string[], from: number, to: number) => Rect[]
}): DrawnPart[] {
  const out: DrawnPart[] = []
  for (const p of parts) {
    const rects: Rect[] = []
    for (const l of p.leaves) rects.push(...lookup.leaf(p.sec, l))
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

/** Tóm tắt cho người soạn: "3 khối · 4 đoạn chữ · 1 bản nhạc (ô 2–5)". */
export function summarize(parts: RegionPart[]): string {
  const leaves = parts.reduce((n, p) => n + p.leaves.length, 0)
  const scores = parts.flatMap(p => p.scores)
  const areas = parts.filter(p => !p.leaves.length && !p.scores.length).length
  const bits = [`${parts.length} khối`]
  if (leaves) bits.push(`${leaves} đoạn chữ`)
  if (scores.length) bits.push(scores.length === 1 ? `bản nhạc (${scores[0].from === scores[0].to ? 'ô ' + scores[0].from : `ô ${scores[0].from}–${scores[0].to}`})` : `${scores.length} bản nhạc`)
  if (areas) bits.push(`${areas} vùng hình/khoảng trống (gần đúng)`)
  return bits.join(' · ')
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
    if (!Array.isArray(e.leaves) || !e.leaves.every(pathOk) || e.leaves.length > REGION_LIMITS.leaves) return null
    if (!Array.isArray(e.scores) || e.scores.length > REGION_LIMITS.scores) return null
    for (const s of e.scores as Record<string, unknown>[]) if (!s || !pathOk(s.p) || !Number.isInteger(s.from) || !Number.isInteger(s.to) || (s.from as number) < 1 || (s.to as number) < (s.from as number)) return null
    out.push({ sec: e.sec as number, box: b as RegionPart['box'], leaves: e.leaves as string[][], scores: e.scores as RegionScore[] })
  }
  return out
}
