// Contextual Share V2 — neo VĂN BẢN: lõi THUẦN phía client (không DOM / mạng; test trên Node). Thiết kế: docs/CONTEXTUAL-SHARE-V2-TEXT.md (§14–§16).
// QUY TẮC VÀNG: toạ độ neo luôn là ĐIỂM MÃ (code point), 0-based, nửa mở [from, to) — đúng đơn vị của PostgreSQL (substr/char_length, CSDL UTF8).
// JavaScript/DOM dùng UTF-16 → CHỈ đi qua cpLen / cpSlice / cpToUtf16 / utf16ToCp. CẤM .length/.slice trên toạ độ neo.
// KHÔNG chuẩn hoá Unicode ở bất cứ đâu (NFC ≠ NFD ⇒ băm khác ⇒ stale: fail-closed).
// Server tự cắt đoạn chọn rồi tự băm; client chỉ KIỂM TRA LẠI (verifyAnchor) trước khi tô — lệch ⇒ KHÔNG tô.

export const TEXT_MIN_NON_SPACE = 4      // đoạn chọn tối thiểu: 4 ký tự không phải khoảng trắng
export const TEXT_MAX_CP = 500           // tối đa 500 điểm mã

/** Neo văn bản trong giáo trình hiện hành: khối (chỉ số mảng) + đường dẫn tới LÁ + khoảng điểm mã */
export type TextAnchor = { section: number; path: string[]; from: number; to: number }

// ───────────────────────── Chỉ số điểm mã ↔ UTF-16 ─────────────────────────
export const cpLen = (s: string): number => Array.from(s).length
export const cpSlice = (s: string, a: number, b: number): string => Array.from(s).slice(a, b).join('')
/** chỉ số điểm mã → chỉ số UTF-16; -1 nếu vượt độ dài */
export function cpToUtf16(s: string, cp: number): number {
  let u = 0, i = 0
  for (const ch of s) { if (i === cp) return u; u += ch.length; i++ }
  return i === cp ? u : -1
}
/** chỉ số UTF-16 (DOM Range) → điểm mã; -1 nếu rơi GIỮA cặp thay thế */
export function utf16ToCp(s: string, u16: number): number {
  let u = 0, i = 0
  for (const ch of s) { if (u === u16) return i; if (u > u16) return -1; u += ch.length; i++ }
  return u === u16 ? i : -1
}

// ───────────────────────── Biên không cắt giữa cụm ký tự ─────────────────────────
// Dải khớp đúng quy tắc server (share_text_boundary_ok): dấu tổ hợp, biến thể, ZWJ, skin-tone.
// eslint-disable-next-line no-misleading-character-class -- dải dấu tổ hợp/ZWJ/VS/skin-tone là CHỦ Ý
const COMBINING_OR_JOINER = /^[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︀-️︠-︯‍\u{1f3fb}-\u{1f3ff}]/u
const ZWJ = '‍'
/** Biên [a,b) hợp lệ: ký tự đầu, ký tự ngay SAU vùng chọn không là dấu tổ hợp/ZWJ/VS/skin-tone; ký tự cuối không là ZWJ. */
export function boundaryOk(text: string, a: number, b: number): boolean {
  const cps = Array.from(text)
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b > cps.length || b <= a) return false
  if (COMBINING_OR_JOINER.test(cps[a])) return false
  if (b < cps.length && COMBINING_OR_JOINER.test(cps[b])) return false
  return cps[b - 1] !== ZWJ
}

type Seg = { segment: string }
type SegmenterLike = { segment: (s: string) => Iterable<Seg> }
const segmenter = (): SegmenterLike | null => {
  const I = (globalThis as { Intl?: { Segmenter?: new (l: string, o: { granularity: string }) => SegmenterLike } }).Intl
  try { return I?.Segmenter ? new I.Segmenter('vi', { granularity: 'grapheme' }) : null } catch { return null }
}
/** Tập ranh giới grapheme (theo điểm mã). Không có Intl.Segmenter ⇒ dùng quy tắc dải ký tự ở trên. */
function graphemeCuts(text: string): Set<number> {
  const cuts = new Set<number>([0])
  const seg = segmenter()
  const cps = Array.from(text)
  if (seg) { let cp = 0; for (const g of seg.segment(text)) { cuts.add(cp); cp += cpLen(g.segment) } cuts.add(cp); return cuts }
  for (let i = 1; i < cps.length; i++) if (!COMBINING_OR_JOINER.test(cps[i]) && cps[i - 1] !== ZWJ) cuts.add(i)
  cuts.add(cps.length)
  return cuts
}
/** Co biên RA NGOÀI tới ranh giới grapheme gần nhất (chỉ làm tròn tới ký tự trọn, không đổi ý định). */
export function snapToGraphemes(text: string, a: number, b: number): [number, number] {
  const cuts = graphemeCuts(text), n = cpLen(text)
  let lo = a, hi = b
  while (lo > 0 && !cuts.has(lo)) lo--
  while (hi < n && !cuts.has(hi)) hi++
  return [lo, hi]
}

