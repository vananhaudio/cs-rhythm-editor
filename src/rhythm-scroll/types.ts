// ── RHYTHM SCROLL — hợp đồng dữ liệu V1 ──
// Một bài = dãy ĐOẠN theo THỨ TỰ BIỂU DIỄN, mỗi đoạn dài N ô nhịp. Người chơi chỉ nhìn lời + hợp âm;
// bản nhạc PDF/ảnh/MusicXML chỉ dùng ở khâu tiền xử lý để suy ra các con số này.
//
// Dữ liệu canonical KHÔNG chứa: BPM (tempo là của consumer), pixel, trạng thái UI, toạ độ trang.
// V1 không giải repeat/volta/D.S./Coda: đoạn lặp đã được trải phẳng thành các segment nối tiếp.

export interface RhythmScrollMeter {
  beats: number;
  beatType: number;
}

export type RhythmScrollSourceType = "pdf" | "image" | "musicxml" | "manual";

export interface RhythmScrollSegment {
  /** Dòng bắt đầu (0-based) trong văn bản lời + hợp âm chuẩn; null = đoạn không lời (dạo, gian tấu). */
  line: number | null;
  /** Số dòng đoạn này phủ; mặc định 1. Không dùng khi `line` là null. */
  lineCount?: number;
  /** Số Ô NHỊP của đoạn — số nguyên ≥ 1. */
  measureCount: number;
  label?: string;
  /** 0..1 — chỉ để người duyệt biết chỗ nào cần xem lại; runtime không dùng. */
  confidence?: number;
}

export interface RhythmScrollProvenance {
  sourceType: RhythmScrollSourceType;
  sourceHash: string;
  generator: string;
  /** ISO 8601. */
  generatedAt: string;
  /** ISO 8601; vắng mặt = chưa có người duyệt. */
  reviewedAt?: string;
}

export interface RhythmScrollData {
  version: 1;
  songId: string;
  /** Mã băm của văn bản lời + hợp âm chuẩn mà các chỉ số `line` căn theo. */
  lyricsHash: string;
  meter: RhythmScrollMeter;
  /** Phải bằng tổng `measureCount` của mọi segment. */
  totalMeasures: number;
  segments: RhythmScrollSegment[];
  provenance: RhythmScrollProvenance;
}

export interface RhythmScrollIssue {
  /** Đường dẫn tới trường lỗi, ví dụ "segments[2].measureCount". */
  path: string;
  message: string;
}

export type RhythmScrollValidation =
  | { ok: true; data: RhythmScrollData }
  | { ok: false; issues: RhythmScrollIssue[] };

export type RhythmScrollState = "before" | "active" | "ended";

export interface RhythmScrollPosition {
  state: RhythmScrollState;
  /** Ô nhịp hiện tại, 0-based. before → 0; ended → ô cuối. */
  measureIndex: number;
  /** Tiến trình trong ô hiện tại, 0..1. before → 0; ended → 1. */
  measureProgress: number;
  /** Segment hiện tại, 0-based. before → 0; ended → segment cuối. */
  segmentIndex: number;
  /** Tiến trình trong segment hiện tại, 0..1. */
  segmentProgress: number;
  /** Tiến trình cả bài tính theo ô nhịp, 0..1, liên tục và không giảm. */
  scrollProgress: number;
}

export interface RhythmScroll {
  readonly totalMeasures: number;
  /**
   * `measurePosition` là vị trí liên tục theo Ô NHỊP: 0 = đầu ô 1, 0.5 = giữa ô 1, 4.25 = 25% ô thứ 5.
   * Engine không có đồng hồ: consumer đưa vị trí vào mỗi lần cần biết.
   */
  locate(measurePosition: number): RhythmScrollPosition;
}
