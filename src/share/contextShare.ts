// Universal Contextual Share — LÕI THUẦN (không DOM / mạng; test trên Node). Thiết kế: docs/CONTEXTUAL-SHARE-V1.md
// Hai khái niệm TÁCH RIÊNG:
//   • Focus Anchor  = phần người gửi muốn nói (lưu ở server, ổn định theo ngữ nghĩa — hôm nay: dải ô nhịp của share_notes).
//   • Context Window = phần xung quanh để người nhận hiểu (KHÔNG lưu — tính lại bằng quy tắc xác định từ giáo trình hiện hành).
// Không dùng AI, không toạ độ pixel làm định danh. Anchor không xác định chắc chắn → 'fail closed' (không đoán vị trí).
import type { BarRange, ScoreKey } from './shareNoteApi'

/** Tham chiếu nguồn: buổi + khối + đường dẫn trong khối (khối nhạc). Phiên bản = dấu vân tay sha256 của chuỗi nhạc ở SERVER. */
export type SourceRef = { sessionNo: number; score: ScoreKey }

/** Neo vùng chú ý. Chỉ 'bars' có hạ tầng lưu + khôi phục (share_notes). Các loại còn lại: HỢP ĐỒNG, chưa lưu được — xem resolveFocus. */
export type FocusAnchor =
  | { type: 'bars'; bars: BarRange }
  | { type: 'text'; section: number; block: number; start: number; end: number }
  | { type: 'region'; section: number; x: number; y: number; w: number; h: number }   // toạ độ CHUẨN HOÁ 0..1 trên hình
  | { type: 'cells'; section: number; block: number; r0: number; c0: number; r1: number; c1: number }
  | { type: 'blocks'; from: number; to: number }

export type FocusResolution =
  | { status: 'ok'; anchor: FocusAnchor }
  | { status: 'unsupported'; type: FocusAnchor['type'] }   // loại neo chưa có hạ tầng lưu: KHÔNG báo là hỗ trợ
  | { status: 'broken'; reason: string }                    // neo không còn chắc chắn: fail closed

const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Khối nhạc tại (khối, đường dẫn) trong giáo trình hiện hành: khối + phần tử con (tầng/tác phẩm) nếu có. null = không còn. */
export function locateScore(sections: unknown, key: ScoreKey): { section: Record<string, unknown>; index: number; child: Record<string, unknown> | null } | null {
  if (!Array.isArray(sections) || !Number.isInteger(key.section) || key.section < 0) return null
  const s = sections[key.section]
  if (!obj(s)) return null
  if (key.path.length === 1) return typeof s.tex === 'string' ? { section: s, index: key.section, child: null } : null
  const list = s[key.path[0]]
  const item = Array.isArray(list) ? list[Number(key.path[1])] : null
  return obj(item) && typeof item.tex === 'string' ? { section: s, index: key.section, child: item } : null
}

/** Quy tắc khung ngữ cảnh cho neo ô nhịp: tôn trọng RANH GIỚI KHỐI — khung là cả khối chứa bản nhạc (tiêu đề, mô tả, nhịp độ, tên tác phẩm) rồi
 *  đến đúng trích đoạn nhạc; khối nhạc khác trong cùng khối (tác phẩm / tầng khác) không bị kéo vào. */
export type ContextFrame = { sectionIndex: number; kind: string; child: number | null }
export function contextFrameForBars(sections: unknown, key: ScoreKey): ContextFrame | null {
  const at = locateScore(sections, key)
  if (!at) return null
  return { sectionIndex: at.index, kind: String(at.section.kind ?? ''), child: key.path.length === 3 ? Number(key.path[1]) : null }
}

// ── Văn bản (khối 'study'): HỢP ĐỒNG ngữ cảnh, kiểm chứng bằng test. Chưa có chỗ lưu neo văn bản ⇒ chưa nối vào Feed. ──
export type StudyBlockLike = { b: string }
/** Neo là một khối con của 'study': ngữ cảnh = tiêu đề mục gần nhất phía trên (nếu có) + khối đó + khối liền sau nếu nó là phần phụ thuộc (callout/list).
 *  Trả danh sách chỉ số khối con, theo thứ tự gốc. Chỉ số hỏng → null. */
export function studyContext(blocks: StudyBlockLike[], idx: number): number[] | null {
  if (!Array.isArray(blocks) || !Number.isInteger(idx) || idx < 0 || idx >= blocks.length) return null
  const out: number[] = []
  if (blocks[idx].b !== 'h') for (let i = idx - 1; i >= 0; i--) { if (blocks[i].b === 'h') { out.push(i); break } }
  out.push(idx)
  const next = blocks[idx + 1]
  if (next && blocks[idx].b === 'p' && (next.b === 'ul' || next.b === 'ol' || next.b === 'callout')) out.push(idx + 1)
  return out
}

/** Khôi phục neo từ dữ liệu đã lưu. Chỉ 'bars' được hỗ trợ thật; còn lại báo thẳng 'unsupported' (không giả vờ). */
export function resolveFocus(anchor: FocusAnchor, sections: unknown, key?: ScoreKey): FocusResolution {
  if (anchor.type !== 'bars') return { status: 'unsupported', type: anchor.type }
  if (!key || !locateScore(sections, key)) return { status: 'broken', reason: 'khối nhạc không còn' }
  const { from, to } = anchor.bars
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) return { status: 'broken', reason: 'dải ô hỏng' }
  return { status: 'ok', anchor }
}