// ───────────────────────── Lá văn bản hợp lệ (đúng 6 loại khối MVP) ─────────────────────────
export type Leaf = { path: string[]; text: string }
const isBlank = (c: string) => /^\s*_{2,}\s*$/.test(c)
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
/** Cùng thứ tự + cùng danh sách với SQL share_text_leaves (test đối chiếu hai bên trên cùng fixture). */
export function textLeaves(section: unknown): Leaf[] {
  const out: Leaf[] = []
  if (!obj(section)) return out
  const push = (path: (string | number)[], t: unknown) => { if (typeof t === 'string' && t.length > 0 && !isBlank(t)) out.push({ path: path.map(String), text: t }) }
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  switch (section.kind) {
    case 'note': push(['text'], section.text); break
    case 'objectives': case 'checklist': arr(section.items).forEach((t, k) => push(['items', k], t)); break
    case 'recap': arr(section.steps).forEach((st, i) => { if (obj(st)) arr(st.items).forEach((t, k) => push(['steps', i, 'items', k], t)) }); break
    case 'assignment': arr(section.items).forEach((it, k) => { if (obj(it)) push(['items', k, 'text'], it.text) }); break
    case 'study': arr(section.blocks).forEach((bl, j) => {
      if (!obj(bl)) return
      if (bl.b === 'h' || bl.b === 'p' || bl.b === 'callout') push(['blocks', j, 'text'], bl.text)
      else if (bl.b === 'ul' || bl.b === 'ol') arr(bl.items).forEach((t, k) => push(['blocks', j, 'items', k], t))
      else if (bl.b === 'table') arr(bl.rows).forEach((r, ri) => arr(r).forEach((c, ci) => push(['blocks', j, 'rows', ri, ci], c)))
    }); break
  }
  return out
}
export const leafKey = (section: number, path: readonly string[]) => `${section}:${path.join('.')}`
export function leafTextAt(sections: unknown, a: { section: number; path: string[] }): string | null {
  if (!Array.isArray(sections)) return null
  return textLeaves(sections[a.section]).find(l => l.path.join('.') === a.path.join('.'))?.text ?? null
}

// ───────────────────────── Phân loại vùng chọn của người dùng (§14) ─────────────────────────
export type SelectionVerdict =
  | { status: 'ok'; anchor: TextAnchor; text: string }
  | { status: 'multi' | 'outside' | 'short' | 'long' | 'empty' }
export const SELECTION_HINT: Record<Exclude<SelectionVerdict['status'], 'ok' | 'empty'>, string> = {
  multi: 'Bạn đang chọn nhiều đoạn. Hãy chọn trong một đoạn.',
  outside: 'Phần này chưa chia sẻ được. Hãy chọn trong nội dung văn bản.',
  short: 'Đoạn chọn quá ngắn. Hãy chọn từ 4 ký tự trở lên.',
  long: 'Đoạn chọn dài quá 500 ký tự. Hãy chọn ngắn hơn.',
}
const nonSpaceCount = (s: string) => Array.from(s).filter(c => !/\s/u.test(c)).length

/** Vùng chọn NẰM TRONG MỘT LÁ (đã biết chuỗi nguồn của lá + offset UTF-16 trong lá) → neo hoặc lý do không hợp lệ.
 *  Chỉ làm tròn tới ranh giới grapheme TRONG cùng lá; không bao giờ co/giãn qua lá khác. */
export function classifyInLeaf(section: number, path: string[], leaf: string, u16Start: number, u16End: number): SelectionVerdict {
  let a = utf16ToCp(leaf, Math.min(u16Start, u16End)), b = utf16ToCp(leaf, Math.max(u16Start, u16End))
  if (a < 0 || b < 0) return { status: 'outside' }
  const cps = Array.from(leaf)
  while (a < b && /\s/u.test(cps[a])) a++            // cắt khoảng trắng đầu / cuối
  while (b > a && /\s/u.test(cps[b - 1])) b--
  if (b <= a) return { status: 'empty' }
  ;[a, b] = snapToGraphemes(leaf, a, b)
  const text = cpSlice(leaf, a, b)
  if (b - a > TEXT_MAX_CP) return { status: 'long' }
  if (nonSpaceCount(text) < TEXT_MIN_NON_SPACE) return { status: 'short' }
  if (!boundaryOk(leaf, a, b)) return { status: 'outside' }
  return { status: 'ok', anchor: { section, path, from: a, to: b }, text }
}

