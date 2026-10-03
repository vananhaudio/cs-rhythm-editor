import type { RhythmScrollData } from '../../rhythm-scroll/index.ts'

// ══════════════════════════════════════════════════════════════════════════
// DEMO TIMING — NOT VISION VERIFIED
// "Chuyến Tàu Hoàng Hôn" — CHỈ để thử trải nghiệm trên máy local.
// • Số ô nhịp là GIẢ ĐỊNH, chưa đối chiếu bản nhạc. KHÔNG dùng làm dữ liệu canonical.
// • Hai dòng đầu là lời + hợp âm Owner đã cung cấp. Các dòng "(dòng mẫu …)" là CHỖ TRỐNG:
//   Owner dán lời + hợp âm thật vào đúng vị trí đó (mỗi câu một dòng, hợp âm dạng [Am]).
// • File này chỉ được nạp bởi trang proof chạy ở chế độ DEV — không vào bundle production.
// ══════════════════════════════════════════════════════════════════════════

export const DEMO_TITLE = 'Chuyến Tàu Hoàng Hôn'
export const DEMO_DEFAULT_BPM = 72

export const DEMO_TEXT = [
  'Chiều [Am] nao, tiễn nhau [E7] đi khi bóng ngả xế [Am] tàn',
  'Hoàng [Dm] hôn đến đâu [G] đây màu tím dâng trong hồn [C] ta',
  '(dòng [Am] mẫu 3 — dán câu thứ ba [Dm] vào đây, giữ hợp âm trong [E7] ngoặc vuông)',
  '(dòng [Am] mẫu 4 — câu này cố ý dài hơn hẳn để thử trường hợp một câu [Dm] bị xuống hàng trên màn hình điện thoại [E7] hẹp)',
  '(dòng [C] mẫu 5 — điệp khúc, câu [G] một)',
  '(dòng [Am] mẫu 6 — điệp khúc, câu [E7] hai)',
  '(dòng [F] mẫu 7 — điệp khúc, câu [C] ba)',
  '(dòng [Dm] mẫu 8 — điệp khúc, câu [E7] bốn)',
  '(dòng [Am] mẫu 9 — câu [E7] kết [Am] bài)',
].join('\n')

export const DEMO_DATA: RhythmScrollData = {
  version: 1,
  songId: 'demo:chuyen-tau-hoang-hon',
  lyricsHash: 'demo-not-hashed',
  meter: { beats: 4, beatType: 4 },
  totalMeasures: 52,
  segments: [
    { line: null, measureCount: 4, label: 'Dạo' },
    { line: 0, measureCount: 4 },
    { line: 1, measureCount: 4 },
    { line: 2, measureCount: 4 },
    { line: 3, measureCount: 4 },
    { line: 4, lineCount: 2, measureCount: 8, label: 'ĐK' },
    { line: 6, lineCount: 2, measureCount: 8 },
    { line: null, measureCount: 4, label: 'Gian tấu' },
    // Điệp khúc hát lại: trải phẳng theo thứ tự biểu diễn.
    { line: 4, lineCount: 2, measureCount: 8, label: 'ĐK' },
    { line: 8, measureCount: 4, label: 'Kết' },
  ],
  provenance: {
    sourceType: 'manual',
    sourceHash: 'demo-not-hashed',
    generator: 'rhythm-scroll-viewer proof (DEMO TIMING — NOT VISION VERIFIED)',
    generatedAt: '2026-10-03T00:00:00.000Z',
  },
}
