// ── Schema tài liệu học (Lesson Document) — dùng chung cho 24 buổi SOLO-01 ──
// Một buổi = LessonDoc (metadata) + danh sách section. Bật/tắt section tuỳ buổi:
// chỉ cần KHÔNG khai báo section đó trong mảng `sections`.
// Nội dung nhạc lưu ở dạng CÓ CẤU TRÚC (alphaTex) → alphaTab render khuông + TAB.

export interface LessonMeta {
  programCode: string        // 'SOLO01'
  programName: string        // 'SOLO GUITAR CĂN BẢN'
  sessionNo: number          // 1..24
  title: string              // tiêu đề buổi
  stageLabel?: string        // 'Chặng 1 · Từ giai điệu đến Solo Guitar'
  backHref?: string          // '/solo01'
}

/** Một nốt trên bản đồ cần đàn. string: 1 = Mi cao … 6 = Mi trầm (chuẩn alphaTab). */
export interface FretDot {
  string: number
  fret: number
  name: string               // 'C'
  nameVi?: string            // 'Đô'
  zone: number               // 1 | 2 | 3
  root?: boolean             // tô đậm (nốt trụ)
}

export interface FretZone {
  no: number
  label: string              // 'Vùng 1 — Đầu cần'
  tag?: string               // nhãn ngắn vẽ trên sơ đồ (mặc định 'VÙNG {no}')
  fromFret: number
  toFret: number
  strings: [number, number]  // [dây cao nhất, dây thấp nhất] theo số dây (1..6)
  hint?: string
  color: string
  /** true = chỉ dùng để phân MÀU + chú thích, không vẽ khung vùng trên sơ đồ
   *  (vd nhóm theo quãng tám — các nốt cùng quãng tám không nằm gọn một ô chữ nhật) */
  hidden?: boolean
}

export type LessonSection =
  | { kind: 'objectives'; title?: string; items: string[] }
  | { kind: 'note'; title?: string; text: string }
  | {
      kind: 'fretboard'
      title: string
      lead?: string
      frets: number             // số ngăn hiển thị
      zones: FretZone[]
      dots: FretDot[]
      legend?: string[]
    }
  | {
      kind: 'score'
      title: string
      subtitle?: string
      lead?: string
      tex: string               // alphaTex (khuông + TAB)
      tempo?: string            // '♩ = 60'
      guidance?: string[]       // gạch đầu dòng ngắn dưới bản nhạc
      marks?: { at: string; text: string }[]   // chú thích chuyển vùng
    }
  | {
      kind: 'repertoire'
      title: string
      candidates: string[]
      status: 'pending' | 'ready'
      pendingText?: string
      /** bản nhạc thật (khuông + TAB) khi giáo viên đã cung cấp nguồn */
      pieces?: {
        title: string
        composer?: string
        note?: string          // giọng / vùng / cách dùng
        tex: string            // alphaTex sinh từ MusicXML
        tempo?: string
        barsPerRow?: number    // hạ xuống 3 khi bản nhạc có lời, cho chữ đủ chỗ
        marks?: { at: string; text: string }[]
        guidance?: string[]
      }[]
      annotationTypes?: string[]
      assets?: { label: string; href: string; type: 'musicxml' | 'pdf' | 'svg' | 'tab' | 'audio' | 'video' }[]
    }
  | { kind: 'assignment'; title?: string; items: { label: string; text: string }[]; message?: string }
  | { kind: 'checklist'; title?: string; items: string[] }
  | { kind: 'studentNotes'; title?: string; lines?: number }

export interface LessonDoc {
  meta: LessonMeta
  sections: LessonSection[]
}