// ───────────────────────── Kiểm lại trước khi tô (fail-closed) ─────────────────────────
export async function sha256Hex(s: string): Promise<string | null> {
  try {
    const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle
    if (!subtle) return null
    const d = await subtle.digest('SHA-256', new TextEncoder().encode(s))
    return Array.from(new Uint8Array(d), x => x.toString(16).padStart(2, '0')).join('')
  } catch { return null }
}
/** Kiểm số học (đồng bộ): 0 ≤ from < to ≤ độ dài lá, ≤ 500 điểm mã, biên hợp lệ. */
export function anchorFits(leaf: string | null, a: { from: number; to: number }): boolean {
  if (leaf === null) return false
  return Number.isInteger(a.from) && Number.isInteger(a.to) && a.from >= 0 && a.to > a.from && a.to <= cpLen(leaf) && a.to - a.from <= TEXT_MAX_CP && boundaryOk(leaf, a.from, a.to)
}
/** Kiểm đầy đủ: số học + băm SHA-256 (UTF-8) của đoạn cắt = text_sha server trả. Lệch ⇒ false ⇒ KHÔNG tô.
 *  Không có crypto.subtle (ngữ cảnh không an toàn): chỉ còn kiểm số học (ghi nhận ở báo cáo). */
export async function verifyAnchor(sections: unknown, a: TextAnchor, sha: string): Promise<boolean> {
  const leaf = leafTextAt(sections, a)
  if (!anchorFits(leaf, a)) return false
  const h = await sha256Hex(cpSlice(leaf as string, a.from, a.to))
  return h === null ? true : h === sha
}

/** Chia lá thành [trước][đoạn tô][sau] theo UTF-16; đoạn tô được mở RA NGOÀI tới ranh giới grapheme (chỉ để hiển thị). null = không hợp lệ. */
export function splitForMark(leaf: string, from: number, to: number): [string, string, string] | null {
  if (!anchorFits(leaf, { from, to })) return null
  const [a, b] = snapToGraphemes(leaf, from, to)
  const u0 = cpToUtf16(leaf, a), u1 = cpToUtf16(leaf, b)
  return u0 < 0 || u1 < 0 ? null : [leaf.slice(0, u0), leaf.slice(u0, u1), leaf.slice(u1)]
}

// ───────────────────────── Cửa sổ ngữ cảnh trong khối 'study' ─────────────────────────
type StudyLike = { b?: string }
/** Mặc định gọn: tiêu đề `h` gần nhất phía trên + khối chứa lá + khối phụ thuộc liền sau (ul/ol/callout sau p). Khối `h` được chọn: chỉ chính nó + khối liền sau. */
export function studyCompact(blocks: StudyLike[], idx: number): number[] {
  if (!Array.isArray(blocks) || idx < 0 || idx >= blocks.length) return []
  const out: number[] = []
  if (blocks[idx]?.b !== 'h') for (let i = idx - 1; i >= 0; i--) if (blocks[i]?.b === 'h') { out.push(i); break }
  out.push(idx)
  const nx = blocks[idx + 1]
  if (nx && (blocks[idx]?.b === 'p' || blocks[idx]?.b === 'h') && nx.b !== 'h') out.push(idx + 1)
  return out
}
/** "Xem đầy đủ": cả tiểu mục — từ `h` gần nhất phía trên tới trước `h` kế tiếp, tối đa `cap` khối (luôn gồm khối được chọn). */
export function studySubsection(blocks: StudyLike[], idx: number, cap = 12): number[] {
  if (!Array.isArray(blocks) || idx < 0 || idx >= blocks.length) return []
  let start = idx
  for (let i = idx; i >= 0; i--) { if (blocks[i]?.b === 'h') { start = i; break } if (i === 0) start = 0 }
  let end = idx
  for (let i = idx + 1; i < blocks.length; i++) { if (blocks[i]?.b === 'h') break; end = i }
  let lo = start, hi = end
  while (hi - lo + 1 > cap) { if (idx - lo > hi - idx) lo++; else hi-- }   // cắt dần phía xa khối được chọn hơn
  return Array.from({ length: hi - lo + 1 }, (_, k) => lo + k)
}

/** Khung văn bản có gì để "Xem đầy đủ"? (khối study: tiểu mục rộng hơn cửa sổ gọn). Các loại khối khác được dựng nguyên khối nên không có thêm. */
export function textContextHasMore(section: unknown, a: { path: string[] }): boolean {
  if (!obj(section) || section.kind !== 'study' || a.path[0] !== 'blocks') return false
  const blocks = (Array.isArray(section.blocks) ? section.blocks : []) as StudyLike[]
  const at = Number(a.path[1])
  return studySubsection(blocks, at).length > studyCompact(blocks, at).length
}
