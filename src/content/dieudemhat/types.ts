// ── ĐIỆU ĐỆM HÁT — content model (nguồn nội dung chuẩn, V1) ──
// MỘT nguồn → nhiều đầu ra (web /dieudemhat, app, sách/PDF). File trong thư mục này CHỈ
// chứa dữ liệu thuần: không React, không Supabase, không CSS. Trình bày nằm ở src/dieudemhat/.
// Chỉ dùng cú pháp TS xoá được (type/interface) để Node đọc trực tiếp khi kiểm:
//   node docs/giao-trinh/tools/check-dieudemhat.mjs
//
// Quy tắc nội dung:
// - Mọi trường KHÔNG thuộc `editorial` là chữ học sinh đọc: ngắn, trực tiếp, không từ nội bộ.
// - Chỉ ghi điều Owner đã cung cấp. Thiếu dữ liệu → để trống trường tuỳ chọn + ghi `editorial.missing`.
// - Ký âm là dữ liệu của âm hình theo format StrumScore (RhythmFigure/FigureStroke trong
//   src/elearn/strumPatterns.ts) — không phải ảnh, không có format tiết tấu thứ hai.
//   Mỗi event = một FigureStroke { frac (trường độ trong phách), label, act, dir?, accent? }.
//   Bùm, Chát, Bass, số dây… là EVENT chiếm đúng trường độ của nó, không phải chú thích.
import type { FigureStroke } from '../../elearn/strumPatterns.ts'

/** Ký âm StrumScore của một âm hình: một ô nhịp, mỗi phần tử `beats` = các event trong 1 phách. */
export interface StrumNotation {
  beatsPerBar: 2 | 3 | 4
  beats: FigureStroke[][]    // độ dài = beatsPerBar; tổng frac mỗi phách = 1
}

/** Một âm hình trong thư viện — dùng lại được ở nhiều điệu (vd Quạt Ballad ở Ballad và Bolero). */
export interface Pattern {
  id: string                 // ổn định, kebab-case: 'ballad-moc-chum-2'
  name: string               // 'Móc Chùm 2'
  family?: string            // họ âm hình khi dùng chung giữa các điệu: 'Quạt Ballad'
  /** Ký âm StrumScore. Bỏ trống khi CHƯA đủ dữ liệu để ký âm chính xác (không đoán). */
  strum?: StrumNotation
  guitar: string             // ký hiệu guitar: 'B – 3 – (21) – 3'
  legend?: string            // giải nghĩa ký hiệu, một dòng: 'B = Bass · 3 = dây 3'
  durations?: string         // trường độ theo thứ tự: 'Đơn – Kép – Kép – …'
  length?: string            // 'Mẫu dài 2 phách, đàn 2 lần là đủ một ô nhịp.'
  tempo?: string             // '♩ = 65'
  howTo: string              // cách thực hiện, một câu
  // Điểm thực hành sau âm hình. Bỏ trống → câu trung tính của template (không đặt yêu cầu chuyên môn).
  practiceTask?: string      // học sinh phải làm gì: 'Đàn chậm 5 lần liên tục…'
  completionCue?: string     // khi nào được đi tiếp: 'Khi giữ đều nhịp…'
}

export type SectionKind = 'loi1' | 'loi2' | 'diepkhuc' | 'loi3'

export const SECTION_LABEL: Record<SectionKind, string> = {
  loi1: 'Lời 1', loi2: 'Lời 2', diepkhuc: 'Điệp khúc', loi3: 'Lời 3',
}

export interface Section {
  kind: SectionKind
  /** Mục tiêu / cường độ của phần: 'Nhẹ, thoáng, phù hợp mở đầu' */
  intensity: string
  /** Id âm hình. Một id = một cách đệm; nhiều id = các lựa chọn (Lựa chọn 1 / Lựa chọn 2). */
  patterns: string[]
  /** Câu hướng dẫn chọn khi có nhiều lựa chọn */
  choiceNote?: string
  /** Phần này dùng lại cách đệm của phần khác (Lời 3 = Lời 2) — không lặp nội dung */
  reuseOf?: SectionKind
}

export interface RhythmStyle {
  id: string                 // 'ballad' — cũng là slug URL /dieudemhat/<id>
  /** 'draft' = Owner chưa duyệt nội dung → chỉ hiện ở chế độ biên soạn */
  status?: 'draft' | 'review'
  name: string               // 'Ballad'
  meter: string              // '4/4'
  beatDivision: string       // cách chia phách, ngôn ngữ học sinh
  traits: string[]           // đặc điểm cần biết, ngắn
  count?: string             // câu đếm: '1-trip-let | 2-trip-let | …'
  sections: Section[]        // đúng thứ tự Lời 1 → Lời 2 → Điệp khúc → Lời 3
  /** Một câu dưới sơ đồ ghép cả bài */
  flowNote?: string
  practiceNotes: string[]    // lưu ý khi đệm: cường độ, chuyển đoạn, giữ nhịp, lỗi thường gặp
  exercise?: string          // bài tập thực hành; bỏ trống nếu Owner chưa đưa
  editorial: EditorialNotes  // KHÔNG BAO GIỜ hiển thị cho học sinh
}

/** Ghi chú biên soạn — chỉ cho người soạn/duyệt. Renderer học sinh không đọc trường này. */
export interface EditorialNotes {
  sources: string[]          // nguồn, ngày chốt, tài liệu gốc
  missing: string[]          // dữ liệu Owner còn cần bổ sung
  notes?: string[]           // quyết định trình bày, quy ước riêng
}
